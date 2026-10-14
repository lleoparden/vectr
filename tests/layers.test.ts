/**
 * Layer editing tests (issue #20).
 *
 * Arranging, grouping, ungrouping, and drag targeting are pure plans over the commands that
 * already exist, so they are tested directly; the gestures are then run through the store to
 * prove each is one undo step and that paint order still follows tree order.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand, isLocked } from '../src/doc/commands.ts'
import {
  createDocument,
  createGroup,
  createRect,
  findNode,
  findParent,
  paintOrder,
} from '../src/doc/document.ts'
import { buildScene } from '../src/render/scene.ts'
import { documentStore } from '../src/state/documentStore.ts'
import { runEditorAction } from '../src/app/actions.ts'
import {
  canArrange,
  planArrange,
  planGroup,
  planUngroup,
  selectionInPaintOrder,
  sharedParent,
  stepCommand,
} from '../src/app/arrange.ts'
import { placementFor, planDrop, resolveDrop } from '../src/app/layerDrag.ts'
import { expandedGroupIds, layerRows } from '../src/app/layerRows.ts'
import type { Document, LayerNode, NodeId } from '../src/doc/types.ts'

function insert(document: Document, nodes: LayerNode[], parentId: NodeId = 'root'): Document {
  const parent = findNode(document, parentId)
  const index = parent !== null && parent.type === 'group' ? parent.children.length : 0
  const result = applyCommand(document, { type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : result.message)
  return result.ok ? result.document : document
}

/** Four siblings: A, B, C, D in paint order. */
function fourSiblings(): { document: Document; ids: NodeId[]; nodes: LayerNode[] } {
  const nodes = ['A', 'B', 'C', 'D'].map((name) => createRect(name, 0, 0, 20, 20))
  return { document: insert(createDocument(), nodes), ids: nodes.map((node) => node.id), nodes }
}

function names(document: Document, parentId: NodeId = 'root'): string[] {
  const parent = findNode(document, parentId)
  if (parent === null || parent.type !== 'group') return []
  return parent.children.map((child) => child.name)
}

/** Applies a plan to a document, so planning is tested without the store. */
function applyPlan(document: Document, steps: ReturnType<typeof planArrange>): Document {
  let current = document
  for (const step of steps) {
    const result = applyCommand(current, stepCommand(step))
    assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
    if (!result.ok) return current
    current = result.document
  }
  return current
}

test('the shared-parent and paint-order helpers describe a selection', () => {
  const { document, ids } = fourSiblings()
  assert.equal(sharedParent(document, ids.slice(0, 2)), 'root')
  assert.deepEqual(selectionInPaintOrder(document, [ids[3], ids[0]]), [ids[0], ids[3]])
  assert.equal(sharedParent(document, []), null)

  const group = createGroup('Group')
  const nested = insert(document, [group])
  const child = createRect('Child', 0, 0, 10, 10)
  const withChild = insert(nested, [child], group.id)
  assert.equal(sharedParent(withChild, [ids[0], child.id]), null, 'different parents have no shared parent')
})

test('locking is inherited, and a locked node refuses every edit', () => {
  const group = createGroup('Group')
  let document = insert(createDocument(), [group])
  const child = createRect('Child', 0, 0, 10, 10)
  document = insert(document, [child], group.id)
  const lockedGroup = applyCommand(document, { type: 'setFlags', nodeId: group.id, locked: true, hidden: false })
  assert.equal(lockedGroup.ok, true)
  if (!lockedGroup.ok) return
  document = lockedGroup.document

  assert.equal(isLocked(document, child.id), true, 'a child of a locked group reads as locked')
  assert.equal(isLocked(document, group.id), true)

  const transform = applyCommand(document, {
    type: 'setTransform',
    nodeId: child.id,
    transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
  })
  assert.equal(transform.ok ? '' : transform.code, 'locked', 'the #18 wart is gone: the code is `locked`')

  const style = applyCommand(document, {
    type: 'setStyle',
    nodeId: child.id,
    style: { fill: '#fff', stroke: null, opacity: 1 },
  })
  assert.equal(style.ok ? '' : style.code, 'locked')

  const move = applyCommand(document, { type: 'moveNode', nodeId: child.id, parentId: 'root', index: 0 })
  assert.equal(move.ok ? '' : move.code, 'locked')

  const remove = applyCommand(document, { type: 'removeNodes', nodeIds: [child.id] })
  assert.equal(remove.ok ? '' : remove.code, 'locked')

  // Unlocking the group restores every edit, which is what Unlock All relies on.
  const unlocked = applyCommand(document, { type: 'setFlags', nodeId: group.id, locked: false, hidden: false })
  assert.equal(unlocked.ok, true)
  if (!unlocked.ok) return
  assert.equal(isLocked(unlocked.document, child.id), false)
  const moved = applyCommand(unlocked.document, { type: 'moveNode', nodeId: child.id, parentId: 'root', index: 0 })
  assert.equal(moved.ok, true)
})

