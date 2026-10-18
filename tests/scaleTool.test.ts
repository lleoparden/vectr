/** The scale gesture as a tool (Phase 4.1). */
import test from "node:test"
import assert from "node:assert/strict"
import { createScaleTool } from "../src/tools/transform.ts"
import type { ToolHost } from "../src/tools/types.ts"
import type { NodeId, Transform } from "../src/doc/types.ts"

function fakeHost(options: { box?: { x: number; y: number; width: number; height: number } | null; originals?: Array<[NodeId, Transform]> } = {}) {
  const calls: string[] = []
  const originals = new Map<NodeId, Transform>(options.originals ?? [])
  const host = {
    scaleBegin: () => {
      calls.push("begin")
      if (options.box === null) return null
      return { box: options.box ?? { x: 0, y: 0, width: 100, height: 100 }, originals: new Map(originals) }
    },
    setNodeTransform: (nodeId: NodeId, transform: Transform) => {
      calls.push("set:" + nodeId + ":" + transform.x + "," + transform.y + ":" + transform.scaleX + "," + transform.scaleY)
    },
    scaleEnd: () => calls.push("end"),
    scaleCancel: () => calls.push("cancel"),
  } as unknown as ToolHost
  return { host, calls }
}

const zero: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }

test("a handle drag scales about the opposite corner from the gesture's start", () => {
  const tool = createScaleTool("default")
  const { host, calls } = fakeHost({ originals: [["node-1", zero]] })
  tool.startHandle(host, "se")
  assert.equal(tool.isDragging(), true)
  tool.moveHandle(host, { x: 200, y: 200 }, { constrain: false, fromCenter: false })
  assert.deepEqual(calls, ["begin", "set:node-1:0,0:2,2"], "the se corner dragged to 200 doubles a 100 box")
  tool.moveHandle(host, { x: 50, y: 50 }, { constrain: false, fromCenter: false })
  assert.deepEqual(calls.slice(2), ["set:node-1:0,0:0.5,0.5"], "absolute from the start, not compounded")
  tool.endHandle(host)
  assert.deepEqual(calls.slice(3), ["end"])
  assert.equal(tool.isDragging(), false)
})

test("Shift constrains the proportions and Alt scales from the centre", () => {
  const tool = createScaleTool("default")
  const constrained = fakeHost({ originals: [["a", zero]] })
  tool.startHandle(constrained.host, "se")
  tool.moveHandle(constrained.host, { x: 300, y: 40 }, { constrain: true, fromCenter: false })
  const constrainedCall = constrained.calls[1]
  const factors = constrainedCall.split(":").pop() ?? ""
  const [sx, sy] = factors.split(",")
  assert.equal(sx, sy, "Shift gives equal factors: " + constrainedCall)

  const centred = fakeHost({ originals: [["a", zero]] })
  tool.startHandle(centred.host, "se")
  tool.moveHandle(centred.host, { x: 200, y: 200 }, { constrain: false, fromCenter: true })
  assert.notEqual(centred.calls[1], "begin", "from-centre still applies a transform")
  assert.ok(centred.calls[1].startsWith("set:a:"), centred.calls[1])
})

test("a drag that never started, or a start with nothing selected, does nothing", () => {
  const tool = createScaleTool("default")
  const empty = fakeHost({ box: null })
  tool.startHandle(empty.host, "nw")
  tool.moveHandle(empty.host, { x: 10, y: 10 }, { constrain: false, fromCenter: false })
  tool.endHandle(empty.host)
  assert.deepEqual(empty.calls, ["begin"], "no transaction, no writes, no commit")

  const never = fakeHost()
  never.host.setNodeTransform("x", zero)
  const before = never.calls.length
  tool.moveHandle(never.host, { x: 5, y: 5 }, { constrain: false, fromCenter: false })
  assert.equal(never.calls.length, before, "moving without a start is a no-op")
})

test("Escape cancels the transaction instead of committing it", () => {
  const tool = createScaleTool("default")
  const { host, calls } = fakeHost({ originals: [["node-1", zero]] })
  tool.startHandle(host, "se")
  tool.cancel(host)
  assert.deepEqual(calls, ["begin", "cancel"])
  assert.equal(tool.isDragging(), false)
})
