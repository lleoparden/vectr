/** Tool state machines (Phase 3.2): selection, direct selection, hand. */
import test from "node:test"
import assert from "node:assert/strict"
import { createSelectTool } from "../src/tools/select.ts"
import { createHandTool } from "../src/tools/hand.ts"
import { createLassoTool } from "../src/tools/lasso.ts"
import { createShapeTool } from "../src/tools/shapes.ts"
import { createTypeTool } from "../src/tools/type.ts"
import { createZoomTool } from "../src/tools/zoom.ts"
import { createToolStateMachines, isStateMachineTool } from "../src/tools/index.ts"
import type { MarqueeRect, ToolHost, ToolPoint } from "../src/tools/types.ts"
import type { NodeId } from "../src/doc/types.ts"

type Calls = string[]

function fakeHost(options: { hits?: Record<string, NodeId>; selection?: NodeId[]; rotation?: boolean } = {}) {
  const calls: Calls = []
  const selected: NodeId[] = options.selection ?? []
  const host: ToolHost = {
    selection: () => selected,
    hitTest: (scene, deep) => {
      calls.push("hitTest:" + scene.x + "," + scene.y + (deep ? ":deep" : ""))
      return options.hits?.[scene.x + "," + scene.y] ?? null
    },
    select: (id) => {
      calls.push("select:" + id)
      selected.splice(0, selected.length, id)
    },
    toggleSelection: (id) => {
      calls.push("toggle:" + id)
      const at = selected.indexOf(id)
      if (at >= 0) selected.splice(at, 1)
      else selected.push(id)
    },
    beginMove: () => calls.push("beginMove"),
    duplicateSelection: () => calls.push("duplicate"),
    moveBy: (dx, dy, shift) => calls.push("moveBy:" + dx + "," + dy + (shift ? ":shift" : "")),
    endMove: () => calls.push("endMove"),
    cancelMove: () => calls.push("cancelMove"),
    setMarquee: (rect: MarqueeRect | null) => calls.push("marquee:" + (rect === null ? "null" : rect.x + "," + rect.y + "," + rect.width + "," + rect.height)),
    commitMarquee: (rect, deep) => calls.push("commit:" + rect.width + "x" + rect.height + (deep ? ":deep" : "")),
    viewport: () => ({ panX: 5, panY: 7 }),
    panTo: (panX, panY) => calls.push("pan:" + panX + "," + panY),
    setLasso: (points) => calls.push("lasso:" + (points === null ? "null" : points.length)),
    commitLasso: (points, modifiers) => calls.push("commitLasso:" + points.length + (modifiers.shift ? ":shift" : "")),
    setShapePreview: (preview) => calls.push("preview:" + (preview === null ? "null" : preview.kind + "@" + preview.current.x + "," + preview.current.y + (preview.shift ? ":shift" : ""))),
    commitShape: (toolId, start, end, shift) => calls.push("shape:" + toolId + ":" + start.x + "," + start.y + ">" + end.x + "," + end.y + (shift ? ":shift" : "")),
    placeText: (scene) => calls.push("text:" + scene.x + "," + scene.y),
    scaleBegin: () => null,
    setNodeTransform: (id) => calls.push("set:" + id),
    scaleEnd: () => calls.push("scaleEnd"),
    scaleCancel: () => calls.push("scaleCancel"),
    rotationBegin: () => (options.rotation === true ? { centre: { x: 0, y: 0 }, startAngle: 0, nodes: [] } : null),
    rotateBy: (scene, shift) => calls.push("rotate:" + scene.x + "," + scene.y + (shift ? ":shift" : "")),
    rotateEnd: () => calls.push("rotateEnd"),
    rotateCancel: () => calls.push("rotateCancel"),
    zoomAt: (screen, factor) => calls.push("zoomAt:" + screen.x + "," + screen.y + ":" + factor),
    zoomToBox: (box) => calls.push("zoomBox:" + box.width + "x" + box.height),
    // Anchor editing belongs to a selected path; these tests exercise selection, so it reports none.
    pathEditCapture: () => null,
    beginPathDrag: () => calls.push("beginPathDrag"),
    setPathAnchors: (id, anchors) => calls.push("setAnchors:" + id + ":" + anchors.length),
    endPathDrag: () => calls.push("endPathDrag"),
    cancelPathDrag: () => calls.push("cancelPathDrag"),
    zoomFactor: () => 1,
  }
  return { host, calls, selected }
}

function point(x: number, y: number): ToolPoint {
  return { scene: { x, y }, screen: { x, y } }
}

const noModifiers = { shift: false, alt: false, meta: false, ctrl: false }

