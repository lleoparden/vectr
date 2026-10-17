/**
 * Align, distribute, and the Vectr clipboard (Phase 2.3, issue #66).
 *
 * The planners are pure, so these tests pin the geometry directly; the clipboard is exercised
 * through the store so a paste is proven to be one undo entry with fresh ids and a shared asset.
 */

import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createImage, createRect, findNode } from "../src/doc/document.ts"
import { planAlign, planDistribute } from "../src/app/editing/align.ts"
import { clearClipboard, clipboardCount, copyToClipboard, pastedNodes, PASTE_OFFSET } from "../src/app/editing/clipboard.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { runEditorAction } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode, NodeId } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: root.children.length, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

function fixture() {
  let document = createDocument("Align")
  const a = createRect("A", 0, 0, 100, 100)
  const b = createRect("B", 200, 300, 100, 40)
  const c = createRect("C", 500, 150, 50, 50)
  document = inserted(document, [a, b, c])
  return { document, a, b, c }
}

const boundsOf = (document: Document, id: NodeId) => {
  const node = findNode(document, id)
  assert.ok(node !== null && node.type !== "group")
  if (node === null || node.type === "group") throw new Error("expected a leaf")
  return { x: node.transform.x, y: node.transform.y, width: node.width * node.transform.scaleX, height: node.height * node.transform.scaleY }
}

const moved = (document: Document, moves: Array<{ nodeId: NodeId; transform: { x: number; y: number } }>) => {
  let next = document
  for (const move of moves) {
    const node = findNode(next, move.nodeId)
    if (node === null || node.type === "group") continue
    const result = applyCommand(next, { type: "setTransform", nodeId: move.nodeId, transform: { ...node.transform, ...move.transform } })
    assert.equal(result.ok, true)
    if (result.ok) next = result.document
  }
  return next
}

test("align moves every object onto the selection's own edge", () => {
  const { document, a, b, c } = fixture()
  const ids = [a.id, b.id, c.id]
  // The union box starts at x 0 and ends at x 550; y 0 to 340.
  assert.deepEqual(boundsOf(moved(document, planAlign(document, ids, "left")), b.id).x, 0)
  assert.deepEqual(boundsOf(moved(document, planAlign(document, ids, "right")), b.id).x + 100, 550)
  assert.equal(boundsOf(moved(document, planAlign(document, ids, "top")), c.id).y, 0)
  assert.equal(boundsOf(moved(document, planAlign(document, ids, "bottom")), c.id).y + 50, 340)

  const centred = moved(document, planAlign(document, ids, "horizontalCenter"))
  assert.equal(boundsOf(centred, b.id).x + 50, 275, "centres share the box centre")
  const middle = moved(document, planAlign(document, ids, "verticalCenter"))
  assert.equal(boundsOf(middle, a.id).y + 50, 170)
})

test("align and distribute refuse a selection with nothing to space", () => {
  const { document, a, b } = fixture()
  assert.deepEqual(planAlign(document, [a.id], "left"), [], "one object has no box to align within")
  assert.deepEqual(planAlign(document, [], "left"), [])
  assert.deepEqual(planDistribute(document, [a.id, b.id], "horizontal"), [], "two objects have no middle")
})

test("align skips locked objects and leaves them where they are", () => {
  const { document, a, b, c } = fixture()
  const locked = applyCommand(document, { type: "setFlags", nodeId: b.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  const lockedDocument = locked.ok ? locked.document : document
  const moves = planAlign(lockedDocument, [a.id, b.id, c.id], "left")
  assert.equal(moves.some((move) => move.nodeId === b.id), false, "a locked object is not moved")
  assert.ok(moves.length > 0, "the unlocked ones still align")
})

test("distribute spaces the centres evenly between the outermost objects", () => {
  const { document, a, b, c } = fixture()
  // Centres: A 50, B 250, C 525. The middle object lands halfway between the outermost two.
  const moves = planDistribute(document, [a.id, b.id, c.id], "horizontal")
  const distributed = moved(document, moves)
  const centres = [a, b, c].map((node) => {
    const box = boundsOf(distributed, node.id)
    return box.x + box.width / 2
  })
  assert.deepEqual(centres, [50, 287.5, 525], "even centres, outermost untouched")
})

test("the clipboard copies subtrees and pastes fresh ids at an offset", () => {
  clearClipboard()
  const { document, a } = fixture()
  assert.equal(copyToClipboard(document, [a.id]), 1)
  assert.equal(clipboardCount(), 1)
  const pasted = pastedNodes()
  assert.equal(pasted.length, 1)
  assert.notEqual(pasted[0].id, a.id, "ids are never reused")
  assert.equal(pasted[0].transform.x, a.transform.x + PASTE_OFFSET)
  assert.equal(pasted[0].transform.y, a.transform.y + PASTE_OFFSET)
  assert.equal(pasted[0].name, a.name, "everything else is preserved")
})

test("copy then paste is one undo entry and leaves the copies selected", () => {
  clearClipboard()
  const { document, a } = fixture()
  documentStore.replaceDocument(document)
  documentStore.setSelection([a.id])
  runEditorAction("edit.copy")
  const before = documentStore.getState().undoDepth

  runEditorAction("edit.paste")
  const after = documentStore.getState().document
  assert.equal(documentStore.getState().undoDepth, before + 1, "paste is one entry")
  assert.equal(after.root.children.length, 4)
  assert.equal(documentStore.getState().selection.length, 1, "the copy is selected")

  documentStore.undo()
  assert.equal(documentStore.getState().document.root.children.length, 3, "undo removes the paste")
})

test("a cut copies first, then removes the selection, and an empty clipboard pastes nothing", () => {
  clearClipboard()
  const { document, a } = fixture()
  documentStore.replaceDocument(document)
  documentStore.setSelection([a.id])

  assert.equal(clipboardCount(), 0)
  const depth = documentStore.getState().undoDepth
  runEditorAction("edit.paste")
  assert.equal(documentStore.getState().undoDepth, depth, "pasting an empty clipboard changes nothing")

  runEditorAction("edit.cut")
  assert.equal(findNode(documentStore.getState().document, a.id), null, "cut removed the object")
  assert.equal(clipboardCount(), 1, "and kept a copy")
  runEditorAction("edit.paste")
  assert.equal(documentStore.getState().document.root.children.length, 3, "the cut object comes back")
})

test("a pasted image shares its content-addressed asset instead of copying bytes", () => {
  clearClipboard()
  let document = createDocument("Assets")
  const asset = { id: "sha256-abc", mimeType: "image/png", byteLength: 10, width: 8, height: 8 }
  const image = createImage("Photo", 0, 0, asset.id, 8, 8)
  const added = applyCommand(document, { type: "addAsset", asset })
  assert.equal(added.ok, true)
  document = added.ok ? added.document : document
  document = inserted(document, [image])

  copyToClipboard(document, [image.id])
  const pasted = pastedNodes()
  assert.equal(pasted.length, 1)
  assert.ok(pasted[0].type === "image")
  if (pasted[0].type === "image") assert.equal(pasted[0].assetId, asset.id, "the same asset, not a copy")
})
