/**
 * Point-text alignment (Phase 6.1).
 *
 * Illustrator keeps the point-text insertion anchor fixed when alignment changes: left keeps the left
 * edge, centre the centre, right the right edge (fixture: tests/fixtures/illustrator/point-text-align.json).
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createText, findNode, insertNodes } from '../src/doc/document.ts'
import type { TextNode } from '../src/doc/types.ts'

function fixture(): { document: ReturnType<typeof createDocument>; id: string } {
  const text = createText('Label', 200, 50, 'Hamburgefonstiv', {
    fontSize: 16,
    lineHeight: 19.2,
    width: 100,
    height: 20,
    align: 'left',
  })
  const base = createDocument('Alignment')
  return { document: insertNodes(base, base.root.id, 0, [text]), id: text.id }
}

function align(
  document: ReturnType<typeof createDocument>,
  id: string,
  next: 'left' | 'center' | 'right',
): ReturnType<typeof applyCommand> {
  return applyCommand(document, {
    type: 'setTextStyle',
    nodeId: id,
    fontSize: 16,
    fontFamily: 'Inter',
    align: next,
    lineHeight: 19.2,
    width: 100,
    height: 20,
  })
}

test('alignment moves the box around a fixed insertion anchor', () => {
  const { document, id } = fixture()
  const centred = align(document, id, 'center')
  assert.equal(centred.ok, true)
  if (!centred.ok) return
  assert.equal((findNode(centred.document, id) as TextNode).transform.x, 150, 'left 200 becomes 200 - width/2')

  const right = align(centred.document, id, 'right')
  assert.equal(right.ok, true)
  if (!right.ok) return
  assert.equal((findNode(right.document, id) as TextNode).transform.x, 100, 'the same anchor 200, minus the width')

  const leftAgain = align(right.document, id, 'left')
  assert.equal(leftAgain.ok, true)
  if (!leftAgain.ok) return
  assert.equal((findNode(leftAgain.document, id) as TextNode).transform.x, 200, 'back to the anchor')
})

test('the inverse restores the exact x as well as the alignment', () => {
  const { document, id } = fixture()
  const centred = align(document, id, 'center')
  assert.equal(centred.ok, true)
  if (!centred.ok) return
  const undone = applyCommand(centred.document, centred.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const node = findNode(undone.document, id) as TextNode
  assert.equal(node.align, 'left')
  assert.equal(node.transform.x, 200)
})