test("a click on an object selects it and begins a move", () => {
  const tool = createSelectTool({ id: "select", deep: false, cursor: "default" })
  const { host, calls } = fakeHost({ hits: { "10,10": "node-1" } })
  tool.onPointerDown(host, point(10, 10), noModifiers)
  assert.deepEqual(calls, ["hitTest:10,10", "select:node-1", "beginMove"])
  tool.onPointerMove(host, point(15, 12), noModifiers)
  tool.onPointerUp(host, point(15, 12), noModifiers)
  assert.deepEqual(calls.slice(3), ["moveBy:5,2", "endMove"])
})

test("shift toggles instead of replacing, and the selection is not re-set", () => {
  const tool = createSelectTool({ id: "select", deep: false, cursor: "default" })
  const { host, calls } = fakeHost({ hits: { "1,1": "node-1" } })
  tool.onPointerDown(host, point(1, 1), { ...noModifiers, shift: true })
  assert.deepEqual(calls, ["hitTest:1,1", "toggle:node-1", "beginMove"])
})

test("clicking an already-selected object keeps the selection so a drag moves the group", () => {
  const tool = createSelectTool({ id: "select", deep: false, cursor: "default" })
  const { host, calls } = fakeHost({ hits: { "2,2": "node-2" }, selection: ["node-2"] })
  tool.onPointerDown(host, point(2, 2), noModifiers)
  assert.deepEqual(calls, ["hitTest:2,2", "beginMove"], "no select call, and no deselect")
})

test("empty canvas starts a marquee that commits with the same deep flag", () => {
  const tool = createSelectTool({ id: "directSelect", deep: true, cursor: "default" })
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(10, 20), noModifiers)
  assert.deepEqual(calls, ["hitTest:10,20:deep", "marquee:10,20,0,0"], "an empty hit shows an empty marquee")
  tool.onPointerMove(host, point(30, 50), noModifiers)
  tool.onPointerUp(host, point(30, 50), noModifiers)
  assert.deepEqual(calls.slice(2), ["marquee:10,20,20,30", "commit:20x30:deep", "marquee:null"])
})

test("a marquee dragged up and left normalises to positive width and height", () => {
  const tool = createSelectTool({ id: "select", deep: false, cursor: "default" })
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(40, 40), noModifiers)
  tool.onPointerUp(host, point(10, 15), noModifiers)
  assert.deepEqual(calls, ["hitTest:40,40", "marquee:40,40,0,0", "commit:30x25", "marquee:null"])
})

test("Escape during a move rolls the move back and leaves no marquee", () => {
  const tool = createSelectTool({ id: "select", deep: false, cursor: "default" })
  const { host, calls } = fakeHost({ hits: { "5,5": "node-1" } })
  tool.onPointerDown(host, point(5, 5), noModifiers)
  tool.cancel(host)
  assert.deepEqual(calls.slice(-2), ["cancelMove", "marquee:null"])
})

test("the zoom tool clicks in, Alt-clicks out, and frames a drag", () => {
  const tool = createZoomTool("zoom-in")
  const clicked = fakeHost()
  tool.onPointerDown(clicked.host, point(100, 100), noModifiers)
  tool.onPointerUp(clicked.host, point(100, 100), noModifiers)
  assert.deepEqual(clicked.calls, ["marquee:null", "marquee:null", "zoomAt:100,100:2"], "a click zooms in by two")

  const alt = fakeHost()
  tool.onPointerDown(alt.host, point(50, 60), noModifiers)
  tool.onPointerUp(alt.host, point(50, 60), { ...noModifiers, alt: true })
  assert.deepEqual(alt.calls, ["marquee:null", "marquee:null", "zoomAt:50,60:0.5"], "Alt zooms out")

  const framed = fakeHost()
  tool.onPointerDown(framed.host, point(10, 20), noModifiers)
  tool.onPointerMove(framed.host, point(110, 70), noModifiers)
  tool.onPointerUp(framed.host, point(110, 70), noModifiers)
  assert.deepEqual(framed.calls, ["marquee:null", "marquee:10,20,100,50", "marquee:null", "zoomBox:100x50"], "a drag frames its rectangle")

  const tiny = fakeHost()
  tool.onPointerDown(tiny.host, point(10, 20), noModifiers)
  tool.onPointerMove(tiny.host, point(12, 21), noModifiers)
  tool.onPointerUp(tiny.host, point(12, 21), noModifiers)
  assert.deepEqual(tiny.calls, ["marquee:null", "marquee:null", "zoomAt:12,21:2"], "a two-pixel move is still a click")
})

