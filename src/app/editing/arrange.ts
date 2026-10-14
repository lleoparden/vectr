/**
 * Layer arrangement planning (issue #20).
 *
 * Group, Ungroup, and the four Arrange commands are composed from the commands that already
 * exist (`insertNodes`, `moveNode`, `removeNodes`). Grouping therefore needs no new document
 * command, and because a gesture runs in one transaction it is one undo step through the
 * aggregate inverse from issue #34.
 *
 * The planning is pure: it simulates each planned step on a local document so every index is
 * computed against the state the command will actually see, which is what keeps a multi-node
 * Bring Forward from scrambling its own order. The module is testable without a store or a
 * browser.
 */

import { applyCommand, type Command } from '../../doc/commands.ts'
import { childIndex, createGroup, findNode, findParent, paintOrder } from '../../doc/document.ts'
import { isGroup, type Document, type LayerNode, type NodeId } from '../../doc/types.ts'

export type ArrangeWhere = 'front' | 'forward' | 'backward' | 'back'

export type PlanStep =
  | { kind: 'insert'; parentId: NodeId; index: number; nodes: LayerNode[] }
  | { kind: 'move'; nodeId: NodeId; parentId: NodeId; index: number }
  | { kind: 'remove'; nodeIds: NodeId[] }

/** The command a plan step runs, so planning and execution cannot disagree. */
export function stepCommand(step: PlanStep): Command {
  switch (step.kind) {
    case 'insert':
      return { type: 'insertNodes', parentId: step.parentId, index: step.index, nodes: step.nodes }
    case 'move':
      return { type: 'moveNode', nodeId: step.nodeId, parentId: step.parentId, index: step.index }
    case 'remove':
      return { type: 'removeNodes', nodeIds: step.nodeIds }
  }
}

/** The parent that contains every selected node, or null when they are spread across parents. */
export function sharedParent(document: Document, selection: NodeId[]): NodeId | null {
  if (selection.length === 0) return null
  const parents = new Set<NodeId>()
  for (const id of selection) {
    const parent = findParent(document, id)
    if (parent === null) return null
    parents.add(parent.id)
  }
  return parents.size === 1 ? [...parents][0] : null
}

/** Selected ids in paint order, the order grouping keeps. */
export function selectionInPaintOrder(document: Document, selection: NodeId[]): NodeId[] {
  const wanted = new Set(selection)
  const ordered: NodeId[] = []
  const walk = (nodes: LayerNode[]) => {
    for (const node of nodes) {
      if (wanted.has(node.id)) ordered.push(node.id)
      if (isGroup(node)) walk(node.children)
    }
  }
  walk(document.root.children)
  return ordered
}

/** How many groups the document holds, so a new one can be named the way nodes are named. */
export function countGroups(document: Document): number {
  let count = 0
  const walk = (nodes: LayerNode[]) => {
    for (const node of nodes) {
      if (!isGroup(node)) continue
      count += 1
      walk(node.children)
    }
  }
  walk(document.root.children)
  return count
}

/**
 * The moves one Arrange press performs. Illustrator moves every selected object by one
 * position for Bring Forward / Send Backward and to the extreme for Bring to Front / Send to
 * Back, preserving the selection's relative order.
 */
export function planArrange(document: Document, selection: NodeId[], where: ArrangeWhere): PlanStep[] {
  const parentId = sharedParent(document, selection)
  if (parentId === null) return []
  const parent = findNode(document, parentId)
  if (parent === null || !isGroup(parent)) return []
  // Everything is selected: there is nowhere to move any of it.
  if (selection.length >= parent.children.length) return []

  const ordered = selectionInPaintOrder(document, selection)
  // Bring to Front and Send Backward walk the selection bottom-up; their mirrors walk it
  // top-down, which is what keeps the relative order intact while indices shift.
  const sequence = where === 'front' || where === 'backward' ? ordered : [...ordered].reverse()

  const steps: PlanStep[] = []
  let current = document
  for (const id of sequence) {
    const container = findNode(current, parentId)
    if (container === null || !isGroup(container)) break
    const index = childIndex(container, id)
    const count = container.children.length
    let target: number | null = null
    if (where === 'front') target = index >= count - 1 ? null : count
    else if (where === 'back') target = index <= 0 ? null : 0
    else if (where === 'forward') target = index >= count - 1 ? null : index + 2
    else target = index <= 0 ? null : index - 1
    if (target === null) continue

    const step: PlanStep = { kind: 'move', nodeId: id, parentId, index: target }
    steps.push(step)
    const result = applyCommand(current, stepCommand(step))
    // A step the command path would refuse means the whole press is refused: the UI never
    // half-applies a plan, because `runEditorAction` dispatches nothing unless every step
    // validated.
    if (!result.ok) return []
    current = result.document
  }
  return steps
}

/** Whether an Arrange press could move anything, used to grey the menu items out. */
export function canArrange(document: Document, selection: NodeId[], where: ArrangeWhere): boolean {
  return planArrange(document, selection, where).length > 0
}

/**
 * Group: one new group takes the stacking position of the topmost selected node, then every
 * selected node moves in, keeping their relative order.
 */
export function planGroup(document: Document, selection: NodeId[]): PlanStep[] | null {
  const parentId = sharedParent(document, selection)
  if (parentId === null) return null
  const ordered = selectionInPaintOrder(document, selection)
  if (ordered.length === 0) return null

  const parent = findNode(document, parentId)
  if (parent === null || !isGroup(parent)) return null
  const topIndex = Math.max(...ordered.map((id) => childIndex(parent, id)))
  const group = createGroup(`Group ${countGroups(document) + 1}`)

  const steps: PlanStep[] = [{ kind: 'insert', parentId, index: topIndex + 1, nodes: [group] }]
  ordered.forEach((id, position) => {
    steps.push({ kind: 'move', nodeId: id, parentId: group.id, index: position })
  })

  // Validate the whole plan before anything is dispatched.
  let current = document
  for (const step of steps) {
    const result = applyCommand(current, stepCommand(step))
    if (!result.ok) return null
    current = result.document
  }
  return steps
}

/**
 * Ungroup: each child moves out to the group's own position, then the empty group is removed.
 * Groups with nothing to ungroup are skipped, so a selection mixing groups and shapes works.
 */
export function planUngroup(document: Document, selection: NodeId[]): PlanStep[] | null {
  const steps: PlanStep[] = []
  let current = document

  for (const id of selectionInPaintOrder(document, selection)) {
    const first = findNode(current, id)
    if (first === null || !isGroup(first)) continue
    for (;;) {
      const group = findNode(current, id)
      const parent = findParent(current, id)
      if (group === null || !isGroup(group) || parent === null) break
      const groupIndex = childIndex(parent, id)
      const step: PlanStep =
        group.children.length === 0
          ? { kind: 'remove', nodeIds: [id] }
          : { kind: 'move', nodeId: group.children[0].id, parentId: parent.id, index: groupIndex }
      steps.push(step)
      const result = applyCommand(current, stepCommand(step))
      if (!result.ok) return null
      current = result.document
      if (step.kind === 'remove') break
    }
  }
  return steps.length === 0 ? null : steps
}


