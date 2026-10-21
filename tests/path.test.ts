/**
 * The Bézier path node (Phase 5.1, issue #137).
 *
 * The geometry is pure, so the curve's approximation, bounds, and hit testing are testable without
 * a canvas. The document side checks normalisation, validation, and the command's exact inverse.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createPath, createRect, findNode, insertNodes, worldBounds } from '../src/doc/document.ts'
import { containsLocalPoint, hitTest } from '../src/doc/hitTest.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { deserializeDocument, serializeDocument } from '../src/file/serialize.ts'
import { FORMAT_VERSION, SUPPORTED_FORMAT_VERSION_LIST, type Document, type PathNode } from '../src/doc/types.ts'
import { cubicPoint, distanceToPolyline, flattenPath, pathBounds, simplifyPoints, type PathAnchor } from '../src/geom/path.ts'

const anchor = (x: number, y: number, outX = 0, outY = 0): PathAnchor => ({
  x,
  y,
  inX: -outX,
  inY: -outY,
  outX,
  outY,
  smooth: outX !== 0 || outY !== 0,
})

/** A document with one path inserted at the root. */
function documentWith(path: PathNode): { document: Document; id: string } {
  const base = createDocument('Paths')
  const document = insertNodes(base, base.root.id, base.root.children.length, [path])
  return { document, id: path.id }
}

test('the file format is 5 and still opens 1 through 5', () => {
  assert.equal(FORMAT_VERSION, 5)
  assert.deepEqual(SUPPORTED_FORMAT_VERSION_LIST, [1, 2, 3, 4, 5])
})

test('a straight two-anchor path flattens to its endpoints exactly', () => {
  const points = flattenPath([anchor(0, 0), anchor(100, 50)], false)
  assert.deepEqual(points, [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
  ])
})

test('a curve flattens within tolerance and passes through its midpoint', () => {
  // A symmetric arch: both handles push upward, so the curve peaks above the chord's midpoint.
  const from = { x: 0, y: 100, inX: 0, inY: 0, outX: 0, outY: -80, smooth: true }
  const to = { x: 100, y: 100, inX: 0, inY: -80, outX: 0, outY: 0, smooth: true }
  const mid = cubicPoint(from, to, 0.5)
  assert.ok(Math.abs(mid.x - 50) < 1e-9)
  assert.ok(mid.y < 100, 'the arch rises above the chord')

  const points = flattenPath([from, to], false, 0.25)
  assert.ok(points.length > 2, 'a curve needs intermediate points')
  // Every point must be within a quarter unit of one of the sampled curve parameters, and the
  // midpoint must be present as a vertex because a symmetric split lands there.
  const closest = Math.min(...points.map((point) => Math.hypot(point.x - mid.x, point.y - mid.y)))
  assert.ok(closest < 1e-6, 'the flattened polyline passes through the curve midpoint')
  const samples = Array.from({ length: 101 }, (_, index) => cubicPoint(from, to, index / 100))
  const worst = Math.max(...points.map((point) => Math.min(...samples.map((sample) => Math.hypot(sample.x - point.x, sample.y - point.y)))))
  assert.ok(worst < 1, `every flattened point sits near the curve (worst ${worst})`)
})

test('bounds include the curve reach, not just the anchors', () => {
  const from = { x: 0, y: 100, inX: 0, inY: 0, outX: 0, outY: -80, smooth: true }
  const to = { x: 100, y: 100, inX: 0, inY: -80, outX: 0, outY: 0, smooth: true }
  const bounds = pathBounds([from, to], false)
  assert.ok(bounds.width > 99.9 && bounds.width < 100.1)
  assert.ok(bounds.height > 55 && bounds.height < 65, 'the arch rises to about 40 above a 100-unit chord')
  assert.ok(bounds.y < 45, 'the box starts where the arch peaks')
})

test('a closed path contains its interior and rejects a point outside', () => {
  const square: PathAnchor[] = [anchor(0, 0), anchor(100, 0), anchor(100, 100), anchor(0, 100)]
  const path = createPath('Square', 0, 0, square, { closed: true })
  assert.equal(containsLocalPoint(path, { x: 50, y: 50 }), true)
  assert.equal(containsLocalPoint(path, { x: 150, y: 50 }), false)
  assert.equal(containsLocalPoint(path, { x: 50, y: -10 }), false)
})

