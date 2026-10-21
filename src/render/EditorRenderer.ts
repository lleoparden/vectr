/**
 * Editor renderer for the canvas (issue #18).
 *
 * Uses the accepted renderer path from Phase 1 slice 1b: the scene is recorded into
 * a bounded number of Skia pictures (buckets of consecutive top-level roots) and
 * replayed with one `drawPicture` call per bucket. Pan and zoom therefore cost one
 * call per bucket, not per shape, and an edit re-records only the buckets whose
 * roots actually changed.
 *
 * Memory rules: one Path per shape, one Paint per style variant in a bounded cache,
 * pictures disposed on rebuild and on close, and no per-frame allocation beyond the
 * replay loop.
 *
 * Recorded limitations for later slices:
 * - `cornerRadius` is in the model but drawn as a square corner until slice #20 or
 *   later adds rounded-rect rendering.
 * - Text and image nodes do not exist yet (#16, #17); unsupported node kinds are
 *   skipped rather than drawn wrongly.
 */

import type { BlendMode as CanvasBlendMode, Shader } from 'canvaskit-wasm'
import type { BlendMode, StrokeCap, StrokeJoin } from '../doc/types.ts'
import type { ArtboardRect } from '../doc/artboards.ts'
import { contentSignature } from './signature.ts'
import { shaderColors } from './shaders.ts'
import { booleanPolygons, type BooleanMode, type Polygon } from './boolean.ts'
import { rotatePoint } from '../geom/transform.ts'
import { flattenPath } from '../geom/path.ts'
import CanvasKitInit, {
  type Canvas,
  type CanvasKit,
  type Color,
  type Font,
  type GrDirectContext,
  type Image,
  type Paint,
  type Path,
  type SkPicture,
  type Surface,
  type Typeface,
} from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'
import fontUrl from '../assets/fonts/Inter-Variable.ttf?url'
import type { NodeId } from '../doc/types.ts'
import { DEFAULT_FONT_FAMILY } from '../doc/document.ts'
import { clampCornerRadius, outlinePoints } from '../geom/shapeGeometry.ts'
import type { Scene, SceneClip, SceneShape } from './scene.ts'

export type EditorRendererInfo = {
  backend: 'webgl' | 'cpu-fallback'
  webglAvailable: boolean
  wasmBytes: number | null
}

export type RenderStats = {
  buckets: number
  shapes: number
  lastRenderMs: number
  p95RenderMs: number
  lastBuildMs: number
  /**
   * Font families a text node asked for that Vectr does not have, which were drawn with the
   * bundled face instead (issue #16's "report the substitution" rule).
   */
  substitutedFonts: string[]
  /** Asset ids a scene asked for that the renderer never received (issue #17). */
  missingAssets: string[]
  /** Decoded images currently held, so the bound on the asset cache is observable. */
  decodedAssets: number
}

type Bucket = {
  key: string
  roots: NodeId[]
  shapes: SceneShape[]
  paths: Path[]
  picture: SkPicture | null
  signature: string
}

/** Upper bound on recorded pictures per scene, matching the measured slice 1b design. */
const MAX_BUCKETS = 16
/** Upper bound on cached paints; a larger palette evicts the batch rather than failing. */
const MAX_PAINTS = 512
const FRAME_SAMPLES = 240

export class EditorRenderer {
  private readonly paintCache = new Map<string, Paint>()
  private readonly colorCache = new Map<string, Color>()
  private readonly ownedPaths: Path[] = []
  /** One Skia font per family/size pair, bounded by the distinct sizes in the document. */
  private readonly fonts = new Map<string, Font>()
  private readonly substituted = new Set<string>()
  private typeface: Typeface | null = null
  /** Decoded images, one per asset id, disposed with the renderer. */
  /** Grid chrome: drawn on the page, under the artwork, and never recorded. */
  private grid: { visible: boolean; spacing: number } = { visible: false, spacing: 10 }

  /** Artboard pages from the last scene, drawn under the artwork. */
  private artboards: ArtboardRect[] = []

  private readonly images = new Map<string, Image>()
  private readonly missingAssets = new Set<string>()
  private buckets: Bucket[] = []
  private shapes = 0
  private viewport = { zoom: 1, panX: 0, panY: 0 }
  private surface: Surface
  private context: GrDirectContext | null
  private frameTimes: number[] = []
  private lastRenderMs = 0
  private lastBuildMs = 0

  private constructor(
    private readonly kit: CanvasKit,
    surface: Surface,
    context: GrDirectContext | null,
    private readonly webglHandle: number | null,
    readonly info: EditorRendererInfo,
  ) {
    this.surface = surface
    this.context = context
  }

