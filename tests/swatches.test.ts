/** Stroke alignment and named swatches (issue #69). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { serializeDocument, deserializeDocument } from "../src/file/serialize.ts"
import { cmykToHex, hexToCmyk } from "../src/app/ui/cmyk.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { addCmykSwatch, addSwatch, applySwatch, removeSwatch, setSelectionStrokeAlign, setSelectionFill } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("CMYK converts to hex and back without losing the ink", () => {
  assert.equal(cmykToHex({ c: 0, m: 0, y: 0, k: 0 }), "#ffffff")
  assert.equal(cmykToHex({ c: 0, m: 0, y: 0, k: 100 }), "#000000")
  const cyan = cmykToHex({ c: 100, m: 0, y: 0, k: 0 })
  assert.equal(cyan, "#00ffff")
  const back = hexToCmyk(cyan)
  assert.deepEqual(back, { c: 100, m: 0, y: 0, k: 0 }, "a pure ink round-trips")
  assert.equal(hexToCmyk("nope"), null)
  for (const hex of ["#e2665c", "#1e1e23", "#7c6cf5"]) {
    const round = cmykToHex(hexToCmyk(hex)!)
    assert.ok(Math.abs(Number.parseInt(round.slice(1, 3), 16) - Number.parseInt(hex.slice(1, 3), 16)) <= 1, hex + " survives")
  }
})

test("named swatches are commands with exact inverses, and they persist", () => {
  let document = createDocument("Swatches")
  const added = applyCommand(document, { type: "addSwatch", swatch: { id: "s1", name: "Coral", color: "#e2665c" } })
  assert.equal(added.ok, true)
  if (!added.ok) return
  document = added.document
  assert.equal(document.swatches?.length, 1)

  const renamed = applyCommand(document, { type: "setSwatch", swatchId: "s1", name: "Sunset", cmyk: { c: 0, m: 60, y: 100, k: 0 }, spot: true })
  assert.equal(renamed.ok, true)
  if (!renamed.ok) return
  assert.equal(renamed.document.swatches?.[0].name, "Sunset")
  assert.equal(renamed.document.swatches?.[0].spot, true)
  const undone = applyCommand(renamed.document, renamed.inverse)
  assert.equal(undone.ok ? undone.document.swatches?.[0].name : null, "Coral", "the inverse restores the old name")

  const removed = applyCommand(renamed.document, { type: "removeSwatch", swatchId: "s1" })
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  assert.equal(removed.document.swatches?.length, 0)

  const text = serializeDocument(renamed.document).manifest
  const reopened = deserializeDocument(text)
  assert.equal(reopened.ok, true)
  if (reopened.ok) assert.deepEqual(reopened.document.swatches?.[0], renamed.document.swatches?.[0], "swatches survive save/reopen")
})

test("swatches are validated at the boundary", () => {
  let document = createDocument("Swatches")
  const duplicate = applyCommand(document, { type: "addSwatch", swatch: { id: "s1", name: "A", color: "#000000" } })
  assert.equal(duplicate.ok, true)
  if (!duplicate.ok) return
  document = duplicate.document
  assert.equal(applyCommand(document, { type: "addSwatch", swatch: { id: "s1", name: "B", color: "#ffffff" } }).ok, false)
  assert.equal(applyCommand(document, { type: "addSwatch", swatch: { id: "s2", name: "  ", color: "#ffffff" } }).ok, false)
  assert.equal(applyCommand(document, { type: "addSwatch", swatch: { id: "s3", name: "C", color: "red" } }).ok, false)
  const badCmyk = { ...document, swatches: [{ id: "s1", name: "A", color: "#000000", cmyk: { c: 200, m: 0, y: 0, k: 0 } }] }
  assert.equal(validateDocument(badCmyk).ok, false, "CMYK outside 0..100 is refused")
})

test("applying a swatch fills the selection, and stroke alignment is stored", () => {
  let document = createDocument("Swatches")
  const rect = createRect("A", 0, 0, 40, 40)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])

  const id = addCmykSwatch("Deep Cyan", { c: 100, m: 0, y: 0, k: 0 }, true)
  assert.ok(id !== null)
  if (id === null) return
  applySwatch(id)
  const filled = findNode(documentStore.getState().document, rect.id)
  assert.ok(filled !== null && filled.type !== "group")
  if (filled !== null && filled.type !== "group") assert.equal(filled.style.fill, "#00ffff")

  setSelectionFill("#ffffff")
  setSelectionStrokeAlign("inside")
  const stroked = findNode(documentStore.getState().document, rect.id)
  assert.ok(stroked !== null && stroked.type !== "group")
  if (stroked !== null && stroked.type !== "group") assert.equal(stroked.style.stroke?.align, "inside")

  removeSwatch(id)
  assert.equal((documentStore.getState().document.swatches ?? []).length, 0, "removing a swatch leaves the fill alone")
  const stillFilled = findNode(documentStore.getState().document, rect.id)
  assert.ok(stillFilled !== null && stillFilled.type !== "group")
})

test("an unsupported stroke alignment is refused", () => {
  let document = createDocument("Align")
  const rect = createRect("A", 0, 0, 10, 10)
  document = inserted(document, [rect])
  const node = document.root.children[0]
  if (node.type === "group") throw new Error("expected a leaf")
  node.style = { ...node.style, stroke: { color: "#000000", width: 1, align: "midway" as never } }
  assert.equal(validateDocument(document).ok, false)
})
