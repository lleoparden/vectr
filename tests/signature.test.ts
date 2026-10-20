/**
 * The bucket content signature (issue #156).
 *
 * A bucket is reused while its signature is unchanged, so every pixel-affecting field must be in
 * it. The gradient used to be missing, which meant switching a fill to a gradient never repainted.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { contentSignature } from '../src/render/signature.ts'
import type { SceneShape } from '../src/render/scene.ts'

function shape(overrides: Partial<SceneShape> = {}): SceneShape {
  return {
    id: 'shape-1',
    kind: 'rect',
    root: 'artboard-1',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    width: 100,
    height: 50,
    cornerRadius: 0,
    lineFrom: 'top-left',
    sides: 0,
    innerRadius: 0,
    startAngle: 0,
    sweepAngle: 0,
    pie: false,
    fill: '#4f7cff',
    gradient: null,
    gradientTarget: null,
    stroke: null,
    opacity: 1,
    blendMode: null,
    text: null,
    clip: null,
    assetId: null,
    crop: null,
    maskAssetId: null,
    ...overrides,
  }
}

const gradient = {
  type: 'linear' as const,
  stops: [
    { offset: 0, color: '#4f7cff' },
    { offset: 1, color: '#ffffff' },
  ],
  from: { x: 0.5, y: 1 },
  to: { x: 0.5, y: 0 },
}

test('switching a shape to a gradient changes its signature', () => {
  const plain = contentSignature([shape()])
  const filled = contentSignature([shape({ gradient })])
  assert.notEqual(plain, filled, 'a gradient must force the bucket to re-record')
})

test('every gradient property that paints is part of the signature', () => {
  const base = contentSignature([shape({ gradient })])
  assert.notEqual(base, contentSignature([shape({ gradient: { ...gradient, type: 'radial' } })]), 'type')
  assert.notEqual(base, contentSignature([shape({ gradient: { ...gradient, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] } })]), 'stop colours')
  assert.notEqual(base, contentSignature([shape({ gradient: { ...gradient, from: { x: 0, y: 0 } } })]), 'from point')
  assert.notEqual(base, contentSignature([shape({ gradientTarget: 'stroke' })]), 'gradient target')
})

test('opacity, blend mode, corner radius, and text all repaint', () => {
  const base = contentSignature([shape()])
  assert.notEqual(base, contentSignature([shape({ opacity: 0.5 })]), 'opacity')
  assert.notEqual(base, contentSignature([shape({ blendMode: 'multiply' })]), 'blend mode')
  assert.notEqual(base, contentSignature([shape({ cornerRadius: 8 })]), 'corner radius')
  assert.notEqual(base, contentSignature([shape({ kind: 'text', text: { content: 'hello', fontSize: 16, fontFamily: 'sans-serif', align: 'left', lineHeight: 20 } })]), 'text')
})

test('an unchanged shape keeps its signature, so an idle bucket still reuses its picture', () => {
  assert.equal(contentSignature([shape()]), contentSignature([shape()]))
})
