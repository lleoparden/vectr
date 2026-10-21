/**
 * Stroke outlines (Phase 5.6, issue #142): an open polyline plus a width becomes a closed polygon.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { offsetRing, offsetSide, outlineArea, strokeOutline, strokeRing } from '../src/geom/offset.ts'

test('a straight line becomes a rectangle of length × width', () => {
  const outline = strokeOutline(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    10,
  )
  assert.equal(outline.length, 4)
  assert.ok(Math.abs(outlineArea(outline) - 1000) < 1e-6, `area ${outlineArea(outline)}`)
})

test('a corner keeps both rails and closes around them', () => {
  const outline = strokeOutline(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    10,
  )
  assert.ok(outline.length >= 6)
  assert.ok(outlineArea(outline) > 1500, 'the L-shaped stroke covers both legs')
})

test('duplicate points and a zero width produce nothing', () => {
  const outline = strokeOutline(
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ],
    8,
  )
  assert.equal(outline.length, 4)
  assert.deepEqual(strokeOutline([{ x: 0, y: 0 }], 10), [])
  assert.deepEqual(strokeOutline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0), [])
})

test('a closed square becomes an outer and an inner contour whose difference is the stroke area', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]
  const ring = strokeRing(square, 10)
  assert.ok(ring !== null)
  assert.equal(ring.outer.length, 4)
  assert.equal(ring.inner.length, 4)
  const area = outlineArea(ring.outer) - outlineArea(ring.inner)
  assert.ok(Math.abs(area - 4000) < 1e-6, `ring area ${area}`)
  assert.ok(outlineArea(ring.outer) > outlineArea(ring.inner), 'the outer contour encloses the hole')
})

test('a degenerate closed contour produces no ring', () => {
  assert.equal(strokeRing([{ x: 0, y: 0 }], 10), null)
  assert.equal(strokeRing([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }], 10), null)
})

test('offsetting an open line moves it perpendicular to its direction', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]
  const moved = offsetSide(line, 10)
  assert.deepEqual(moved, [
    { x: 0, y: 10 },
    { x: 100, y: 10 },
  ])
})

test('offsetting a closed square changes its area exactly', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]
  assert.equal(outlineArea(offsetRing(square, 10)), 14400)
  assert.equal(outlineArea(offsetRing(square, -10)), 6400)
})
