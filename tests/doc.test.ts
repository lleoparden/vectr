import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand, type Command } from '../src/doc/commands.ts'
import { History } from '../src/doc/history.ts'
import {
  createDocument,
  createEllipse,
  createGroup,
  createRect,
  countNodes,
  depthOf,
  findNode,
  insertNodes,
  paintOrder,
  worldBounds,
  worldTransform,
} from '../src/doc/document.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { FORMAT_VERSION, type Document, type LayerNode, type Transform } from '../src/doc/types.ts'

function apply(document: Document, command: Command): Document {
  const result = applyCommand(document, command)
  assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
  return result.ok ? result.document : document
}

function move(x: number, y = 0): Transform {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1 }
}

/** Document with two rects and a group holding one ellipse. */
function scene(): { document: Document; rect: LayerNode; rect2: LayerNode; group: LayerNode; ellipse: LayerNode } {
  const rect = createRect('Rect 1', 10, 20)
  const rect2 = createRect('Rect 2', 40, 50)
  const group = createGroup('Group 1')
  const ellipse = createEllipse('Ellipse 1', 5, 5, 80, 40)
  let document = createDocument('Scene')
  document = apply(document, { type: 'insertNodes', parentId: 'root', index: 0, nodes: [rect, rect2, group] })
  document = apply(document, { type: 'insertNodes', parentId: group.id, index: 0, nodes: [ellipse] })
  return { document, rect, rect2, group, ellipse }
}

test('a new document is valid, empty, and versioned', () => {
  const document = createDocument()
  assert.equal(document.formatVersion, FORMAT_VERSION)
  assert.equal(FORMAT_VERSION, 6, 'v6 adds compound paths')
  assert.equal(countNodes(document), 0)
  assert.equal(validateDocument(document).ok, true)
})

test('create + insert commands build the tree and keep paint order', () => {
  const { document, rect, rect2, group, ellipse } = scene()
  assert.deepEqual(paintOrder(document), [rect.id, rect2.id, group.id, ellipse.id])
  assert.equal(countNodes(document), 4)
  assert.equal(depthOf(document, ellipse.id), 2)
  assert.equal(findNode(document, group.id)?.type, 'group')
})