  static async create(canvas: HTMLCanvasElement): Promise<EditorRenderer> {
    const kit = await CanvasKitInit({ locateFile: () => new URL(wasmUrl, document.baseURI).href })
    const wasmBytes = await readAssetBytes(wasmUrl)
    let webglHandle: number | null = null
    let context: GrDirectContext | null = null
    let surface: Surface | null = null
    try {
      const handle = kit.GetWebGLContext(canvas)
      webglHandle = handle !== null && handle >= 0 ? handle : null
      if (webglHandle !== null) {
        context = kit.MakeWebGLContext(webglHandle)
        surface =
          context === null
            ? null
            : kit.MakeOnScreenGLSurface(context, canvas.width, canvas.height, kit.ColorSpace.SRGB)
      }
    } catch {
      surface = null
    }
    if (surface === null || context === null) {
      context?.releaseResourcesAndAbandonContext()
      if (webglHandle !== null) kit.deleteContext(webglHandle)
      webglHandle = null
      context = null
      surface = kit.MakeSurface(canvas.width, canvas.height)
      if (surface === null) throw new Error('CanvasKit could not create a WebGL or CPU surface.')
    }
    const renderer = new EditorRenderer(kit, surface, context, webglHandle, {
      backend: context === null ? 'cpu-fallback' : 'webgl',
      webglAvailable: context !== null,
      wasmBytes,
    })
    await renderer.loadFont()
    return renderer
  }

