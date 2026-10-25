/**
 * TrueType outline reading (Phase 6.9): cmap, advances, contours, and cubic conversion.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  advanceFor,
  contoursToAnchors,
  glyphContours,
  glyphFor,
  parseTrueType,
  textAdvanceWidth,
  textOutlineContours,
} from '../src/geom/ttf.ts'

const bytes = new Uint8Array(fs.readFileSync(new URL('../src/assets/fonts/Inter-Variable.ttf', import.meta.url)))
const font = parseTrueType(bytes)

test('the bundled font parses with a cmap, metrics, and glyphs', () => {
  assert.ok(font.unitsPerEm > 0)
  assert.ok(font.glyphCount > 100)
  assert.ok(font.ascender > 0)
  assert.ok(font.cmap.size > 50)
  assert.ok(glyphFor(font, 'A') > 0)
  assert.ok(advanceFor(font, glyphFor(font, 'A')) > 0)
})

test('glyph A has contours and converts to finite cubic anchors', () => {
  const contours = glyphContours(font, glyphFor(font, 'A'))
  assert.ok(contours.length >= 1, `${contours.length} contours`)
  const anchors = contoursToAnchors(contours, 100 / font.unitsPerEm, 0, 100)
  assert.ok(anchors.length >= 1)
  for (const contour of anchors) {
    assert.ok(contour.length >= 3)
    for (const anchor of contour) {
      assert.ok([anchor.x, anchor.y, anchor.inX, anchor.inY, anchor.outX, anchor.outY].every(Number.isFinite))
    }
  }
  // Inter's A is all straight lines; S is the one that must carry curve handles.
  const curved = contoursToAnchors(glyphContours(font, glyphFor(font, 'S')), 100 / font.unitsPerEm, 0, 100)
  assert.ok(curved.some((contour) => contour.some((anchor) => anchor.outX !== 0 || anchor.outY !== 0)), 'S curves carry handles')
})

test('a laid-out string reports an ordered advance width and outlines', () => {
  const width = textAdvanceWidth(font, 'Ab', 64)
  assert.ok(width > 0)
  assert.ok(textAdvanceWidth(font, 'Abc', 64) > width, 'more characters are wider')
  assert.ok(textAdvanceWidth(font, 'Ab', 128) > width, 'a larger size is wider')
  const outlines = textOutlineContours(font, 'Ab', 64, 76.8, 'left', 200)
  assert.ok(outlines.length >= 2, 'two glyphs produce at least two contours')
})
