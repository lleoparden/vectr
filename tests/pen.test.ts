/**
 * The Pen tool state machine (Phase 5.2, issue #138).
 *
 * The tool only touches the host, so the whole click/drag/close/finish/cancel contract is testable
 * without a canvas. The host records what it was asked to draw and to commit.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createPenTool, PEN_CLOSE_DISTANCE } from '../src/tools/pen.ts'
import type { PenDraft, ToolHost, ToolPoint } from '../src/tools/types.ts'
import type { PathAnchor } from '../src/geom/path.ts'

type Commit = { anchors: PathAnchor[]; closed: boolean }

function harness() {
  const drafts: Array<PenDraft | null> = []
  const commits: Commit[] = []
  const host = {
    setPenDraft: (draft: PenDraft | null) => drafts.push(draft),
    commitPenPath: (anchors: PathAnchor[], closed: boolean) =>
      commits.push({ anchors: anchors.map((anchor) => ({ ...anchor })), closed }),
  } as unknown as ToolHost
  return {
    host,
    drafts,
    commits,
    lastDraft: (): PenDraft | null => drafts.length === 0 ? null : drafts[drafts.length - 1],
  }
}

const point = (x: number, y: number): ToolPoint => ({ scene: { x, y }, screen: { x, y } })
const none = { shift: false, alt: false, meta: false, ctrl: false }

function click(host: ToolHost, tool: ReturnType<typeof createPenTool>, x: number, y: number): void {
  tool.onPointerDown(host, point(x, y), none)
  tool.onPointerUp(host, point(x, y), none)
}

test('a click adds a corner anchor and shows it in the preview', () => {
  const { host, lastDraft, commits } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 10, 20)
  const draft = lastDraft()
  assert.ok(draft !== null)
  assert.equal(draft.anchors.length, 1)
  assert.deepEqual(
    { x: draft.anchors[0].x, y: draft.anchors[0].y, inX: draft.anchors[0].inX, outX: draft.anchors[0].outX, smooth: draft.anchors[0].smooth },
    { x: 10, y: 20, inX: 0, outX: 0, smooth: false },
  )
  assert.equal(commits.length, 0, 'nothing is written to the document until the path is finished')
})

test('a press-and-drag makes a smooth anchor with mirrored handles', () => {
  const { host, lastDraft } = harness()
  const tool = createPenTool('crosshair')
  tool.onPointerDown(host, point(0, 0), none)
  tool.onPointerMove(host, point(20, 10), none)
  tool.onPointerUp(host, point(20, 10), none)
  tool.onPointerDown(host, point(80, 0), none)
  tool.onPointerUp(host, point(80, 0), none)
  const draft = lastDraft()
  assert.ok(draft !== null)
  const anchor = draft.anchors[0]
  assert.equal(anchor.smooth, true)
  assert.deepEqual([anchor.outX, anchor.outY, anchor.inX, anchor.inY], [20, 10, -20, -10])
})

test('clicking the first anchor closes a finished path in one commit', () => {
  const { host, commits } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 0, 0)
  click(host, tool, 100, 0)
  click(host, tool, 50, 80)
  click(host, tool, PEN_CLOSE_DISTANCE - 2, 0)
  assert.equal(commits.length, 1)
  assert.equal(commits[0].closed, true)
  assert.equal(commits[0].anchors.length, 3)
})

test('the close radius is honoured: a click just outside it adds an anchor instead', () => {
  const { host, commits } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 0, 0)
  click(host, tool, 100, 0)
  click(host, tool, 50, 80)
  click(host, tool, PEN_CLOSE_DISTANCE + 2, PEN_CLOSE_DISTANCE + 2)
  assert.equal(commits.length, 0, 'an outside click is a new anchor, not a close')
})

test('Enter finishes an open path with at least two anchors', () => {
  const { host, commits } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 0, 0)
  click(host, tool, 60, 40)
  tool.finish?.(host)
  assert.equal(commits.length, 1)
  assert.equal(commits[0].closed, false)
  assert.equal(commits[0].anchors.length, 2)
})

test('Enter with a single anchor simply drops the draft', () => {
  const { host, commits, lastDraft } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 0, 0)
  tool.finish?.(host)
  assert.equal(commits.length, 0)
  assert.equal(lastDraft(), null, 'the preview is cleared')
})

test('Escape abandons the draft without committing', () => {
  const { host, commits, lastDraft } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 0, 0)
  click(host, tool, 60, 0)
  tool.cancel(host)
  assert.equal(commits.length, 0)
  assert.equal(lastDraft(), null)
  // A fresh click starts a new draft rather than continuing the abandoned one.
  click(host, tool, 200, 200)
  const draft = lastDraft()
  assert.ok(draft !== null)
  assert.equal(draft.anchors.length, 1)
  assert.equal(draft.anchors[0].x, 200)
})

test('the pointer position feeds the rubber band between clicks', () => {
  const { host, lastDraft } = harness()
  const tool = createPenTool('crosshair')
  click(host, tool, 0, 0)
  tool.onPointerMove(host, point(30, 40), none)
  const draft = lastDraft()
  assert.ok(draft !== null)
  assert.deepEqual(draft.cursor, { x: 30, y: 40 })
})
