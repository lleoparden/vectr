/**
 * Transform planning (Phase 2.2, issue #65).
 *
 * Pure arithmetic for the selection's bounding box and its eight scale handles. Everything here
 * returns numbers or a `Transform` patch; the caller dispatches the existing `setTransform`
 * command, so a pointer gesture is still one transaction and one undo entry. No second geometry
 * model: the box comes from `worldBounds`, which is the same composition the hit test and the
 * renderer use.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createEllipse, createGroup, createRect, findNode } from '../src/doc/document.ts'
import {
  anchoredEdge,
  handlePoints,
  scaleFactors,
  scaledTransform,
  type Rect,
} from '../src/geom/transform.ts'
import { unionBounds } from '../src/doc/transform.ts'
import { documentStore } from '../src/state/documentStore.ts'
import { nudgeSelection } from '../src/app/actions.ts'
import type { Document, GroupNode, LayerNode, NodeId } from '../src/doc/types.ts'

function inserted(document: Document, parentId: NodeId, nodes: LayerNode[]): Document {
  const parent = findNode(document, parentId) as GroupNode
  const result = applyCommand(document, {
    type: 'insertNodes',
    parentId,
    index: parent.children.length,
    nodes,
  })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

const BOX: Rect = { x: 100, y: 50, width: 200, height: 100 }

test('the selection box is the union of what is selected, in paint order', () => {
  let document = createDocument('Bounds')
  const a = createRect('A', 100, 50, 100, 100)
  const b = createEllipse('B', 300, 200, 50, 50)
  document = inserted(document, document.root.id, [a, b])
  assert.deepEqual(unionBounds(document, [a.id]), { x: 100, y: 50, width: 100, height: 100 })
  assert.deepEqual(unionBounds(document, [a.id, b.id]), { x: 100, y: 50, width: 250, height: 200 })
  assert.equal(unionBounds(document, []), null)
  assert.equal(unionBounds(document, ['missing']), null)

  // A selection that includes a group uses the group's subtree bounds, which is what the user sees.
  const group = createGroup('G')
  document = inserted(document, document.root.id, [group])
  const child = createRect('Child', 400, 400, 40, 40)
  document = inserted(document, group.id, [child])
  assert.deepEqual(unionBounds(document, [group.id]), { x: 400, y: 400, width: 40, height: 40 })
})

test('the eight handles sit on the box corners and edge midpoints', () => {
  const points = handlePoints(BOX)
  assert.deepEqual(points.nw, { x: 100, y: 50 })
  assert.deepEqual(points.se, { x: 300, y: 150 })
  assert.deepEqual(points.e, { x: 300, y: 100 })
  assert.deepEqual(points.n, { x: 200, y: 50 })
  assert.deepEqual(points.w, { x: 100, y: 100 })
})

test('a scale keeps the opposite anchor fixed', () => {
  // Dragging the south-east handle to (450, 300): the north-west corner must not move.
  const factors = scaleFactors('se', BOX, { x: 450, y: 300 }, {})
  assert.deepEqual(anchoredEdge('se', BOX), { x: 100, y: 50 })
  assert.equal(factors.sx, 350 / 200)
  assert.equal(factors.sy, 250 / 100)

  const move = scaledTransform({ x: 100, y: 50, scaleX: 1, scaleY: 1 }, factors.anchor, factors.sx, factors.sy)
  assert.equal(move.x, 100, 'the anchor corner stays put')
  assert.equal(move.y, 50)
  assert.equal(move.scaleX, 350 / 200)
  assert.equal(move.scaleY, 250 / 100)

  // The north-west handle scales about the south-east corner, so that corner stays put.
  const northWest = scaleFactors('nw', BOX, { x: 120, y: 60 }, {})
  const shrunk = scaledTransform({ x: 100, y: 50, scaleX: 1, scaleY: 1 }, northWest.anchor, northWest.sx, northWest.sy)
  assert.equal(shrunk.x + 200 * shrunk.scaleX, 300, 'the south-east corner is unchanged')
  assert.equal(shrunk.y + 100 * shrunk.scaleY, 150)
  assert.ok(shrunk.scaleX < 1 && shrunk.scaleY < 1, 'dragging the corner inward shrinks')
})

test('an edge handle scales one axis and leaves the other alone', () => {
  const east = scaleFactors('e', BOX, { x: 500, y: 999 }, {})
  assert.equal(east.sy, 1, 'an east drag does not change height')
  assert.equal(east.sx, 400 / 200)
  const north = scaleFactors('n', BOX, { x: 0, y: 0 }, {})
  assert.equal(north.sx, 1, 'a north drag does not change width')
  assert.equal(north.sy, 150 / 100, 'dragging the top edge up enlarges the height')
})

test('Shift constrains the scale to one factor and Alt anchors at the centre', () => {
  const constrained = scaleFactors('se', BOX, { x: 450, y: 300 }, { constrain: true })
  assert.equal(constrained.sx, constrained.sy, 'both axes take the dominant factor')

  const centre = scaleFactors('e', BOX, { x: 400, y: 100 }, { fromCenter: true })
  assert.deepEqual(centre.anchor, { x: 200, y: 100 }, 'the centre is the fixed point')
  assert.equal(centre.sx, (400 - 200) / (300 - 200), 'twice the half-width factor')
})

test('a scale never collapses to zero', () => {
  const collapsed = scaleFactors('se', BOX, { x: 100, y: 50 }, {})
  assert.ok(Math.abs(collapsed.sx) >= 0.01)
  assert.ok(Math.abs(collapsed.sy) >= 0.01)
})

test('scaling the selection is one undoable transaction per node', () => {
  let document = createDocument('Scale')
  const a = createRect('A', 100, 50, 100, 100)
  const b = createRect('B', 300, 50, 100, 100)
  document = inserted(document, document.root.id, [a, b])
  documentStore.replaceDocument(document)
  documentStore.setSelection([a.id, b.id])

  const before = documentStore.getState().undoDepth
  const factors = scaleFactors('se', unionBounds(documentStore.getState().document, [a.id, b.id])!, { x: 600, y: 300 }, {})
  documentStore.beginTransaction('scale')
  for (const id of [a.id, b.id]) {
    const node = findNode(documentStore.getState().document, id)
    assert.ok(node !== null && node.type !== 'group')
    if (node === null || node.type === 'group') continue
    const next = scaledTransform(node.transform, factors.anchor, factors.sx, factors.sy)
    const result = documentStore.dispatch({
      type: 'setTransform',
      nodeId: id,
      transform: { ...node.transform, ...next },
    })
    assert.equal(result.ok, true)
  }
  documentStore.commitTransaction()
  assert.equal(documentStore.getState().undoDepth, before + 1, 'one history entry for the gesture')

  const scaledA = findNode(documentStore.getState().document, a.id)
  assert.ok(scaledA !== null && scaledA.type !== 'group')
  if (scaledA !== null && scaledA.type !== 'group') {
    assert.equal(scaledA.transform.scaleX, factors.sx)
    assert.equal(scaledA.transform.x, 100, 'the anchor corner still does not move')
  }

  documentStore.undo()
  const restored = findNode(documentStore.getState().document, a.id)
  assert.ok(restored !== null && restored.type !== 'group')
  if (restored !== null && restored.type !== 'group') {
    assert.equal(restored.transform.scaleX, 1)
    assert.equal(restored.transform.x, 100)
  }
})

test('nudging moves the selection one pixel, or ten with the bigger step, as one entry', () => {
  let document = createDocument('Nudge')
  const a = createRect('A', 100, 50, 100, 100)
  document = inserted(document, document.root.id, [a])
  documentStore.replaceDocument(document)
  documentStore.setSelection([a.id])

  const before = documentStore.getState().undoDepth
  nudgeSelection(1, 0)
  const moved = findNode(documentStore.getState().document, a.id)
  assert.ok(moved !== null && moved.type !== 'group')
  if (moved !== null && moved.type !== 'group') assert.equal(moved.transform.x, 101)
  assert.equal(documentStore.getState().undoDepth, before + 1)

  nudgeSelection(0, -10)
  const up = findNode(documentStore.getState().document, a.id)
  assert.ok(up !== null && up.type !== 'group')
  if (up !== null && up.type !== 'group') assert.equal(up.transform.y, 40)

  documentStore.undo()
  const back = findNode(documentStore.getState().document, a.id)
  assert.ok(back !== null && back.type !== 'group')
  if (back !== null && back.type !== 'group') assert.equal(back.transform.y, 50)
})

test('a nudge with nothing selected, or on a locked node, changes nothing', () => {
  let document = createDocument('Nudge locked')
  const a = createRect('A', 100, 50, 100, 100)
  document = inserted(document, document.root.id, [a])
  documentStore.replaceDocument(document)
  const depth = documentStore.getState().undoDepth

  nudgeSelection(5, 5)
  assert.equal(documentStore.getState().undoDepth, depth, 'no selection, no history')

  documentStore.dispatch({ type: 'setFlags', nodeId: a.id, locked: true, hidden: false })
  documentStore.setSelection([a.id])
  nudgeSelection(5, 5)
  assert.equal(documentStore.getState().lastError?.code, 'locked', 'a locked node is refused, not moved')
  documentStore.clearError()
})
