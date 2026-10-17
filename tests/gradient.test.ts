/** Linear gradient fills (Phase 2.7, issue #70). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { buildScene } from "../src/render/scene.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { linearGradientFrom, setSelectionGradient } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("angle becomes unit endpoints across the box", () => {
  const horizontal = linearGradientFrom(0, "#000000", "#ffffff")
  assert.deepEqual(horizontal.from, { x: 0, y: 0.5 })
  assert.deepEqual(horizontal.to, { x: 1, y: 0.5 })
  const vertical = linearGradientFrom(90, "#000000", "#ffffff")
  assert.ok(Math.abs((vertical.from.y + vertical.to.y) / 2 - 0.5) < 1e-9)
  assert.ok(vertical.from.y > vertical.to.y, "90 degrees runs bottom to top on a y-down canvas")
  assert.deepEqual(horizontal.stops.map((stop) => stop.offset), [0, 1])
})

test("a gradient applies to the selection as one entry and can be removed", () => {
  let document = createDocument("Gradient")
  const rect = createRect("A", 0, 0, 100, 100)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])
  const depth = documentStore.getState().undoDepth

  setSelectionGradient(linearGradientFrom(45, "#123456", "#abcdef"))
  const styled = findNode(documentStore.getState().document, rect.id)
  assert.ok(styled !== null && styled.type !== "group")
  if (styled !== null && styled.type !== "group") {
    assert.equal(styled.style.gradient?.type, "linear")
    assert.equal(styled.style.gradient?.stops[1].color, "#abcdef")
  }
  assert.equal(documentStore.getState().undoDepth, depth + 1)

  setSelectionGradient(null)
  const cleared = findNode(documentStore.getState().document, rect.id)
  assert.ok(cleared !== null && cleared.type !== "group")
  if (cleared !== null && cleared.type !== "group") assert.equal(cleared.style.gradient, null)
})

test("the scene carries the gradient, and the solid fill stays as the fallback", () => {
  let document = createDocument("Gradient")
  const rect = createRect("A", 0, 0, 100, 100, "#ff0000")
  document = inserted(document, [rect])
  const styled = applyCommand(document, {
    type: "setStyle",
    nodeId: rect.id,
    style: { ...(findNode(document, rect.id) as { style: never }).style, gradient: linearGradientFrom(0, "#000000", "#ffffff") },
  })
  assert.equal(styled.ok, true)
  if (!styled.ok) return
  const scene = buildScene(styled.document)
  assert.equal(scene.shapes[0].fill, "#ff0000")
  assert.equal(scene.shapes[0].gradient?.stops.length, 2)
})

test("a malformed gradient is refused at the boundary", () => {
  let document = createDocument("Gradient")
  const rect = createRect("A", 0, 0, 100, 100)
  document = inserted(document, [rect])
  const node = document.root.children[0]
  if (node.type === "group") throw new Error("expected a leaf")

  node.style = { ...node.style, gradient: { type: "linear", stops: [{ offset: 0, color: "#000000" }], from: { x: 0, y: 0 }, to: { x: 1, y: 0 } } }
  assert.equal(validateDocument(document).ok, false, "one stop is not a gradient")

  node.style = { ...node.style, gradient: { type: "linear", stops: [{ offset: 0, color: "red" }, { offset: 1, color: "#ffffff" }], from: { x: 0, y: 0 }, to: { x: 1, y: 0 } } }
  assert.equal(validateDocument(document).ok, false, "a named colour is not a hex colour")

  node.style = { ...node.style, gradient: { type: "linear", stops: [{ offset: 0, color: "#000000" }, { offset: 1, color: "#ffffff" }], from: { x: 0.5, y: 0.5 }, to: { x: 0.5, y: 0.5 } } }
  assert.equal(validateDocument(document).ok, false, "identical endpoints have no direction")
})
