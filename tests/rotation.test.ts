/** Rotation (Phase 4.2): math, hit testing, the scene, and the numeric command. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { hitTest } from "../src/doc/hitTest.ts"
import { buildScene } from "../src/render/scene.ts"
import { rotatedTransform } from "../src/geom/transform.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { setSelectionRotation } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

const identity = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("a node turns about its own centre and orbits a pivot", () => {
  const spun = rotatedTransform(identity, { width: 100, height: 100 }, { x: 50, y: 50 }, 90)
  assert.equal(spun.rotation, 90)
  assert.equal(spun.x, 0, "turning about its own centre keeps the box in place")
  assert.equal(spun.y, 0)

  const orbited = rotatedTransform({ ...identity, x: 0, y: 0 }, { width: 10, height: 10 }, { x: 100, y: 0 }, 90)
  assert.equal(orbited.x, 90, "the centre orbits the pivot: (5,5) about (100,0) lands (95,-95), so the box starts at 90")
  assert.equal(orbited.y, -100)
  assert.equal(orbited.rotation, 90)

  const wrapped = rotatedTransform({ ...identity, rotation: 350 }, { width: 10, height: 10 }, { x: 0, y: 0 }, 20)
  assert.equal(wrapped.rotation, 10, "angles normalise into 0..360")
})

test("a click lands where a rotated object looks", () => {
  let document = createDocument("Rotation")
  const rect = createRect("A", 0, 0, 100, 20)
  document = inserted(document, [rect])
  const untouched = hitTest(document, { x: 50, y: 40 })
  assert.equal(untouched, null, "nothing there before the rotation")

  const turned = applyCommand(document, { type: "setTransform", nodeId: rect.id, transform: { ...rect.transform, rotation: 90 } })
  assert.equal(turned.ok, true)
  if (!turned.ok) return
  assert.equal(hitTest(turned.document, { x: 50, y: 40 }), rect.id, "the tall rotated box is hit where it is drawn")
  assert.equal(hitTest(turned.document, { x: 90, y: 10 }), null, "and not where it used to be")
})

test("the scene carries the rotation for the renderer", () => {
  let document = createDocument("Rotation")
  const rect = createRect("A", 0, 0, 40, 40)
  document = inserted(document, [rect])
  const turned = applyCommand(document, { type: "setTransform", nodeId: rect.id, transform: { ...rect.transform, rotation: 45 } })
  assert.equal(turned.ok, true)
  if (!turned.ok) return
  const scene = buildScene(turned.document)
  assert.equal(scene.shapes[0].rotation, 45)
})

test("numeric rotation is normalised, one undo entry, and reversible", () => {
  let document = createDocument("Rotation")
  const rect = createRect("A", 0, 0, 40, 40)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])

  const depth = documentStore.getState().undoDepth
  setSelectionRotation(-90)
  const node = findNode(documentStore.getState().document, rect.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.equal(node.transform.rotation, 270, "normalised into 0..360")
  assert.equal(documentStore.getState().undoDepth, depth + 1, "one entry")
  documentStore.undo()
  const back = findNode(documentStore.getState().document, rect.id)
  assert.ok(back !== null && back.type !== "group")
  if (back !== null && back.type !== "group") assert.equal(back.transform.rotation, 0)
})

test("a non-finite rotation is refused by validation", () => {
  let document = createDocument("Rotation")
  const rect = createRect("A", 0, 0, 10, 10)
  document = inserted(document, [rect])
  const result = applyCommand(document, { type: "setTransform", nodeId: rect.id, transform: { ...rect.transform, rotation: Number.NaN } })
  assert.equal(result.ok, false)
})
