/**
 * What the Transform panel and the Properties panel both need (Phase 4.4).
 *
 * One place for "the selection's box and its rotation", so the two surfaces cannot disagree about the
 * numbers they show.
 */

import { findNode } from '../../doc/document.ts'
import { unionBounds } from '../../doc/transform.ts'
import { isGroup, type Document, type NodeId } from '../../doc/types.ts'
import type { Rect } from '../../geom/transform.ts'

export type SelectionTransform = {
  box: Rect | null
  /** The common rotation, or 0 when the selected objects disagree or there is nothing selected. */
  rotation: number
}

export function selectionTransform(document: Document, ids: NodeId[]): SelectionTransform {
  const box = unionBounds(document, ids)
  const rotations: number[] = []
  for (const id of ids) {
    const node = findNode(document, id)
    if (node === null || isGroup(node)) continue
    rotations.push(((node.transform.rotation % 360) + 360) % 360)
  }
  const rotation = rotations.length > 0 && rotations.every((value) => value === rotations[0]) ? rotations[0] : 0
  return { box, rotation }
}
