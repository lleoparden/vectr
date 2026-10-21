/**
 * Live Paint bucket (Phase 5.4, issue #140): the tool hands the scene point to the host, nothing more.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createLivePaintTool } from '../src/tools/livePaint.ts'
import type { ToolHost, ToolPoint } from '../src/tools/types.ts'

test('a click asks the host to paint the region under the pointer', () => {
  const painted: Array<{ x: number; y: number }> = []
  const host = { paintRegion: (point: { x: number; y: number }) => painted.push(point) } as unknown as ToolHost
  const tool = createLivePaintTool('crosshair')
  tool.onPointerDown(host, { scene: { x: 12, y: 34 }, screen: { x: 1, y: 2 } } as ToolPoint)
  assert.deepEqual(painted, [{ x: 12, y: 34 }])
  assert.equal(tool.id, 'livePaint')
})
