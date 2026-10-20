/**
 * Hit testing for the editor canvas (issue #18).
 *
 * Pure math over the document: a scene point in, node ids out. Keeping it out of
 * the renderer and the DOM means selection is testable without a GPU and the same
 * logic can later serve MCP and the built-in agent.
 *
 * Rules recorded for slices 3–6:
 * - Hidden nodes are never hit.
 * - A click selects the top-level (isolation-level) object; `deep` returns the
 *   deepest leaf instead, which direct selection and group editing will use.
 * - Groups are hit when any descendant is hit, so an empty group is never hit.
 */

import { findNode, findParent, worldTransform } from './document.ts'
import { isGroup, type Document, type LayerNode, type NodeId } from './types.ts'
import { clipPolygon } from '../geom/shapeGeometry.ts'
import { distanceToPolyline, flattenPath } from '../geom/path.ts'

export type Point = { x: number; y: number }

export type HitOptions = {
  /** Return the deepest hit node instead of its top-level ancestor. */
  deep?: boolean
  /** Include locked nodes (transforms are rejected separately by the command path). */
  includeLocked?: boolean
}

type PlacedClip = { points: Point[]; x: number; y: number; scaleX: number; scaleY: number }

type Placed = {
  node: LayerNode
  x: number
  y: number
  scaleX: number
  scaleY: number
  /** Degrees about the leaf's own centre; groups do not rotate (issue #120). */
  rotation: number
  /** Top-level ancestor id, used to collapse a hit to the isolation level. */
  root: NodeId
  /** True when the node or any ancestor is locked, so a locked group locks its subtree. */
  locked: boolean
  /** The clip in force for this leaf, when its group is clipped (issue #71). */
  clip: PlacedClip | null
}

function placedChildren(
  node: LayerNode,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  root: NodeId,
  inheritedLocked: boolean,
  into: Placed[],
  clip: PlacedClip | null = null,
): void {
  const nextX = x + node.transform.x * scaleX
  const nextY = y + node.transform.y * scaleY
  const nextScaleX = scaleX * node.transform.scaleX
  const nextScaleY = scaleY * node.transform.scaleY
  const locked = inheritedLocked || node.locked
  if (isGroup(node)) {
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
      if (clipId !== null && child.id === clipId) continue
      placedChildren(child, nextX, nextY, nextScaleX, nextScaleY, root, locked, into, nextClip)
    }
    return
  }
  into.push({ node, x: nextX, y: nextY, scaleX: nextScaleX, scaleY: nextScaleY, rotation: node.transform.rotation, root, locked, clip })
}

/** Every visible leaf with its world transform, in paint order. */
/** True when a world point is inside a placed entry's clip (always true when it has none). */
export function insideClip(entry: Placed, point: Point): boolean {
  if (entry.clip === null) return true
  const local = {
    x: (point.x - entry.clip.x) / (entry.clip.scaleX === 0 ? 1 : entry.clip.scaleX),
    y: (point.y - entry.clip.y) / (entry.clip.scaleY === 0 ? 1 : entry.clip.scaleY),
  }
  return polygonContains(entry.clip.points, local)
}

export function placedLeaves(document: Document): Placed[] {
  const placed: Placed[] = []
  for (const root of document.root.children) {
    if (root.hidden) continue
    placedChildren(root, 0, 0, 1, 1, root.id, false, placed)
  }
  return placed
}

/** Point-in-shape test in the node's own local space. */
export function containsLocalPoint(node: LayerNode, local: Point): boolean {
  if (isGroup(node)) return false
  // Rectangles, text, and images occupy their box; ellipses are tested against the ellipse.
  if (node.type === 'path') {
    const points = flattenPath(node.anchors, node.closed)
    if (node.closed && polygonContains(points, local)) return true
    // An open path, or a closed one clicked outside its fill, is hit by its stroke.
    const width = node.style.stroke?.width ?? 0
    return width > 0 && distanceToPolyline(points, node.closed, local) <= width / 2 + 3
  }
  if (node.type === 'rect' || node.type === 'text' || node.type === 'image') {
    return local.x >= 0 && local.x <= node.width && local.y >= 0 && local.y <= node.height
  }
  const radiusX = node.width / 2
  const radiusY = node.height / 2
  if (radiusX <= 0 || radiusY <= 0) return false
  const dx = (local.x - radiusX) / radiusX
  const dy = (local.y - radiusY) / radiusY
  return dx * dx + dy * dy <= 1
}

/** Topmost node at a scene point, or null when nothing is hit. */
export function hitTest(document: Document, point: Point, options: HitOptions = {}): NodeId | null {
  const placed = placedLeaves(document)
  for (let index = placed.length - 1; index >= 0; index -= 1) {
    const entry = placed[index]
    if (entry.locked && options.includeLocked !== true) continue
    // A rotated node is tested against the point rotated back into its own frame, so a click lands
    // where the object looks (issue #120).
    const probe = entry.rotation === 0 ? point : rotateAboutCentre(point, entry, -entry.rotation)
    const local = {
      x: (probe.x - entry.x) / (entry.scaleX === 0 ? 1 : entry.scaleX),
      y: (probe.y - entry.y) / (entry.scaleY === 0 ? 1 : entry.scaleY),
    }
    if (!containsLocalPoint(entry.node, local)) continue
    // A clipped-away point is not a hit: selecting what cannot be seen is a lie (issue #71).
    if (!insideClip(entry, point)) continue
    if (options.deep === true) return entry.node.id
    return entry.root === entry.node.id ? entry.node.id : entry.root
  }
  return null
}