test('Arrange moves the selection the way Illustrator does, keeping its order', () => {
  const { document, ids } = fourSiblings()
  const [a, b, c] = ids

  // Bring Forward on B and C: each moves one position up, and B stays below C.
  assert.deepEqual(names(applyPlan(document, planArrange(document, [b, c], 'forward'))), ['A', 'D', 'B', 'C'])
  // Send Backward on B and C: each moves one position down, and the order is preserved.
  assert.deepEqual(names(applyPlan(document, planArrange(document, [b, c], 'backward'))), ['B', 'C', 'A', 'D'])
  // Bring to Front and Send to Back take the extremes and preserve the order as well.
  assert.deepEqual(names(applyPlan(document, planArrange(document, [b, c], 'front'))), ['A', 'D', 'B', 'C'])
  assert.deepEqual(names(applyPlan(document, planArrange(document, [b, c], 'back'))), ['B', 'C', 'A', 'D'])
  // A single node already at the edge has nowhere to go.
  assert.deepEqual(planArrange(document, [ids[3]], 'forward'), [])
  assert.deepEqual(planArrange(document, [a], 'backward'), [])
  assert.equal(canArrange(document, [b], 'forward'), true)
  assert.equal(canArrange(document, [b], 'front'), true)
})

test('Arrange is unavailable across parents and when every sibling is selected', () => {
  const { document, ids } = fourSiblings()
  const group = createGroup('Group')
  const child = createRect('Child', 0, 0, 10, 10)
  let withGroup = insert(document, [group])
  withGroup = insert(withGroup, [child], group.id)
  assert.deepEqual(
    planArrange(withGroup, [ids[0], child.id], 'front'),
    [],
    'nodes in different parents cannot be arranged together',
  )
  assert.deepEqual(planArrange(document, ids, 'front'), [], 'nothing to do when all siblings are selected')
})

test('Group puts the new group where the topmost selected node was', () => {
  const { document, ids } = fourSiblings()
  const plan = planGroup(document, [ids[1], ids[2]])
  assert.notEqual(plan, null)
  if (plan === null) return
  assert.equal(plan[0].kind, 'insert')
  const grouped = applyPlan(document, plan)
  assert.deepEqual(names(grouped), ['A', 'Group 1', 'D'], 'the group replaces the topmost selected node')
  const group = grouped.root.children[1]
  assert.equal(group.type, 'group')
  assert.deepEqual(names(grouped, group.id), ['B', 'C'], 'children keep their relative order')
})

test('Ungroup puts the children back where the group was and keeps nested groups', () => {
  const { document, ids } = fourSiblings()
  const inner = createGroup('Inner')
  const leaves = ['E', 'F'].map((name) => createRect(name, 0, 0, 10, 10))
  let built = insert(document, [inner])
  built = insert(built, leaves, inner.id)
  const outer = createGroup('Outer')
  built = insert(built, [outer])
  built = insert(built, [inner], outer.id)

  const plan = planUngroup(built, [outer.id])
  assert.notEqual(plan, null)
  if (plan === null) return
  const ungrouped = applyPlan(built, plan)
  assert.deepEqual(names(ungrouped), ['A', 'B', 'C', 'D', 'Inner'], 'the outer group is gone, the inner remains')
  assert.deepEqual(names(ungrouped, inner.id), ['E', 'F'])
  assert.equal(planUngroup(built, ids), null, 'a selection of shapes has nothing to ungroup')
})

