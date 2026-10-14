/**
 * Aggregate-inverse tests (issue #34).
 *
 * A transaction may contain several commands and must undo and redo as one entry. These
 * tests pin the four things that can go wrong: the inverse order, atomicity when a step is
 * rejected, memory when a gesture repeats on one node, and redo replaying the original
 * commands rather than the inverse of the inverse.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand, batchCommand, type Command } from '../src/doc/commands.ts'
import { History, transactionEntry } from '../src/doc/history.ts'
import { createDocument, createEllipse, createRect, findNode } from '../src/doc/document.ts'
import type { Document, LayerNode, NodeId } from '../src/doc/types.ts'

function insert(document: Document, nodes: LayerNode[], parentId: NodeId = 'root'): Document {
  const parent = findNode(document, parentId)
  const index = parent !== null && parent.type === 'group' ? parent.children.length : 0
  const result = applyCommand(document, { type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : result.message)
  return result.ok ? result.document : document
}

function apply(document: Document, command: Command): { document: Document; inverse: Command } {
  const result = applyCommand(document, command)
  assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
  if (!result.ok) throw new Error(result.message)
  return { document: result.document, inverse: result.inverse }
}

function move(x: number, y = 0) {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1 }
}

/** One rect plus one ellipse, both visible and unlocked. */
function fixture(): { document: Document; rect: LayerNode; ellipse: LayerNode } {
  const rect = createRect('Rect', 0, 0, 40, 40)
  const ellipse = createEllipse('Ellipse', 80, 0, 40, 40)
  return { document: insert(createDocument(), [rect, ellipse]), rect, ellipse }
}

test('a batch applies in order and hands back the inverses in reverse order', () => {
  const { document, rect } = fixture()
  const batch = batchCommand([
    { type: 'setTransform', nodeId: rect.id, transform: move(50) },
    { type: 'renameNode', nodeId: rect.id, name: 'Moved' },
  ])
  const applied = apply(document, batch)
  assert.equal(applied.document.revision, document.revision + 2, 'each step still bumps the revision')
  assert.equal(findNode(applied.document, rect.id)?.transform.x, 50)
  assert.equal(findNode(applied.document, rect.id)?.name, 'Moved')

  const inverse = applied.inverse
  assert.equal(inverse.type, 'batch')
  if (inverse.type !== 'batch') return
  assert.deepEqual(
    inverse.commands.map((command) => command.type),
    ['renameNode', 'setTransform'],
    'undo unwinds the last change first',
  )

  const undone = apply(applied.document, inverse).document
  assert.equal(findNode(undone, rect.id)?.transform.x, 0)
  assert.equal(findNode(undone, rect.id)?.name, 'Rect')
})

test('a step that depends on an earlier step undoes only because of the reverse order', () => {
  const { document, rect, ellipse } = fixture()
  const late = createRect('Late', 10, 10, 20, 20)
  const batch = batchCommand([
    { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes: [late] },
    { type: 'setTransform', nodeId: late.id, transform: move(30) },
  ])
  const applied = apply(document, batch)
  assert.equal(applied.document.root.children.length, 3)

  const undoResult = applyCommand(applied.document, applied.inverse)
  assert.equal(undoResult.ok, true, 'the correct order restores the tree')
  if (undoResult.ok) {
    assert.deepEqual(
      undoResult.document.root.children.map((node) => node.id),
      [rect.id, ellipse.id],
    )
  }

  // The recorded order (not reversed) would drop the node first and then try to transform
  // a node that no longer exists, so it must be refused. This is what pins the ordering.
  const inverse = applied.inverse
  if (inverse.type !== 'batch') throw new Error('expected a batch inverse')
  const wrongOrder = applyCommand(applied.document, { type: 'batch', commands: [...inverse.commands].reverse() })
  assert.equal(wrongOrder.ok, false)
  if (!wrongOrder.ok) assert.equal(wrongOrder.code, 'absent-node')
})

