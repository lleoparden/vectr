/** The Align and Transform panels' logic (Phase 4.4). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect } from "../src/doc/document.ts"
import { alignAvailability } from "../src/app/editing/alignAvailability.ts"
import { selectionTransform } from "../src/app/editing/selectionTransform.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("align needs two objects and distribute needs three, and locked ones do not count", () => {
  let document = createDocument("Panels")
  const a = createRect("A", 0, 0, 10, 10)
  const b = createRect("B", 20, 0, 10, 10)
  const c = createRect("C", 40, 0, 10, 10)
  document = inserted(document, [a, b, c])

  assert.deepEqual(alignAvailability(document, []), { align: false, distribute: false, count: 0 })
  assert.deepEqual(alignAvailability(document, [a.id]), { align: false, distribute: false, count: 1 })
  assert.deepEqual(alignAvailability(document, [a.id, b.id]), { align: true, distribute: false, count: 2 })
  assert.deepEqual(alignAvailability(document, [a.id, b.id, c.id]), { align: true, distribute: true, count: 3 })

  const locked = applyCommand(document, { type: "setFlags", nodeId: b.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  if (locked.ok) {
    assert.equal(alignAvailability(locked.document, [a.id, b.id]).align, false, "a locked object cannot be aligned")
  }
})

test("the shared selection transform is the box plus the common rotation", () => {
  let document = createDocument("Panels")
  const a = createRect("A", 10, 20, 40, 30)
  const b = createRect("B", 100, 60, 20, 20)
  document = inserted(document, [a, b])

  assert.deepEqual(selectionTransform(document, []), { box: null, rotation: 0 })
  const single = selectionTransform(document, [a.id])
  assert.deepEqual(single.box, { x: 10, y: 20, width: 40, height: 30 })
  assert.equal(single.rotation, 0)

  const both = selectionTransform(document, [a.id, b.id])
  assert.deepEqual(both.box, { x: 10, y: 20, width: 110, height: 60 })

  const turned = applyCommand(document, { type: "setTransform", nodeId: b.id, transform: { ...b.transform, rotation: 30 } })
  assert.equal(turned.ok, true)
  if (turned.ok) {
    assert.equal(selectionTransform(turned.document, [a.id, b.id]).rotation, 0, "disagreeing rotations show no common angle")
    assert.equal(selectionTransform(turned.document, [b.id]).rotation, 30)
  }
})
