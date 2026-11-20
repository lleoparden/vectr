/**
 * Appearance effects (Phase 7.1): the drop-shadow command, its inverse, and its refusals.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createRect, createText, findNode, insertNodes } from '../src/doc/document.ts'
import { validateDocument } from '../src/doc/validate.ts'
import type { RectNode } from '../src/doc/types.ts'

const SHADOW = { type: 'dropShadow' as const, x: 6, y: 8, blur: 10, color: '#000000', opacity: 0.4 }

function fixture(): { document: ReturnType<typeof createDocument>; id: string } {
  const base = createDocument('Effects')
  const rect = createRect('Rect', 20, 30, 100, 80)
  return { document: insertNodes(base, base.root.id, 0, [rect]), id: rect.id }
}

test('a drop shadow is stored, validated, and removed by its inverse', () => {
  const { document, id } = fixture()
  const applied = applyCommand(document, { type: 'setEffects', nodeId: id, effects: [SHADOW] })
  assert.equal(applied.ok, true)
  if (!applied.ok) return
  const node = findNode(applied.document, id) as RectNode
  assert.deepEqual(node.style.effects, [SHADOW])
  assert.equal(validateDocument(applied.document).ok, true)

  const undone = applyCommand(applied.document, applied.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  assert.equal((findNode(undone.document, id) as RectNode).style.effects, undefined)
})

test('a blur is stored alongside a shadow and refuses an out-of-range radius', () => {
  const { document, id } = fixture()
  const both = applyCommand(document, { type: 'setEffects', nodeId: id, effects: [SHADOW, { type: 'blur', radius: 12 }] })
  assert.equal(both.ok, true)
  if (!both.ok) return
  const node = findNode(both.document, id) as RectNode
  assert.equal(node.style.effects?.length, 2)
  assert.equal(validateDocument(both.document).ok, true)
  const bad = applyCommand(both.document, { type: 'setEffects', nodeId: id, effects: [{ type: 'blur', radius: 200 }] })
  assert.equal(bad.ok, false)
})

test('effects are refused on text, groups, and out-of-range shadows', () => {
  const { document } = fixture()
  const text = createText('Text', 0, 0, 'x')
  const withText = insertNodes(document, document.root.id, 1, [text])
  assert.equal(applyCommand(withText, { type: 'setEffects', nodeId: text.id, effects: [SHADOW] }).ok, false)
  assert.equal(applyCommand(withText, { type: 'setEffects', nodeId: 'root', effects: [SHADOW] }).ok, false)

  const badBlur = applyCommand(document, {
    type: 'setEffects',
    nodeId: (document.root.children[0] as RectNode).id,
    effects: [{ ...SHADOW, blur: 900 }],
  })
  assert.equal(badBlur.ok, false)
  const badOpacity = applyCommand(document, {
    type: 'setEffects',
    nodeId: (document.root.children[0] as RectNode).id,
    effects: [{ ...SHADOW, opacity: 2 }],
  })
  assert.equal(badOpacity.ok, false)
})
