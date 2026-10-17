/** Fill and stroke editing from the Properties panel (Phase 2.6 start, issue #69). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
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
