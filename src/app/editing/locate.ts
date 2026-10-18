/**
 * The Layers panel's locate column (Phase 4.5).
 *
 * Illustrator marks the row that *contains* the current selection, so a user can jump from a selected
 * object to its group. This returns those rows: every ancestor of a selected node that is not itself
 * selected, because a selected row needs no pointer to itself.
 */

import { findNode, findParent } from '../../doc/document.ts'
import type { Document, NodeId } from '../../doc/types.ts'

export function locateRowIds(document: Document, selection: NodeId[]): Set<NodeId> {
  const located = new Set<NodeId>()
  const selected = new Set(selection)
  for (const id of selection) {
    if (findNode(document, id) === null) continue
    let parent = findParent(document, id)
    while (parent !== null) {
      // The document root has no row of its own, so it is never a locate target.
      if (parent.id !== document.root.id && !selected.has(parent.id)) located.add(parent.id)
      parent = findParent(document, parent.id)
    }
  }
  return located
}