/** World-space bounds of a placed leaf. */
export function placedBounds(entry: Placed): { x: number; y: number; width: number; height: number } {
  if (isGroup(entry.node)) return { x: entry.x, y: entry.y, width: 0, height: 0 }
  const box = {
    x: entry.x,
    y: entry.y,
    width: entry.node.width * entry.scaleX,
    height: entry.node.height * entry.scaleY,
  }
  if (entry.rotation === 0) return box
  // A rotated leaf occupies the axis-aligned box around its four rotated corners, which is what a
  // marquee or a lasso can honestly test (issue #120).
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ].map((corner) => rotateAboutCentre(corner, entry, entry.rotation))
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

/** Rotates a point about a placed leaf's centre; positive degrees turn clockwise on screen. */
function rotateAboutCentre(point: Point, entry: Placed, degrees: number): Point {
  const centreX = entry.x + (entry.node.type === 'group' ? 0 : (entry.node.width * entry.scaleX) / 2)
  const centreY = entry.y + (entry.node.type === 'group' ? 0 : (entry.node.height * entry.scaleY) / 2)
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - centreX
  const dy = point.y - centreY
  return { x: centreX + dx * cos - dy * sin, y: centreY + dx * sin + dy * cos }
}

/**
 * Ids touched by a marquee rectangle, collapsed to their top-level object and
 * returned in paint order.
 */
export function marqueeHitTest(
  document: Document,
  rectangle: { x: number; y: number; width: number; height: number },
  options: HitOptions = {},
): NodeId[] {
  const left = Math.min(rectangle.x, rectangle.x + rectangle.width)
  const right = Math.max(rectangle.x, rectangle.x + rectangle.width)
  const top = Math.min(rectangle.y, rectangle.y + rectangle.height)
  const bottom = Math.max(rectangle.y, rectangle.y + rectangle.height)
  const ids: NodeId[] = []
  const seen = new Set<NodeId>()
  for (const entry of placedLeaves(document)) {
    if (entry.locked && options.includeLocked !== true) continue
    const bounds = placedBounds(entry)
    const intersects =
      bounds.x <= right && bounds.x + bounds.width >= left && bounds.y <= bottom && bounds.y + bounds.height >= top
    if (!intersects) continue
    const id = options.deep === true ? entry.node.id : entry.root
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/** World-space center of a node, used to frame the view or position a new shape. */
export function sceneAnchor(document: Document, nodeId: NodeId): Point | null {
  const node = findNode(document, nodeId)
  if (node === null) return null
  const world = worldTransform(document, nodeId)
  if (world === null) return null
  if (isGroup(node)) return { x: world.x, y: world.y }
  return { x: world.x + (node.width * world.scaleX) / 2, y: world.y + (node.height * world.scaleY) / 2 }
}

/**
 * Even-odd point-in-polygon test for the Lasso tool (Phase 2.1, issue #64). A point exactly on the
 * path counts as inside, so a lasso drawn tightly around an object's corner still catches it.
 */
export function polygonContains(points: Point[], point: Point): boolean {
  if (points.length < 3) return false
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index]
    const b = points[previous]
    if (pointOnSegment(a, b, point)) return true
    const crosses = a.y > point.y !== b.y > point.y
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

const EPSILON = 1e-9

function pointOnSegment(a: Point, b: Point, point: Point): boolean {
  const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
  if (Math.abs(cross) > EPSILON) return false
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  )
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const direction = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = direction(c, d, a)
  const d2 = direction(c, d, b)
  const d3 = direction(a, b, c)
  const d4 = direction(a, b, d)
  return ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
    ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
}

/**
 * True when a closed path encloses a rectangle. Vectr matches Illustrator's lasso rule: every corner of the object is inside the path, and no
 */
export function polygonEnclosesBounds(
  points: Point[],
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  if (points.length === 0) return false
  const corners: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
  for (const corner of corners) {
    if (!polygonContains(points, corner)) return false
  }
  if (points.length === 1) return false
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    for (let side = 0; side < 4; side += 1) {
      if (segmentsCross(a, b, corners[side], corners[(side + 1) % 4])) return false
    }
  }
  return true
}

/**
 * Ids a Lasso path encloses, in paint order. Collapsed to the top-level object unless `deep`
 * is set, so the Lasso selects objects the way the Selection tool does.
 */
export function lassoHitTest(document: Document, points: Point[], options: HitOptions = {}): NodeId[] {
  const ids: NodeId[] = []
  const seen = new Set<NodeId>()
  for (const entry of placedLeaves(document)) {
    if (entry.locked && options.includeLocked !== true) continue
    if (!polygonEnclosesBounds(points, placedBounds(entry))) continue
    const id = options.deep === true ? entry.node.id : entry.root
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * The top-level-to-leaf chain of ids under a scene point, or null when nothing is hit. The chain is
 * what makes double-click hierarchy drilling aware of how deeply an object is nested.
 */
function hitChain(document: Document, point: Point): NodeId[] | null {
  const leaf = hitTest(document, point, { deep: true })
  if (leaf === null) return null
  const chain: NodeId[] = []
  let current: NodeId | null = leaf
  while (current !== null) {
    chain.unshift(current)
    const parent = findParent(document, current)
    current = parent === null || parent.id === document.root.id ? null : parent.id
  }
  return chain
}

/**
 * What a double-click on the canvas selects: Illustrator's one-level-at-a-time descent. With
 * nothing selected the first level in from the top-level object is chosen; a second double-click
 * with that group selected descends again; a leaf cannot go deeper.
 */
export function hierarchySelection(document: Document, point: Point, selection: NodeId[]): NodeId | null {
  const chain = hitChain(document, point)
  if (chain === null) return null
  const index = selection.length === 1 ? chain.indexOf(selection[0]) : -1
  const next = index >= 0 ? Math.min(index + 1, chain.length - 1) : Math.min(1, chain.length - 1)
  return chain[next]
}