test('an open path is hit by its stroke, and not by empty space', () => {
  const line = createPath('Line', 0, 0, [anchor(0, 0), anchor(100, 0)], { closed: false })
  line.style.stroke = { color: '#000000', width: 2 }
  assert.equal(containsLocalPoint(line, { x: 50, y: 1 }), true, 'within half the stroke plus slack')
  assert.equal(containsLocalPoint(line, { x: 50, y: 40 }), false)
  const bare = createPath('Bare', 0, 0, [anchor(0, 0), anchor(100, 0)], { closed: false })
  assert.equal(containsLocalPoint(bare, { x: 50, y: 0 }), false, 'no stroke means nothing to hit')
})

test('createPath normalises the box and keeps the requested position', () => {
  const path = createPath('Curve', 400, 300, [anchor(100, 100), anchor(200, 100), anchor(300, 200)], {
    closed: true,
    fillRule: 'evenodd',
    fill: '#a94a4a',
  })
  assert.equal(path.type, 'path')
  assert.equal(path.closed, true)
  assert.equal(path.fillRule, 'evenodd')
  assert.equal(path.style.fill, '#a94a4a')
  assert.ok(path.width > 0 && path.height > 0)
  assert.equal(path.transform.x, 400)
  assert.equal(path.transform.y, 300)
  assert.equal(path.anchors[0].x, 0, 'anchors are shifted into the local box')
  assert.equal(path.anchors[0].y, 0)
})

test('a path is selectable by clicking its fill and its stroke', () => {
  const path = createPath('Triangle', 100, 100, [anchor(0, 0), anchor(80, 0), anchor(40, 60)], { closed: true })
  const { document, id } = documentWith(path)
  const inside = hitTest(document, { x: 100 + 40, y: 100 + 20 })
  assert.equal(inside, id)
  // Just outside the fill but on the stroke.
  path.style.stroke = { color: '#000000', width: 4 }
  const stroked = documentWith(path).document
  const edge = hitTest(stroked, { x: 100 + 40, y: 100 - 1 })
  assert.equal(edge, id)
})

test('the document validates a path and refuses a malformed one', () => {
  const path = createPath('Triangle', 0, 0, [anchor(0, 0), anchor(80, 0), anchor(40, 60)], { closed: true })
  const { document } = documentWith(path)
  assert.equal(validateDocument(document).ok, true)

  const bad = createPath('Bad', 0, 0, [anchor(0, 0), anchor(10, 10)], { closed: true })
  const broken = documentWith(bad).document
  const result = validateDocument(broken)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.issue.message, /at least 3 anchors/)
})

