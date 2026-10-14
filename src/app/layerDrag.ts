/**
 * Layer drag targeting (issue #20).
 *
 * Dragging a row in the Layers panel is the way Illustrator reorders: drop on the upper or
 * lower quarter of a row to place before or after it, and on the middle of a group to drop
 * inside it. The pointer position is turned into a destination here, as pure logic, and the
 * plan is simulated so a rejected step cannot leave a half-applied drag behind.
 */

import { applyCommand, isLocked } from '../doc/commands.ts'
import { childIndex, findNode, findParent, subtreeIds } from '../doc/document.ts'
import { isGroup, type Document, type NodeId } from '../doc/types.ts'
import { selectionInPaintOrder, stepCommand, type PlanStep } from './arrange.ts'
import type { LayerRow } from './layerRows.ts'

export type DropPlacement = 'before' | 'inside' | 'after'

export type DropTarget = {
  parentId: NodeId
  index: number
  placement: DropPlacement
  targetRowId: NodeId
}

/** Where a pointer at `ratio` of a row's height means the dragged node should land. */
export function placementFor(ratio: number, row: LayerRow): DropPlacement {
  if (isGroup(row.node) && ratio > 0.25 && ratio < 0.75) return 'inside'
  return ratio < 0.5 ? 'before' : 'after'
}

/**
 * The destination a drop means, or null when the drop is meaningless: onto itself, into its
 * own subtree (a cycle), or back where it already is.
 */
export function resolveDrop(
  document: Document,
  rows: LayerRow[],
  dragging: NodeId[],
  targetRowId: NodeId,
  ratio: number,
): DropTarget | null {
  if (dragging.length === 0) return null
  const targetRow = rows.find((row) => row.id === targetRowId)
  if (targetRow === undefined) return null

  // A node cannot land on itself or inside its own subtree.
  for (const id of dragging) {
    if (id === targetRowId) return null
    if (subtreeIds(document, id).includes(targetRowId)) return null
  }

  const placement = placementFor(ratio, targetRow)
  if (placement === 'inside') {
    const target = findNode(document, targetRowId)
    if (target === null || !isGroup(target)) return null
    if (isLocked(document, dragging[0])) return null
    if (isLocked(document, targetRowId)) return null
    const index = target.children.length
    if (findParent(document, dragging[0])?.id === targetRowId && childIndex(target, dragging[0]) === index - 1) {
      return null
    }
    return { parentId: targetRowId, index, placement, targetRowId }
  }

  const parent = findParent(document, targetRowId)
  if (parent === null) return null
  const targetIndex = childIndex(parent, targetRowId)
  const index = placement === 'before' ? targetIndex : targetIndex + 1

  if (isLocked(document, dragging[0])) return null
  if (isLocked(document, parent.id)) return null

  const currentParent = findParent(document, dragging[0])
  if (currentParent !== null && currentParent.id === parent.id) {
    const currentIndex = childIndex(parent, dragging[0])
    const effective = index > currentIndex ? index - 1 : index
    if (effective === currentIndex) return null
  }
  return { parentId: parent.id, index, placement, targetRowId }
}

/**
 * The moves a drop performs. A multi-selection drops as a block in paint order, so the
 * relative order the user sees is the order they get.
 */
export function planDrop(
  document: Document,
  rows: LayerRow[],
  dragging: NodeId[],
  targetRowId: NodeId,
  ratio: number,
): PlanStep[] | null {
  const target = resolveDrop(document, rows, dragging, targetRowId, ratio)
  if (target === null) return null

  const ordered = selectionInPaintOrder(document, dragging)
  if (ordered.length === 0) return null
  const steps: PlanStep[] = []
  let current = document
  let index = target.index

  // Each following node lands immediately after the one before it, so the block keeps its
  // relative order. Every index is read from the simulated document, so the "as if still in
  // place" index convention of `moveNode` stays correct.
  for (const id of ordered) {
    const step: PlanStep = { kind: 'move', nodeId: id, parentId: target.parentId, index }
    steps.push(step)
    const result = applyCommand(current, stepCommand(step))
    if (!result.ok) return null
    current = result.document
    const placedParent = findParent(current, id)
    if (placedParent === null) return null
    index = childIndex(placedParent, id) + 1
  }
  return steps.length === 0 ? null : steps
}
