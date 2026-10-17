/** Artboards (Phase 2.4, issue #67): derived layout, commands, validation. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { artboardAtPoint, artboardRect, artboardRects, ARTBOARD_GAP } from "../src/doc/artboards.ts"
import { createDocument } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"

const board = (id: string, width = 100, height = 80) => ({ id, name: id, width, height })

test("artboards are laid out left to right with a fixed gap", () => {
  const document = createDocument("Pages")
  document.artboards = [board("a", 100), board("b", 200), board("c", 50)]
  assert.deepEqual(artboardRects(document).map((rect) => rect.x), [0, 100 + ARTBOARD_GAP, 300 + 2 * ARTBOARD_GAP])
  assert.equal(artboardAtPoint(document, { x: 50, y: 20 })?.id, "a")
  assert.equal(artboardAtPoint(document, { x: 100 + ARTBOARD_GAP + 10, y: 20 })?.id, "b")
  assert.equal(artboardAtPoint(document, { x: 100 + ARTBOARD_GAP / 2, y: 20 }), null, "the gap is pasteboard, not a page")
  assert.equal(artboardRect(document, "missing")?.id, "a", "a missing pointer falls back to the first page")
})

test("adding, resizing, and removing artboards is undoable and exact", () => {
  let document = createDocument("Pages")
  const added = applyCommand(document, { type: "addArtboard", artboard: board("b", 300, 200), index: 1 })
  assert.equal(added.ok, true)
  if (!added.ok) return
  document = added.document
  assert.equal(document.artboards.length, 2)

  const resized = applyCommand(document, { type: "setArtboard", artboardId: "b", width: 320 })
  assert.equal(resized.ok, true)
  if (!resized.ok) return
  assert.equal(resized.document.artboards[1].width, 320)

  const removed = applyCommand(resized.document, { type: "removeArtboard", artboardId: "b" })
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  assert.equal(removed.document.artboards.length, 1)

  const undone = applyCommand(removed.document, removed.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  assert.deepEqual(undone.document.artboards[1], { id: "b", name: "b", width: 320, height: 200 })
})

test("artboard commands refuse what a document cannot be", () => {
  const document = createDocument("Pages")
  assert.equal(applyCommand(document, { type: "removeArtboard", artboardId: "artboard-0" }).ok, false, "the last page stays")
  const duplicate = applyCommand(document, { type: "addArtboard", artboard: board("artboard-0"), index: 0 })
  assert.equal(duplicate.ok, false)
  assert.equal(duplicate.ok ? "" : duplicate.code, "duplicate-id")
  const zero = applyCommand(document, { type: "addArtboard", artboard: board("z", 0, 10), index: 0 })
  assert.equal(zero.ok ? "" : zero.code, "non-positive-size")
  const blank = applyCommand(document, { type: "setArtboard", artboardId: "artboard-0", name: "   " })
  assert.equal(blank.ok ? "" : blank.code, "invalid-index")
})

test("document validation checks artboard ids, sizes, and names", () => {
  const document = createDocument("Pages")
  document.artboards = [board("a"), board("a")]
  assert.equal(validateDocument(document).ok ? "" : (validateDocument(document) as { issue: { code: string } }).issue.code, "duplicate-id")
  document.artboards = [board("a"), { id: "b", name: "b", width: -1, height: 10 }]
  assert.equal(validateDocument(document).ok ? "" : (validateDocument(document) as { issue: { code: string } }).issue.code, "non-positive-size")
  document.artboards = [board("a"), { id: "b", name: "  ", width: 10, height: 10 }]
  assert.equal(validateDocument(document).ok ? "" : (validateDocument(document) as { issue: { code: string } }).issue.code, "invalid-index")
})
