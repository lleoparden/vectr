/**
 * Paint-order scene building for the editor renderer (issue #18).
 *
 * Pure and renderer-free: the document in, an ordered draw list out. Canvas order
 * therefore comes from the tree walk in exactly one place, which is what makes the
 * "paint order equals layer order" acceptance criterion testable without a GPU.
 */

import { artboardRects, type ArtboardRect } from '../doc/artboards.ts'
import { clipPolygon } from '../geom/shapeGeometry.ts'
import type { PathAnchor } from '../geom/path.ts'
import type { BlendMode, FillGradient, PathFillRule, Stroke } from '../doc/types.ts'
import { isGroup, isText, type Document, type ImageCrop, type LayerNode, type NodeId, type TextAlign } from '../doc/types.ts'

/** Everything the renderer needs to draw one text node (issue #16). */
export type SceneText = {
  content: string
  fontSize: number
  fontFamily: string
  align: TextAlign
  textType: 'point' | 'area'
  textPath: PathAnchor[] | null
  textPathClosed: boolean
  lineHeight: number
}

/** A group's clip, resolved to world space so the recorder needs no tree knowledge (issue #71). */
export type SceneClip = {
  points: Array<{ x: number; y: number }>
  x: number
  y: number
  scaleX: number
  scaleY: number
}

export type SceneShape = {
  id: NodeId
  kind: 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'arc' | 'path' | 'text' | 'image'
  /** Top-level ancestor, which is the invalidation unit of the renderer. */
  root: NodeId
  x: number
  y: number
  scaleX: number
  scaleY: number
  /** Degrees, about the shape's own centre in world space (issue #120). */
  rotation: number
  width: number
  height: number
  cornerRadius: number
  /** Line: which corner the segment starts at. */
  lineFrom: 'top-left' | 'top-right'
  /** Polygon sides, or star tips, as the node stores them. */
  sides: number
  /** Star: valley radius as a fraction of the box radius. */
  innerRadius: number
  /** Arc: degrees, counterclockwise from +x, plus whether it closes through the centre. */
  startAngle: number
  sweepAngle: number
  pie: boolean
  /** Present exactly when `kind` is `path`: the anchors, closure, and fill rule. */
  anchors: PathAnchor[] | null
  /** Additional contours of a compound path, when present (Phase 5.6). */
  subpaths: PathAnchor[][] | null
  closed: boolean
  fillRule: PathFillRule | null
  fill: string
  /** Linear gradient paint for the fill, or null for a solid fill (issue #70). */
  gradient: FillGradient | null
  /** Which part the gradient paints: fill, stroke, or both (issue #70). */
  gradientTarget: 'fill' | 'stroke' | 'both' | null
  stroke: Stroke | null
  opacity: number
  /** Fill blend mode, or null for normal (issue #71). */
  blendMode: BlendMode | null
  /** Present exactly when `kind` is `text`. */
  text: SceneText | null
  /** Present exactly when `kind` is `image`: the asset the renderer must draw. */
  assetId: string | null
  /** The clip in force for this shape, or null (issue #71). */
  clip: SceneClip | null
  /** Image-only source crop and optional raster alpha mask. */
  crop: ImageCrop | null
  maskAssetId: string | null
}

export type Scene = {
  revision: number
  /** Artboard pages, in document order, with their derived positions (issue #67). */
  artboards: ArtboardRect[]
  shapes: SceneShape[]
  /** Shapes grouped by top-level root, in paint order; the renderer's buckets. */
  byRoot: Array<{ root: NodeId; shapes: SceneShape[] }>
}

