/**
 * Anchor editing (Phase 5.3, issue #139): the scene↔local maths, hit tolerance under rotation, and
 * the three anchor commands with their exact inverses.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand, type Command } from '../src/doc/commands.ts'
import { createDocument, createPath, findNode, insertNodes } from '../src/doc/document.ts'
import {
  draggedHandle,
  localToScene,
  nearestAnchor,
  nearestHandle,
  nudgedAnchor,
  sceneToLocal,
  type PathEditCapture,
} from '../src/doc/pathEdit.ts'
import type { Document, PathAnchor, PathNode } from '../src/doc/types.ts'
import { cornerAnchor } from '../src/geom/path.ts'

function capture(overrides: Partial<PathEditCapture> = {}): PathEditCapture {
  return {
    nodeId: 'path-1',
    anchors: [cornerAnchor(0, 0), cornerAnchor(100, 0), cornerAnchor(50, 80)],
    width: 100,
    height: 80,
    transform: { x: 200, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
    ...overrides,
  }
}

function documentWith(path: PathNode): { document: Document; id: string } {
  const base = createDocument()
  const document = insertNodes(base, base.root.id, base.root.children.length, [path])
  return { document, id: path.id }
}

function apply(document: Document, command: Command): Document {
  const result = applyCommand(document, command)
  assert.equal(result.ok, true, result.ok ? '' : result.message)
  return result.ok ? result.document : document
}

const triangle = () =>
  createPath('Triangle', 0, 0, [cornerAnchor(0, 0), cornerAnchor(100, 0), cornerAnchor(50, 80)], { closed: true })

test('local and scene coordinates are inverses, including rotation and scale', () => {
  const rotated = capture({ transform: { x: 50, y: 60, rotation: 30, scaleX: 2, scaleY: 1.5 } })
  const local = { x: 25, y: 40 }
  const scene = localToScene(local, rotated)
  const back = sceneToLocal(scene, rotated)
  assert.ok(Math.abs(back.x - local.x) < 1e-9)
  assert.ok(Math.abs(back.y - local.y) < 1e-9)
})

test('an anchor is picked by its scene position, under rotation', () => {
  const rotated = capture({ transform: { x: 50, y: 60, rotation: 30, scaleX: 1, scaleY: 1 } })
  const target = localToScene({ x: 100, y: 0 }, rotated)
  assert.equal(nearestAnchor(rotated.anchors, { x: target.x + 1, y: target.y }, rotated, 3)?.index, 1)
  assert.equal(nearestAnchor(rotated.anchors, { x: target.x + 100, y: target.y }, rotated, 3), null, 'outside the tolerance')
})

test('a handle is picked before its anchor could be', () => {
  const smooth: PathAnchor = { x: 50, y: 50, inX: -20, inY: 0, outX: 20, outY: 0, smooth: true }
  const withHandles = capture({ anchors: [cornerAnchor(0, 0), smooth, cornerAnchor(100, 100)] })
  const handlePoint = localToScene({ x: 70, y: 50 }, withHandles)
  assert.deepEqual(nearestHandle(withHandles.anchors, handlePoint, withHandles, 2), { index: 1, handle: 'out', distance: 0 })
  const inPoint = localToScene({ x: 30, y: 50 }, withHandles)
  assert.equal(nearestHandle(withHandles.anchors, inPoint, withHandles, 2)?.handle, 'in')
})

test('dragging one handle mirrors the other, and Alt breaks the mirror', () => {
  const anchor: PathAnchor = { x: 0, y: 0, inX: -10, inY: 0, outX: 10, outY: 0, smooth: true }
  const mirrored = draggedHandle(anchor, 'out', { x: 30, y: 20 }, true)
  assert.deepEqual([mirrored.outX, mirrored.outY, mirrored.inX, mirrored.inY], [30, 20, -30, -20])
  assert.equal(mirrored.smooth, true)

  const broken = draggedHandle(anchor, 'out', { x: 30, y: 20 }, false)
  assert.deepEqual([broken.outX, broken.outY, broken.inX, broken.inY], [30, 20, -10, 0])
  assert.equal(broken.smooth, false)
})

test('adding an anchor keeps the curve and its inverse restores the anchors exactly', () => {
  let { document, id } = documentWith(triangle())
  const before = (findNode(document, id) as PathNode).anchors.map((anchor) => ({ ...anchor }))
  const result = applyCommand(document, { type: 'addPathAnchor', nodeId: id, index: 0, t: 0.5 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  document = result.document
  const after = findNode(document, id) as PathNode
  assert.equal(after.anchors.length, 4)
  assert.ok(Math.abs(after.anchors[1].x - 50) < 1e-9 && Math.abs(after.anchors[1].y) < 1e-9, 'the new anchor sits at the segment midpoint')

  const undone = applyCommand(document, result.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  assert.deepEqual(
    (findNode(undone.document, id) as PathNode).anchors.map((anchor) => [anchor.x, anchor.y, anchor.inX, anchor.inY, anchor.outX, anchor.outY]),
    before.map((anchor) => [anchor.x, anchor.y, anchor.inX, anchor.inY, anchor.outX, anchor.outY]),
  )
})

test('removing an anchor respects the minimum and restores exactly', () => {
  const open = createPath('Open', 0, 0, [cornerAnchor(0, 0), cornerAnchor(100, 0), cornerAnchor(50, 80)], { closed: false })
  const { document, id } = documentWith(open)
  const removed = applyCommand(document, { type: 'removePathAnchor', nodeId: id, index: 1 })
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  assert.equal((findNode(removed.document, id) as PathNode).anchors.length, 2)

  const tooFew = applyCommand(removed.document, { type: 'removePathAnchor', nodeId: id, index: 0 })
  assert.equal(tooFew.ok, false, 'an open path cannot drop below two anchors')

  const undone = applyCommand(removed.document, removed.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const restored = findNode(undone.document, id) as PathNode
  assert.equal(restored.anchors.length, 3)
  assert.equal(restored.anchors[1].x, 100)
})

test('converting an anchor to smooth derives mirrored handles, and back to corner clears them', () => {
  const { document, id } = documentWith(triangle())
  const smooth = apply(document, { type: 'convertPathAnchor', nodeId: id, index: 1, smooth: true })
  const smoothed = findNode(smooth, id) as PathNode
  assert.equal(smoothed.anchors[1].smooth, true)
  assert.ok(smoothed.anchors[1].outX !== 0)
  assert.ok(Math.abs(smoothed.anchors[1].outX + smoothed.anchors[1].inX) < 1e-9, 'handles mirror')

  const corner = apply(smooth, { type: 'convertPathAnchor', nodeId: id, index: 1, smooth: false })
  const cleared = findNode(corner, id) as PathNode
  assert.equal(cleared.anchors[1].smooth, false)
  assert.deepEqual([cleared.anchors[1].inX, cleared.anchors[1].inY, cleared.anchors[1].outX, cleared.anchors[1].outY], [0, 0, 0, 0])
})

test('anchor commands refuse a locked path and a non-path', () => {
  const { document, id } = documentWith(triangle())
  const locked = apply(document, { type: 'setFlags', nodeId: id, locked: true, hidden: false })
  for (const command of [
    { type: 'addPathAnchor', nodeId: id, index: 0, t: 0.5 },
    { type: 'removePathAnchor', nodeId: id, index: 0 },
    { type: 'convertPathAnchor', nodeId: id, index: 0, smooth: true },
  ] as Command[]) {
    const result = applyCommand(locked, command)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'locked')
  }
})

test('nudging an anchor moves it and leaves its handles alone', () => {
  const anchors = [
    { x: 0, y: 0, inX: -5, inY: 0, outX: 10, outY: 0, smooth: true },
    { x: 50, y: 50, inX: 0, inY: 0, outX: 0, outY: 0, smooth: false },
  ]
  const moved = nudgedAnchor(anchors, 1, 3, -2)
  assert.deepEqual([moved[1].x, moved[1].y], [53, 48])
  assert.deepEqual([moved[0].x, moved[0].outX], [0, 10], 'the other anchor is untouched')
  assert.equal(moved[1].inX, 0, 'handles are relative, so they travel with the anchor')
})