  /**
   * Loads the bundled face (issue #16). CanvasKit exposes no system font manager, so text is
   * drawn with Inter — the face slice 1 chose and licensed — and any other requested family is
   * reported as a substitution rather than failing.
   */
  private async loadFont(): Promise<void> {
    try {
      const response = await fetch(new URL(fontUrl, document.baseURI).href)
      if (!response.ok) {
        console.warn(`[vectr-font] Inter could not be read (${response.status}); text will not be drawn.`)
        return
      }
      const buffer = await response.arrayBuffer()
      this.typeface = this.kit.Typeface.MakeTypefaceFromData(buffer)
      if (this.typeface === null) console.warn('[vectr-font] Inter could not be parsed; text will not be drawn.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      console.warn(`[vectr-font] Inter could not be loaded: ${message}`)
    }
  }

  /** The font for a family/size pair, substituting the bundled face and recording it. */
  private fontFor(family: string, size: number): Font | null {
    if (this.typeface === null) return null
    const requested = family.trim() === '' ? DEFAULT_FONT_FAMILY : family
    if (requested.toLowerCase() !== DEFAULT_FONT_FAMILY.toLowerCase() && !this.substituted.has(requested)) {
      this.substituted.add(requested)
      console.warn(`[vectr-font] "${requested}" is not available; drawing with ${DEFAULT_FONT_FAMILY}.`)
    }
    const key = `${requested.toLowerCase()}|${size}`
    const cached = this.fonts.get(key)
    if (cached !== undefined) return cached
    const font = new this.kit.Font(this.typeface, size)
    this.fonts.set(key, font)
    return font
  }

  /**
   * Applies a new scene, re-recording only the buckets whose roots changed. The
   * signature covers everything that affects pixels, so an unchanged bucket keeps
   * its picture and its paths.
   */
  /** Shows or hides the page grid; spacing is in scene units. */
  setGrid(grid: { visible: boolean; spacing: number }): void {
    this.grid = grid
  }

  setScene(scene: Scene): number {
    this.artboards = scene.artboards
    const started = performance.now()
    const previous = this.buckets
    const bucketCount = Math.max(1, Math.min(MAX_BUCKETS, scene.byRoot.length))
    const chunkSize = Math.max(1, Math.ceil(scene.byRoot.length / bucketCount))
    const next: Bucket[] = []

    for (let start = 0; start < scene.byRoot.length; start += chunkSize) {
      const slice = scene.byRoot.slice(start, start + chunkSize)
      const roots = slice.map((entry) => entry.root)
      const shapes = slice.flatMap((entry) => entry.shapes)
      const signature = contentSignature(shapes)
      const key = roots.join('|')
      const reusable = previous.find((bucket) => bucket.key === key && bucket.signature === signature)
      if (reusable !== undefined && reusable.picture !== null) {
        next.push(reusable)
        continue
      }
      const stale = previous.find((bucket) => bucket.key === key)
      stale?.picture?.delete()
      for (const path of stale?.paths ?? []) path.delete()
      next.push({
        key,
        roots,
        shapes,
        paths: shapes.map((shape) => this.makePath(shape)),
        picture: null,
        signature,
      })
    }

    // Buckets that no longer exist must not leak their pictures or paths.
    for (const bucket of previous) {
      if (next.some((entry) => entry.key === bucket.key)) continue
      bucket.picture?.delete()
      for (const path of bucket.paths) path.delete()
    }

    this.buckets = next
    this.shapes = scene.shapes.length
    this.lastBuildMs = performance.now() - started
    return this.lastBuildMs
  }

  /** Re-records the buckets containing the given roots (used by drags). */
  invalidateRoots(roots: NodeId[]): number {
    const started = performance.now()
    const wanted = new Set(roots)
    for (const bucket of this.buckets) {
      if (!bucket.roots.some((root) => wanted.has(root))) continue
      this.recordBucket(bucket)
    }
    return performance.now() - started
  }

  /**
   * Accepts an asset's bytes and decodes them once (issue #17). A file that cannot be decoded
   * is ignored rather than throwing, so a corrupt asset leaves an empty frame instead of
   * taking the editor down; the scene reports it through `missingAssets`.
   */
  putAsset(assetId: string, bytes: Uint8Array): boolean {
    if (this.images.has(assetId)) return true
    try {
      const image = this.kit.MakeImageFromEncoded(bytes)
      if (image === null) return false
      this.images.set(assetId, image)
      this.missingAssets.delete(assetId)
      return true
    } catch {
      return false
    }
  }

  /**
   * Keeps only the decoded images the given asset ids need, releasing the rest (issue #19's
   * "caches are derived, bounded, and explicitly disposed" constraint). A session that opens
   * several documents must not accumulate their pixels, so the canvas calls this whenever the
   * asset set changes, and `dispose` releases whatever is left.
   *
   * Returns how many decoded images were released.
   */
  retainAssets(assetIds: Set<string>): number {
    let released = 0
    for (const [assetId, image] of [...this.images]) {
      if (assetIds.has(assetId)) continue
      image.delete()
      this.images.delete(assetId)
      released += 1
    }
    return released
  }

  /**
   * Renders a top-level layer into a small PNG data URL for the Layers panel (UI enhancement).
   *
   * It reuses the bucket's already-recorded picture, so a thumbnail costs one draw and one encode
   * rather than a scene rebuild, and the caller decides how often to ask. The bounds let the
   * caller fit the layer into the square. Returns null when no picture is available yet.
   */
  renderThumbnail(
    rootId: NodeId,
    size: number,
    bounds: { x: number; y: number; width: number; height: number },
  ): string | null {
    // Only a bucket holding exactly this root can be previewed truthfully: with more top-level
    // layers than the renderer's bucket budget, a bucket holds several roots and its picture would
    // show the neighbours too, so the row keeps its placeholder instead of a misleading preview.
    const bucket = this.buckets.find((candidate) => candidate.roots.length === 1 && candidate.roots[0] === rootId)
    if (bucket === undefined) return null
    if (bucket.picture === null) this.recordBucket(bucket)
    if (bucket.picture === null) return null

    const surface = this.kit.MakeSurface(size, size)
    if (surface === null) return null
    try {
      const canvas = surface.getCanvas()
      canvas.clear(this.kit.TRANSPARENT)
      const scale = Math.min(
        size / Math.max(bounds.width, 1),
        size / Math.max(bounds.height, 1),
      )
      const offsetX = (size - bounds.width * scale) / 2
      const offsetY = (size - bounds.height * scale) / 2
      canvas.save()
      canvas.translate(offsetX - bounds.x * scale, offsetY - bounds.y * scale)
      canvas.scale(scale, scale)
      canvas.drawPicture(bucket.picture)
      canvas.restore()
      const image = surface.makeImageSnapshot()
      const bytes = image.encodeToBytes()
      image.delete()
      if (bytes === null) return null
      return `data:image/png;base64,${base64FromBytes(bytes)}`
    } catch {
      return null
    } finally {
      surface.dispose()
    }
  }

  /** Measured box for a text node (issue #16). The editor uses this so selection bounds match
   * the glyphs that are actually drawn; it returns null when no font is loaded, and callers
   * fall back to the shared estimate.
   */
  measureTextBox(
    family: string,
    fontSize: number,
    lineHeight: number,
    text: string,
  ): { width: number; height: number } | null {
    const font = this.fontFor(family, fontSize)
    if (font === null) return null
    const lines = text.split('\n')
    let width = 0
    for (const line of lines) {
      if (line.length === 0) continue
      width = Math.max(width, this.measureLine(font, line))
    }
    return { width: Math.max(1, width), height: Math.max(1, lines.length) * lineHeight }
  }

  /** Draws one frame and returns its submission time. */
  render(
    viewport: { zoom: number; panX: number; panY: number },
    selection: Array<{ x: number; y: number; width: number; height: number }> = [],
  ): number {
    const started = performance.now()
    this.viewport = viewport
    const canvas = this.surface.getCanvas()
    // The pasteboard around the page is grey, so the page reads as a bounded sheet rather than an
    // infinite white board; the pages themselves are painted white inside the viewport transform.
    canvas.clear(this.kit.Color4f(0.106, 0.106, 0.122, 1))
    canvas.save()
    canvas.translate(viewport.panX, viewport.panY)
    canvas.scale(viewport.zoom, viewport.zoom)
    this.drawArtboards(canvas)
    for (const bucket of this.buckets) {
      if (bucket.picture === null) this.recordBucket(bucket)
      if (bucket.picture !== null) canvas.drawPicture(bucket.picture)
    }
    // Selection outlines are drawn outside the pictures so they stay crisp and are
    // never baked into a recording.
    if (selection.length > 0) {
      const paint = this.selectionPaintFor(viewport.zoom)
      for (const rect of selection) {
        canvas.drawRect(this.kit.XYWHRect(rect.x, rect.y, rect.width, rect.height), paint)
      }
    }
    canvas.restore()
    this.surface.flush()
    const elapsed = performance.now() - started
    this.lastRenderMs = elapsed
    this.frameTimes.push(elapsed)
    if (this.frameTimes.length > FRAME_SAMPLES) this.frameTimes.shift()
    return elapsed
  }

  /** Recreates the surface at a new size; recorded pictures survive. */
  resize(width: number, height: number): void {
    this.surface.dispose()
    const surface =
      this.context === null
        ? this.kit.MakeSurface(width, height)
        : this.kit.MakeOnScreenGLSurface(this.context, width, height, this.kit.ColorSpace.SRGB)
    if (surface === null) throw new Error('CanvasKit could not recreate the surface after resize.')
    this.surface = surface
  }

  stats(): RenderStats {
    const sorted = [...this.frameTimes].sort((left, right) => left - right)
    const index = sorted.length === 0 ? 0 : Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)
    return {
      buckets: this.buckets.length,
      shapes: this.shapes,
      lastRenderMs: this.lastRenderMs,
      p95RenderMs: sorted[index] ?? 0,
      lastBuildMs: this.lastBuildMs,
      substitutedFonts: [...this.substituted],
      missingAssets: [...this.missingAssets],
      decodedAssets: this.images.size,
    }
  }

