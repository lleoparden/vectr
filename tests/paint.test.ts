/** Fill and stroke editing from the Properties panel (Phase 2.6 start, issue #69). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { setSelectionFill, setSelectionOpacity, setSelectionStroke } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: root.children.length, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

function fixture() {
  let document = createDocument("Paint")
  const a = createRect("A", 0, 0, 100, 100)
  const b = createRect("B", 200, 0, 100, 100)
  document = inserted(document, [a, b])
  documentStore.replaceDocument(document)
  return { a, b }
}

test("fill and stroke edits are one undo entry each", () => {
  const { a } = fixture()
  documentStore.setSelection([a.id])
  const depth = documentStore.getState().undoDepth

  setSelectionFill("#ff0000")
  let node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.equal(node.style.fill, "#ff0000")
  assert.equal(documentStore.getState().undoDepth, depth + 1)

  setSelectionStroke({ width: 4, color: "#00ff00" })
  node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.deepEqual(node.style.stroke, { color: "#00ff00", width: 4 })
  assert.equal(documentStore.getState().undoDepth, depth + 2)

  documentStore.undo()
  node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.equal(node.style.stroke, null, "undo removes the stroke")
})

test("a stroke colour edit keeps the weight and is one entry", () => {
  const { a } = fixture()
  documentStore.setSelection([a.id])
  setSelectionStroke({ width: 3 })
  const depth = documentStore.getState().undoDepth
  setSelectionStroke({ color: "#00ff00" })
  const node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.deepEqual(node.style.stroke, { color: "#00ff00", width: 3 })
  assert.equal(documentStore.getState().undoDepth, depth + 1, "changing only the colour is one entry")

  documentStore.undo()
  const restored = findNode(documentStore.getState().document, a.id)
  assert.ok(restored !== null && restored.type !== "group")
  if (restored !== null && restored.type !== "group") assert.equal(restored.style.stroke?.color ?? restored.style.fill, restored.style.fill)
})

test("a stroke weight of zero removes the stroke, and weights are clamped", () => {
  const { a } = fixture()
  documentStore.setSelection([a.id])
  setSelectionStroke({ width: 2 })
  setSelectionStroke({ width: 0 })
  const node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.equal(node.style.stroke, null)

  setSelectionStroke({ width: 500 })
  const wide = findNode(documentStore.getState().document, a.id)
  assert.ok(wide !== null && wide.type !== "group")
  if (wide !== null && wide.type !== "group") assert.equal(wide.style.stroke?.width, 100, "clamped to the command's range")
})

test("a fill change on several objects is one entry, and a locked object is refused", () => {
  const { a, b } = fixture()
  documentStore.setSelection([a.id, b.id])
  const depth = documentStore.getState().undoDepth
  setSelectionFill("#123456")
  assert.equal(documentStore.getState().undoDepth, depth + 1)
  const first = findNode(documentStore.getState().document, a.id)
  const second = findNode(documentStore.getState().document, b.id)
  assert.ok(first !== null && first.type !== "group" && second !== null && second.type !== "group")
  if (first !== null && first.type !== "group" && second !== null && second.type !== "group") {
    assert.equal(first.style.fill, "#123456")
    assert.equal(second.style.fill, "#123456")
  }

  documentStore.dispatch({ type: "setFlags", nodeId: a.id, locked: true, hidden: false })
  documentStore.setSelection([a.id])
  setSelectionFill("#abcdef")
  assert.equal(documentStore.getState().lastError?.code, "locked")
  documentStore.clearError()
})

test("opacity is clamped to 0-1 and is one entry for the whole selection", () => {
  const { a, b } = fixture()
  documentStore.setSelection([a.id, b.id])
  const depth = documentStore.getState().undoDepth
  setSelectionOpacity(0.4)
  const node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") assert.equal(node.style.opacity, 0.4)
  assert.equal(documentStore.getState().undoDepth, depth + 1, "a multi-object opacity change is one entry")

  setSelectionOpacity(5)
  const clamped = findNode(documentStore.getState().document, a.id)
  assert.ok(clamped !== null && clamped.type !== "group")
  if (clamped !== null && clamped.type !== "group") assert.equal(clamped.style.opacity, 1, "clamped to 1")
})

test("stroke cap and join are stored, validated, and survive a round trip", () => {
  const { a } = fixture()
  documentStore.setSelection([a.id])
  setSelectionStroke({ width: 4, cap: "round", join: "bevel" })
  const node = findNode(documentStore.getState().document, a.id)
  assert.ok(node !== null && node.type !== "group")
  if (node !== null && node.type !== "group") {
    assert.equal(node.style.stroke?.cap, "round")
    assert.equal(node.style.stroke?.join, "bevel")
    assert.equal(node.style.stroke?.width, 4, "the weight is untouched")
  }

  // Changing only the join keeps the cap, so the two controls cannot reset each other.
  setSelectionStroke({ join: "miter" })
  const joined = findNode(documentStore.getState().document, a.id)
  assert.ok(joined !== null && joined.type !== "group")
  if (joined !== null && joined.type !== "group") {
    assert.equal(joined.style.stroke?.join, "miter")
    assert.equal(joined.style.stroke?.cap, "round")
  }
})

test("a document with an unsupported stroke cap is refused at the boundary", () => {
  let document = createDocument("Caps")
  const rect = createRect("A", 0, 0, 10, 10)
  document = inserted(document, [rect])
  const node = document.root.children[0]
  if (node.type === "group") throw new Error("expected a leaf")
  node.style = { ...node.style, stroke: { color: "#000000", width: 1, cap: "spike" as never } }
  const result = validateDocument(document)
  assert.equal(result.ok ? "" : (result as { issue: { code: string } }).issue.code, "invalid-index")
})

test("a dash pattern is stored, cleared, and validated", () => {
  const { a } = fixture()
  documentStore.setSelection([a.id])
  setSelectionStroke({ width: 2, dash: [6, 3] })
  const dashed = findNode(documentStore.getState().document, a.id)
  assert.ok(dashed !== null && dashed.type !== "group")
  if (dashed !== null && dashed.type !== "group") assert.deepEqual(dashed.style.stroke?.dash, [6, 3])

  setSelectionStroke({ dash: [] })
  const solid = findNode(documentStore.getState().document, a.id)
  assert.ok(solid !== null && solid.type !== "group")
  if (solid !== null && solid.type !== "group") {
    assert.equal(solid.style.stroke?.dash, undefined, "an empty pattern means solid, not an empty array")
    assert.equal(solid.style.stroke?.width, 2, "clearing the dashes keeps the weight")
  }
})

test("an unusable dash pattern is refused at the boundary", () => {
  let document = createDocument("Dashes")
  const rect = createRect("A", 0, 0, 10, 10)
  document = inserted(document, [rect])
  const node = document.root.children[0]
  if (node.type === "group") throw new Error("expected a leaf")
  node.style = { ...node.style, stroke: { color: "#000000", width: 1, dash: [6, -2] } }
  assert.equal(validateDocument(document).ok, false, "a negative dash is refused")
  node.style = { ...node.style, stroke: { color: "#000000", width: 1, dash: new Array(9).fill(1) } }
  assert.equal(validateDocument(document).ok, false, "more than eight entries is refused")
  node.style = { ...node.style, stroke: { color: "#000000", width: 1, dash: [6, 3] } }
  assert.equal(validateDocument(document).ok, true, "a plain on/off pattern is fine")
})
