/**
 * CanvasKit scene renderer for the Phase 1 renderer spike (issue #15).
 *
 * Responsibilities kept deliberately narrow: own the WebGL/CPU surface, build the
 * retained Skia objects for a fixture, draw them in tree order, and dispose
 * everything on request. No document model, no React, no IPC — the editor's
 * renderer in the next slice reuses this shape.
 *
 * Memory rules: one Paint reused for path work, one Color per distinct fill,
 * shared decoded images per content-addressed asset id, and explicit disposal of
 * every retained object.
 */

import CanvasKitInit, {
  type CanvasKit,
  type Color,
  type Canvas,
  type FontMgr,
  type GrDirectContext,
  type Image,
  type Paint,
  type Paragraph,
  type Path,
  type SkPicture,
  type Surface,
} from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'
import fontUrl from '../assets/fonts/Inter-Variable.ttf?url'
import { FIXTURE_PIXEL_SIZE, primitiveLocalPoints, type Fixture, type FixtureNode, type PrimitiveNode } from './fixtures.ts'
import type { SceneTarget } from './target.ts'

export type Viewport = { zoom: number; panX: number; panY: number }

/**
 * `direct` re-issues every node to CanvasKit on each frame (the slice 1 control
 * path). `picture` records geometry into Skia pictures once and replays them, so
 * an interaction costs one call per picture instead of roughly ten per node.
 */
export type RenderMode = 'direct' | 'picture'

export type RendererInfo = {
  backend: 'webgl' | 'cpu-fallback'
  webglAvailable: boolean
  fontLoaded: boolean
  /** Size of the CanvasKit WebAssembly payload in bytes, or null when unavailable. */
  wasmBytes: number | null
}

export type SceneStats = {
  mode: RenderMode
  buildMs: number
  items: number
  paths: number
  images: number
  paragraphs: number
  pictures: number
}

export type LiveObjects = { paths: number; images: number; paragraphs: number; pictures: number }

type SceneItem =
  | {
      kind: 'path'
      x: number
      y: number
      scale: number
      path: Path
      fill: Color
      stroke: Color | null
      strokeWidth: number
    }
  | {
      kind: 'image'
      x: number
      y: number
      scale: number
      image: Image
      width: number
      height: number
    }
  | {
      kind: 'paragraph'
      x: number
      y: number
      scale: number
      paragraph: Paragraph
    }

/**
 * A recorded scene unit. Roots are batched into a bounded number of buckets, so a
 * 10,000-layer fixture still records a handful of pictures, and an edit re-records
 * only the bucket that contains the changed root.
 */
type SceneBucket = { id: string; rootIds: string[]; items: SceneItem[]; picture: SkPicture | null }

/** One top-level fixture root and the items it produced, in paint order. */
type SceneRoot = { id: string; items: SceneItem[] }

/** Upper bound on recorded pictures per scene, so recording memory stays bounded. */
const MAX_BUCKETS = 16

/** Upper bound on cached paints; a larger palette evicts the batch instead of failing. */
const MAX_PAINTS = 512

export class SceneRenderer implements SceneTarget {
  readonly candidate = 'canvaskit'
  private readonly paint: Paint
  private readonly fontManager: FontMgr | null
  private readonly colorCache = new Map<string, Color>()
  private readonly paintCache = new Map<string, Paint>()
  private readonly assetImages = new Map<string, Image>()
  private readonly paragraphs: Paragraph[] = []
  private readonly ownedPaths: Path[] = []
  private items: SceneItem[] = []
  private roots: SceneRoot[] = []
  private buckets: SceneBucket[] = []
  private mode: RenderMode = 'direct'
  private viewport: Viewport = { zoom: 1, panX: 0, panY: 0 }
  private surface: Surface
  private context: GrDirectContext | null

  private constructor(
    private readonly kit: CanvasKit,
    surface: Surface,
    context: GrDirectContext | null,
    private readonly webglHandle: number | null,
    fontData: ArrayBuffer | null,
    readonly info: RendererInfo,
  ) {
    this.surface = surface
    this.context = context
    this.fontManager = fontData === null ? null : kit.FontMgr.FromData(fontData)
    this.paint = new kit.Paint()
    this.paint.setAntiAlias(true)
  }

