/** The canvas cursor vocabulary (Phase 4.3). */
import test from "node:test"
import assert from "node:assert/strict"
import { cursorForTool, cursorWhileDragging } from "../src/app/canvas/cursor.ts"

test("each tool gets the cursor that says what it draws", () => {
  assert.equal(cursorForTool("select"), "default")
  assert.equal(cursorForTool("directSelect"), "default")
  assert.equal(cursorForTool("hand"), "grab")
  assert.equal(cursorForTool("text"), "text")
  for (const shape of ["rect", "roundedRect", "ellipse", "polygon", "star", "line", "arc", "lasso"]) {
    assert.equal(cursorForTool(shape), "crosshair", shape + " draws with a crosshair")
  }
  assert.equal(cursorForTool("nosuchtool"), "default")
})

test("a drag overrides the tool cursor while it lasts", () => {
  assert.equal(cursorWhileDragging("select", "move"), "move")
  assert.equal(cursorWhileDragging("select", "marquee"), "crosshair")
  assert.equal(cursorWhileDragging("hand", "pan"), "grabbing")
  assert.equal(cursorWhileDragging("text", "pan"), "grabbing")
  assert.equal(cursorWhileDragging("ellipse", null), "crosshair")
  assert.equal(cursorWhileDragging("select", null), "default")
})
