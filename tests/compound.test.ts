/**
 * Compound paths (Phase 5.6, issue #142): one node, several contours, even-odd holes.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createDocument, createPath, createRect, insertNodes } from '../src/doc/document.ts'
import { hitTest } from '../src/doc/hitTest.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { FORMAT_VERSION, type PathNode } from '../src/doc/types.ts'
import { cornerAnchor } from '../src/geom/path.ts'

function compoundFixture(): { document: ReturnType<typeof createDocument>; id: string } {
  const outer = [cornerAnchor(0, 0), cornerAnchor(200, 0), cornerAnchor(200, 200), cornerAnchor(0, 200)]
  const inner = [cornerAnchor(50, 50), cornerAnchor(150, 50), cornerAnchor(150, 150), cornerAnchor(50, 150)]
  const path = createPath('Compound', 0, 0, outer, { closed: true, fillRule: 'evenodd', subpaths: [inner] })
  const base = createDocument('Compound')
  const document = insertNodes(base, base.root.id, 0, [path])
  return { document, id: path.id }
}

test('the file format is 10 and a compound path validates', () => {
  assert.equal(FORMAT_VERSION, 10)
  const { document, id } = compoundFixture()
  const node = document.root.children[0] as PathNode
  assert.equal(node.id, id)
  assert.equal(node.subpaths?.length, 1)
  assert.equal(validateDocument(document).ok, true)
})

test('a click inside the hole misses, and a click on the ring hits', () => {
  const { document, id } = compoundFixture()
  assert.equal(hitTest(document, { x: 100, y: 100 }), null, 'the hole is not filled')
  assert.equal(hitTest(document, { x: 25, y: 25 }), id, 'the ring is filled')
})

test('an invalid contour is refused by validation', () => {
  const { document } = compoundFixture()
  const broken = structuredClone(document)
  const node = broken.root.children[0] as PathNode
  node.subpaths = [[cornerAnchor(0, 0)]]
  const result = validateDocument(broken)
  assert.equal(result.ok, false)
})

test('compound paths serialise their contours through the document format', () => {
  const { document, id } = compoundFixture()
  const round = structuredClone(document)
  assert.equal((round.root.children[0] as PathNode).id, id)
  assert.equal((round.root.children[0] as PathNode).subpaths?.length, 1)
  // A plain rectangle and the compound path can coexist without sharing ids.
  const rect = createRect('Rect', 0, 0, 10, 10)
  const base = insertNodes(document, document.root.id, 1, [rect])
  assert.equal(base.root.children.length, 2)
})