  static async create(canvas: HTMLCanvasElement): Promise<SceneRenderer> {
    const kit = await CanvasKitInit({ locateFile: () => new URL(wasmUrl, document.baseURI).href })
    const wasmBytes = await readAssetBytes(wasmUrl)
    const fontData = await loadFont()
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
    return new SceneRenderer(kit, surface, context, webglHandle, fontData, {
      backend: context === null ? 'cpu-fallback' : 'webgl',
      webglAvailable: context !== null,
      fontLoaded: fontData !== null,
      wasmBytes,
    })
  }

  /** Retained Skia objects currently owned; used for leak assertions. */
  liveObjects(): LiveObjects {
    return {
      paths: this.ownedPaths.length,
      images: this.assetImages.size,
      paragraphs: this.paragraphs.length,
      pictures: this.buckets.reduce((total, bucket) => total + (bucket.picture === null ? 0 : 1), 0),
    }
  }

  /** Switches the draw path; the caller rebuilds so the scene matches the mode. */
  setMode(mode: string) {
    this.mode = mode as RenderMode
  }

  /** Draw paths this target measures: the slice 1 control and recorded replay. */
  modes(): string[] {
    return ['direct', 'picture']
  }

  currentMode(): string {
    return this.mode
  }

  /** Re-records only the bucket that contains the edited root. */
  invalidateRoot(rootId: string) {
    const bucket = this.buckets.find((candidate) => candidate.rootIds.includes(rootId))
    if (!bucket) throw new Error(`Cannot invalidate unknown root ${rootId}.`)
    if (this.mode !== 'picture') return
    this.recordBucket(bucket)
  }

  rootIds(): string[] {
    return this.roots.map((root) => root.id)
  }

  bucketCount(): number {
    return this.buckets.length
  }

  viewportState(): Viewport {
    return this.viewport
  }

  setViewport(next: Partial<Viewport>) {
    this.viewport = { ...this.viewport, ...next }
  }

  /**
   * Builds the retained scene for a fixture. In picture mode the scene is also
   * recorded into a bounded number of buckets, which moves per-item cost out of
   * the interaction path.
   */
  build(fixture: Fixture): SceneStats {
    const started = performance.now()
    this.releaseScene()
    for (const asset of fixture.assets) this.assetImages.set(asset.id, this.makeAssetImage(asset.id))
    this.roots = fixture.roots.map((root) => {
      this.items = []
      this.buildNode(root, 0, 0, 1)
      return { id: root.id, items: this.items }
    })
    this.items = []
    if (this.mode === 'picture') {
      this.buckets = this.createBuckets()
      for (const bucket of this.buckets) this.recordBucket(bucket)
    }
    return {
      mode: this.mode,
      buildMs: performance.now() - started,
      items: this.roots.reduce((total, root) => total + root.items.length, 0),
      paths: this.ownedPaths.length,
      images: this.assetImages.size,
      paragraphs: this.paragraphs.length,
      pictures: this.liveObjects().pictures,
    }
  }

  /** Distributes roots into at most {@link MAX_BUCKETS} recording buckets. */
  private createBuckets(): SceneBucket[] {
    const bucketCount = Math.max(1, Math.min(MAX_BUCKETS, this.roots.length))
    const chunkSize = Math.ceil(this.roots.length / bucketCount)
    const buckets: SceneBucket[] = []
    for (let start = 0; start < this.roots.length; start += chunkSize) {
      const slice = this.roots.slice(start, start + chunkSize)
      buckets.push({
        id: `bucket-${buckets.length}`,
        rootIds: slice.map((root) => root.id),
        items: slice.flatMap((root) => root.items),
        picture: null,
      })
    }
    return buckets
  }

  /** Draws the retained scene with the current viewport and returns submission time. */
  draw(): number {
    const started = performance.now()
    const canvas = this.surface.getCanvas()
    canvas.clear(this.kit.WHITE)
    canvas.save()
    canvas.translate(this.viewport.panX, this.viewport.panY)
    canvas.scale(this.viewport.zoom, this.viewport.zoom)
    if (this.mode === 'picture') {
      for (const bucket of this.buckets) {
        if (bucket.picture === null) this.recordBucket(bucket)
        if (bucket.picture !== null) canvas.drawPicture(bucket.picture)
      }
    } else {
      for (const root of this.roots) this.drawItems(canvas, root.items)
    }
    canvas.restore()
    this.surface.flush()
    return performance.now() - started
  }

