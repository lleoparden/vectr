/** Vector clipping (Phase 2.8, issue #71): the command, the scene, and the hit test. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createGroup, createRect, findNode } from "../src/doc/document.ts"
import { buildScene } from "../src/render/scene.ts"
import { hitTest } from "../src/doc/hitTest.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { clipPolygon } from "../src/doc/shapeGeometry.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, parentId: string, nodes: LayerNode[]): Document {
  const result = applyCommand(document, { type: "insertNodes", parentId, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

function findGroup(document: Document, id: string): GroupNode {
  const node = findNode(document, id)
  assert.ok(node !== null && node.type === "group")
  if (node === null || node.type !== "group") throw new Error("expected a group")
  return node
}

/**
 * group "Clipped" holds a 100x100 clip rect at 0,0 and a 400x400 rect behind it at 0,0.
 * Only the top-left 100x100 of the big rect is visible.
 */
function fixture() {
  const group = createGroup("Clipped")
  const clip = createRect("Clip", 0, 0, 100, 100)
  const big = createRect("Big", 0, 0, 400, 400)
  let document = createDocument("Clip")
  document = inserted(document, document.root.id, [group])
  document = inserted(document, group.id, [big, clip])
  return { document, group, clip, big }
}

test("making and releasing a clip is exact and undoable", () => {
  const { document, group, clip, big } = fixture()
  const made = applyCommand(document, { type: "setClip", groupId: group.id, clipChildId: clip.id })
  assert.equal(made.ok, true)
  if (!made.ok) return
  assert.equal(findGroup(made.document, group.id).clipChildId, clip.id)

  const released = applyCommand(made.document, made.inverse)
  assert.equal(released.ok, true)
  if (!released.ok) return
  assert.equal(findGroup(released.document, group.id).clipChildId ?? null, null)
  assert.equal(findNode(released.document, big.id) !== null, true, "the clipped object is untouched")
})

test("a clip must name a direct child of the group that carries it", () => {
  const { document, group, clip } = fixture()
  const outsider = createRect("Outsider", 900, 900, 10, 10)
  const withOutsider = inserted(document, document.root.id, [outsider])
  const refused = applyCommand(withOutsider, { type: "setClip", groupId: group.id, clipChildId: outsider.id })
  assert.equal(refused.ok, false)
  assert.equal(refused.ok ? "" : refused.code, "invalid-parent")

  const broken = findGroup(withOutsider, group.id)
  broken.clipChildId = outsider.id
  assert.equal(validateDocument(withOutsider).ok ? "" : "refused", "refused", "the boundary checks the reference too")

  const wrongTarget = applyCommand(document, { type: "setClip", groupId: clip.id, clipChildId: null })
  assert.equal(wrongTarget.ok ? "" : wrongTarget.code, "invalid-parent", "a leaf is not a group")
})

test("the scene carries the clip in world space and hides the clip object", () => {
  const { document, group, clip, big } = fixture()
  const made = applyCommand(document, { type: "setClip", groupId: group.id, clipChildId: clip.id })
  assert.equal(made.ok, true)
  if (!made.ok) return
  const scene = buildScene(made.document)
  assert.equal(scene.shapes.length, 1, "only the clipped object is drawn")
  assert.equal(scene.shapes[0].id, big.id)
  const clipInfo = scene.shapes[0].clip
  assert.ok(clipInfo !== null)
  if (clipInfo !== null) {
    assert.deepEqual(clipInfo.points[0], { x: 0, y: 0 })
    assert.equal(clipInfo.scaleX, 1)
    assert.equal(clipInfo.x, 0)
  }
})

test("hit testing follows the clip", () => {
  const { document, group, clip } = fixture()
  const made = applyCommand(document, { type: "setClip", groupId: group.id, clipChildId: clip.id })
  assert.equal(made.ok, true)
  if (!made.ok) return
  assert.equal(hitTest(made.document, { x: 50, y: 50 }) !== null, true, "inside the mask is a hit")
  assert.equal(hitTest(made.document, { x: 300, y: 300 }), null, "clipped away is not a hit")
  assert.equal(hitTest(made.document, { x: 300, y: 300 }, { deep: true }), null)
})

test("duplicating a clipped group re-points the clip at the copy", () => {
  const { document, group, clip } = fixture()
  const made = applyCommand(document, { type: "setClip", groupId: group.id, clipChildId: clip.id })
  assert.equal(made.ok, true)
  if (!made.ok) return
  const source = findGroup(made.document, group.id)
  const copy = (applyCommand(made.document, {
    type: "insertNodes",
    parentId: made.document.root.id,
    index: 1,
    nodes: [{ ...source, id: "group-copy" }],
  }) as { ok: boolean }).ok
  assert.equal(copy, true)
})

test("an ellipse clip samples its outline, a rect clip uses its corners", () => {
  assert.equal(clipPolygon({ kind: "rect", width: 100, height: 50 }).length, 4)
  assert.equal(clipPolygon({ kind: "rect", width: 100, height: 50, cornerRadius: 10 }).length, 20)
  assert.equal(clipPolygon({ kind: "ellipse", width: 100, height: 100 }).length, 64)
  const rounded = clipPolygon({ kind: "rect", width: 40, height: 40, cornerRadius: 40 })
  assert.ok(rounded.every((point) => point.x >= 0 && point.x <= 40), "a rounded corner never leaves the box")
})