test('setTransform is invertible and rejects non-finite values', () => {
  const { document, rect } = scene()
  const moved = apply(document, { type: 'setTransform', nodeId: rect.id, transform: move(100, 200) })
  assert.equal(findNode(moved, rect.id)?.transform.x, 100)
  const rejected = applyCommand(moved, {
    type: 'setTransform',
    nodeId: rect.id,
    transform: { x: Number.NaN, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  })
  assert.equal(rejected.ok, false)
  assert.equal(rejected.ok ? '' : rejected.code, 'non-finite')
})

test('locked nodes refuse transforms', () => {
  const { document, rect } = scene()
  const locked = apply(document, { type: 'setFlags', nodeId: rect.id, locked: true, hidden: false })
  const refused = applyCommand(locked, { type: 'setTransform', nodeId: rect.id, transform: move(1, 1) })
  assert.equal(refused.ok, false)
})

test('absent nodes, absent parents, and cycles are rejected with codes', () => {
  const { document, group, ellipse } = scene()
  const absentNode = applyCommand(document, { type: 'setTransform', nodeId: 'missing', transform: move(0) })
  assert.equal(absentNode.ok ? '' : absentNode.code, 'absent-node')

  const absentParent = applyCommand(document, {
    type: 'insertNodes',
    parentId: 'missing',
    index: 0,
    nodes: [createRect('Orphan', 0, 0)],
  })
  assert.equal(absentParent.ok ? '' : absentParent.code, 'absent-parent')

  const shapeParent = applyCommand(document, {
    type: 'insertNodes',
    parentId: ellipse.id,
    index: 0,
    nodes: [createRect('Into shape', 0, 0)],
  })
  assert.equal(shapeParent.ok ? '' : shapeParent.code, 'invalid-parent')

  const cycle = applyCommand(document, { type: 'moveNode', nodeId: group.id, parentId: group.id, index: 0 })
  assert.equal(cycle.ok, false, 'a group cannot become its own parent')
})

test('validation catches duplicate ids and non-positive sizes', () => {
  const { document, rect } = scene()
  const duplicated: Document = {
    ...document,
    root: { ...document.root, children: [...document.root.children, structuredClone(rect)] },
  }
  const duplicateResult = validateDocument(duplicated)
  assert.equal(duplicateResult.ok ? '' : duplicateResult.issue.code, 'duplicate-id')

  const invalid = applyCommand(createDocument(), {
    type: 'insertNodes',
    parentId: 'root',
    index: 0,
    nodes: [createRect('Zero', 0, 0, 0, 10)],
  })
  assert.equal(invalid.ok, true, 'commands check structure; validateDocument checks geometry')
  if (invalid.ok) {
    const geometry = validateDocument(invalid.document)
    assert.equal(geometry.ok ? '' : geometry.issue.code, 'non-positive-size')
  }
})

test('reordering keeps sibling order and index adjustment is exact', () => {
  const { document, rect, rect2 } = scene()
  const moved = apply(document, { type: 'moveNode', nodeId: rect.id, parentId: 'root', index: 3 })
  const ids = moved.root.children.map((child) => child.id)
  assert.equal(ids.length, 3)
  assert.equal(ids[0], rect2.id)
  assert.equal(ids[ids.length - 1], rect.id)
})

test('moving a node into a group places it in that group only', () => {
  const { document, rect2, group } = scene()
  const moved = apply(document, { type: 'moveNode', nodeId: rect2.id, parentId: group.id, index: 0 })
  assert.equal(moved.root.children.some((child) => child.id === rect2.id), false)
  const groupNode = findNode(moved, group.id)
  assert.equal(groupNode?.type, 'group')
  assert.equal(groupNode !== null && groupNode.type === 'group' ? groupNode.children[0].id : '', rect2.id)
})

test('unrelated subtrees keep their identity after a command', () => {
  const { document, rect, group } = scene()
  const moved = apply(document, { type: 'setTransform', nodeId: rect.id, transform: move(7, 7) })
  assert.equal(findNode(document, group.id) === findNode(moved, group.id), true)
})

test('world transform and bounds compose through nested groups', () => {
  const { document, group, ellipse } = scene()
  const scaled = apply(document, {
    type: 'setTransform',
    nodeId: group.id,
    transform: { x: 30, y: 40, rotation: 0, scaleX: 2, scaleY: 2 },
  })
  assert.deepEqual(worldTransform(scaled, ellipse.id), { x: 40, y: 50, scaleX: 2, scaleY: 2 })
  const bounds = worldBounds(scaled, ellipse.id)
  assert.equal(bounds?.width, 160)
  assert.equal(bounds?.height, 80)
})

test('undo restores the previous value and redo re-applies it', () => {
  const { document, rect } = scene()
  const history = new History()
  const command: Command = { type: 'renameNode', nodeId: rect.id, name: 'Renamed' }
  const result = applyCommand(document, command)
  assert.equal(result.ok, true)
  if (!result.ok) return
  history.record({ label: 'rename', command, inverse: result.inverse })
  const undone = history.undo(result.document)
  assert.equal(findNode(undone!.document, rect.id)?.name, 'Rect 1')
  const redone = history.redo(undone!.document)
  assert.equal(findNode(redone!.document, rect.id)?.name, 'Renamed')
  assert.equal(history.canRedo(), false, 'redo is consumed')
})

test('history is bounded and a fresh command clears redo', () => {
  const { document, rect } = scene()
  const history = new History(3)
  let current = document
  for (let step = 1; step <= 5; step += 1) {
    const command: Command = { type: 'setTransform', nodeId: rect.id, transform: move(step) }
    const result = applyCommand(current, command)
    assert.equal(result.ok, true)
    if (!result.ok) return
    history.record({ label: `move ${step}`, command, inverse: result.inverse })
    current = result.document
  }
  assert.equal(history.undoDepth(), 3, 'oldest entries are trimmed at the limit')
  const undone = history.undo(current)
  assert.notEqual(undone, null)
  if (undone === null) return
  const rename: Command = { type: 'renameNode', nodeId: rect.id, name: 'After undo' }
  const renamed = applyCommand(undone.document, rename)
  assert.equal(renamed.ok, true)
  if (!renamed.ok) return
  history.record({ label: 'rename', command: rename, inverse: renamed.inverse })
  assert.equal(history.canRedo(), false, 'a fresh command clears redo')
})

test('a drag is one transaction with the first inverse and the last command', () => {
  const { document, rect } = scene()
  const history = new History()
  const transaction = history.begin()
  let current = document
  for (const x of [5, 15, 30, 60]) {
    const command: Command = { type: 'setTransform', nodeId: rect.id, transform: move(x) }
    const result = applyCommand(current, command)
    assert.equal(result.ok, true)
    if (!result.ok) return
    transaction.push(command, result.inverse)
    current = result.document
  }
  assert.equal(transaction.steps(), 4)
  assert.notEqual(transaction.commit('drag'), null)
  assert.equal(history.undoDepth(), 1, 'one gesture is one entry')
  const undone = history.undo(current)
  assert.equal(findNode(undone!.document, rect.id)?.transform.x, 10, 'undo returns to the pre-gesture value')
  const redone = history.redo(undone!.document)
  assert.equal(findNode(redone!.document, rect.id)?.transform.x, 60, 'redo re-applies the final value')
})

test('an aborted transaction records nothing', () => {
  const { document, rect } = scene()
  const history = new History()
  const transaction = history.begin()
  const command: Command = { type: 'setTransform', nodeId: rect.id, transform: move(99) }
  const result = applyCommand(document, command)
  assert.equal(result.ok, true)
  if (!result.ok) return
  transaction.push(command, result.inverse)
  transaction.abort()
  assert.equal(history.canUndo(), false)
})

test('removing and undoing restores the node in the same position', () => {
  const { document, rect2 } = scene()
  const removed = applyCommand(document, { type: 'removeNodes', nodeIds: [rect2.id] })
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  const restored = applyCommand(removed.document, removed.inverse)
  assert.equal(restored.ok, true)
  if (!restored.ok) return
  assert.deepEqual(
    restored.document.root.children.map((child) => child.id),
    document.root.children.map((child) => child.id),
  )
})

test('the document root cannot be removed', () => {
  const { document } = scene()
  const result = applyCommand(document, { type: 'removeNodes', nodeIds: ['root'] })
  assert.equal(result.ok, false)
})

test('insertNodes clamps out-of-range indices instead of failing', () => {
  const next = insertNodes(createDocument(), 'root', 99, [createRect('Clamped', 0, 0)])
  assert.equal(next.root.children.length, 1)
})