test('a drag resolves to before, inside, or after a row', () => {
  const group = createGroup('Group')
  const inner = createRect('Inner', 0, 0, 10, 10)
  let document = insert(createDocument(), [createRect('A', 0, 0, 10, 10), group, createRect('Z', 0, 0, 10, 10)])
  document = insert(document, [inner], group.id)
  const rows = layerRows(document.root.children, new Set(expandedGroupIds(document.root.children)))
  const [a, groupRow, innerRow] = rows.map((row) => row.id)
  const z = document.root.children[2].id

  assert.equal(placementFor(0.1, rows[1]), 'before')
  assert.equal(placementFor(0.5, rows[1]), 'inside', 'the middle of a group row drops inside it')
  assert.equal(placementFor(0.9, rows[1]), 'after')
  assert.equal(placementFor(0.5, rows[0]), 'after', 'a shape row has no inside')

  assert.deepEqual(resolveDrop(document, rows, [z], a, 0.1), {
    parentId: 'root',
    index: 0,
    placement: 'before',
    targetRowId: a,
  })
  assert.equal(resolveDrop(document, rows, [a], a, 0.5), null, 'a row cannot be dropped on itself')
  assert.equal(
    resolveDrop(document, rows, [groupRow], innerRow, 0.5),
    null,
    'a group cannot be dropped inside its own subtree',
  )
  assert.equal(resolveDrop(document, rows, [a], a, 0.9), null, 'dropping back where it is does nothing')
  assert.deepEqual(resolveDrop(document, rows, [z], groupRow, 0.5), {
    parentId: groupRow,
    index: 1,
    placement: 'inside',
    targetRowId: groupRow,
  })
})

test('a drag plan reorders the tree and moves nodes into a group', () => {
  const group = createGroup('Group')
  const inner = createRect('Inner', 0, 0, 10, 10)
  let document = insert(createDocument(), [createRect('A', 0, 0, 10, 10), group, createRect('Z', 0, 0, 10, 10)])
  document = insert(document, [inner], group.id)
  const rows = layerRows(document.root.children, new Set(expandedGroupIds(document.root.children)))
  const [a, groupRow] = rows.map((row) => row.id)
  const z = document.root.children[2].id

  const reorder = planDrop(document, rows, [z], a, 0.1)
  assert.notEqual(reorder, null)
  if (reorder !== null) assert.deepEqual(names(applyPlan(document, reorder)), ['Z', 'A', 'Group'])

  const intoGroup = planDrop(document, rows, [z], groupRow, 0.5)
  assert.notEqual(intoGroup, null)
  if (intoGroup !== null) {
    const moved = applyPlan(document, intoGroup)
    assert.deepEqual(names(moved), ['A', 'Group'])
    assert.deepEqual(names(moved, groupRow), ['Inner', 'Z'])
  }
})

test('grouping, arranging, and ungrouping are each one undo step through the store', () => {
  const { document, ids } = fourSiblings()
  documentStore.replaceDocument(document)
  documentStore.setSelection([ids[1], ids[2]])
  const before = documentStore.getState().undoDepth

  runEditorAction('object.group')
  assert.equal(documentStore.getState().undoDepth, before + 1, 'grouping is one entry')
  assert.deepEqual(names(documentStore.getState().document), ['A', 'Group 1', 'D'])
  const grouped = documentStore.getState().document.root.children[1]
  assert.deepEqual(documentStore.getState().selection, [grouped.id], 'the new group is selected')

  documentStore.undo()
  assert.deepEqual(names(documentStore.getState().document), ['A', 'B', 'C', 'D'], 'one undo restores the order')
  assert.equal(documentStore.getState().undoDepth, before)
  assert.deepEqual(
    documentStore.getState().selection,
    [],
    'selection is not history state, so undoing the group prunes the vanished group from it',
  )
  documentStore.redo()
  assert.deepEqual(names(documentStore.getState().document), ['A', 'Group 1', 'D'], 'one redo re-groups')
  documentStore.undo()

  documentStore.setSelection([ids[1], ids[2]])
  runEditorAction('object.arrangeFront')
  assert.equal(documentStore.getState().undoDepth, before + 1, 'arranging is one entry')
  assert.deepEqual(names(documentStore.getState().document), ['A', 'D', 'B', 'C'])
  documentStore.undo()

  // Group again and then ungroup that group: each gesture is one entry of its own.
  documentStore.setSelection([ids[1], ids[2]])
  runEditorAction('object.group')
  assert.equal(documentStore.getState().undoDepth, before + 1, 'grouping again is one entry')
  const created = documentStore.getState().selection[0]
  assert.equal(created, documentStore.getState().document.root.children[1].id)

  runEditorAction('object.ungroup')
  assert.equal(documentStore.getState().undoDepth, before + 2, 'ungrouping is one entry')
  assert.deepEqual(names(documentStore.getState().document), ['A', 'B', 'C', 'D'])
  assert.deepEqual(documentStore.getState().selection, [ids[1], ids[2]], 'the released children are selected')
  documentStore.undo()
  assert.deepEqual(names(documentStore.getState().document), ['A', 'Group 1', 'D'], 'undo re-groups in one step')
})