test('a rejected step leaves the document untouched and reports which step failed', () => {
  const { document, rect } = fixture()
  const before = findNode(document, rect.id)?.transform.x
  const result = applyCommand(document, {
    type: 'batch',
    commands: [
      { type: 'setTransform', nodeId: rect.id, transform: move(70) },
      { type: 'setTransform', nodeId: 'missing', transform: move(10) },
      { type: 'renameNode', nodeId: rect.id, name: 'Never' },
    ],
  })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, 'absent-node', "the failing step's own code survives")
  assert.match(result.message, /Batch step 2 of 3 \(setTransform\)/)
  // Nothing was swapped in, so the caller's document is exactly as it was.
  assert.equal(findNode(document, rect.id)?.transform.x, before)
  assert.equal(findNode(document, rect.id)?.name, 'Rect')
})

test('an empty batch and a nested batch are both refused', () => {
  const { document, rect } = fixture()
  const empty = applyCommand(document, { type: 'batch', commands: [] })
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.equal(empty.code, 'invalid-index')

  const nested = applyCommand(document, {
    type: 'batch',
    commands: [{ type: 'batch', commands: [{ type: 'renameNode', nodeId: rect.id, name: 'Inner' }] }],
  })
  assert.equal(nested.ok, false)
  if (!nested.ok) assert.match(nested.message, /Nested batch/)
})

test('batchCommand flattens nesting and returns a single command unchanged', () => {
  const rename: Command = { type: 'renameNode', nodeId: 'rect-1', name: 'One' }
  assert.equal(batchCommand([rename]), rename, 'a single command is not wrapped')
  const flattened = batchCommand([
    { type: 'batch', commands: [rename] },
    { type: 'renameNode', nodeId: 'rect-2', name: 'Two' },
  ])
  assert.equal(flattened.type, 'batch')
  if (flattened.type !== 'batch') return
  assert.deepEqual(
    flattened.commands.map((command) => (command.type === 'renameNode' ? command.name : '')),
    ['One', 'Two'],
  )
  assert.throws(() => batchCommand([]), /at least one command/)
})

/** Hides the rect and then the ellipse inside one transaction, the way Hide Selection does. */
function twoNodeTransaction(): { history: History; hidden: Document; rect: LayerNode; ellipse: LayerNode } {
  const { document, rect, ellipse } = fixture()
  const history = new History()
  const transaction = history.begin()
  let current = document
  for (const node of [rect, ellipse]) {
    const step = apply(current, { type: 'setFlags', nodeId: node.id, locked: false, hidden: true })
    transaction.push({ type: 'setFlags', nodeId: node.id, locked: false, hidden: true }, step.inverse)
    current = step.document
  }
  transaction.commit('hide selection')
  return { history, hidden: current, rect, ellipse }
}

test('a two-node transaction is one entry, undoes in one step, and redoes in one step', () => {
  const { history, hidden, rect, ellipse } = twoNodeTransaction()
  assert.equal(history.undoDepth(), 1, 'one transaction is one history entry')

  const entry = history.peekUndo()
  assert.equal(entry?.label, 'hide selection')
  assert.equal(entry?.command.type, 'batch', 'the aggregate records every command')
  assert.equal(entry?.inverse.type, 'batch')
  if (entry?.command.type !== 'batch' || entry.inverse.type !== 'batch') return
  assert.deepEqual(
    entry.command.commands.map((command) => (command.type === 'setFlags' ? command.nodeId : '')),
    [rect.id, ellipse.id],
    'redo replays the original commands in their original order',
  )
  assert.deepEqual(
    entry.inverse.commands.map((command) => (command.type === 'setFlags' ? command.nodeId : '')),
    [ellipse.id, rect.id],
    'undo applies the inverses in reverse order',
  )
  assert.equal(
    entry.inverse.commands.every((command) => command.type === 'setFlags' && command.hidden === false),
    true,
  )

  const undone = history.undo(hidden)
  assert.ok(undone, 'one undo is enough')
  if (undone === null) return
  assert.equal(
    undone.document.root.children.some((node) => node.hidden),
    false,
    'both layers are visible again',
  )
  assert.equal(history.undoDepth(), 0)

  const redone = history.redo(undone.document)
  assert.ok(redone)
  if (redone === null) return
  assert.equal(
    redone.document.root.children.every((node) => node.hidden),
    true,
    'redo hides both again in one step',
  )
})