  /** Paints each artboard page, so multiple pages are visibly separate (issue #67). */
  private drawArtboards(canvas: Canvas): void {
    if (this.artboards.length === 0) return
    const zoom = this.viewport?.zoom ?? 1
    const page = this.paintFor('fill', '#ffffff', 0, 1)
    const edge = this.pageEdgePaintFor(zoom)
    // A soft shadow keeps the page edge legible on the grey pasteboard at any zoom.
    const shadow = this.paintFor('fill', '#000000', 0, 0.28)
    for (const artboard of this.artboards) {
      const rect = this.kit.XYWHRect(artboard.x, artboard.y, artboard.width, artboard.height)
      canvas.drawRect(
        this.kit.XYWHRect(artboard.x + 2 / zoom, artboard.y + 3 / zoom, artboard.width, artboard.height),
        shadow,
      )
      canvas.drawRect(rect, page)
      if (this.grid.visible) this.drawGrid(canvas, artboard, zoom)
      canvas.drawRect(rect, edge)
    }
  }

  /** Builds a shape's clip polygon as a Skia path in world coordinates. */
  private clipPathFor(clip: SceneClip): Path {
    const builder = new this.kit.PathBuilder()
    const first = clip.points[0]
    if (first === undefined) return builder.detach()
    builder.moveTo(clip.x + first.x * clip.scaleX, clip.y + first.y * clip.scaleY)
    for (const point of clip.points.slice(1)) {
      builder.lineTo(clip.x + point.x * clip.scaleX, clip.y + point.y * clip.scaleY)
    }
    builder.close()
    return builder.detach()
  }

  private recordBucket(bucket: Bucket): void {
    const recorder = new this.kit.PictureRecorder()
    const recording = recorder.beginRecording(this.kit.XYWHRect(0, 0, 4096, 4096))
    for (let index = 0; index < bucket.shapes.length; index += 1) {
      const shape = bucket.shapes[index]
      const path = bucket.paths[index]
      // A clipped shape draws inside its group's clip, resolved to world space by the scene
      // builder (issue #71). The clip wraps this shape's own save/restore, so paint state cannot
      // leak between shapes.
      if (shape.clip !== null) {
        recording.save()
        recording.clipPath(this.clipPathFor(shape.clip), this.kit.ClipOp.Intersect, true)
      }
      recording.save()
      // Rotation is a world-space turn about the shape's own centre, applied outside the translate
      // and scale so it works identically at any scale (issue #120).
      if (shape.rotation !== 0) {
        const centreX = shape.x + (shape.width * shape.scaleX) / 2
        const centreY = shape.y + (shape.height * shape.scaleY) / 2
        recording.translate(centreX, centreY)
        recording.rotate(shape.rotation, 0, 0)
        recording.translate(-centreX, -centreY)
      }
      recording.translate(shape.x, shape.y)
      if (shape.scaleX !== 1 || shape.scaleY !== 1) recording.scale(shape.scaleX, shape.scaleY)
      if (shape.kind === 'text') {
        this.drawText(recording, shape)
      } else if (shape.kind === 'image') {
        this.drawImage(recording, shape)
      } else if (shape.kind === 'line') {
        // A segment has no interior: its appearance is the stroke. When a line was created
        // without one (a hand-edited file), fall back to the fill colour so it stays visible.
        const stroke = shape.stroke ?? { color: shape.fill, width: 2 }
        recording.drawPath(path, this.paintFor('stroke', stroke.color, stroke.width, shape.opacity))
      } else {
        const fillPaint = this.fillPaintFor(shape)
        if (shape.blendMode !== null) fillPaint.setBlendMode(this.blendModeFor(shape.blendMode))
        recording.drawPath(path, fillPaint)
        if (shape.stroke !== null && shape.stroke.width > 0) {
          recording.drawPath(path, this.paintFor('stroke', shape.stroke.color, shape.stroke.width, shape.opacity))
        }
      }
      recording.restore()
      if (shape.clip !== null) recording.restore()
    }
    bucket.picture?.delete()
    bucket.picture = recorder.finishRecordingAsPicture()
    recorder.delete()
  }

