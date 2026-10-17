/**
 * Isolation mode (Phase 2.8, issue #71).
 *
 * Isolation is workspace state, not document state: the user is editing inside one group, so
 * selection, marquee, and lasso are limited to its subtree and clicking outside changes nothing.
 * Nothing about it can reach the file, the renderer, or the compiler — which is why it is a session
 * pointer plus a few pure filters rather than a command.
 */

import { placedLeaves } from '../../doc/hitTest.ts'
import type { Point } from '../../doc/hitTest.ts'
import { containsLocalPoint } from '../../doc/hitTest.ts'
import { findNode, subtreeIds } from '../../doc/document.ts'
import { isGroup, type Document, type NodeId } from '../../doc/types.ts'

/** Ids inside the isolated group, or null when the document is not isolated. */
export function isolatedIds(document: Document, isolatedGroupId: string | null): Set<NodeId> | null {
  if (isolatedGroupId === null) return null
  const node = findNode(document, isolatedGroupId)
  if (node === null || !isGroup(node)) return null
  return new Set(subtreeIds(document, isolatedGroupId))
}

/** True when an id may be selected; everything is selectable when not isolated. */
export function isSelectable(document: Document, isolatedGroupId: string | null, id: NodeId): boolean {
  const ids = isolatedIds(document, isolatedGroupId)
  return ids === null ? true : ids.has(id) && id !== isolatedGroupId
}

/** Restricts a selection to what isolation allows, keeping order. */
export function withinIsolation(document: Document, isolatedGroupId: string | null, ids: NodeId[]): NodeId[] {
  const allowed = isolatedIds(document, isolatedGroupId)
  if (allowed === null) return ids
  return ids.filter((id) => allowed.has(id) && id !== isolatedGroupId)
}

/**
 * The deepest leaf under a point *inside* the isolated subtree, or null when the point is outside
 * it. Selection inside isolation is leaf-level, which is what makes editing a group's contents feel
 * like editing alone.
 */
export function deepHitWithin(document: Document, isolatedGroupId: string | null, point: Point): NodeId | null {
  const allowed = isolatedIds(document, isolatedGroupId)
  if (allowed === null) return null
  const leaves = placedLeaves(document)
  for (let index = leaves.length - 1; index >= 0; index -= 1) {
    const entry = leaves[index]
    if (entry.locked || !allowed.has(entry.node.id)) continue
    const local = {
      x: (point.x - entry.x) / (entry.scaleX === 0 ? 1 : entry.scaleX),
      y: (point.y - entry.y) / (entry.scaleY === 0 ? 1 : entry.scaleY),
    }
    if (containsLocalPoint(entry.node, local)) return entry.node.id
  }
  return null
}

/** The name to show while isolated, or null. */
export function isolationLabel(document: Document, isolatedGroupId: string | null): string | null {
  if (isolatedGroupId === null) return null
  const node = findNode(document, isolatedGroupId)
  return node === null ? null : node.name
}

/**
 * The group to isolate for a selection: the selected group itself, or the group that contains the
 * selected object. Illustrator enters isolation by double-clicking into a group, so "the group you
 * clicked into" is the intent either way.
 */
export function groupToIsolate(document: Document, selection: NodeId[]): NodeId | null {
  if (selection.length === 0) return null
  const first = findNode(document, selection[0])
  if (first === null) return null
  if (isGroup(first)) return first.id
  const walk = (nodes: Document['root']['children']): NodeId | null => {
    for (const node of nodes) {
      if (node.id === selection[0]) return null
      if (isGroup(node)) {
        if (node.children.some((child) => child.id === selection[0])) return node.id
        const deeper = walk(node.children)
        if (deeper !== null) return deeper
      }
    }
    return null
  }
  return walk(document.root.children)
}