test('a stale inverse inside a batch makes the whole undo fail and change nothing', () => {
  const { history, hidden, rect } = twoNodeTransaction()
  // Something else removed one of the nodes, so the batch's first inverse cannot apply.
  const diverged = apply(hidden, { type: 'removeNodes', nodeIds: [rect.id] }).document

  const undone = history.undo(diverged)
  assert.equal(undone, null, 'a partially applicable batch is refused rather than half-applied')
  assert.equal(history.undoDepth(), 1, 'the entry stays on the undo stack')
  assert.equal(history.canUndo(), true)
  assert.notEqual(history.peekUndo(), null)
  assert.equal(history.peekRedo(), null, 'nothing moved to the redo stack')
  assert.equal(findNode(diverged, rect.id), null, 'the document the caller passed is untouched')
})

test('a repeated single-node gesture stays compact instead of retaining one command per step', () => {
  const { document, rect } = fixture()
  const history = new History()
  const transaction = history.begin()
  let current = document
  for (let step = 1; step <= 200; step += 1) {
    const command: Command = { type: 'setTransform', nodeId: rect.id, transform: move(step) }
    const applied = apply(current, command)
    transaction.push(command, applied.inverse)
    current = applied.document
  }
  assert.equal(transaction.steps(), 200)
  transaction.commit('move')

  const entry = history.peekUndo()
  assert.equal(entry?.command.type, 'setTransform', 'a drag keeps the compact form, not a 200-command batch')
  assert.equal(entry?.inverse.type, 'setTransform')

  const undone = history.undo(current)
  assert.ok(undone)
  if (undone === null) return
  assert.equal(findNode(undone.document, rect.id)?.transform.x, 0, 'undo restores the pre-gesture value')
  const redone = history.redo(undone.document)
  assert.ok(redone)
  if (redone === null) return
  assert.equal(findNode(redone.document, rect.id)?.transform.x, 200, 'redo re-applies the final value')
})

test('a single-step transaction still commits a plain entry', () => {
  const { document, rect } = fixture()
  const history = new History()
  const transaction = history.begin()
  const applied = apply(document, { type: 'renameNode', nodeId: rect.id, name: 'Solo' })
  transaction.push({ type: 'renameNode', nodeId: rect.id, name: 'Solo' }, applied.inverse)
  const entry = transaction.commit('rename layer')
  assert.equal(entry?.command.type, 'renameNode', 'one step is not wrapped in a batch')
  assert.equal(entry?.inverse.type, 'renameNode')
  assert.equal(history.undoDepth(), 1)
})

test('transactionEntry picks the form from the steps, and an aborted transaction records nothing', () => {
  const { document, rect } = fixture()
  const first: Command = { type: 'renameNode', nodeId: rect.id, name: 'A' }
  const second: Command = { type: 'renameNode', nodeId: rect.id, name: 'B' }
  assert.equal(transactionEntry('one', [first], [second]).command.type, 'renameNode', 'single step stays plain')
  assert.equal(
    transactionEntry('repeat', [first, second], [second, first]).command.type,
    'renameNode',
    'same node and same type stays compact',
  )
  assert.equal(
    transactionEntry(
      'mixed',
      [first, { type: 'setFlags', nodeId: rect.id, locked: true, hidden: false }],
      [second, { type: 'setFlags', nodeId: rect.id, locked: false, hidden: false }],
    ).command.type,
    'batch',
    'different command types need the aggregate',
  )

  const history = new History()
  const transaction = history.begin()
  const applied = apply(document, { type: 'renameNode', nodeId: rect.id, name: 'Dropped' })
  transaction.push({ type: 'renameNode', nodeId: rect.id, name: 'Dropped' }, applied.inverse)
  transaction.abort()
  assert.equal(history.undoDepth(), 0, 'an aborted gesture leaves no history')
  assert.equal(history.peekUndo(), null)
})