  /**
   * Draws a text node line by line (issue #16): the box is the node's measured width, the
   * leading is its line height, and alignment places each line inside the box.
   */
  private drawText(recording: Canvas, shape: SceneShape): void {
    const text = shape.text
    if (text === null || text.content.length === 0) return
    const font = this.fontFor(text.fontFamily, text.fontSize)
    if (font === null) return
    const paint = this.paintFor('fill', shape.fill, 0, shape.opacity)
    // Skia's ascent is negative above the baseline, so `-ascent` is the baseline offset.
    const baseline = -font.getMetrics().ascent
    const lines = text.content.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (line.length === 0) continue
      const width = this.measureLine(font, line)
      const left =
        text.align === 'center' ? (shape.width - width) / 2 : text.align === 'right' ? shape.width - width : 0
      recording.drawText(line, left, index * text.lineHeight + baseline, paint, font)
    }
  }

  /**
   * Draws an image asset into the node's box (issue #17). A missing or undecodable asset is
   * drawn as a light placeholder frame — Illustrator shows a box for a missing link too — and
   * is reported through `missingAssets` rather than disappearing silently.
   */
  private drawImage(recording: Canvas, shape: SceneShape): void {
    const assetId = shape.assetId
    const image = assetId === null ? undefined : this.images.get(assetId)
    if (image === undefined) {
      if (assetId !== null) this.missingAssets.add(assetId)
      recording.drawRect(
        this.kit.XYWHRect(0, 0, shape.width, shape.height),
        this.paintFor('fill', '#d9d3cc', 0, shape.opacity),
      )
      return
    }
    const crop = shape.crop ?? { x: 0, y: 0, width: 1, height: 1 }
    const source = this.kit.XYWHRect(
      image.width() * crop.x,
      image.height() * crop.y,
      image.width() * crop.width,
      image.height() * crop.height,
    )
    const destination = this.kit.XYWHRect(0, 0, shape.width, shape.height)
    const mask = shape.maskAssetId === null ? undefined : this.images.get(shape.maskAssetId)
    if (mask === undefined) {
      if (shape.maskAssetId !== null) this.missingAssets.add(shape.maskAssetId)
      recording.drawImageRect(image, source, destination, this.paintFor('fill', '#ffffff', 0, shape.opacity), false)
      return
    }
    recording.saveLayer()
    recording.drawImageRect(image, source, destination, this.paintFor('fill', '#ffffff', 0, shape.opacity), false)
    const maskPaint = new this.kit.Paint()
    maskPaint.setAntiAlias(true)
    maskPaint.setBlendMode(this.kit.BlendMode.DstIn)
    recording.drawImageRect(mask, this.kit.XYWHRect(0, 0, mask.width(), mask.height()), destination, maskPaint, false)
    maskPaint.delete()
    recording.restore()
  }

  /** Width of one line, from the font's own glyph advances. */
  private measureLine(font: Font, line: string): number {
    const glyphs = font.getGlyphIDs(line)
    const widths = font.getGlyphWidths(glyphs)
    let total = 0
    for (let index = 0; index < widths.length; index += 1) total += widths[index]
    return total
  }

  /**
   * Every shape kind as a Skia path. The point-based kinds come from `shapeGeometry`, the same
   * module the canvas uses for its drag preview, so the preview and the drawn shape agree.
   * Shapes with a stroke and no fill (a line) are stroked by the caller.
   */
  private makePath(shape: SceneShape): Path {
    const builder = new this.kit.PathBuilder()
    if (shape.kind === 'ellipse') {
      builder.addOval(this.kit.XYWHRect(0, 0, shape.width, shape.height))
    } else if (shape.kind === 'rect') {
      const radius = clampCornerRadius(shape.width, shape.height, shape.cornerRadius)
      if (radius > 0) {
        builder.addRRect(
          this.kit.RRectXY(this.kit.XYWHRect(0, 0, shape.width, shape.height), radius, radius),
        )
      } else {
        builder.addRect(this.kit.XYWHRect(0, 0, shape.width, shape.height))
      }
    } else if (shape.kind === 'path' && shape.anchors !== null && shape.anchors.length >= 2) {
      const anchors = shape.anchors
      builder.moveTo(anchors[0].x, anchors[0].y)
      const segments = shape.closed ? anchors.length : anchors.length - 1
      for (let index = 0; index < segments; index += 1) {
        const a = anchors[index]
        const b = anchors[(index + 1) % anchors.length]
        builder.cubicTo(a.x + a.outX, a.y + a.outY, b.x + b.inX, b.y + b.inY, b.x, b.y)
      }
      if (shape.closed) builder.close()
    } else {
      const points = outlinePoints(shape)
      if (points !== null && points.length > 0) {
        builder.moveTo(points[0].x, points[0].y)
        for (const point of points.slice(1)) builder.lineTo(point.x, point.y)
        // A line stays open; every other point-based kind closes its outline.
        if (shape.kind !== 'line') builder.close()
      }
    }
    // Text draws glyphs instead of a path; an empty path keeps the per-shape array aligned.
    const path = builder.detach()
    if (shape.kind === 'path' && shape.fillRule === 'evenodd') path.setFillType(this.kit.FillType.EvenOdd)
    builder.delete()
    this.ownedPaths.push(path)
    return path
  }

  private paintFor(
    kind: 'fill' | 'stroke',
    value: string,
    strokeWidth = 0,
    opacity = 1,
    ends: { cap?: StrokeCap; join?: StrokeJoin } = {},
  ): Paint {
    const rounded = Math.round(opacity * 100) / 100
    const key = `${kind}:${value}:${strokeWidth}:${rounded}:${ends.cap ?? '-'}:${ends.join ?? '-'}`
    const cached = this.paintCache.get(key)
    if (cached) return cached
    if (this.paintCache.size >= MAX_PAINTS) {
      for (const paint of this.paintCache.values()) paint.delete()
      this.paintCache.clear()
    }
    const paint = new this.kit.Paint()
    paint.setAntiAlias(true)
    paint.setColor(this.color(value))
    if (rounded < 1) paint.setAlphaf(rounded)
    if (kind === 'stroke') {
      paint.setStyle(this.kit.PaintStyle.Stroke)
      paint.setStrokeWidth(strokeWidth)
    }
    this.paintCache.set(key, paint)
    return paint
  }

