/**
 * Align and distribute planners (Phase 2.3, issue #66).
 *
 * Pure: the document and a selection in, a list of transform moves out. The caller runs them
 * through the existing command path inside one transaction, so each command is one undo entry and
 * no new document command exists. Locked nodes are left where they are rather than failing the
 * whole command, and a locked node in the selection is skipped the way Clear skips it.
 *
 * Policy, stated because Illustrator has several: alignment is against the selection's own union
 * box (no key object yet), and distribution spaces the objects' *centres* evenly between the
 * first and last, which is Illustrator's default Distribute Objects behaviour.
 */

import { findNode, worldBounds } from '../../doc/document.ts'
import type { Document, NodeId, Transform } from '../../doc/types.ts'
import { unionBounds } from '../../doc/transform.ts'
import { type Rect } from '../../geom/transform.ts'

export type AlignMode = 'left' | 'horizontalCenter' | 'right' | 'top' | 'verticalCenter' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

/** One object's move: absolute transform plus the world delta that produced it. */
export type AlignMove = { nodeId: NodeId; transform: Transform }

type Place = { id: NodeId; bounds: Rect; transform: Transform }

/** Visible, unlocked, non-empty places in paint order. */
function places(document: Document, ids: NodeId[]): Place[] {
  const result: Place[] = []
  for (const id of ids) {
    const node = findNode(document, id)
    if (node === null || node.hidden || node.locked) continue
    const bounds = worldBounds(document, id)
    if (bounds === null) continue
    if (bounds.width === 0 && bounds.height === 0) continue
    result.push({ id, bounds, transform: node.transform })
  }
  return result
}

/** Aligns two or more objects inside the selection's own box; fewer than two does nothing. */
export function planAlign(document: Document, ids: NodeId[], mode: AlignMode): AlignMove[] {
  const targets = places(document, ids)
  if (targets.length < 2) return []
  const box = unionBounds(document, targets.map((target) => target.id))
  if (box === null) return []
  const moves: AlignMove[] = []
  for (const target of targets) {
    let dx = 0
    let dy = 0
    if (mode === 'left') dx = box.x - target.bounds.x
    if (mode === 'horizontalCenter') dx = box.x + box.width / 2 - (target.bounds.x + target.bounds.width / 2)
    if (mode === 'right') dx = box.x + box.width - (target.bounds.x + target.bounds.width)
    if (mode === 'top') dy = box.y - target.bounds.y
    if (mode === 'verticalCenter') dy = box.y + box.height / 2 - (target.bounds.y + target.bounds.height / 2)
    if (mode === 'bottom') dy = box.y + box.height - (target.bounds.y + target.bounds.height)
    if (dx === 0 && dy === 0) continue
    moves.push({ nodeId: target.id, transform: { ...target.transform, x: target.transform.x + dx, y: target.transform.y + dy } })
  }
  return moves
}

/**
 * Spaces three or more objects' centres evenly along an axis, keeping the two outermost where they
 * are. Fewer than three has no middle to space, so it does nothing.
 */
export function planDistribute(document: Document, ids: NodeId[], axis: DistributeAxis): AlignMove[] {
  const targets = places(document, ids)
  if (targets.length < 3) return []
  const centre = (target: Place) =>
    axis === 'horizontal' ? target.bounds.x + target.bounds.width / 2 : target.bounds.y + target.bounds.height / 2
  const sorted = [...targets].sort((a, b) => centre(a) - centre(b))
  const first = centre(sorted[0])
  const last = centre(sorted[sorted.length - 1])
  const gap = (last - first) / (sorted.length - 1)
  if (!Number.isFinite(gap) || gap === 0) return []
  const moves: AlignMove[] = []
  for (let index = 1; index < sorted.length - 1; index += 1) {
    const target = sorted[index]
    const wanted = first + gap * index
    const delta = wanted - centre(target)
    if (delta === 0) continue
    moves.push({
      nodeId: target.id,
      transform:
        axis === 'horizontal'
          ? { ...target.transform, x: target.transform.x + delta }
          : { ...target.transform, y: target.transform.y + delta },
    })
  }
  return moves
}