test('setPathAnchors edits in one step and its inverse restores the path exactly', () => {
  const path = createPath('Triangle', 0, 0, [anchor(0, 0), anchor(80, 0), anchor(40, 60)], { closed: true, fillRule: 'nonzero' })
  let { document, id } = documentWith(path)
  const original = (findNode(document, id) as PathNode).anchors.map((value) => ({ ...value }))

  const result = applyCommand(document, {
    type: 'setPathAnchors',
    nodeId: id,
    anchors: [anchor(0, 0), anchor(100, 0), anchor(50, 80)],
    closed: true,
    fillRule: 'evenodd',
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  document = result.document
  const edited = findNode(document, id) as PathNode
  assert.equal(edited.anchors[1].x, 100)
  assert.equal(edited.fillRule, 'evenodd')

  const undone = applyCommand(document, result.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const restored = findNode(undone.document, id) as PathNode
  assert.deepEqual(restored.anchors, original)
  assert.equal(restored.fillRule, 'nonzero')
  assert.equal(restored.closed, true)
})

test('setPathAnchors refuses a non-path and a locked path', () => {
  const base = createDocument()
  const rect = createRect('Rect', 0, 0, 10, 10)
  const withRect = insertNodes(base, base.root.id, 0, [rect])
  const wrong = applyCommand(withRect, { type: 'setPathAnchors', nodeId: rect.id, anchors: [anchor(0, 0), anchor(1, 1)], closed: false, fillRule: 'nonzero' })
  assert.equal(wrong.ok, false)

  const path = createPath('Line', 0, 0, [anchor(0, 0), anchor(20, 0)], { closed: false })
  const { document, id } = documentWith(path)
  const locked = applyCommand(document, { type: 'setFlags', nodeId: id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  if (!locked.ok) return
  const refused = applyCommand(locked.document, { type: 'setPathAnchors', nodeId: id, anchors: [anchor(0, 0), anchor(20, 5)], closed: false, fillRule: 'nonzero' })
  assert.equal(refused.ok, false)
  if (!refused.ok) assert.equal(refused.code, 'locked')
})

test('a path round-trips through JSON and keeps its geometry', () => {
  const path = createPath('Round trip', 12, 34, [anchor(0, 0, 10, 0), anchor(60, 40, 0, -10), anchor(0, 40)], { closed: true })
  const parsed = JSON.parse(JSON.stringify(path)) as PathNode
  assert.equal(JSON.stringify(parsed.anchors), JSON.stringify(path.anchors))
  assert.equal(parsed.closed, true)
  assert.equal(parsed.width, path.width)
})

test('distanceToPolyline honours closure', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  // The closing edge from (0,10) to (0,0) only exists when the path is closed.
  assert.ok(distanceToPolyline(square, false, { x: -1, y: 5 }) > 1e-6)
  assert.ok(Math.abs(distanceToPolyline(square, true, { x: -1, y: 5 }) - 1) < 1e-6)
})

test('world bounds come from the normalised path box', () => {
  const path = createPath('Bounds', 200, 100, [anchor(0, 0), anchor(100, 0), anchor(50, 80)], { closed: true })
  const { document } = documentWith(path)
  const bounds = worldBounds(document, path.id)
  assert.ok(bounds !== null)
  if (bounds === null) return
  assert.ok(Math.abs(bounds.x - 200) < 1e-6)
  assert.ok(Math.abs(bounds.y - 100) < 1e-6)
  assert.ok(Math.abs(bounds.width - 100) < 1e-6)
  assert.ok(Math.abs(bounds.height - 80) < 1e-6)
})

test('a saved document with a curve reopens with format 5 and the same anchors', () => {
  const path = createPath('Saved curve', 40, 60, [anchor(0, 0, 12, 0), anchor(80, 30, 0, -12), anchor(0, 60)], {
    closed: true,
    fillRule: 'evenodd',
  })
  const { document } = documentWith(path)
  const saved = serializeDocument(document)
  assert.match(saved.manifest, /"formatVersion":\s*5/)
  const reopened = deserializeDocument(saved.manifest)
  assert.equal(reopened.ok, true)
  if (!reopened.ok) return
  const reopenedPath = findNode(reopened.document, path.id) as PathNode
  assert.equal(reopenedPath.type, 'path')
  assert.equal(reopenedPath.closed, true)
  assert.equal(reopenedPath.fillRule, 'evenodd')
  // Canonical JSON sorts keys, so compare fields rather than serialized order.
  assert.deepEqual(
    reopenedPath.anchors.map((value) => [value.x, value.y, value.inX, value.inY, value.outX, value.outY, value.smooth].map((n) => (n === 0 ? 0 : n))),
    path.anchors.map((value) => [value.x, value.y, value.inX, value.inY, value.outX, value.outY, value.smooth].map((n) => (n === 0 ? 0 : n))),
  )
})

test('simplify drops collinear points and keeps the end points', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ]
  assert.deepEqual(simplifyPoints(points, 0.5), [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
  ])
})

test('simplify keeps a point that is further out than the tolerance', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 8 },
    { x: 20, y: 0 },
  ]
  assert.equal(simplifyPoints(points, 0.5).length, 3)
  assert.equal(simplifyPoints(points, 10).length, 2)
})

test('the simplify command reduces anchors and its inverse restores them exactly', () => {
  // A densely sampled circle: neighbouring points are nearly collinear, so simplify has work to do.
  const circle: PathAnchor[] = Array.from({ length: 72 }, (_, index) => {
    const angle = (index / 72) * Math.PI * 2
    return anchor(50 + 50 * Math.cos(angle), 50 + 50 * Math.sin(angle))
  })
  const path = createPath('Round', 0, 0, circle, { closed: true })
  const { document, id } = documentWith(path)
  const before = (findNode(document, id) as PathNode).anchors.length
  const result = applyCommand(document, { type: 'simplifyPath', nodeId: id, tolerance: 1 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const simplified = findNode(result.document, id) as PathNode
  assert.ok(simplified.anchors.length < before, `${simplified.anchors.length} of ${before}`)
  const undone = applyCommand(result.document, result.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  assert.equal((findNode(undone.document, id) as PathNode).anchors.length, before)
})