/**
 * The fill paint for a shape: a solid colour, or a linear gradient built in the node's own box
 * (issue #70). A gradient paint is created per recorded shape and released straight after the
 * recording call, which stores the paint by value — so no gradient shader outlives the bucket.
 */
  private fillPaintFor(shape: SceneShape): Paint {
    if (shape.gradient === null) return this.paintFor('fill', shape.fill, 0, shape.opacity)
    const colors = shaderColors(shape.gradient.stops.map((stop) => stop.color))
    const positions = shape.gradient.stops.map((stop) => stop.offset)
    const start: number[] = [shape.gradient.from.x * shape.width, shape.gradient.from.y * shape.height]
    const end: number[] = [shape.gradient.to.x * shape.width, shape.gradient.to.y * shape.height]
    const shader =
      shape.gradient.type === 'radial'
        ? this.kit.Shader.MakeRadialGradient(
            start,
            Math.max(1, Math.hypot(end[0] - start[0], end[1] - start[1])),
            colors,
            positions,
            this.kit.TileMode.Clamp,
          )
        : this.kit.Shader.MakeLinearGradient(start, end, colors, positions, this.kit.TileMode.Clamp)
    const paint = new this.kit.Paint()
    paint.setAntiAlias(true)
    paint.setShader(shader)
    if (shape.opacity < 1) paint.setAlphaf(Math.round(shape.opacity * 100) / 100)
    return paint
  }

  /** The gradient shader for a shape in its own box, or null when it has no gradient. */
  private gradientShaderFor(shape: SceneShape): Shader | null {
    if (shape.gradient === null) return null
    const colors = shaderColors(shape.gradient.stops.map((stop) => stop.color))
    const positions = shape.gradient.stops.map((stop) => stop.offset)
    const start: number[] = [shape.gradient.from.x * shape.width, shape.gradient.from.y * shape.height]
    const end: number[] = [shape.gradient.to.x * shape.width, shape.gradient.to.y * shape.height]
    return shape.gradient.type === 'radial'
      ? this.kit.Shader.MakeRadialGradient(start, Math.max(1, Math.hypot(end[0] - start[0], end[1] - start[1])), colors, positions, this.kit.TileMode.Clamp)
      : this.kit.Shader.MakeLinearGradient(start, end, colors, positions, this.kit.TileMode.Clamp)
  }

