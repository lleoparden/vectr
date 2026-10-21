/**
 * Stroke outlines (Phase 5.6, issue #142): an open polyline plus a width becomes a closed polygon.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { outlineArea, strokeOutline } from '../src/geom/offset.ts'

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
