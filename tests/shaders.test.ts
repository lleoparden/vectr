/**
 * Shader colour normalisation (issue #156).
 *
 * CanvasKit's `Color()` normalises RGB but not alpha, while gradient shaders want all four
 * channels in 0-1. Passing `Color()` straight into a gradient turned every stop white, which made
 * a gradient look like an invisible shape on a white page. These values are the contract the
 * renderer relies on.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { shaderColor, shaderColors } from '../src/render/shaders.ts'

test('shader colours are four channels in 0-1, including alpha', () => {
  const white = shaderColor('#ffffff')
  assert.deepEqual(Array.from(white), [1, 1, 1, 1])
  const black = shaderColor('#000000')
  assert.deepEqual(Array.from(black), [0, 0, 0, 1])
  const blue = shaderColor('#4f7cff')
  // Float32Array rounds each channel; compare at float precision rather than double precision.
  const expected = [79 / 255, 124 / 255, 1, 1].map((channel) => Math.fround(channel))
  assert.deepEqual(Array.from(blue), expected)
  for (const channel of blue) {
    assert.ok(channel >= 0 && channel <= 1, 'every channel must be in 0-1, got ' + channel)
  }
  assert.equal(blue[3], 1, 'opaque document colours keep full alpha')
})

test('a hex without the leading hash parses the same way', () => {
  assert.deepEqual(Array.from(shaderColor('a94a4a')), Array.from(shaderColor('#a94a4a')))
})

test('an unparseable colour degrades to transparent black rather than NaN', () => {
  const broken = shaderColor('#zzz')
  assert.deepEqual(Array.from(broken), [0, 0, 0, 1])
  assert.ok(broken.every((channel) => Number.isFinite(channel)))
})

test('a stop list keeps its order', () => {
  const colors = shaderColors(['#a94a4a', '#f3eee8'])
  assert.equal(colors.length, 2)
  assert.deepEqual(Array.from(colors[0]), Array.from(shaderColor('#a94a4a')))
  assert.deepEqual(Array.from(colors[1]), Array.from(shaderColor('#f3eee8')))
})
