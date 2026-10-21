/**
 * Shape Builder (Phase 5.4, issue #140).
 *
 * The tool collects the objects a drag crosses and hands them to the host; the host applies the
 * boolean. That seam is testable without a canvas, which is why the state machine owns no geometry.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createShapeBuilderTool } from '../src/tools/shapeBuilder.ts'
import type { ToolHost, ToolPoint } from '../src/tools/types.ts'

function harness(hits: Record<string, string>) {
  const applied: Array<{ ids: string[]; subtract: boolean; pathLength: number; tolerance: number }> = []
  const host = {
    hitTest: (scene: { x: number; y: number }) => hits[Math.round(scene.x) + ',' + Math.round(scene.y)] ?? null,
    setMarquee: () => {},
    zoomFactor: () => 1,
    applyShapeBuilder: (ids: string[], subtract: boolean, path: Array<{ x: number; y: number }>, tolerance: number) =>
      applied.push({ ids, subtract, pathLength: path.length, tolerance }),
  } as unknown as ToolHost
  return { host, applied }
}

const point = (x: number, y: number): ToolPoint => ({ scene: { x, y }, screen: { x, y } })
const none = { shift: false, alt: false, meta: false, ctrl: false }

test('a drag across two objects unites them on release', () => {
  const { host, applied } = harness({ '10,10': 'a', '60,10': 'b' })
  const tool = createShapeBuilderTool('crosshair')
  tool.onPointerDown(host, point(10, 10), none)
  tool.onPointerMove(host, point(60, 10), none)
  tool.onPointerUp(host, point(60, 10), none)
  assert.equal(applied.length, 1)
  assert.deepEqual(applied[0].ids.sort(), ['a', 'b'])
  assert.equal(applied[0].subtract, false)
  assert.ok(applied[0].pathLength >= 2, 'the drag path reaches the host')
  assert.equal(applied[0].tolerance, 6)
})

test('Alt on release subtracts instead', () => {
  const { host, applied } = harness({ '10,10': 'a', '60,10': 'b' })
  const tool = createShapeBuilderTool('crosshair')
  tool.onPointerDown(host, point(10, 10), none)
  tool.onPointerMove(host, point(60, 10), none)
  tool.onPointerUp(host, point(60, 10), { ...none, alt: true })
  assert.equal(applied[0].subtract, true)
})

test('crossing one object still hands it to the host, and a cancel leaves nothing behind', () => {
  const { host, applied } = harness({ '10,10': 'a' })
  const tool = createShapeBuilderTool('crosshair')
  tool.onPointerDown(host, point(10, 10), none)
  tool.onPointerUp(host, point(10, 10), none)
  assert.equal(applied.length, 1, 'one object is a single region')
  applied.length = 0
  tool.onPointerDown(host, point(10, 10), none)
  tool.cancel(host)
  tool.onPointerUp(host, point(10, 10), none)
  assert.equal(applied.length, 0)
})

test('the same object crossed twice is only collected once', () => {
  const { host, applied } = harness({ '10,10': 'a', '20,10': 'a', '60,10': 'b' })
  const tool = createShapeBuilderTool('crosshair')
  tool.onPointerDown(host, point(10, 10), none)
  tool.onPointerMove(host, point(20, 10), none)
  tool.onPointerMove(host, point(60, 10), none)
  tool.onPointerUp(host, point(60, 10), none)
  assert.deepEqual(applied[0].ids.sort(), ['a', 'b'])
})
