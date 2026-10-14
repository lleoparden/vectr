import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FIXTURE_ASSETS,
  FIXTURE_VERSION,
  createFixture,
  hslToHex,
  summarizeFixture,
} from '../src/bench/fixtures.ts'
import { computeVerdict, percentile, round, summarizeRuns } from '../src/bench/report.ts'

test('fixtures are frozen and deterministic', () => {
  const first = createFixture('primitives', 'representative')
  const second = createFixture('primitives', 'representative')
  assert.equal(FIXTURE_VERSION, 1)
  assert.equal(first.version, FIXTURE_VERSION)
  assert.deepEqual(first, second)
})

test('empty fixtures produce no roots and require no assets', () => {
  for (const content of ['primitives', 'text', 'images', 'groups']) {
    const fixture = createFixture(content, 'empty')
    assert.deepEqual(fixture.roots, [], `${content} empty fixture must have no roots`)
    assert.deepEqual(fixture.assets, [])
  }
})

test('representative and stress sizes match the declared leaf budgets', () => {
  const representative = summarizeFixture(createFixture('primitives', 'representative'))
  assert.equal(representative.leaves, 1_000)
  assert.equal(representative.segments, 4_000)
  const stress = summarizeFixture(createFixture('primitives', 'stress'))
  assert.equal(stress.leaves, 10_000)
  assert.equal(stress.segments, 100_000)
})

test('text fixtures carry editable text and a font size', () => {
  const summary = summarizeFixture(createFixture('text', 'representative'))
  assert.equal(summary.texts, 1_000)
  assert.equal(summary.primitives, 0)
})

test('image fixtures reference only declared content-addressed assets', () => {
  const fixture = createFixture('images', 'representative')
  const declared = new Set(fixture.assets.map((asset) => asset.id))
  assert.equal(fixture.assets.length, FIXTURE_ASSETS.length)
  const summary = summarizeFixture(fixture)
  assert.equal(summary.images, 100)
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.kind === 'group') walk(node.children)
      else if (node.kind === 'image') assert.ok(declared.has(node.asset), `${node.id} uses ${node.asset}`)
    }
  }
  walk(fixture.roots)
})

test('group fixtures are nested several levels deep', () => {
  const summary = summarizeFixture(createFixture('groups', 'representative'))
  assert.equal(summary.groups > 0, true)
  assert.equal(summary.leaves, 1_000)
  assert.ok(summary.maxDepth >= 4, `expected nesting, saw depth ${summary.maxDepth}`)
})

test('hslToHex converts hue, saturation, and lightness predictably', () => {
  assert.equal(hslToHex(0, 1, 0.5), '#ff0000')
  assert.equal(hslToHex(120, 1, 0.5), '#00ff00')
  assert.equal(hslToHex(240, 1, 0.5), '#0000ff')
  assert.equal(hslToHex(0, 0, 0.5), '#808080')
  assert.equal(hslToHex(360, 1, 0.5), hslToHex(0, 1, 0.5))
})

const metric = (detail, interactionMs, presentedMs = 0, uiInteractionMs = 0, renderMode = 'picture') => ({
  scenario: 'fixture',
  detail,
  renderMode,
  buildMs: 1,
  drawMs: interactionMs,
  interactionMs,
  presentedMs,
  uiInteractionMs,
  livePaths: 0,
  liveImages: 0,
  liveParagraphs: 0,
  livePictures: 0,
  heapBytes: null,
})

test('verdict passes inside the target and fails outside it', () => {
  const pass = computeVerdict([metric('a', 20), metric('b', 33)])
  assert.equal(pass.pass, true)
  assert.equal(pass.worstInteractionMs, 33)
  const fail = computeVerdict([metric('a', 20), metric('b', 35.2)])
  assert.equal(fail.pass, false)
  assert.match(fail.summary, /exceeds the 33 ms target/)
})

test('verdict refuses to pass without interaction measurements', () => {
  const none = computeVerdict([metric('resize', 0)])
  assert.equal(none.pass, false)
  assert.match(none.summary, /no interaction measurements/)
})

test('percentile and round behave predictably', () => {
  assert.equal(percentile([], 0.95), 0)
  assert.equal(percentile([1, 2, 3, 4, 5], 0.95), 5)
  assert.equal(round(35.2049), 35.2)
})

test('summarizeRuns aggregates repeated runs and keeps the gate metric', () => {
  const record = (interactionMs) => ({
    schemaVersion: 1,
    fixtureVersion: FIXTURE_VERSION,
    reportKind: 'phase-one-renderer-spike',
    capturedAt: '2026-10-14T00:00:00.000Z',
    renderer: { backend: 'webgl', wasmBytes: 1, webglAvailable: true, fontLoaded: true },
    environment: { platform: 'win32', arch: 'x64', electron: '35', chrome: '134', devicePixelRatio: 1 },
    scenarios: [metric('primitives/stress', interactionMs, 30, 40)],
    notes: [],
  })
  const summary = summarizeRuns([record(10), record(20)])
  assert.equal(summary.runCount, 2)
  assert.equal(summary.pass, true)
  assert.equal(summary.backend, 'webgl')
  assert.equal(summary.fontLoaded, true)
  assert.equal(summary.decidingMode, 'picture')
  const entry = summary.entries[0]
  assert.equal(entry.detail, 'primitives/stress')
  assert.equal(entry.renderMode, 'picture')
  assert.equal(entry.worstInteractionMs, 20)
  assert.equal(entry.uiInteractionMsP95, 40)
})

test('the picture path decides the gate while the direct path is only reported', () => {
  const record = (detail, directMs, pictureMs) => ({
    schemaVersion: 1,
    fixtureVersion: FIXTURE_VERSION,
    reportKind: 'phase-one-renderer-spike',
    capturedAt: '2026-10-14T00:00:00.000Z',
    renderer: { backend: 'webgl', wasmBytes: 1, webglAvailable: true, fontLoaded: true },
    environment: { platform: 'win32', arch: 'x64', electron: '35', chrome: '134', devicePixelRatio: 1 },
    scenarios: [
      metric(detail, directMs, 0, 0, 'direct'),
      metric(detail, pictureMs, 0, 0, 'picture'),
    ],
    notes: [],
  })
  const summary = summarizeRuns([record('primitives/stress', 99.9, 12.5)])
  assert.equal(summary.decidingMode, 'picture')
  assert.equal(summary.pass, true)
  assert.equal(summary.worstInteractionMsP95, 12.5)
  assert.equal(summary.verdicts.direct.pass, false)
  assert.equal(summary.verdicts.direct.worstInteractionMs, 99.9)
  assert.equal(summary.verdicts.picture.pass, true)
  assert.equal(summary.entries.length, 2)
})