  private recordBucket(bucket: SceneBucket) {
    const recorder = new this.kit.PictureRecorder()
    const recording = recorder.beginRecording(this.kit.XYWHRect(0, 0, 1200, 800))
    this.drawItems(recording, bucket.items)
    bucket.picture?.delete()
    bucket.picture = recorder.finishRecordingAsPicture()
    recorder.delete()
  }

  private paintFor(style: 'fill' | 'stroke', color: Color, strokeWidth = 0): Paint {
    const key = `${style}:${color.toString()}:${strokeWidth}`
    const cached = this.paintCache.get(key)
    if (cached) return cached
    if (this.paintCache.size >= MAX_PAINTS) {
      // Batch eviction keeps the cache bounded on unusual palettes without failing.
      for (const paint of this.paintCache.values()) paint.delete()
      this.paintCache.clear()
    }
    const paint = new this.kit.Paint()
    paint.setAntiAlias(true)
    paint.setColor(color)
    if (style === 'stroke') {
      paint.setStyle(this.kit.PaintStyle.Stroke)
      paint.setStrokeWidth(strokeWidth)
    }
    this.paintCache.set(key, paint)
    return paint
  }

  private drawItems(canvas: Canvas, items: SceneItem[]) {
    for (const item of items) {
      canvas.save()
      canvas.translate(item.x, item.y)
      if (item.scale !== 1) canvas.scale(item.scale, item.scale)
      if (item.kind === 'path') {
        canvas.drawPath(item.path, this.paintFor('fill', item.fill))
        if (item.stroke) {
          canvas.drawPath(item.path, this.paintFor('stroke', item.stroke, item.strokeWidth))
        }
      } else if (item.kind === 'image') {
        const imageInfo = item.image.getImageInfo()
        canvas.drawImageRect(
          item.image,
          this.kit.XYWHRect(0, 0, imageInfo.width ?? item.width, imageInfo.height ?? item.height),
          this.kit.XYWHRect(0, 0, item.width, item.height),
          this.paintFor('fill', this.color('#000000')),
          true,
        )
      } else {
        canvas.drawParagraph(item.paragraph, 0, 0)
      }
      canvas.restore()
    }
  }

  /** Recreates the surface at a new size, releasing the previous one first. */
  resize(width: number, height: number) {
    this.surface.dispose()
    const surface =
      this.context === null
        ? this.kit.MakeSurface(width, height)
        : this.kit.MakeOnScreenGLSurface(this.context, width, height, this.kit.ColorSpace.SRGB)
    if (surface === null) throw new Error('CanvasKit could not recreate the surface after resize.')
    this.surface = surface
  }

  /** Disposes every retained scene object without destroying the surface. */
  releaseScene() {
    for (const path of this.ownedPaths) path.delete()
    for (const paragraph of this.paragraphs) paragraph.delete()
    for (const image of this.assetImages.values()) image.delete()
    for (const root of this.buckets) root.picture?.delete()
    this.items = []
    this.roots = []
    this.buckets = []
    this.ownedPaths.length = 0
    this.paragraphs.length = 0
    this.assetImages.clear()
  }

  /** Releases the scene, the paint, the surface, and the GPU/WASM context. */
  dispose() {
    this.releaseScene()
    this.colorCache.clear()
    for (const paint of this.paintCache.values()) paint.delete()
    this.paintCache.clear()
    this.paint.delete()
    this.surface.dispose()
    if (this.context) {
      this.context.releaseResourcesAndAbandonContext()
      this.context.delete()
      this.context = null
    }
    if (this.webglHandle !== null) {
      this.kit.deleteContext(this.webglHandle)
    }
  }

