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

import { findNode, worldTransform } from './document.ts'
import { isGroup, type Document, type LayerNode, type NodeId } from './types.ts'

export type Point = { x: number; y: number }

export type HitOptions = {
  /** Return the deepest hit node instead of its top-level ancestor. */
  deep?: boolean
  /** Include locked nodes (transforms are rejected separately by the command path). */
  includeLocked?: boolean
}

type Placed = {
  node: LayerNode
  x: number
  y: number
  scaleX: number
  scaleY: number
  /** Top-level ancestor id, used to collapse a hit to the isolation level. */
  root: NodeId
  /** True when the node or any ancestor is locked, so a locked group locks its subtree. */
  locked: boolean
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
): void {
  const nextX = x + node.transform.x * scaleX
  const nextY = y + node.transform.y * scaleY
  const nextScaleX = scaleX * node.transform.scaleX
  const nextScaleY = scaleY * node.transform.scaleY
  const locked = inheritedLocked || node.locked
  if (isGroup(node)) {
    for (const child of node.children) {
      if (child.hidden) continue
      placedChildren(child, nextX, nextY, nextScaleX, nextScaleY, root, locked, into)
    }
    return
  }
  into.push({ node, x: nextX, y: nextY, scaleX: nextScaleX, scaleY: nextScaleY, root, locked })
}

/** Every visible leaf with its world transform, in paint order. */
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
    const local = {
      x: (point.x - entry.x) / (entry.scaleX === 0 ? 1 : entry.scaleX),
      y: (point.y - entry.y) / (entry.scaleY === 0 ? 1 : entry.scaleY),
    }
    if (!containsLocalPoint(entry.node, local)) continue
    if (options.deep === true) return entry.node.id
    return entry.root === entry.node.id ? entry.node.id : entry.root
  }
  return null
}

/** World-space bounds of a placed leaf. */
export function placedBounds(entry: Placed): { x: number; y: number; width: number; height: number } {
  if (isGroup(entry.node)) return { x: entry.x, y: entry.y, width: 0, height: 0 }
  return {
    x: entry.x,
    y: entry.y,
    width: entry.node.width * entry.scaleX,
    height: entry.node.height * entry.scaleY,
  }
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
