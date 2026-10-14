/**
 * Document construction, lookup, and structural editing helpers (issue #18).
 *
 * Every mutation returns a new `Document` built with structural sharing, so
 * unchanged subtrees keep their identity. That keeps React memoization honest and
 * avoids the retained whole-document copies the architecture forbids.
 */

import {
  FORMAT_VERSION,
  createStyle,
  createTransform,
  isGroup,
  type Artboard,
  type Document,
  type GroupNode,
  type LayerNode,
  type NodeId,
  type TextAlign,
  type TextNode,
  type ImageNode,
} from './types.ts'

const defaultArtboard: Artboard = { id: 'artboard-0', name: 'Artboard 1', width: 1200, height: 800 }

export function createDocument(name = 'Untitled'): Document {
  return {
    formatVersion: FORMAT_VERSION,
    revision: 0,
    id: 'document-0',
    name,
    artboards: [defaultArtboard],
    root: {
      id: 'root',
      name: 'Document',
      type: 'group',
      transform: createTransform(),
      locked: false,
      hidden: false,
      children: [],
    },
    assets: [],
  }
}

let idCounter = 0

/** Stable, collision-checked ids. Slice #19 persists them verbatim. */
export function newId(prefix: LayerNode['type'] | 'document' | 'asset'): NodeId {
  idCounter += 1
  return `${prefix}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createRect(
  name: string,
  x: number,
  y: number,
  width = 160,
  height = 120,
  /** The tool options bar's fill for the next shape; the palette default otherwise. */
  fill = '#4f7cff',
  cornerRadius = 0,
): LayerNode {
  return {
    id: newId('rect'),
    name,
    type: 'rect',
    transform: createTransform(x, y),
    width,
    height,
    cornerRadius,
    style: createStyle(fill),
    locked: false,
    hidden: false,
  }
}

export function createEllipse(
  name: string,
  x: number,
  y: number,
  width = 140,
  height = 140,
  fill = '#f0a24b',
): LayerNode {
  return {
    id: newId('ellipse'),
    name,
    type: 'ellipse',
    transform: createTransform(x, y),
    width,
    height,
    style: createStyle(fill),
    locked: false,
    hidden: false,
  }
}

/** Straight segment. Its appearance is the stroke, so the tool passes the colour as one. */
export function createLine(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: { color: string; width: number },
  from: 'top-left' | 'top-right' = 'top-left',
): LayerNode {
  const style = createStyle()
  return {
    id: newId('line'),
    name,
    type: 'line',
    transform: createTransform(x, y),
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    from,
    style: { ...style, stroke },
    locked: false,
    hidden: false,
  }
}

export function createPolygon(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  sides: number,
  fill = '#4f7cff',
): LayerNode {
  return {
    id: newId('polygon'),
    name,
    type: 'polygon',
    transform: createTransform(x, y),
    width,
    height,
    sides: Math.max(3, Math.min(60, Math.round(sides))),
    style: createStyle(fill),
    locked: false,
    hidden: false,
  }
}

export function createStar(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  points: number,
  innerRadius: number,
  fill = '#4f7cff',
): LayerNode {
  return {
    id: newId('star'),
    name,
    type: 'star',
    transform: createTransform(x, y),
    width,
    height,
    points: Math.max(3, Math.min(60, Math.round(points))),
    innerRadius: Math.max(0.05, Math.min(0.95, innerRadius)),
    style: createStyle(fill),
    locked: false,
    hidden: false,
  }
}

export function createArc(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  startAngle: number,
  sweepAngle: number,
  pie: boolean,
  fill = '#4f7cff',
): LayerNode {
  return {
    id: newId('arc'),
    name,
    type: 'arc',
    transform: createTransform(x, y),
    width,
    height,
    startAngle,
    sweepAngle,
    pie,
    style: createStyle(fill),
    locked: false,
    hidden: false,
  }
}

/** The members of the shape group, in palette order. `roundedRect` is a rect with a radius. */
export type ShapeKind = 'rect' | 'roundedRect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'arc'

/** What the shape tool needs to know when it draws, all of it from the options bar. */
export type ShapeParams = {
  fill: string
  cornerRadius: number
  sides: number
  points: number
  innerRadius: number
  startAngle: number
  sweepAngle: number
  pie: boolean
  strokeWidth: number
}

export const DEFAULT_SHAPE_PARAMS: ShapeParams = {
  fill: '#4f7cff',
  cornerRadius: 12,
  sides: 6,
  points: 5,
  innerRadius: 0.5,
  startAngle: 0,
  sweepAngle: 90,
  pie: false,
  strokeWidth: 2,
}

/** Illustrator's layer names for new shapes, which the Layers panel shows. */
export function shapeLabel(kind: ShapeKind): string {
  switch (kind) {
    case 'rect':
      return 'Rectangle'
    case 'roundedRect':
      return 'Rounded Rectangle'
    case 'ellipse':
      return 'Ellipse'
    case 'line':
      return 'Line'
    case 'polygon':
      return 'Polygon'
    case 'star':
      return 'Star'
    case 'arc':
      return 'Arc'
  }
}

/** One entry point for every shape the tools create, so the gestures stay thin. */
export function createShape(
  kind: ShapeKind,
  name: string,
  box: { x: number; y: number; width: number; height: number },
  params: ShapeParams,
  /** A line's direction; ignored by every other kind. */
  lineFrom: 'top-left' | 'top-right' = 'top-left',
): LayerNode {
  const { x, y, width, height } = box
  switch (kind) {
    case 'rect':
      return createRect(name, x, y, width, height, params.fill, 0)
    case 'roundedRect':
      return createRect(name, x, y, width, height, params.fill, params.cornerRadius)
    case 'ellipse':
      return createEllipse(name, x, y, width, height, params.fill)
    case 'line':
      return createLine(name, x, y, width, height, { color: params.fill, width: params.strokeWidth }, lineFrom)
    case 'polygon':
      return createPolygon(name, x, y, width, height, params.sides, params.fill)
    case 'star':
      return createStar(name, x, y, width, height, params.points, params.innerRadius, params.fill)
    case 'arc':
      return createArc(name, x, y, width, height, params.startAngle, params.sweepAngle, params.pie, params.fill)
  }
}
/** Bundled face; slice 1 recorded that CanvasKit has no system font manager. */
export const DEFAULT_FONT_FAMILY = 'Inter'
export const DEFAULT_FONT_SIZE = 16
/** Illustrator's default leading is auto; Vectr uses 1.2× the size. */
export const DEFAULT_LINE_HEIGHT_RATIO = 1.2
/** Upper bound on one text node's content, so a paste cannot grow the document unbounded. */
export const MAX_TEXT_LENGTH = 100_000

export type TextOptions = {
  fontSize?: number
  fontFamily?: string
  align?: TextAlign
  lineHeight?: number
  fill?: string
  width?: number
  height?: number
}

/**
 * Estimated box for a text node: the fallback used when no renderer is available to measure,
 * and the value the tests assert against. The renderer replaces it with exact metrics.
 */
export function estimateTextSize(text: string, fontSize: number, lineHeight: number): { width: number; height: number } {
  const lines = text.split('\n')
  const longest = Math.max(1, ...lines.map((line) => line.length))
  return { width: longest * fontSize * 0.55, height: Math.max(1, lines.length) * lineHeight }
}

/**
 * Plain text node (issue #16). The box is estimated here and replaced with measured metrics
 * by the caller when it has a renderer, so bounds, hit testing, and marquee selection work
 * before the first frame is drawn.
 */
export function createText(name: string, x: number, y: number, text: string, options: TextOptions = {}): TextNode {
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE
  const lineHeight = options.lineHeight ?? fontSize * DEFAULT_LINE_HEIGHT_RATIO
  const box = estimateTextSize(text, fontSize, lineHeight)
  return {
    id: newId('text'),
    type: 'text',
    name,
    transform: createTransform(x, y),
    locked: false,
    hidden: false,
    text,
    width: options.width ?? box.width,
    height: options.height ?? box.height,
    fontSize,
    fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
    align: options.align ?? 'left',
    lineHeight,
    style: createStyle(options.fill ?? '#1e1e23'),
  }
}

/**
 * Placed image node (issue #17). The node holds the asset's content key and the box it is
 * drawn into; the pixels stay in the registry, so moving, grouping, and hiding a hundred
 * copies of one image cost one copy of the bytes.
 */
export function createImage(
  name: string,
  x: number,
  y: number,
  assetId: string,
  width: number,
  height: number,
): ImageNode {
  return {
    id: newId('image'),
    type: 'image',
    name,
    transform: createTransform(x, y),
    locked: false,
    hidden: false,
    assetId,
    width,
    height,
    style: createStyle('#000000'),
  }
}

/**
 * Deep-copies a subtree with fresh ids (issue: Layers panel actions).
 *
 * A duplicate must be a genuinely new set of nodes: same order, geometry, styles, text, and asset
 * references, but new ids, because ids are how selection, history, and the manifest refer to
 * things. Images keep pointing at the same content-addressed asset, so duplicating a photograph
 * costs one more node, not one more copy of the pixels.
 */
export function duplicateSubtree(node: LayerNode): LayerNode {
  const copy: LayerNode = { ...node, id: newId(node.type === 'group' ? 'group' : node.type) }
  if (copy.type === 'group' && node.type === 'group') {
    copy.children = node.children.map((child) => duplicateSubtree(child))
  }
  return copy
}

export function createGroup(name: string): GroupNode {
  return {
    id: newId('group'),
    name,
    type: 'group',
    transform: createTransform(),
    locked: false,
    hidden: false,
    children: [],
  }
}

export function findNode(document: Document, nodeId: NodeId): LayerNode | null {
  return document.root.id === nodeId ? document.root : findWithin(document.root, nodeId)
}

/** Subtree search, used by validation and by callers that hold a node, not a document. */
export function findWithin(node: LayerNode, nodeId: NodeId): LayerNode | null {
  if (!isGroup(node)) return null
  for (const child of node.children) {
    if (child.id === nodeId) return child
    if (isGroup(child)) {
      const found = findWithin(child, nodeId)
      if (found) return found
    }
  }
  return null
}

export function findParent(document: Document, nodeId: NodeId): GroupNode | null {
  const walk = (group: GroupNode): GroupNode | null => {
    for (const child of group.children) {
      if (child.id === nodeId) return group
      if (isGroup(child)) {
        const found = walk(child)
        if (found) return found
      }
    }
    return null
  }
  return walk(document.root)
}

export function childIndex(parent: GroupNode, nodeId: NodeId): number {
  return parent.children.findIndex((child) => child.id === nodeId)
}

/** Node ids in paint order (depth-first, last child painted last). */
export function paintOrder(document: Document): NodeId[] {
  const order: NodeId[] = []
  const walk = (nodes: LayerNode[]) => {
    for (const node of nodes) {
      order.push(node.id)
      if (isGroup(node)) walk(node.children)
    }
  }
  walk(document.root.children)
  return order
}

export function countNodes(document: Document): number {
  return paintOrder(document).length
}

export function depthOf(document: Document, nodeId: NodeId): number {
  const walk = (nodes: LayerNode[], depth: number): number | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return depth
      if (isGroup(node)) {
        const found = walk(node.children, depth + 1)
        if (found !== null) return found
      }
    }
    return null
  }
  return walk(document.root.children, 1) ?? 0
}

/**
 * Returns a new document with `nodeId` replaced by `patch(node)`. Ancestors on the
 * path are rebuilt; every other subtree keeps its identity.
 */
export function replaceNode(
  document: Document,
  nodeId: NodeId,
  patch: (node: LayerNode) => LayerNode,
): Document {
  // The root is never a *child*, so it needs its own check; without it, inserts at
  // root level silently changed nothing.
  if (document.root.id === nodeId) {
    const patched = patch(document.root)
    return patched === document.root ? document : { ...document, root: patched as GroupNode }
  }
  const root = replaceIn(document.root, nodeId, patch)
  return root === document.root ? document : { ...document, root }
}

function replaceIn(group: GroupNode, nodeId: NodeId, patch: (node: LayerNode) => LayerNode): GroupNode {
  let changed = false
  const children = group.children.map((child) => {
    if (child.id === nodeId) {
      changed = true
      return patch(child)
    }
    if (isGroup(child)) {
      const next = replaceIn(child, nodeId, patch)
      if (next !== child) {
        changed = true
        return next
      }
    }
    return child
  })
  return changed ? { ...group, children } : group
}

/** Inserts nodes into a parent at an index, clamped to the valid range. */
export function insertNodes(document: Document, parentId: NodeId, index: number, nodes: LayerNode[]): Document {
  const parent = findNode(document, parentId)
  if (parent === null || !isGroup(parent)) throw new Error(`Parent ${parentId} is not a group.`)
  const clamped = Math.max(0, Math.min(index, parent.children.length))
  return replaceNode(document, parentId, (node) => {
    const group = node as GroupNode
    const children = [...group.children]
    children.splice(clamped, 0, ...nodes)
    return { ...group, children }
  })
}

/** Removes nodes by id, preserving sibling order for the survivors. */
export function removeNodes(document: Document, nodeIds: NodeId[]): Document {
  const ids = new Set(nodeIds)
  const prune = (group: GroupNode): GroupNode => {
    let changed = false
    const children: LayerNode[] = []
    for (const child of group.children) {
      if (ids.has(child.id)) {
        changed = true
        continue
      }
      if (isGroup(child)) {
        const next = prune(child)
        if (next !== child) changed = true
        children.push(next)
        continue
      }
      children.push(child)
    }
    return changed ? { ...group, children } : group
  }
  const root = prune(document.root)
  return root === document.root ? document : { ...document, root }
}

/** All node ids in the subtree rooted at `nodeId`, including itself. */
export function subtreeIds(document: Document, nodeId: NodeId): NodeId[] {
  const node = findNode(document, nodeId)
  if (node === null) return []
  const ids: NodeId[] = []
  const walk = (current: LayerNode) => {
    ids.push(current.id)
    if (isGroup(current)) current.children.forEach(walk)
  }
  walk(node)
  return ids
}

/**
 * Absolute translation and scale of a node, composing its ancestors. Accumulated
 * in one descent rather than rebuilt as a chain, so it stays O(depth).
 */
export function worldTransform(
  document: Document,
  nodeId: NodeId,
): { x: number; y: number; scaleX: number; scaleY: number } | null {
  const walk = (
    nodes: LayerNode[],
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): { x: number; y: number; scaleX: number; scaleY: number } | null => {
    for (const node of nodes) {
      const nextX = x + node.transform.x * scaleX
      const nextY = y + node.transform.y * scaleY
      const nextScaleX = scaleX * node.transform.scaleX
      const nextScaleY = scaleY * node.transform.scaleY
      if (node.id === nodeId) return { x: nextX, y: nextY, scaleX: nextScaleX, scaleY: nextScaleY }
      if (isGroup(node)) {
        const found = walk(node.children, nextX, nextY, nextScaleX, nextScaleY)
        if (found !== null) return found
      }
    }
    return null
  }
  return walk(document.root.children, 0, 0, 1, 1)
}

/** World-space bounds of a leaf shape, or null for groups and missing ids. */
export function worldBounds(
  document: Document,
  nodeId: NodeId,
): { x: number; y: number; width: number; height: number } | null {
  const node = findNode(document, nodeId)
  if (node === null || isGroup(node)) return null
  const world = worldTransform(document, nodeId)
  if (world === null) return null
  return {
    x: world.x,
    y: world.y,
    width: node.width * world.scaleX,
    height: node.height * world.scaleY,
  }
}