/**
 * The stroke paint for a shape: the cached paint when it is plain, or a fresh one when a dash
 * pattern needs a path effect (issue #69) — a dash effect is pattern-specific, so caching it by
 * colour and width would hand one shape another shape's dashes.
 */
  private strokePaintFor(shape: SceneShape, stroke: { color: string; width: number; cap?: StrokeCap; join?: StrokeJoin; dash?: number[] }): Paint {
    if (stroke.dash === undefined || stroke.dash.length === 0) {
      return this.paintFor('stroke', stroke.color, stroke.width, shape.opacity, { cap: stroke.cap, join: stroke.join })
    }
    const paint = new this.kit.Paint()
    paint.setAntiAlias(true)
    paint.setColor(this.color(stroke.color))
    if (shape.opacity < 1) paint.setAlphaf(Math.round(shape.opacity * 100) / 100)
    paint.setStyle(this.kit.PaintStyle.Stroke)
    paint.setStrokeWidth(stroke.width)
    if (stroke.cap !== undefined) {
      paint.setStrokeCap(stroke.cap === 'round' ? this.kit.StrokeCap.Round : stroke.cap === 'square' ? this.kit.StrokeCap.Square : this.kit.StrokeCap.Butt)
    }
    if (stroke.join !== undefined) {
      paint.setStrokeJoin(stroke.join === 'round' ? this.kit.StrokeJoin.Round : stroke.join === 'bevel' ? this.kit.StrokeJoin.Bevel : this.kit.StrokeJoin.Miter)
    }
    paint.setPathEffect(this.kit.PathEffect.MakeDash(stroke.dash.slice(), 0))
    if (shape.gradientTarget === 'stroke' || shape.gradientTarget === 'both') {
      const shader = this.gradientShaderFor(shape)
      if (shader !== null) paint.setShader(shader)
    }
    return paint
  }

  /** Frees the paint a dashed shape created, since it never entered the cache. */
  private releaseExtraPaint(dash: number[] | undefined, paint: Paint): void {
    if (dash === undefined || dash.length === 0) return
    paint.delete()
  }

  /** Maps a document blend mode onto Skia's, for the small set Vectr supports. */
  private blendModeFor(mode: BlendMode): CanvasBlendMode {
    switch (mode) {
      case 'multiply':
        return this.kit.BlendMode.Multiply
      case 'screen':
        return this.kit.BlendMode.Screen
      case 'overlay':
        return this.kit.BlendMode.Overlay
      case 'darken':
        return this.kit.BlendMode.Darken
      case 'lighten':
        return this.kit.BlendMode.Lighten
      case 'color-dodge':
        return this.kit.BlendMode.ColorDodge
      case 'color-burn':
        return this.kit.BlendMode.ColorBurn
      case 'hard-light':
        return this.kit.BlendMode.HardLight
      case 'soft-light':
        return this.kit.BlendMode.SoftLight
      case 'difference':
        return this.kit.BlendMode.Difference
      case 'exclusion':
        return this.kit.BlendMode.Exclusion
      case 'hue':
        return this.kit.BlendMode.Hue
      case 'saturation':
        return this.kit.BlendMode.Saturation
      case 'color':
        return this.kit.BlendMode.Color
      case 'luminosity':
        return this.kit.BlendMode.Luminosity
      default:
        return this.kit.BlendMode.SrcOver
    }
  }

  /** Grid lines inside one page: a line every spacing units, a stronger one every ten. */
  private drawGrid(canvas: Canvas, artboard: ArtboardRect, zoom: number): void {
    const spacing = this.grid.spacing * zoom
    if (spacing < 4) return
    const minor = this.paintFor('stroke', '#e7e8ee', 0, 1)
    minor.setStrokeWidth(1 / zoom)
    const major = this.paintFor('stroke', '#cfd2dc', 0, 1)
    major.setStrokeWidth(1 / zoom)
    canvas.save()
    const page = new this.kit.PathBuilder()
    page.addRect(this.kit.XYWHRect(artboard.x, artboard.y, artboard.width, artboard.height))
    canvas.clipPath(page.detach(), this.kit.ClipOp.Intersect, true)
    let index = 1
    for (let x = artboard.x + this.grid.spacing; x < artboard.x + artboard.width; x += this.grid.spacing) {
      const paint = index % 10 === 0 ? major : minor
      canvas.drawLine(x, artboard.y, x, artboard.y + artboard.height, paint)
      index += 1
    }
    index = 1
    for (let y = artboard.y + this.grid.spacing; y < artboard.y + artboard.height; y += this.grid.spacing) {
      const paint = index % 10 === 0 ? major : minor
      canvas.drawLine(artboard.x, y, artboard.x + artboard.width, y, paint)
      index += 1
    }
    canvas.restore()
  }

  /** A one-screen-pixel page edge, kept crisp by scaling the width with the zoom. */
  private pageEdgePaintFor(zoom: number): Paint {
    const key = `page-edge:${zoom}`
    const cached = this.paintCache.get(key)
    if (cached) return cached
    const paint = new this.kit.Paint()
    paint.setAntiAlias(true)
    paint.setColor(this.color('#55555f'))
    paint.setStyle(this.kit.PaintStyle.Stroke)
    paint.setStrokeWidth(1 / zoom)
    this.paintCache.set(key, paint)
    return paint
  }

  /** One-pixel selection outline, drawn independently of zoom. */
  private selectionPaintFor(zoom: number): Paint {
    const key = `selection:${zoom}`
    const cached = this.paintCache.get(key)
    if (cached) return cached
    if (this.paintCache.size >= MAX_PAINTS) {
      for (const paint of this.paintCache.values()) paint.delete()
      this.paintCache.clear()
    }
    const paint = new this.kit.Paint()
    paint.setAntiAlias(false)
    paint.setStyle(this.kit.PaintStyle.Stroke)
    paint.setStrokeWidth(1 / Math.max(zoom, 0.0001))
    paint.setColor(this.color('#7c5cff'))
    this.paintCache.set(key, paint)
    return paint
  }

  private color(value: string): Color {
    const cached = this.colorCache.get(value)
    if (cached) return cached
    const hex = value.replace('#', '')
    const color = this.kit.Color(
      Number.parseInt(hex.slice(0, 2) || '00', 16),
      Number.parseInt(hex.slice(2, 4) || '00', 16),
      Number.parseInt(hex.slice(4, 6) || '00', 16),
      255,
    )
    this.colorCache.set(value, color)
    return color
  }

  /**
   * A boolean of the given scene shapes, as scene-space polygons (Phase 5.4). Curves are flattened at
   * the document tolerance and the result is polygonal; that limitation is deliberate and documented.
   */
  booleanPolygonsForShapes(shapes: SceneShape[], mode: BooleanMode): Polygon[] {
    const polygons = shapes.map((shape) => this.scenePolygon(shape)).filter((polygon) => polygon.length >= 3)
    return booleanPolygons(this.kit, polygons, mode)
  }

  /** A shape's outline in scene coordinates, flattened. */
  private scenePolygon(shape: SceneShape): Polygon {
    // outlinePoints deliberately returns null for the primitives; sample those here.
    const local =
      shape.kind === 'path' && shape.anchors !== null
        ? flattenPath(shape.anchors, true)
        : shape.kind === 'line'
          ? []
          : shape.kind === 'rect'
            ? rectPolygon(shape.width, shape.height, clampCornerRadius(shape.width, shape.height, shape.cornerRadius))
            : shape.kind === 'ellipse'
              ? ellipsePolygon(shape.width, shape.height)
              : outlinePoints(shape) ?? []
    if (local.length === 0) return []
    const centre = { x: shape.x + (shape.width * shape.scaleX) / 2, y: shape.y + (shape.height * shape.scaleY) / 2 }
    const points = local.map((point: { x: number; y: number }) => {
      const placed = { x: shape.x + point.x * shape.scaleX, y: shape.y + point.y * shape.scaleY }
      return shape.rotation === 0 ? placed : rotatePoint(placed, centre, shape.rotation)
    })
    return points
  }

  /** Releases every owned Skia object, the surface, and the GPU/WASM context. */
  dispose(): void {
    for (const bucket of this.buckets) {
      bucket.picture?.delete()
      for (const path of bucket.paths) path.delete()
    }
    this.buckets = []
    this.ownedPaths.length = 0
    for (const font of this.fonts.values()) font.delete()
    this.fonts.clear()
    this.typeface?.delete()
    this.typeface = null
    for (const image of this.images.values()) image.delete()
    this.images.clear()
    this.missingAssets.clear()
    for (const paint of this.paintCache.values()) paint.delete()
    this.paintCache.clear()
    this.colorCache.clear()
    this.surface.dispose()
    if (this.context) {
      this.context.releaseResourcesAndAbandonContext()
      this.context.delete()
      this.context = null
    }
    if (this.webglHandle !== null) this.kit.deleteContext(this.webglHandle)
  }
}

