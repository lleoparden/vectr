/**
 * Boolean path operations (Phase 5.4, issue #140).
 *
 * Skia's path ops do the clipping; the scoreboard here is area. Two unit squares overlapping by half
 * have known areas for every mode, so a wrong result cannot pass by looking plausible.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

import CanvasKitInit from 'canvaskit-wasm'

import { booleanPolygons, dividePolygons, type BooleanMode } from '../src/render/boolean.ts'
import { area } from '../src/ops/polygon.ts'

const wasm = path.join(process.cwd(), 'node_modules', 'canvaskit-wasm', 'bin', 'canvaskit.wasm')
const kit = await CanvasKitInit({ locateFile: () => wasm })

const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

const left = square(0, 0, 100)
const right = square(50, 50, 100)

test('two overlapping squares give the expected area in every mode', () => {
  const expected: Record<BooleanMode, number> = {
    unite: 17500,
    intersect: 2500,
    subtract: 7500,
    exclude: 15000,
  }
  for (const mode of Object.keys(expected) as BooleanMode[]) {
    const result = booleanPolygons(kit, [left, right], mode)
    const total = result.reduce((sum, polygon) => sum + area(polygon), 0)
    assert.ok(Math.abs(total - expected[mode]) < 1e-6, `${mode}: ${total} vs ${expected[mode]}`)
  }
})

test('disjoint squares join into two subpaths and subtract leaves the first alone', () => {
  const far = square(500, 500, 20)
  const union = booleanPolygons(kit, [left, far], 'unite')
  assert.equal(union.length, 2)
  assert.ok(Math.abs(union.reduce((sum, polygon) => sum + area(polygon), 0) - 10400) < 1e-6)
  const difference = booleanPolygons(kit, [left, far], 'subtract')
  assert.equal(difference.length, 1)
  assert.ok(Math.abs(area(difference[0]) - 10000) < 1e-6)
})

test('fewer than two polygons passes the input through', () => {
  const result = booleanPolygons(kit, [left], 'unite')
  assert.equal(result.length, 1)
  assert.ok(Math.abs(area(result[0]) - 10000) < 1e-6)
})

test('divide splits two overlapping squares into three non-overlapping faces', () => {
  const faces = dividePolygons(kit, [left, right])
  assert.equal(faces.length, 3)
  const areas = faces.map((face) => area(face)).sort((a, b) => a - b)
  assert.deepEqual(areas.map((value) => Math.round(value)), [2500, 7500, 7500])
  assert.ok(Math.abs(areas.reduce((sum, value) => sum + value, 0) - 17500) < 1e-6, 'faces cover the union exactly once')
})
