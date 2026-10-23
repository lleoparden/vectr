/**
 * Text on a path (Phase 6.3): glyph placement, tangents, and a box that content edits do not move.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createText, findNode, insertNodes } from '../src/doc/document.ts'
import { layoutTextOnPath, pathLength } from '../src/doc/textOnPath.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { cornerAnchor } from '../src/geom/path.ts'
import type { TextNode } from '../src/doc/types.ts'

const measure = () => 10

test('text centres on a straight path and runs along its tangent', () => {
  const glyphs = layoutTextOnPath('ABC', [{ x: 0, y: 0 }, { x: 200, y: 0 }], false, measure)
  assert.equal(glyphs.length, 3)
  assert.deepEqual(glyphs.map((glyph) => Math.round(glyph.x * 1e6) / 1e6), [90, 100, 110], '30 wide on 200: starts at 85, centres at 90/100/110')
  assert.deepEqual(glyphs.map((glyph) => glyph.y), [0, 0, 0])
  assert.deepEqual(glyphs.map((glyph) => glyph.angle), [0, 0, 0])
})

test('a vertical segment turns the glyphs', () => {
  const glyphs = layoutTextOnPath('A', [{ x: 0, y: 0 }, { x: 0, y: 100 }], false, measure)
  assert.equal(glyphs.length, 1)
  assert.equal(glyphs[0].x, 0)
  assert.equal(glyphs[0].y, 50)
  assert.equal(glyphs[0].angle, 90)
})

test('a closed path keeps flowing around its corners', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]
  assert.equal(pathLength(square, true), 400)
  assert.equal(pathLength(square, false), 300, 'an open square drops the closing edge')
  const glyphs = layoutTextOnPath('ABCD', square, true, measure)
  assert.equal(glyphs.length, 4)
  const angles = new Set(glyphs.map((glyph) => glyph.angle))
  assert.ok(angles.has(90), 'the right edge is vertical')
  assert.ok(angles.has(180), 'the bottom edge runs back')
})

test('a path text validates and keeps its box through content and style edits', () => {
  const text = createText('On path', 0, 0, '', {
    width: 100,
    height: 100,
    fontSize: 16,
    lineHeight: 19.2,
  })
  text.textPath = {
    anchors: [cornerAnchor(0, 0), cornerAnchor(100, 100)],
    closed: false,
  }
  const base = createDocument('Path text')
  const document = insertNodes(base, base.root.id, 0, [text])
  assert.equal(validateDocument(document).ok, true)

  const edited = applyCommand(document, { type: 'setText', nodeId: text.id, text: 'Hello', width: 10, height: 10 })
  assert.equal(edited.ok, true)
  if (!edited.ok) return
  const node = findNode(edited.document, text.id) as TextNode
  assert.deepEqual([node.width, node.height], [100, 100], 'the path box is not resized')

  const broken = structuredClone(document)
  const brokenNode = broken.root.children[0] as TextNode
  brokenNode.textPath = { anchors: [cornerAnchor(0, 0)], closed: false }
  assert.equal(validateDocument(broken).ok, false)
})
