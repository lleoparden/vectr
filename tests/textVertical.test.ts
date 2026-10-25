/**
 * Vertical text (Phase 6.7): the box model and the toggle command.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createText, estimateTextSize, findNode, insertNodes } from '../src/doc/document.ts'
import type { TextNode } from '../src/doc/types.ts'

test('vertical text stacks characters in columns, one font size per character', () => {
  assert.deepEqual(estimateTextSize('abc', 16, 19.2, 'vertical'), { width: 16, height: 48 })
  assert.deepEqual(estimateTextSize('ab\nc', 16, 19.2, 'vertical'), { width: 32, height: 32 })
  assert.deepEqual(estimateTextSize('abc', 16, 19.2), { width: 26.400000000000002, height: 16 })
})

function point(): { document: ReturnType<typeof createDocument>; id: string } {
  const text = createText('Vertical', 20, 30, 'abc', { fontSize: 16, lineHeight: 19.2 })
  const base = createDocument('Vertical')
  return { document: insertNodes(base, base.root.id, 0, [text]), id: text.id }
}

test('the orientation command changes the box and its inverse restores it', () => {
  const { document, id } = point()
  const vertical = applyCommand(document, { type: 'setTextOrientation', nodeId: id, orientation: 'vertical' })
  assert.equal(vertical.ok, true)
  if (!vertical.ok) return
  const node = findNode(vertical.document, id) as TextNode
  assert.equal(node.orientation, 'vertical')
  assert.deepEqual([node.width, node.height], [16, 48])

  const undone = applyCommand(vertical.document, vertical.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const restored = findNode(undone.document, id) as TextNode
  assert.notEqual(restored.orientation, 'vertical')
  assert.deepEqual([restored.width, restored.height], [26.400000000000002, 16])
})

test('an area frame keeps its authored box when it turns vertical', () => {
  const text = createText('Frame', 0, 0, 'abc', {
    width: 120,
    height: 80,
    textType: 'area',
    fontSize: 16,
    lineHeight: 19.2,
  })
  const base = createDocument('Area vertical')
  const document = insertNodes(base, base.root.id, 0, [text])
  const result = applyCommand(document, { type: 'setTextOrientation', nodeId: text.id, orientation: 'vertical' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const node = findNode(result.document, text.id) as TextNode
  assert.equal(node.orientation, 'vertical')
  assert.deepEqual([node.width, node.height], [120, 80])
})
