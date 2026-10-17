/**
 * Vectr document model (Phase 1 slice 2, issue #18).
 *
 * The document is the single source of truth: a versioned, renderer-independent
 * layer tree with stable ids, local transforms, and styles. Nothing here knows
 * about Skia, React, or the DOM. Serialization lands in slice #19, so the shape
 * stays JSON-safe (no class instances, no functions, no undefined values).
 */

/** Bump when the persisted shape changes; migration hooks key off this. */
export const FORMAT_VERSION = 4
/** Versions this build still opens. v3 adds non-destructive image crop and mask state. */
export const SUPPORTED_FORMAT_VERSION_LIST = [1, 2, 3, 4]

export type NodeId = string

/** Local transform relative to the parent. Rotation is reserved for slice 2b. */
export type Transform = {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

/** Line ends and corners, Illustrator's Stroke panel terms (issue #69). */
export type StrokeCap = 'butt' | 'round' | 'square'
export type StrokeJoin = 'miter' | 'round' | 'bevel'

export type Stroke = {
  color: string
  width: number
  cap?: StrokeCap
  join?: StrokeJoin
}

/** A linear gradient in the node's own box, normalised 0..1 (issue #70). */
export type GradientStop = { offset: number; color: string }
export type FillGradient = { type: 'linear'; stops: GradientStop[]; from: { x: number; y: number }; to: { x: number; y: number } }

export type Style = {
  /** CSS hex color, for example `#4f7cff`. */
  fill: string
  stroke: Stroke | null
  /** When set, it paints the fill and `fill` is the fallback colour (issue #70). */
  gradient?: FillGradient | null
  /** 0..1, applied to the node and its subtree. */
  opacity: number
}

export type BaseNode = {
  id: NodeId
  name: string
  transform: Transform
  /** Locked nodes are not selectable or transformable. */
  locked: boolean
  hidden: boolean
}

export type RectNode = BaseNode & {
  type: 'rect'
  width: number
  height: number
  cornerRadius: number
  style: Style
}

export type EllipseNode = BaseNode & {
  type: 'ellipse'
  width: number
  height: number
  style: Style
}

/**
 * Straight segment across its box (owner request: the Line Segment tool). `from` picks which
 * corner the segment starts at, so both diagonals are reachable. A line has no fill: its
 * appearance is `style.stroke`, which the tool sets when it creates one.
 */
export type LineNode = BaseNode & {
  type: 'line'
  width: number
  height: number
  from: 'top-left' | 'top-right'
  style: Style
}

/** Regular polygon with 3–60 sides, inscribed in its box (Illustrator's Polygon tool). */
export type PolygonNode = BaseNode & {
  type: 'polygon'
  width: number
  height: number
  sides: number
  style: Style
}

/** Star with 3–60 tips; `innerRadius` is the valley radius as a fraction of the box radius. */
export type StarNode = BaseNode & {
  type: 'star'
  width: number
  height: number
  points: number
  innerRadius: number
  style: Style
}

/**
 * Elliptical arc. Angles are degrees, counterclockwise from +x, as Illustrator's Arc tool labels
 * them; `pie` closes the arc through the centre, which is Illustrator's pie mode.
 */
export type ArcNode = BaseNode & {
  type: 'arc'
  width: number
  height: number
  startAngle: number
  sweepAngle: number
  pie: boolean
  style: Style
}

export type TextAlign = 'left' | 'center' | 'right'

/** Plain text (issue #16). Advanced typography stays in Phase 3, as the plan states. */
export type TextNode = BaseNode & {
  type: 'text'
  text: string
  /** Measured box, so bounds, hit testing, and marquee selection work like any other leaf. */
  width: number
  height: number
  fontSize: number
  fontFamily: string
  align: TextAlign
  lineHeight: number
  /** `style.fill` is the text color; stroke and opacity apply as they do to shapes. */
  style: Style
}

/** Placed raster image (issue #17). The pixels live in the asset registry, keyed by content. */
export type ImageCrop = { x: number; y: number; width: number; height: number }

export type ImageNode = BaseNode & {
  type: 'image'
  /** Content-addressed asset id; the document's `assets` list holds the metadata. */
  assetId: string
  width: number
  height: number
  /** Normalised source rectangle; crop never changes the original asset bytes. */
  crop: ImageCrop
  /** Optional raster alpha mask, also held as a normal document asset. */
  maskAssetId: string | null
  style: Style
}

export type GroupNode = BaseNode & {
  type: 'group'
  /** Paint order: the last child is drawn on top. */
  children: LayerNode[]
  /**
   * A direct child whose geometry clips this group's other children (issue #71). Null means no
   * clip. The clip object keeps its own style and transform and is not drawn on its own.
   */
  clipChildId?: string | null
}

export type LayerNode =
  | RectNode
  | EllipseNode
  | LineNode
  | PolygonNode
  | StarNode
  | ArcNode
  | TextNode
  | ImageNode
  | GroupNode
export type ShapeNode = RectNode | EllipseNode | LineNode | PolygonNode | StarNode | ArcNode
/** Anything that occupies a rectangular box in the tree and can be transformed by itself. */
export type LeafNode = ShapeNode | TextNode | ImageNode

export type Artboard = { id: string; name: string; width: number; height: number }

/** Asset descriptors stay here for later slices; slice 5 fills them in. */
export type AssetRef = {
  id: string
  mimeType: string
  byteLength: number
  width: number
  height: number
  /** Absolute path selected through the desktop picker; omitted assets are embedded. */
  sourcePath?: string
}

export type Document = {
  formatVersion: number
  /** Incremented by every applied command, so renderers can invalidate caches. */
  revision: number
  id: string
  name: string
  artboards: Artboard[]
  /** The document root is always a group, which keeps tree code uniform. */
  root: GroupNode
  assets: AssetRef[]
}

export function createTransform(x = 0, y = 0): Transform {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1 }
}

export function createStyle(fill = '#4f7cff'): Style {
  return { fill, stroke: null, opacity: 1 }
}

export function isGroup(node: LayerNode): node is GroupNode {
  return node.type === 'group'
}

/** Shapes and text: leaves with a box, a style, and no children. */
export function isLeaf(node: LayerNode): node is LeafNode {
  return node.type !== 'group'
}

export function isShape(node: LayerNode): node is ShapeNode {
  return (
    node.type === 'rect' ||
    node.type === 'ellipse' ||
    node.type === 'line' ||
    node.type === 'polygon' ||
    node.type === 'star' ||
    node.type === 'arc'
  )
}

export function isText(node: LayerNode): node is TextNode {
  return node.type === 'text'
}

export function isImage(node: LayerNode): node is ImageNode {
  return node.type === 'image'
}

/**
 * Nodes that carry a fill: shapes and text. An image's pixels are its appearance, and a line has
 * no interior — its appearance is its stroke — so neither is offered a fill control.
 */
export function supportsFill(node: LayerNode): node is Exclude<ShapeNode, LineNode> | TextNode {
  return isShape(node) && node.type !== 'line' ? true : node.type === 'text'
}

/** Local bounds of a node, ignoring its children and transform. */
export function nodeSize(node: LayerNode): { width: number; height: number } {
  return isGroup(node) ? { width: 0, height: 0 } : { width: node.width, height: node.height }
}
