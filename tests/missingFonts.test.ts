/**
 * Missing-font detection (Phase 6.8): what a document references versus what ships.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createDocument, createGroup, createText, insertNodes } from '../src/doc/document.ts'
import { missingFontFamilies, textNodesWithMissingFonts } from '../src/doc/missingFonts.ts'

function documentWithTexts(): ReturnType<typeof createDocument> {
  const base = createDocument('Fonts')
  const group = createGroup('Group')
  const missing = createText('Missing', 0, 0, 'x', { fontFamily: 'Comic Sans MS' })
  const nested = createText('Nested', 0, 0, 'y', { fontFamily: 'comic sans ms' })
  const available = createText('Available', 0, 0, 'z', { fontFamily: 'Inter' })
  let document = insertNodes(base, base.root.id, 0, [group])
  document = insertNodes(document, group.id, 0, [missing])
  document = insertNodes(document, group.id, 1, [nested])
  return insertNodes(document, document.root.id, 1, [available])
}

test('missing families are unique, sorted, and detected inside groups regardless of case', () => {
  const document = documentWithTexts()
  assert.deepEqual(missingFontFamilies(document), ['Comic Sans MS'])
  const nodes = textNodesWithMissingFonts(document)
  assert.equal(nodes.length, 2)
  assert.deepEqual(nodes.map((node) => node.name), ['Missing', 'Nested'])
})

test('a document that only uses the bundled face has nothing missing', () => {
  const base = createDocument('Fine')
  const text = createText('Inter only', 0, 0, 'x', { fontFamily: 'Inter' })
  const document = insertNodes(base, base.root.id, 0, [text])
  assert.deepEqual(missingFontFamilies(document), [])
  assert.deepEqual(textNodesWithMissingFonts(document), [])
})

test('the caller can supply a different available list', () => {
  const document = documentWithTexts()
  assert.deepEqual(missingFontFamilies(document, ['Inter', 'Comic Sans MS']), [])
})
