import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, createEllipse, createGroup, createRect, findNode, paintOrder } from '../src/doc/document.ts'
import { hitTest, marqueeHitTest } from '../src/doc/hitTest.ts'
import { applyCommand } from '../src/doc/commands.ts'
import { buildScene, sceneRootIds } from '../src/render/scene.ts'
import { DocumentStore } from '../src/state/documentStore.ts'
import type { Document, GroupNode, LayerNode } from '../src/doc/types.ts'

function insert(document: Document, parentId: string, nodes: LayerNode[]): Document {
  const parent = findNode(document, parentId)
  const index = parent !== null && parent.type === 'group' ? parent.children.length : 0
  const result = applyCommand(document, { type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
  return result.ok ? result.document : document
}

function move(x: number, y = 0) {
  return { x, y, rotation: 0, scaleX: 1, scaleY: 1 }
}

/** Two overlapping rects plus a nested group holding an ellipse. */
function scene(): { document: Document; back: LayerNode; front: LayerNode; group: LayerNode; ellipse: LayerNode } {
  const back = createRect('Back', 0, 0, 100, 100)
  const front = createRect('Front', 50, 50, 100, 100)
  const group = createGroup('Group')
  const ellipse = createEllipse('Ellipse', 300, 300, 80, 60)
  let document = createDocument()
  document = insert(document, 'root', [back, front, group])
  document = insert(document, group.id, [ellipse])
  return { document, back, front, group, ellipse }
}

test('scene paint order matches document layer order', () => {
  const { document, back, front, group, ellipse } = scene()
  const built = buildScene(document)
  assert.deepEqual(built.shapes.map((shape) => shape.id), [back.id, front.id, ellipse.id])
  assert.deepEqual(sceneRootIds(built), [back.id, front.id, group.id])
  assert.deepEqual(
    built.shapes.map((shape) => shape.id),
    paintOrder(document).filter((id) => id !== group.id),
  )
})

test('a 200-node nested fixture keeps scene order equal to tree order', () => {
  let document = createDocument()
  const groups = Array.from({ length: 20 }, (_, index) => createGroup(`Group ${index}`))
  document = insert(document, 'root', groups)
  for (const [index, group] of groups.entries()) {
    const children = Array.from({ length: 10 }, (_, child) =>
      createRect(`Rect ${index}-${child}`, index * 5, child * 5),
    )
    document = insert(document, group.id, children)
  }
  const built = buildScene(document)
  const expected = paintOrder(document).filter((id) => {
    const node = findNode(document, id)
    return node !== null && node.type !== 'group'
  })
  assert.equal(built.shapes.length, 200)
  assert.deepEqual(built.shapes.map((shape) => shape.id), expected)
})

test('hidden nodes and hidden subtrees stay out of the scene', () => {
  const { document, back, front, group } = scene()
  const hiddenRoot = applyCommand(document, { type: 'setFlags', nodeId: front.id, locked: false, hidden: true })
  assert.equal(hiddenRoot.ok, true)
  if (!hiddenRoot.ok) return
  const hiddenGroup = applyCommand(hiddenRoot.document, {
    type: 'setFlags',
    nodeId: group.id,
    locked: false,
    hidden: true,
  })
  assert.equal(hiddenGroup.ok, true)
  if (!hiddenGroup.ok) return
  assert.deepEqual(
    buildScene(hiddenGroup.document).shapes.map((shape) => shape.id),
    [back.id],
  )
})

test('group transforms compose into scene shapes', () => {
  const { document, group, ellipse } = scene()
  const moved = applyCommand(document, {
    type: 'setTransform',
    nodeId: group.id,
    transform: { x: 20, y: 30, rotation: 0, scaleX: 2, scaleY: 2 },
  })
  assert.equal(moved.ok, true)
  if (!moved.ok) return
  const shape = buildScene(moved.document).shapes.find((entry) => entry.id === ellipse.id)
  assert.equal(shape?.x, 620)
  assert.equal(shape?.y, 630)
  assert.equal(shape?.scaleX, 2)
})

test('hit testing picks the topmost node and respects overlap order', () => {
  const { document, back, front, group } = scene()
  assert.equal(hitTest(document, { x: 75, y: 75 }), front.id, 'overlap goes to the front rect')
  assert.equal(hitTest(document, { x: 10, y: 10 }), back.id)
  assert.equal(hitTest(document, { x: 340, y: 330 }), group.id, 'a nested shape selects its top-level group')
  assert.equal(hitTest(document, { x: 500, y: 500 }), null)
  assert.equal(hitTest(document, { x: 340, y: 330 }, { deep: true }), ellipseIdOf(document, group.id))
})

/** Reads the nested ellipse id back out of the document, avoiding stale references. */
function ellipseIdOf(document: Document, groupId: string): string {
  const group = findNode(document, groupId)
  return group !== null && group.type === 'group' ? group.children[0].id : ''
}

test('hidden and locked nodes are not hit by default', () => {
  const { document, front, group } = scene()
  const hidden = applyCommand(document, { type: 'setFlags', nodeId: front.id, locked: false, hidden: true })
  assert.equal(hidden.ok, true)
  if (!hidden.ok) return
  // (140,140) lies only inside the front rect, so hiding it must leave nothing.
  assert.equal(hitTest(hidden.document, { x: 140, y: 140 }), null)

  const locked = applyCommand(document, { type: 'setFlags', nodeId: group.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  if (!locked.ok) return
  assert.equal(hitTest(locked.document, { x: 340, y: 330 }), null, 'a locked group is not hit')
  assert.equal(hitTest(locked.document, { x: 340, y: 330 }, { includeLocked: true }), group.id)
})

test('marquee returns intersecting top-level nodes in paint order', () => {
  const { document, back, front, group } = scene()
  assert.deepEqual(marqueeHitTest(document, { x: 0, y: 0, width: 400, height: 400 }), [
    back.id,
    front.id,
    group.id,
  ])
  assert.deepEqual(marqueeHitTest(document, { x: 310, y: 310, width: 10, height: 10 }), [group.id])
})

test('store records one history entry per gesture and undo restores it', () => {
  const { document, back } = scene()
  const store = new DocumentStore(document)
  store.setSelection([back.id])

  store.beginTransaction('move')
  for (const x of [10, 25, 40]) {
    store.dispatch({ type: 'setTransform', nodeId: back.id, transform: move(x) })
  }
  store.commitTransaction()

  assert.equal(store.getState().undoDepth, 1, 'a drag is one entry')
  assert.equal(store.getState().document.revision, document.revision + 3)
  assert.equal(findNode(store.getState().document, back.id)?.transform.x, 40)
  store.undo()
  assert.equal(findNode(store.getState().document, back.id)?.transform.x, 0, 'undo restores the pre-gesture value')
  assert.equal(store.getState().canRedo, true)
  store.redo()
  assert.equal(findNode(store.getState().document, back.id)?.transform.x, 40)
})

test('store surfaces a rejected command without changing the document', () => {
  const { document } = scene()
  const store = new DocumentStore(document)
  const before = store.getState().document
  const result = store.dispatch({ type: 'setTransform', nodeId: 'missing', transform: move(0) })
  assert.equal(result.ok, false)
  assert.equal(store.getState().lastError?.code, 'absent-node')
  assert.equal(store.getState().document === before, true, 'the document object is untouched')
  assert.equal(store.getState().canUndo, false)
  store.clearError()
  assert.equal(store.getState().lastError, null)
})

test('deleting a selection prunes it, and select-all skips hidden and locked layers', () => {
  const { document, back, front, group } = scene()
  const lockedFront = applyCommand(document, { type: 'setFlags', nodeId: front.id, locked: true, hidden: false })
  assert.equal(lockedFront.ok, true)
  if (!lockedFront.ok) return
  const store = new DocumentStore(lockedFront.document)
  store.selectAll()
  assert.deepEqual(store.getState().selection, [back.id, group.id], 'locked layers are not selected')

  store.setSelection([back.id])
  store.dispatch({ type: 'removeNodes', nodeIds: [back.id] }, 'delete')
  assert.deepEqual(store.getState().selection, [], 'a deleted node cannot stay selected')
})

test('replaceDocument clears history and selection', () => {
  const { document, back } = scene()
  const store = new DocumentStore(document)
  store.setSelection([back.id])
  store.dispatch({ type: 'renameNode', nodeId: back.id, name: 'Renamed' })
  assert.equal(store.getState().canUndo, true)
  store.replaceDocument(createDocument('Fresh'))
  assert.equal(store.getState().canUndo, false)
  assert.deepEqual(store.getState().selection, [])
  assert.equal(store.getState().document.name, 'Fresh')
})

test('subscribers are notified once per state change', () => {
  const { document, back } = scene()
  const store = new DocumentStore(document)
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })
  store.setTool('rect')
  store.setSelection([back.id])
  store.dispatch({ type: 'renameNode', nodeId: back.id, name: 'Named' })
  unsubscribe()
  store.setTool('select')
  assert.equal(notifications, 3)
  assert.equal(store.getState().tool, 'select')
})

test('group membership is reported through the store for later slices', () => {
  const { document, group } = scene()
  const store = new DocumentStore(document)
  assert.equal(store.isGroupId(group.id), true)
  assert.equal(store.isGroupId(document.root.id), false)
  const groupNode = findNode(document, group.id) as GroupNode | null
  assert.equal(groupNode?.children.length, 1)
})

