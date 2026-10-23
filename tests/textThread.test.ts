/**
 * Threaded text (Phase 6.4): line distribution, the link command, and exact inverse.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createText, findNode, insertNodes } from '../src/doc/document.ts'
import { distributeLines, frameCapacity } from '../src/doc/textThread.ts'
import type { TextNode } from '../src/doc/types.ts'

test('a frame takes one line per leading, rounded up like Illustrator', () => {
  assert.equal(frameCapacity(200, 14.4), 14)
  assert.equal(frameCapacity(100, 20), 5)
  assert.equal(frameCapacity(10, 20), 1, 'a frame too short for a line still shows one')
  assert.equal(frameCapacity(Number.NaN, 20), 1)
  assert.equal(frameCapacity(100, 0), 1)
})

test('lines fill frames in order and the overflow past the last frame is not displayed', () => {
  const lines = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const slices = distributeLines(lines, [3, 4])
  assert.deepEqual(slices, [['1', '2', '3'], ['4', '5', '6', '7']])
  const total = slices.reduce((sum, slice) => sum + slice.length, 0)
  assert.equal(total, 7, 'three lines stay in the story but are not shown')
})

function frames(): { document: ReturnType<typeof createDocument>; head: string; next: string } {
  const head = createText('Head', 0, 0, 'one\ntwo\nthree', {
    width: 100,
    height: 50,
    textType: 'area',
    fontSize: 16,
    lineHeight: 20,
  })
  const next = createText('Next', 120, 0, '', { width: 100, height: 50, textType: 'area', fontSize: 16, lineHeight: 20 })
  const base = createDocument('Thread')
  return {
    document: insertNodes(insertNodes(base, base.root.id, 0, [head]), base.root.id, 1, [next]),
    head: head.id,
    next: next.id,
  }
}

test('the thread command stores the link and story, and its inverse clears them', () => {
  const { document, head, next } = frames()
  const result = applyCommand(document, { type: 'setTextThread', nodeId: head, nextId: next, story: 'full story' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const linked = findNode(result.document, head) as TextNode
  assert.equal(linked.threadNextId, next)
  assert.equal(linked.threadStory, 'full story')

  const undone = applyCommand(result.document, result.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const cleared = findNode(undone.document, head) as TextNode
  assert.equal(cleared.threadNextId, undefined)
  assert.equal(cleared.threadStory, undefined)
})

test('the thread command refuses a non-area frame and a self link', () => {
  const { document, head, next } = frames()
  const point = createText('Point', 0, 0, 'x')
  const withPoint = insertNodes(document, document.root.id, 2, [point])
  const badNext = applyCommand(withPoint, { type: 'setTextThread', nodeId: head, nextId: point.id, story: 's' })
  assert.equal(badNext.ok, false)
  const self = applyCommand(document, { type: 'setTextThread', nodeId: head, nextId: head, story: 's' })
  assert.equal(self.ok, false)
  const missingStory = applyCommand(document, { type: 'setTextThread', nodeId: head, nextId: next, story: null })
  assert.equal(missingStory.ok, false)
})
