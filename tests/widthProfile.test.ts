/**
 * Width profiles (Phase 5.5, issue #141): per-anchor multipliers on a path's stroke.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCommand } from '../src/doc/commands.ts'
import { createDocument, createPath, findNode, insertNodes } from '../src/doc/document.ts'
import { hitTest } from '../src/doc/hitTest.ts'
import type { PathNode } from '../src/doc/types.ts'
import { cornerAnchor, flattenPath, type PathAnchor } from '../src/geom/path.ts'
import { flattenedWithWidths, outlineArea, variableOutline } from '../src/geom/offset.ts'

function line(): { document: ReturnType<typeof createDocument>; id: string } {
  const path = createPath('Line', 0, 0, [cornerAnchor(0, 0), cornerAnchor(100, 0)], { closed: false })
  path.style.stroke = { color: '#a94a4a', width: 10 }
  const base = createDocument('Profiles')
  return { document: insertNodes(base, base.root.id, 0, [path]), id: path.id }
}

test('a tapered outline covers the trapezoid between its end widths', () => {
  const { points, halfWidths } = flattenedWithWidths(
    [cornerAnchor(0, 0), cornerAnchor(100, 0)],
    false,
    [1, 2],
    10,
  )
  assert.deepEqual(points, [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ])
  assert.deepEqual(halfWidths, [5, 10])
  assert.equal(outlineArea(variableOutline(points, halfWidths)), 1500)
})

test('the command stores a profile, restores it exactly, and refuses a wrong length', () => {
  const { document, id } = line()
  const result = applyCommand(document, { type: 'setWidthProfile', nodeId: id, profile: [0.5, 1, 0.75] })
  assert.equal(result.ok, false, 'two anchors need two values')

  const ok = applyCommand(document, { type: 'setWidthProfile', nodeId: id, profile: [0.25, 1] })
  assert.equal(ok.ok, true)
  if (!ok.ok) return
  const node = findNode(ok.document, id) as PathNode
  assert.deepEqual(node.style.stroke?.widthProfile, [0.25, 1])

  const uniform = applyCommand(ok.document, { type: 'setWidthProfile', nodeId: id, profile: null })
  assert.equal(uniform.ok, true)
  if (!uniform.ok) return
  assert.equal((findNode(uniform.document, id) as PathNode).style.stroke?.widthProfile, undefined)

  const undone = applyCommand(ok.document, ok.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  assert.equal((findNode(undone.document, id) as PathNode).style.stroke?.widthProfile, undefined)
})

test('hit testing follows the narrow and wide ends of a profile', () => {
  const { document, id } = line()
  const profiled = applyCommand(document, { type: 'setWidthProfile', nodeId: id, profile: [0.1, 1] })
  assert.equal(profiled.ok, true)
  if (!profiled.ok) return
  assert.equal(hitTest(profiled.document, { x: 95, y: 6 }), id, 'near the wide end the band is wide')
  assert.equal(hitTest(profiled.document, { x: 5, y: 6 }), null, 'near the narrow end the band is thin')
  // The same point on a uniform stroke of width 10 is inside the band.
  assert.equal(hitTest(document, { x: 5, y: 6 }), id)
})
