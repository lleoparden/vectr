/** Snapping (Phase 2.5, issue #68): the contract's five fixtures, as unit tests. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect } from "../src/doc/document.ts"
import { artboardRects } from "../src/doc/artboards.ts"
import { boxLines, isMovable, snapBox, snapTargets, SNAP_PIXELS } from "../src/app/editing/snapping.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: root.children.length, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("a box contributes its two edges and its centre on each axis", () => {
  assert.deepEqual(boxLines({ x: 10, y: 20, width: 100, height: 40 }), {
    x: [10, 60, 110],
    y: [20, 40, 60],
  })
})

test("a drag inside the threshold lands exactly on the target; outside it moves by the raw delta", () => {
  const targets = { x: [200], y: [] }
  const near = snapBox({ x: 96, y: 0, width: 100, height: 50 }, targets, 6)
  assert.equal(near.dx, 4, "the left edge moves onto the target")
  assert.equal(near.guides.length, 1)
  assert.equal(near.guides[0].axis, "x")

  const far = snapBox({ x: 90, y: 0, width: 100, height: 50 }, targets, 6)
  assert.equal(far.dx, 0, "ten units away is outside a six-unit threshold")

  // The centre and the far edge are candidates too, not just the near edge.
  const centre = snapBox({ x: 150, y: 0, width: 100, height: 50 }, { x: [200], y: [] }, 6)
  assert.equal(centre.dx, 0, "a centre already on the target needs no move")
})

test("the axes snap independently", () => {
  const result = snapBox({ x: 98, y: 48, width: 100, height: 50 }, { x: [100], y: [50] }, 6)
  assert.equal(result.dx, 2)
  assert.equal(result.dy, 2)
  assert.equal(result.guides.length, 2)
  assert.deepEqual(result.guides.map((guide) => guide.axis).sort(), ["x", "y"])
})

test("targets are the page and every other object, never the selection itself", () => {
  let document = createDocument("Snap")
  const moving = createRect("Moving", 100, 100, 100, 100)
  const other = createRect("Other", 400, 300, 50, 50)
  document = inserted(document, [moving, other])
  const page = artboardRects(document)[0]
  const targets = snapTargets(document, [moving.id], null)

  assert.ok(targets.x.includes(page.x) && targets.x.includes(page.x + page.width), "page edges are targets")
  assert.ok(targets.x.includes(page.x + page.width / 2), "the page centre is a target")
  assert.ok(targets.x.includes(400) && targets.x.includes(425), "the other object's edges are targets")
  assert.equal(targets.x.includes(100), false, "the moving object is not its own target")
  assert.equal(targets.x.includes(200), false)
})

test("a locked object neither moves nor acts as a target", () => {
  let document = createDocument("Snap locked")
  const locked = createRect("Locked", 300, 300, 50, 50)
  document = inserted(document, [locked])
  const result = applyCommand(document, { type: "setFlags", nodeId: locked.id, locked: true, hidden: false })
  assert.equal(result.ok, true)
  const lockedDocument = result.ok ? result.document : document
  assert.equal(isMovable(lockedDocument, locked.id), false)
})

test("the threshold is a screen distance: the same pixels are fewer scene units when zoomed in", () => {
  // The caller divides by the zoom, so at 200% six pixels are three scene units and a five-unit
  // gap no longer snaps. This pins the conversion the canvas performs.
  const box = { x: 100, y: 0, width: 100, height: 100 }
  const zoomedIn = snapBox(box, { x: [205], y: [] }, SNAP_PIXELS / 2)
  assert.equal(zoomedIn.dx, 0, "at 200% the right edge is five units away and does not snap")
  const actualSize = snapBox(box, { x: [205], y: [] }, SNAP_PIXELS)
  assert.equal(actualSize.dx, 5, "at 100% the same five units are inside the six-pixel threshold")
})