  private buildNode(node: FixtureNode, x: number, y: number, scale: number) {
    const nextX = x + node.transform.x * scale
    const nextY = y + node.transform.y * scale
    const nextScale = scale * node.transform.scale

    if (node.kind === 'group') {
      for (const child of node.children) this.buildNode(child, nextX, nextY, nextScale)
      return
    }

    if (node.kind === 'rect' || node.kind === 'ellipse') {
      const path = this.makePrimitivePath(node.width, node.height, node.segments, node.kind)
      this.ownedPaths.push(path)
      this.items.push({
        kind: 'path',
        x: nextX,
        y: nextY,
        scale: nextScale,
        path,
        fill: this.color(node.style.fill),
        stroke: node.style.stroke === null ? null : this.color(node.style.stroke),
        strokeWidth: node.style.strokeWidth,
      })
      return
    }

    if (node.kind === 'image') {
      const image = this.assetImages.get(node.asset)
      if (!image) throw new Error(`Fixture node ${node.id} references unknown asset ${node.asset}.`)
      this.items.push({
        kind: 'image',
        x: nextX,
        y: nextY,
        scale: nextScale,
        image,
        width: node.width,
        height: node.height,
      })
      return
    }

    if (this.fontManager === null) throw new Error('No font is loaded, so text cannot be built.')
    if (node.kind !== 'text') {
      throw new Error(`Unsupported fixture node kind: ${String((node as { kind: string }).kind)}`)
    }
    const paragraph = this.makeParagraph(node.text, node.fontSize, node.fill)
    this.paragraphs.push(paragraph)
    this.items.push({ kind: 'paragraph', x: nextX, y: nextY, scale: nextScale, paragraph })
  }

  /**
   * Builds primitive geometry programmatically with the fixture's segment budget.
   * The Phase 0 SVG string parse is intentionally not reproduced, so parse cost
   * cannot be mistaken for draw or interaction cost.
   */
  private makePrimitivePath(width: number, height: number, segments: number, kind: 'rect' | 'ellipse') {
    const builder = new this.kit.PathBuilder()
    // Shared vertex list, so every renderer target draws identical geometry.
    const points = primitiveLocalPoints({ kind, id: '', transform: { x: 0, y: 0, scale: 1 }, width, height, style: { fill: '#000000', stroke: null, strokeWidth: 0 }, segments })
    builder.moveTo(points[0], points[1])
    for (let index = 2; index < points.length; index += 2) {
      builder.lineTo(points[index], points[index + 1])
    }
    builder.close()
    const path = builder.detach()
    builder.delete()
    return path
  }

  private color(value: string): Color {
    const cached = this.colorCache.get(value)
    if (cached) return cached
    const hex = value.replace('#', '')
    const color = this.kit.Color(
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255,
    )
    this.colorCache.set(value, color)
    return color
  }

  /** Deterministic shared bitmap for a content-addressed asset id. */
  private makeAssetImage(assetId: string): Image {
    const pixels = new Uint8Array(FIXTURE_PIXEL_SIZE * FIXTURE_PIXEL_SIZE * 4)
    const seed = Number(assetId.split('-')[1] ?? 0)
    for (let index = 0; index < FIXTURE_PIXEL_SIZE * FIXTURE_PIXEL_SIZE; index += 1) {
      const offset = index * 4
      pixels[offset] = (index * 7 + seed * 31) % 256
      pixels[offset + 1] = (index * 3 + seed * 17) % 256
      pixels[offset + 2] = (index * 11 + seed * 53) % 256
      pixels[offset + 3] = 255
    }
    const image = this.kit.MakeImage(
      {
        width: FIXTURE_PIXEL_SIZE,
        height: FIXTURE_PIXEL_SIZE,
        colorType: this.kit.ColorType.RGBA_8888,
        alphaType: this.kit.AlphaType.Opaque,
        colorSpace: this.kit.ColorSpace.SRGB,
      },
      pixels,
      FIXTURE_PIXEL_SIZE * 4,
    )
    if (!image) throw new Error(`CanvasKit could not create fixture asset ${assetId}.`)
    return image
  }

  private makeParagraph(text: string, fontSize: number, fill: string): Paragraph {
    const fontManager = this.fontManager
    if (fontManager === null) throw new Error('No font is loaded, so text cannot be rendered.')
    const style = new this.kit.ParagraphStyle({
      textStyle: new this.kit.TextStyle({
        color: this.color(fill),
        fontFamilies: ['Inter'],
        fontSize,
      }),
    })
    const builder = this.kit.ParagraphBuilder.Make(style, fontManager)
    builder.addText(text)
    const paragraph = builder.build()
    paragraph.layout(800)
    builder.delete()
    return paragraph
  }
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

/** Loads the bundled Inter face; CanvasKit has no system font manager. */
async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(new URL(fontUrl, document.baseURI).href)
    if (!response.ok) return null
    return await response.arrayBuffer()
  } catch {
    return null
  }
}