test("Alt-drag duplicates before the move starts", () => {
  const tool = createSelectTool({ id: "select", deep: false, cursor: "default" })
  const { host, calls } = fakeHost({ hits: { "4,4": "node-4" } })
  tool.onPointerDown(host, point(4, 4), { ...noModifiers, alt: true })
  assert.deepEqual(calls, ["hitTest:4,4", "select:node-4", "duplicate", "beginMove"])
  tool.onPointerUp(host, point(4, 4), { ...noModifiers, alt: true })
  assert.deepEqual(calls.slice(4), ["endMove"])
})

test("the hand pans by screen pixels from the pan it started at", () => {
  const tool = createHandTool("grab")
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, { scene: { x: 100, y: 100 }, screen: { x: 100, y: 100 } })
  tool.onPointerMove(host, { scene: { x: 0, y: 0 }, screen: { x: 80, y: 60 } })
  assert.deepEqual(calls, ["pan:-15,-33"], "pan start 5,7 plus a screen delta of -20,-40")
  tool.onPointerMove(host, { scene: { x: 0, y: 0 }, screen: { x: 130, y: 120 } })
  assert.deepEqual(calls.slice(1), ["pan:35,27"])
  tool.onPointerUp(host, { scene: { x: 0, y: 0 }, screen: { x: 130, y: 120 } })
  tool.onPointerMove(host, { scene: { x: 0, y: 0 }, screen: { x: 0, y: 0 } })
  assert.equal(calls.length, 2, "after release the hand no longer pans")
})

test("the registry holds every palette tool as a state machine", () => {
  const machines = createToolStateMachines()
  assert.deepEqual(Object.keys(machines).sort(), [
    "arc",
    "directSelect",
    "ellipse",
    "hand",
    "lasso",
    "line",
    "pen",
    "polygon",
    "rect",
    "roundedRect",
    "select",
    "star",
    "text",
    "zoom",
  ])
  assert.equal(machines.select.id, "select")
  assert.equal(machines.directSelect.id, "directSelect")
  assert.equal(machines.hand.id, "hand")
  assert.equal(machines.lasso.id, "lasso")
  for (const id of ["select", "directSelect", "hand", "lasso", "pen", "rect", "roundedRect", "ellipse", "polygon", "star", "line", "arc", "text"]) {
    assert.equal(isStateMachineTool(id), true, id + " is a state machine")
  }
  assert.equal(isStateMachineTool("nosuchtool"), false)
})

test("the lasso collects a freehand path and decides on release", () => {
  const tool = createLassoTool({ cursor: "crosshair" })
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(10, 10))
  tool.onPointerMove(host, point(20, 10))
  tool.onPointerMove(host, point(20, 20))
  assert.deepEqual(calls, ["lasso:1", "lasso:2", "lasso:3"])
  tool.onPointerUp(host, point(20, 20), { ...noModifiers, shift: true })
  assert.deepEqual(calls.slice(3), ["commitLasso:3:shift", "lasso:null"])
  tool.onPointerUp(host, point(20, 20), noModifiers)
  assert.equal(calls.length, 5, "a second release commits nothing")
})

test("the lasso caps its path and Escape drops it without committing", () => {
  const tool = createLassoTool({ cursor: "crosshair", maxPoints: 2 })
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(0, 0))
  tool.onPointerMove(host, point(1, 1))
  tool.onPointerMove(host, point(2, 2))
  assert.deepEqual(calls, ["lasso:1", "lasso:2"])
  tool.cancel(host)
  assert.deepEqual(calls.slice(2), ["lasso:null"])
})

test("a shape tool previews the drag live and creates on release with the live Shift", () => {
  const tool = createShapeTool("ellipse", "crosshair")
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(5, 5), noModifiers)
  tool.onPointerMove(host, point(25, 15), noModifiers)
  tool.onPointerMove(host, point(25, 15), { ...noModifiers, shift: true })
  tool.onPointerUp(host, point(25, 15), { ...noModifiers, shift: true })
  assert.deepEqual(calls, [
    "preview:ellipse@5,5",
    "preview:ellipse@25,15",
    "preview:ellipse@25,15:shift",
    "shape:ellipse:5,5>25,15:shift",
    "preview:null",
  ])
})

test("cancelling a shape drag leaves no object behind", () => {
  const tool = createShapeTool("star", "crosshair")
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(1, 1), noModifiers)
  tool.cancel(host)
  assert.deepEqual(calls, ["preview:star@1,1", "preview:null"])
})

test("the Type tool places text where the click landed", () => {
  const tool = createTypeTool("text")
  const { host, calls } = fakeHost()
  tool.onPointerDown(host, point(42, 84))
  assert.deepEqual(calls, ["text:42,84"])
})
