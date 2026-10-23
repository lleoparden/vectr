/**
 * Area text (Phase 6.2): a fixed frame, wrapping inside it, and a frame that content edits do not move.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createText, findNode, insertNodes } from '../src/doc/document.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { wrapText } from '../src/doc/textWrap.ts'
import type { TextNode } from '../src/doc/types.ts'

const measure = (line: string) => line.length * 10

test('words wrap at spaces and long words break by character', () => {
  assert.deepEqual(wrapText('aaa bbb ccc', 70, measure), ['aaa bbb', 'ccc'])
  assert.deepEqual(wrapText('abcdefgh', 40, measure), ['abcd', 'efgh'])
  assert.deepEqual(wrapText('a\nb', 100, measure), ['a', 'b'])
  assert.deepEqual(wrapText('', 100, measure), [''])
})

test('an area frame keeps its authored box through content and style edits', () => {
  const text = createText('Frame', 40, 60, '', {
    width: 200,
    height: 100,
    textType: 'area',
    fontSize: 16,
    lineHeight: 19.2,
  })
  const base = createDocument('Area')
  const document = insertNodes(base, base.root.id, 0, [text])
  assert.equal(text.textType, 'area')
  assert.equal(validateDocument(document).ok, true)

  const edited = applyCommand(document, {
    type: 'setText',
    nodeId: text.id,
    text: 'The quick brown fox jumps over the lazy dog. '.repeat(6),
    width: 10,
    height: 10,
  })
  assert.equal(edited.ok, true)
  if (!edited.ok) return
  const afterEdit = findNode(edited.document, text.id) as TextNode
  assert.deepEqual([afterEdit.width, afterEdit.height], [200, 100], 'content does not resize an area frame')

  const styled = applyCommand(edited.document, {
    type: 'setTextStyle',
    nodeId: text.id,
    fontSize: 24,
    fontFamily: 'Inter',
    align: 'left',
    lineHeight: 28.8,
  })
  assert.equal(styled.ok, true)
  if (!styled.ok) return
  const afterStyle = findNode(styled.document, text.id) as TextNode
  assert.deepEqual([afterStyle.width, afterStyle.height], [200, 100], 'style does not resize an area frame')
})

test('the Illustrator area fixture fits its line capacity, including a clipped last line', () => {
  const fixture = JSON.parse(
    fs
      .readFileSync(new URL('./fixtures/illustrator/area-text.json', import.meta.url), 'utf8')
      .replace(/^﻿/u, ''),
  )
  const parts = fixture.raw.split('|')
  const [left, top, right, bottom] = parts[1].split(',').map(Number)
  const lines = Number(parts[2])
  const leading = 14.4 // 12 pt at the recorded 1.2 ratio
  const height = top - bottom
  assert.equal(right - left, 200)
  assert.equal(height, 200)
  assert.equal(lines, Math.ceil(height / leading), 'Illustrator draws the partially clipped line too')
  assert.equal(height / leading <= lines, true)
})
