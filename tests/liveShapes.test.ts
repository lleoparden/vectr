/**
 * Live shape reshaping (Phase 5.6, issue #142): a command that changes width/height instead of scale.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createEllipse, createRect, findNode, insertNodes } from '../src/doc/document.ts'
import type { Document, RectNode } from '../src/doc/types.ts'

function fixture(): { document: Document; id: string } {
  const base = createDocument('Live')
  const rect = createRect('Rect', 20, 30, 100, 50)
  return { document: insertNodes(base, base.root.id, 0, [rect]), id: rect.id }
}

test('a resize changes width, height, and position while leaving the scale alone', () => {
  const { document, id } = fixture()
  const result = applyCommand(document, { type: 'resizeNode', nodeId: id, x: 40, y: 60, width: 150, height: 80 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const node = findNode(result.document, id) as RectNode
  assert.deepEqual([node.width, node.height, node.transform.x, node.transform.y], [150, 80, 40, 60])
  assert.deepEqual([node.transform.scaleX, node.transform.scaleY], [1, 1], 'no scale was introduced')

  const undone = applyCommand(result.document, result.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const restored = findNode(undone.document, id) as RectNode
  assert.deepEqual([restored.width, restored.height, restored.transform.x], [100, 50, 20])
})

test('a resize refuses a group, text, and a non-positive size', () => {
  const { document, id } = fixture()
  const group = applyCommand(document, { type: 'resizeNode', nodeId: 'root', x: 0, y: 0, width: 10, height: 10 })
  assert.equal(group.ok, false)
  const negative = applyCommand(document, { type: 'resizeNode', nodeId: id, x: 0, y: 0, width: 0, height: 10 })
  assert.equal(negative.ok, false)

  const ellipse = createEllipse('Ellipse', 0, 0, 40, 20)
  const withEllipse = insertNodes(document, document.root.id, 1, [ellipse])
  const grown = applyCommand(withEllipse, { type: 'resizeNode', nodeId: ellipse.id, x: 0, y: 0, width: 80, height: 40 })
  assert.equal(grown.ok, true)
})