function walkShapes(
  node: LayerNode,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  opacity: number,
  root: NodeId,
  into: SceneShape[],
  clip: SceneClip | null = null,
): void {
  const nextX = x + node.transform.x * scaleX
  const nextY = y + node.transform.y * scaleY
  const nextScaleX = scaleX * node.transform.scaleX
  const nextScaleY = scaleY * node.transform.scaleY
  if (isGroup(node)) {
    const nextOpacity = opacity * 1
    // A clipped group resolves its clip child to world space once; its children inherit it.
    let nextClip = clip
    const clipId = node.clipChildId ?? null
    if (clipId !== null) {
      const clipChild = node.children.find((child) => child.id === clipId) ?? null
      if (clipChild !== null && clipChild.type !== 'group') {
        nextClip = {
          points: clipPolygon({
            kind: clipChild.type,
            width: clipChild.width,
            height: clipChild.height,
            cornerRadius: clipChild.type === 'rect' ? clipChild.cornerRadius : 0,
            sides: clipChild.type === 'polygon' ? clipChild.sides : clipChild.type === 'star' ? clipChild.points : 0,
            innerRadius: clipChild.type === 'star' ? clipChild.innerRadius : 0,
            startAngle: clipChild.type === 'arc' ? clipChild.startAngle : 0,
            sweepAngle: clipChild.type === 'arc' ? clipChild.sweepAngle : 0,
            pie: clipChild.type === 'arc' ? clipChild.pie : false,
            lineFrom: clipChild.type === 'line' ? clipChild.from : 'top-left',
          }),
          x: nextX + clipChild.transform.x * nextScaleX,
          y: nextY + clipChild.transform.y * nextScaleY,
          scaleX: nextScaleX * clipChild.transform.scaleX,
          scaleY: nextScaleY * clipChild.transform.scaleY,
        }
      }
    }
    for (const child of node.children) {
      if (child.hidden) continue
      // The clip object itself is not drawn: it defines the mask.
      if (clipId !== null && child.id === clipId) continue
      walkShapes(child, nextX, nextY, nextScaleX, nextScaleY, nextOpacity, root, into, nextClip)
    }
    return
  }
  into.push({
    id: node.id,
    kind: node.type,
    root,
    x: nextX,
    y: nextY,
    rotation: node.transform.rotation,
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    width: node.width,
    height: node.height,
    cornerRadius: node.type === 'rect' ? node.cornerRadius : 0,
    lineFrom: node.type === 'line' ? node.from : 'top-left',
    sides: node.type === 'polygon' ? node.sides : node.type === 'star' ? node.points : 0,
    innerRadius: node.type === 'star' ? node.innerRadius : 0,
    startAngle: node.type === 'arc' ? node.startAngle : 0,
    sweepAngle: node.type === 'arc' ? node.sweepAngle : 0,
    pie: node.type === 'arc' ? node.pie : false,
    anchors: node.type === 'path' ? node.anchors.map((anchor) => ({ ...anchor })) : null,
    subpaths: node.type === 'path' && node.subpaths !== undefined ? node.subpaths.map((contour) => contour.map((anchor) => ({ ...anchor }))) : null,
    closed: node.type === 'path' ? node.closed : false,
    fillRule: node.type === 'path' ? node.fillRule : null,
    fill: node.style.fill,
    gradient: node.style.gradient ?? null,
    gradientTarget: node.style.gradientTarget ?? null,
    stroke: node.style.stroke,
    opacity: opacity * node.style.opacity,
    blendMode: node.style.blendMode ?? null,
    text: isText(node)
      ? {
          content: node.text,
          fontSize: node.fontSize,
          fontFamily: node.fontFamily,
          align: node.align,
          lineHeight: node.lineHeight,
          textType: node.textType === 'area' ? 'area' : 'point',
          textPath: node.textPath === undefined ? null : node.textPath.anchors.map((anchor) => ({ ...anchor })),
          textPathClosed: node.textPath?.closed ?? false,
        }
      : null,
    clip,
    assetId: node.type === 'image' ? node.assetId : null,
    crop: node.type === 'image' ? { ...node.crop } : null,
    maskAssetId: node.type === 'image' ? node.maskAssetId : null,
  })
}

/** Builds the ordered draw list for a document; never returns hidden nodes. */
export function buildScene(document: Document): Scene {
  const shapes: SceneShape[] = []
  const byRoot: Array<{ root: NodeId; shapes: SceneShape[] }> = []
  for (const root of document.root.children) {
    if (root.hidden) continue
    const rootShapes: SceneShape[] = []
    walkShapes(root, 0, 0, 1, 1, 1, root.id, rootShapes)
    shapes.push(...rootShapes)
    byRoot.push({ root: root.id, shapes: rootShapes })
  }
  return { revision: document.revision, artboards: artboardRects(document), shapes, byRoot }
}

/** Root ids in paint order, matching {@link paintOrder} at the top level. */
export function sceneRootIds(scene: Scene): NodeId[] {
  return scene.byRoot.map((bucket) => bucket.root)
}
