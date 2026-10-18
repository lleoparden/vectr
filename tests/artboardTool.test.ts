/** Artboard tool (issue #67 follow-up): drag maths and the create/resize actions. */
import test from "node:test"
import assert from "node:assert/strict"
import { artboardFromDrag, dragIsAPage, MIN_ARTBOARD_SIZE, resizedPage } from "../src/app/editing/artboardDrag.ts"
import { createDocument } from "../src/doc/document.ts"
import { artboardRects } from "../src/doc/artboards.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { workspaceStore } from "../src/state/workspaceStore.ts"
import { createArtboardFromRect, resizeArtboard } from "../src/app/actions.ts"
import { beginLiveEdit, endLiveEdit, markLiveChanged } from "../src/app/ui/liveEdit.ts"

test("a drag becomes a page with positive size and a minimum", () => {
  assert.deepEqual(artboardFromDrag({ x: 10, y: 20 }, { x: 310, y: 220 }), { x: 10, y: 20, width: 300, height: 200 })
  assert.deepEqual(artboardFromDrag({ x: 310, y: 220 }, { x: 10, y: 20 }), { x: 10, y: 20, width: 300, height: 200 }, "dragging up-left normalises")
  const tiny = artboardFromDrag({ x: 0, y: 0 }, { x: 1, y: 1 })
  assert.equal(tiny.width, MIN_ARTBOARD_SIZE)
  assert.equal(tiny.height, MIN_ARTBOARD_SIZE)
  assert.equal(dragIsAPage(tiny), false, "a click is not a page")
  assert.equal(dragIsAPage({ x: 0, y: 0, width: 200, height: 20 }), true)
})

test("a page only grows right and down, because its corner is the anchor", () => {
  const start = { width: 300, height: 200 }
  assert.deepEqual(resizedPage("e", start, { x: 50, y: 999 }), { width: 350, height: 200 }, "the right edge ignores dy")
  assert.deepEqual(resizedPage("s", start, { x: 999, y: -50 }), { width: 300, height: 150 }, "the bottom edge ignores dx")
  assert.deepEqual(resizedPage("se", start, { x: 100, y: 50 }), { width: 400, height: 250 })
  assert.deepEqual(resizedPage("se", start, { x: -1000, y: -1000 }), { width: MIN_ARTBOARD_SIZE, height: MIN_ARTBOARD_SIZE })
})

test("dragging a page creates it where it was dragged, active, and undoable", () => {
  documentStore.replaceDocument(createDocument("Pages"))
  const before = documentStore.getState().document.artboards.length
  createArtboardFromRect({ x: 500, y: 120, width: 300, height: 200 })
  const document = documentStore.getState().document
  assert.equal(document.artboards.length, before + 1)
  const page = document.artboards[document.artboards.length - 1]
  assert.equal(page.width, 300)
  assert.equal(page.height, 200)
  assert.equal(page.x, 500, "the page keeps where it was dragged")
  assert.equal(page.y, 120)
  const rects = artboardRects(document)
  assert.deepEqual({ x: rects[1].x, y: rects[1].y }, { x: 500, y: 120 })
  assert.equal(workspaceStore.getState().activeArtboardId, page.id, "a new page becomes active")
  documentStore.undo()
  assert.equal(documentStore.getState().document.artboards.length, before, "one undo removes it")
})

test("resizing through a live session is one undo entry", () => {
  documentStore.replaceDocument(createDocument("Pages"))
  const page = documentStore.getState().document.artboards[0]
  const depth = documentStore.getState().undoDepth
  beginLiveEdit("resize artboard")
  for (const width of [1300, 1400, 1500]) {
    markLiveChanged()
    resizeArtboard(page.id, { width, height: 900 })
  }
  endLiveEdit()
  const resized = documentStore.getState().document.artboards[0]
  assert.equal(resized.width, 1500)
  assert.equal(resized.height, 900)
  assert.equal(documentStore.getState().undoDepth, depth + 1, "the whole drag is one entry")
})