/** A rectangle as a polygon; a rounded corner is sampled at eight steps. */
function rectPolygon(width: number, height: number, radius: number): Array<{ x: number; y: number }> {
  if (radius <= 0) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ]
  }
  const points: Array<{ x: number; y: number }> = []
  const corners = [
    { cx: width - radius, cy: radius, from: -Math.PI / 2, to: 0 },
    { cx: width - radius, cy: height - radius, from: 0, to: Math.PI / 2 },
    { cx: radius, cy: height - radius, from: Math.PI / 2, to: Math.PI },
    { cx: radius, cy: radius, from: Math.PI, to: (3 * Math.PI) / 2 },
  ]
  for (const corner of corners) {
    for (let step = 0; step <= 8; step += 1) {
      const angle = corner.from + ((corner.to - corner.from) * step) / 8
      points.push({ x: corner.cx + Math.cos(angle) * radius, y: corner.cy + Math.sin(angle) * radius })
    }
  }
  return points
}

/** An ellipse as a 64-point polygon. */
function ellipsePolygon(width: number, height: number): Array<{ x: number; y: number }> {
  const rx = width / 2
  const ry = height / 2
  const points: Array<{ x: number; y: number }> = []
  for (let step = 0; step < 64; step += 1) {
    const angle = (step / 64) * Math.PI * 2
    points.push({ x: rx + rx * Math.cos(angle), y: ry + ry * Math.sin(angle) })
  }
  return points
}

/** Base64 for the thumbnail data URLs; chunked so a larger encode cannot blow the call stack. */
function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

/** Reads a bundled asset's byte size without retaining it. */
async function readAssetBytes(url: string): Promise<number | null> {
  try {
    const response = await fetch(new URL(url, document.baseURI).href)
    if (!response.ok) return null
    const declared = response.headers.get('content-length')
    if (declared !== null) return Number(declared)
    return (await response.arrayBuffer()).byteLength
  } catch {
    return null
  }
}