test('scene paint order agrees with tree order after grouping and arranging', () => {
  const { document, ids } = fourSiblings()
  const groupPlan = planGroup(document, [ids[0], ids[2]])
  assert.notEqual(groupPlan, null)
  if (groupPlan === null) return
  const grouped = applyPlan(document, groupPlan)
  const arranged = applyPlan(grouped, planArrange(grouped, [ids[1]], 'front'))

  const scene = buildScene(arranged)
  const treeOrder = paintOrder(arranged).filter((id) => {
    const node = findNode(arranged, id)
    return node !== null && node.type !== 'group'
  })
  assert.deepEqual(
    scene.shapes.map((shape) => shape.id),
    treeOrder,
    'what is drawn last is what the tree puts on top',
  )
  assert.deepEqual(names(arranged), ['Group 1', 'D', 'B'])
})

test('a locked layer cannot be grouped, arranged, or dragged', () => {
  const { document, ids } = fourSiblings()
  const locked = applyCommand(document, { type: 'setFlags', nodeId: ids[1], locked: true, hidden: false })
  assert.equal(locked.ok, true)
  if (!locked.ok) return
  const lockedDocument = locked.document

  assert.equal(planGroup(lockedDocument, [ids[1], ids[2]]), null, 'a locked node is not grouped')
  assert.deepEqual(planArrange(lockedDocument, [ids[1]], 'front'), [], 'a locked node is not arranged')

  const rows = layerRows(lockedDocument.root.children, new Set())
  assert.equal(
    resolveDrop(lockedDocument, rows, [ids[1]], rows[0].id, 0.1),
    null,
    'a locked node is not dragged',
  )

  // A locked group refuses a drop into it as well.
  const group = createGroup('Locked group')
  let withGroup = insert(lockedDocument, [group])
  const lockedGroup = applyCommand(withGroup, { type: 'setFlags', nodeId: group.id, locked: true, hidden: false })
  assert.equal(lockedGroup.ok, true)
  if (!lockedGroup.ok) return
  withGroup = lockedGroup.document
  const groupRows = layerRows(withGroup.root.children, new Set())
  const target = groupRows.find((row) => row.id === group.id)
  assert.ok(target)
  assert.equal(
    resolveDrop(withGroup, groupRows, [withGroup.root.children[0].id], group.id, 0.5),
    null,
    'a locked group does not accept a drop',
  )
})

test('the store reports the selection after a group and refuses an impossible group', () => {
  const { document, ids } = fourSiblings()
  documentStore.replaceDocument(document)
  documentStore.setSelection([])
  assert.equal(canArrange(documentStore.getState().document, [], 'front'), false)
  runEditorAction('object.group')
  assert.equal(documentStore.getState().document.root.children.length, 4, 'an empty selection groups nothing')

  const group = createGroup('Group')
  const withGroup = insert(document, [group])
  const child = createRect('Child', 0, 0, 10, 10)
  documentStore.replaceDocument(insert(withGroup, [child], group.id))
  documentStore.setSelection([ids[0], child.id])
  runEditorAction('object.group')
  assert.equal(
    documentStore.getState().document.root.children.length,
    5,
    'nodes in different parents are not grouped together',
  )
  assert.equal(findParent(documentStore.getState().document, child.id)?.id, group.id)
})


