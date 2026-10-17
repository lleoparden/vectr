/** Panel fields (UI pass): colour parsing, and live editing as one undo entry. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { isLightColor, normalizeHex, toRgb, PANEL_SWATCHES } from "../src/app/ui/color.ts"
import { beginLiveEdit, endLiveEdit, markLiveChanged } from "../src/app/ui/liveEdit.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { setSelectionFill, gradientAngle, linearGradientFrom, setSelectionGradient } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("hex input accepts the forms a person types", () => {
  assert.equal(normalizeHex("#ABCDEF"), "#abcdef")
  assert.equal(normalizeHex("abcdef"), "#abcdef")
  assert.equal(normalizeHex("#abc"), "#aabbcc")
  assert.equal(normalizeHex("  #0a0b0c  "), "#0a0b0c")
  assert.equal(normalizeHex("red"), null)
  assert.equal(normalizeHex("#12345"), null)
  assert.equal(normalizeHex(""), null)
})

test("rgb parsing and light-colour detection drive readable swatch labels", () => {
  assert.deepEqual(toRgb("#ff0000"), { r: 255, g: 0, b: 0 })
  assert.equal(toRgb("nope"), null)
  assert.equal(isLightColor("#ffffff"), true)
  assert.equal(isLightColor("#000000"), false)
  assert.equal(isLightColor("#f2d94e"), true, "yellow reads as light")
  assert.equal(isLightColor("#4f7cff"), false, "violet reads as dark")
  assert.ok(PANEL_SWATCHES.every((color) => normalizeHex(color) === color), "the palette is all valid hex")
})

test("the gradient angle round-trips through the stored endpoints", () => {
  assert.equal(gradientAngle(linearGradientFrom(0, "#000000", "#ffffff")), 0)
  assert.equal(gradientAngle(linearGradientFrom(90, "#000000", "#ffffff")), 90)
  assert.equal(gradientAngle(linearGradientFrom(180, "#000000", "#ffffff")), 180)
  assert.equal(gradientAngle(linearGradientFrom(-45, "#000000", "#ffffff")), -45)
})

test("a live edit session is one undo entry, however many values it passes through", () => {
  let document = createDocument("Live")
  const rect = createRect("A", 0, 0, 100, 100)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])
  const depth = documentStore.getState().undoDepth

  // What dragging a colour wheel does: focus, many changes, blur.
  beginLiveEdit("Fill")
  for (const color of ["#111111", "#222222", "#333333", "#444444"]) {
    markLiveChanged()
    setSelectionFill(color)
  }
  endLiveEdit()

  const node = findNode(documentStore.getState().document, rect.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.equal(node.style.fill, "#444444", "the last value wins")
  assert.equal(documentStore.getState().undoDepth, depth + 1, "one entry for the whole drag")

  documentStore.undo()
  const restored = findNode(documentStore.getState().document, rect.id)
  assert.ok(restored !== null && restored.type !== "group")
  if (restored !== null && restored.type !== "group") assert.notEqual(restored.style.fill, "#444444", "one undo reverts the session")
})

test("a focus that changes nothing records no history", () => {
  let document = createDocument("Live")
  const rect = createRect("A", 0, 0, 100, 100)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])
  const depth = documentStore.getState().undoDepth

  beginLiveEdit("Fill")
  endLiveEdit()
  assert.equal(documentStore.getState().undoDepth, depth, "clicking into a field and out again is not an edit")
})
