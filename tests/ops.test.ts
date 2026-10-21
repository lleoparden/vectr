/**
 * Polygon primitives for path operations (Phase 5.4, issue #140).
 *
 * Area and winding are the scoreboard a boolean result has to satisfy; these tests fix what those
 * words mean before any operation is built on them.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { area, centroid, nestPolygons, polygonContainsNonzero, polygonOf, polygonTouchesPath, signedArea, windingNumber } from '../src/ops/polygon.ts'
import { cornerAnchor } from '../src/geom/path.ts'

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

test('shoelace area is exact and signed by direction', () => {
  assert.equal(area(square), 100)
  assert.ok(signedArea(square) > 0, 'counter-clockwise is positive in y-down coordinates')
  assert.equal(signedArea([...square].reverse()), -100)
  assert.equal(area(square.slice(0, 2)), 0, 'two points have no area')
})

test('the winding number is nonzero inside and zero outside', () => {
  assert.equal(windingNumber(square, { x: 5, y: 5 }), 1)
  assert.equal(windingNumber(square, { x: -1, y: 5 }), 0)
  assert.equal(polygonContainsNonzero(square, { x: 5, y: 5 }), true)
  assert.equal(polygonContainsNonzero(square, { x: 15, y: 5 }), false)
})

test('a curved path flattens to a polygon whose area is close to the analytic value', () => {
  const radius = 50
  const kappa = 0.5522847498 * radius
  const anchors = [
    { x: radius, y: 0, inX: 0, inY: -kappa, outX: 0, outY: kappa, smooth: true },
    { x: 0, y: radius, inX: kappa, inY: 0, outX: -kappa, outY: 0, smooth: true },
    { x: -radius, y: 0, inX: 0, inY: kappa, outX: 0, outY: -kappa, smooth: true },
    { x: 0, y: -radius, inX: -kappa, inY: 0, outX: kappa, outY: 0, smooth: true },
  ]
  const polygon = polygonOf(anchors)
  const expected = Math.PI * radius * radius
  assert.ok(Math.abs(area(polygon) - expected) / expected < 0.01, `area ${area(polygon)} vs ${expected}`)
})

test('a two-anchor path still produces a usable polygon', () => {
  const tiny = polygonOf([cornerAnchor(0, 0), cornerAnchor(10, 0)])
  assert.ok(tiny.length >= 2, 'a two-anchor path still yields a polygon')
  assert.equal(tiny[0].x, 0)
})

test('a face is touched when the drag passes within tolerance of it', () => {
  assert.deepEqual(centroid(square), { x: 5, y: 5 })
  const drag = [
    { x: -5, y: 5 },
    { x: 15, y: 5 },
  ]
  assert.equal(polygonTouchesPath(square, drag, 0.5), true, 'the drag crosses the face')
  const far = [
    { x: -30, y: 5 },
    { x: -20, y: 5 },
  ]
  assert.equal(polygonTouchesPath(square, far, 0.5), false)
  assert.equal(polygonTouchesPath(square, [{ x: -10, y: 4 }, { x: -10, y: 6 }], 3), false)
})

test('nesting puts a hole inside its container and keeps disjoint contours apart', () => {
  const outer = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ]
  const inner = [
    { x: 50, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 150 },
    { x: 50, y: 150 },
  ]
  const far = [
    { x: 400, y: 400 },
    { x: 450, y: 400 },
    { x: 450, y: 450 },
    { x: 400, y: 450 },
  ]
  const groups = nestPolygons([outer, inner, far])
  assert.equal(groups.length, 2)
  const withHole = groups.find((group) => group.holes.length === 1)
  assert.ok(withHole !== undefined)
  assert.equal(area(withHole.outer), 40000)
  assert.equal(area(withHole.holes[0]), 10000)
})
