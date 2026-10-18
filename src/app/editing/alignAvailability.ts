/**
 * When the align and distribute commands can act (Phase 4.4).
 *
 * The panels must disable exactly what the commands would refuse, so the rule lives here once and both
 * the panel and its tests read it.
 */

import { findNode } from '../../doc/document.ts'
import type { Document, NodeId } from '../../doc/types.ts'

export type AlignAvailability = {
  /** Two unlocked objects are the minimum for an alignment. */
  align: boolean
  /** Three are the minimum for a distribution: two would have no middle to move. */
  distribute: boolean
  count: number
}

export function alignAvailability(document: Document, ids: NodeId[]): AlignAvailability {
  let count = 0
  for (const id of ids) {
    const node = findNode(document, id)
    if (node !== null && !node.locked) count += 1
  }
  return { align: count >= 2, distribute: count >= 3, count }
}
