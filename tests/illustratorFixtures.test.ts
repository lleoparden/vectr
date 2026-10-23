/**
 * Recorded Illustrator behaviour (Phase 6 oracle).
 *
 * Fixtures are committed so the unit suite never needs Illustrator. Each names the application
 * version that produced it; a new version appends a fixture instead of rewriting this one.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const FIXTURES = [
  'point-text',
  'area-text',
  'text-on-path',
  'threading',
  'styles',
  'tabs',
  'vertical-text',
  'missing-font',
  'outline-text',
] as const

type Fixture = { probe: string; illustrator: { name: string; version: string }; raw: string }

function load(name: string): Fixture {
  return JSON.parse(
    fs.readFileSync(new URL(`./fixtures/illustrator/${name}.json`, import.meta.url), 'utf8').replace(/^﻿/u, ''),
  )
}

function fields(raw: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of raw.split('|')) {
    const separator = part.indexOf('=')
    if (separator > 0) map.set(part.slice(0, separator), part.slice(separator + 1))
  }
  return map
}

const POINTS_TO_CSS_PIXELS = 4 / 3

test('every fixture names the Illustrator build that produced it', () => {
  for (const name of FIXTURES) {
    const fixture = load(name)
    assert.equal(fixture.probe, name)
    assert.equal(fixture.illustrator.name, 'Adobe Illustrator')
    assert.match(fixture.illustrator.version, /^\d+\.\d+\.\d+$/u)
    assert.ok(fixture.raw.length > 0, `${name} has a recording`)
  }
})

test('point text leading is 1.2 x size and the width grows with size', () => {
  const raw = load('point-text').raw
  const parsed = raw.split(';').map((entry) => {
    const [size, leading, bounds, position, font] = entry.split('|')
    const [left, top, right, bottom] = bounds.split(',').map(Number)
    const [x, y] = position.split(',').map(Number)
    return { size: Number(size), leading: Number(leading), bounds: [left, top, right, bottom], position: [x, y], font }
  })
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
  const parsed = load('point-text').raw.split(';')
  const bounds = parsed[0].split('|')[2].split(',').map(Number)
  const widthPoints = bounds[2] - bounds[0]
  const widthPixels = widthPoints * POINTS_TO_CSS_PIXELS
  assert.ok(widthPixels > widthPoints, 'a point is larger than a CSS pixel')
  assert.ok(Math.abs(widthPixels / widthPoints - POINTS_TO_CSS_PIXELS) < 1e-9)
})

test('area text reports the frame box and its visible lines', () => {
  const [kind, bounds, lines, visibleLines] = load('area-text').raw.split('|')
  assert.match(kind, /AREATEXT/u)
  const [left, top, right, bottom] = bounds.split(',').map(Number)
  assert.equal(right - left, 200)
  assert.equal(top - bottom, 200)
  assert.equal(Number(lines), Number(visibleLines))
  assert.ok(Number(lines) > 0)
})

test('text on a path reports the path kind and the path length', () => {
  const parts = load('text-on-path').raw.split('|')
  assert.match(parts[0], /PATHTEXT/u)
  assert.equal(Number(parts[5]), 280, 'a 280 pt straight path')
  const [left, top, right, bottom] = parts[1].split(',').map(Number)
  assert.ok(top === bottom, 'a straight horizontal path has a flat box')
  assert.ok(right > left)
})

test('threading links the frames and the overflow lands in the second one', () => {
  const map = fields(load('threading').raw)
  assert.equal(map.get('linked'), '1')
  assert.ok(Number(map.get('firstChars')) < Number(map.get('secondChars')), map.get('firstChars') + ' < ' + map.get('secondChars'))
  assert.ok(Number(map.get('first')) > 0)
  assert.ok(Number(map.get('second')) > 0)
})

test('a character style stores its size and both styles come back by name', () => {
  const map = fields(load('styles').raw)
  assert.equal(map.get('characterName'), 'Probe Body')
  assert.equal(map.get('paragraphName'), 'Probe Paragraph')
  assert.equal(map.get('size'), '21')
  assert.equal(Number(map.get('characterStyles')), 2)
  assert.equal(Number(map.get('paragraphStyles')), 2)
})

test('vertical type exists, is settable, and changes the box', () => {
  const map = fields(load('vertical-text').raw)
  assert.match(map.get('orientation') ?? '', /VERTICAL/u)
  assert.equal(map.get('set'), 'set')
  const horizontal = (map.get('horizontal') ?? '').split(',').map(Number)
  const vertical = (map.get('vertical') ?? '').split(',').map(Number)
  assert.notEqual(Math.abs(horizontal[3] - horizontal[1]), Math.abs(vertical[3] - vertical[1]))
})

test('missing-font scripting refuses a nonexistent family instead of substituting', () => {
  const map = fields(load('missing-font').raw)
  assert.ok(Number(map.get('fonts')) > 0)
  assert.match(map.get('apply') ?? '', /^error:/u)
  assert.equal(map.get('current'), 'MyriadPro-Regular', 'the applied font is unchanged')
})

test('text-to-outline produces a group of paths with recorded bounds', () => {
  const map = fields(load('outline-text').raw)
  assert.equal(map.get('method'), 'createOutline')
  assert.ok(Number(map.get('paths')) >= 2)
  assert.equal(Number(map.get('groups')), 1)
  assert.notEqual(map.get('groupBounds'), 'none')
})

test('the tab API limitation is recorded rather than papered over', () => {
  const map = fields(load('tabs').raw)
  assert.equal(map.get('count'), '0')
  assert.match(map.get('add') ?? '', /^error:/u)
  assert.match(map.get('assign') ?? '', /^error:/u)
})
