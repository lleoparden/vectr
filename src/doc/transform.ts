/**
 * Document-level transform helpers (Phase 4.1).
 *
 * Union bounds needs the layer tree, so it belongs to the document layer. The pure algebra - factors,
 * scaled transforms, handle points - lives at L0 in `geom/transform.ts` so tools may use it.
 */

import { findNode, subtreeIds, worldBounds } from './document.ts'
import { isGroup, type Document, type NodeId } from './types.ts'
import type { Rect } from '../geom/transform.ts'

function unionOf(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/**
 * The world box a node occupies. A group has no box of its own, so its box is the union of its
 * leaves — which is what the user sees selected when they click the group.
 */
function nodeBounds(document: Document, id: NodeId): Rect | null {
  const node = findNode(document, id)
  if (node === null) return null
  if (!isGroup(node)) {
    const bounds = worldBounds(document, id)
    return bounds === null || (bounds.width === 0 && bounds.height === 0) ? null : bounds
  }
  let box: Rect | null = null
  for (const descendant of subtreeIds(document, id)) {
    const child = findNode(document, descendant)
    if (child === null || isGroup(child)) continue
    const bounds = worldBounds(document, descendant)
    if (bounds === null || (bounds.width === 0 && bounds.height === 0)) continue
    box = box === null ? { ...bounds } : unionOf(box, bounds)
  }
  return box
}

/** Union of the world bounds of the given ids; null when none of them has any. */

/** Screen-independent positions of the eight handles on a box. */

export function unionBounds(document: Document, ids: NodeId[]): Rect | null {
  let box: Rect | null = null
  for (const id of ids) {
    const bounds = nodeBounds(document, id)
    if (bounds === null) continue
    box = box === null ? bounds : unionOf(box, bounds)
  }
  return box
}
