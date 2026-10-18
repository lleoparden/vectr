/** Transactions own their commits (Phase 4.6). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { nudgeSelection, runEditorAction } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("an action that joins an open transaction does not commit it", () => {
  let document = createDocument("Batch")
  const rect = createRect("A", 0, 0, 40, 40)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])

  const depth = documentStore.getState().undoDepth
  documentStore.beginTransaction("batch")
  nudgeSelection(0, 10)
  nudgeSelection(0, 10)
  runEditorAction("object.duplicate")
  documentStore.commitTransaction()
  assert.equal(documentStore.getState().undoDepth, depth + 1, "the whole batch is one entry")

  const moved = findNode(documentStore.getState().document, rect.id)
  assert.ok(moved !== null && moved.type !== "group")
  if (moved !== null && moved.type !== "group") assert.equal(moved.transform.y, 20)
  assert.equal(documentStore.getState().document.root.children.length, 2, "the duplicate is in the same entry")

  documentStore.undo()
  assert.equal(documentStore.getState().document.root.children.length, 1, "one undo removes the whole batch")
  const back = findNode(documentStore.getState().document, rect.id)
  assert.ok(back !== null && back.type !== "group")
  if (back !== null && back.type !== "group") assert.equal(back.transform.y, 0)
})
