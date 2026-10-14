/**
 * Vectr document model (Phase 1 slice 2, issue #18).
 *
 * The document is the single source of truth: a versioned, renderer-independent
 * layer tree with stable ids, local transforms, and styles. Nothing here knows
 * about Skia, React, or the DOM. Serialization lands in slice #19, so the shape
 * stays JSON-safe (no class instances, no functions, no undefined values).
 */

/** Bump when the persisted shape changes; migration hooks key off this. */
export const FORMAT_VERSION = 1

export type NodeId = string

/** Local transform relative to the parent. Rotation is reserved for slice 2b. */
export type Transform = {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export type Stroke = { color: string; width: number }

export type Style = {
  /** CSS hex color, for example `#4f7cff`. */
  fill: string
  stroke: Stroke | null
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

export type GroupNode = BaseNode & {
  type: 'group'
  /** Paint order: the last child is drawn on top. */
  children: LayerNode[]
}

export type LayerNode = RectNode | EllipseNode | GroupNode
export type ShapeNode = RectNode | EllipseNode

export type Artboard = { id: string; name: string; width: number; height: number }

/** Asset descriptors stay here for later slices; slice 5 fills them in. */
export type AssetRef = {
  id: string
  mimeType: string
  byteLength: number
  width: number
  height: number
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

export function isShape(node: LayerNode): node is ShapeNode {
  return node.type === 'rect' || node.type === 'ellipse'
}

/** Local bounds of a node, ignoring its children and transform. */
export function nodeSize(node: LayerNode): { width: number; height: number } {
  return isGroup(node) ? { width: 0, height: 0 } : { width: node.width, height: node.height }
}
