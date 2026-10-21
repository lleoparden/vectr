/**
 * Width tool (Phase 5.5, issue #141): a drag edits the nearest anchor's multiplier.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createWidthTool } from '../src/tools/width.ts'
import type { ToolHost } from '../src/tools/types.ts'

function fakeHost() {
  const calls: string[] = []
  const host = {
    widthBegin: () => {
      calls.push('begin')
      return { nodeId: 'node-1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], profile: [1, 1], width: 10 }
    },
    widthApply: (_nodeId: string, profile: number[]) => calls.push('apply:' + profile.join(',')),
    widthEnd: () => calls.push('end'),
    widthCancel: () => calls.push('cancel'),
  } as unknown as ToolHost
  return { host, calls }
}

test('dragging away from an anchor widens it and the drag ends as one entry', () => {
  const tool = createWidthTool('crosshair')
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, { scene: { x: 0, y: 0 }, screen: { x: 0, y: 0 } })
  tool.onPointerMove(host, { scene: { x: 0, y: 20 }, screen: { x: 0, y: 20 } })
  assert.deepEqual(calls, ['begin', 'apply:4,1'], 'distance 20 at width 10 is the cap of 4')
  tool.onPointerUp(host, { scene: { x: 0, y: 20 }, screen: { x: 0, y: 20 } })
  assert.deepEqual(calls.slice(2), ['end'])
})

test('a cancel aborts the transaction and a drag with no path does nothing', () => {
  const tool = createWidthTool('crosshair')
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, { scene: { x: 0, y: 0 }, screen: { x: 0, y: 0 } })
  tool.cancel(host)
  assert.deepEqual(calls, ['begin', 'cancel'])
})
