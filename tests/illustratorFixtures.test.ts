/**
 * Recorded Illustrator behaviour (Phase 6 oracle).
 *
 * These fixtures are committed so the unit suite never needs Illustrator. Each one names the
 * application version that produced it; a new version appends a fixture instead of rewriting this one.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const fixture = JSON.parse(
  fs
    .readFileSync(new URL('./fixtures/illustrator/point-text.json', import.meta.url), 'utf8')
    .replace(/^\uFEFF/u, ''),
)

type PointTextRow = {
  size: number
  leading: number
  bounds: [number, number, number, number]
  position: [number, number]
  font: string
}

function rows(raw: string): PointTextRow[] {
  return raw.split(';').map((entry) => {
    const [size, leading, bounds, position, font] = entry.split('|')
    const [left, top, right, bottom] = bounds.split(',').map(Number)
    const [x, y] = position.split(',').map(Number)
    return { size: Number(size), leading: Number(leading), bounds: [left, top, right, bottom], position: [x, y], font }
  })
}

const POINTS_TO_CSS_PIXELS = 4 / 3

test('the point-text fixture names the Illustrator build that produced it', () => {
  assert.equal(fixture.probe, 'point-text')
  assert.match(fixture.illustrator.version, /^\d+\.\d+\.\d+$/u)
  assert.equal(fixture.illustrator.name, 'Adobe Illustrator')
})

test('point text leading is 1.2 x size and the width grows with size', () => {
  const parsed = rows(fixture.raw)
  assert.equal(parsed.length, 3)
  for (const row of parsed) {
    assert.ok(Math.abs(row.leading - row.size * 1.2) < 0.01, `${row.size} pt leading ${row.leading}`)
    assert.ok(row.bounds[2] > row.bounds[0], 'right edge is beyond the left edge')
    assert.ok(row.bounds[3] < row.bounds[1], 'bottom is below top in Illustrator coordinates')
    assert.equal(row.position[0], 20)
    assert.ok(row.font.length > 0)
  }
  const widths = parsed.map((row) => row.bounds[2] - row.bounds[0])
  assert.ok(widths[0] < widths[1] && widths[1] < widths[2], `widths ${widths.join(', ')}`)
})

test('points convert to CSS pixels explicitly, never implicitly', () => {
  const parsed = rows(fixture.raw)
  const widthPoints = parsed[0].bounds[2] - parsed[0].bounds[0]
  const widthPixels = widthPoints * POINTS_TO_CSS_PIXELS
  assert.ok(widthPixels > widthPoints, 'a point is larger than a CSS pixel')
  assert.ok(Math.abs(widthPixels / widthPoints - POINTS_TO_CSS_PIXELS) < 1e-9)
})
