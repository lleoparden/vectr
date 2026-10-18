/** Guides, rulers, and grid (issue #67): commands, validation, persistence, snapping. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { serializeDocument } from "../src/file/serialize.ts"
import { snapBox, snapTargets } from "../src/app/editing/snapping.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { addGuide, moveGuide, removeGuide } from "../src/app/actions.ts"

test("a guide can be added, moved, and removed with exact inverses", () => {
  let document = createDocument("Guides")
  const added = applyCommand(document, { type: "addGuide", guide: { id: "g1", axis: "x", position: 120 } })
  assert.equal(added.ok, true)
  if (!added.ok) return
  assert.deepEqual(added.document.guides, [{ id: "g1", axis: "x", position: 120 }])

  const moved = applyCommand(added.document, { type: "setGuide", guideId: "g1", position: 240 })
  assert.equal(moved.ok, true)
  if (!moved.ok) return
  assert.equal(moved.document.guides?.[0].position, 240)
  const back = applyCommand(moved.document, moved.inverse)
  assert.equal(back.ok ? back.document.guides?.[0].position : null, 120, "the inverse restores the old position")

  const removed = applyCommand(moved.document, { type: "removeGuide", guideId: "g1" })
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  assert.deepEqual(removed.document.guides, [])
  const restored = applyCommand(removed.document, removed.inverse)
  assert.equal(restored.ok ? restored.document.guides?.length : null, 1, "removing is undoable")
  document = removed.document
})

test("guides are validated and survive a save/reopen round trip", () => {
  let document = createDocument("Guides")
  const added = applyCommand(document, { type: "addGuide", guide: { id: "g1", axis: "y", position: 300 } })
  assert.equal(added.ok, true)
  if (!added.ok) return
  document = added.document
  assert.equal(validateDocument(document).ok, true)

  const roundTripped = serializedRoundTrip(document)
  assert.deepEqual(roundTripped.guides, [{ id: "g1", axis: "y", position: 300 }], "guides are document data")

  const duplicate = applyCommand(document, { type: "addGuide", guide: { id: "g1", axis: "x", position: 0 } })
  assert.equal(duplicate.ok ? "" : duplicate.code, "duplicate-id")
  const broken = { ...document, guides: [{ id: "g1", axis: "diagonal" as never, position: 0 }] }
  assert.equal(validateDocument(broken).ok, false, "an unknown axis is refused")
  const notFinite = { ...document, guides: [{ id: "g1", axis: "x" as const, position: Number.NaN }] }
  assert.equal(validateDocument(notFinite).ok, false, "a non-finite position is refused")
})

test("a guide is a snap target", () => {
  let document = createDocument("Guides")
  const added = applyCommand(document, { type: "addGuide", guide: { id: "g1", axis: "x", position: 500 } })
  assert.equal(added.ok, true)
  if (!added.ok) return
  const targets = snapTargets(added.document, [], null)
  assert.ok(targets.x.includes(500), "the guide appears among the x targets")
  const snapped = snapBox({ x: 496, y: 0, width: 40, height: 40 }, targets, 6)
  assert.equal(snapped.dx, 4, "a box near the guide snaps onto it")
})

test("the actions place, move, and remove guides through the store, one entry per session", () => {
  documentStore.replaceDocument(createDocument("Guides"))
  const depth = documentStore.getState().undoDepth
  const id = addGuide("x", 100)
  assert.ok(id !== null)
  if (id === null) return
  moveGuide(id, 180)
  assert.equal(documentStore.getState().document.guides?.[0].position, 180)
  assert.equal(documentStore.getState().undoDepth, depth + 2, "each action outside a live session is one entry")
  removeGuide(id)
  assert.deepEqual(documentStore.getState().document.guides, [])
})

function serializedRoundTrip(document: ReturnType<typeof createDocument>) {
  const manifest = serializeDocument(document).manifest
  const parsed = JSON.parse(manifest) as { guides?: Array<{ id: string; axis: 'x' | 'y'; position: number }> }
  return { guides: parsed.guides ?? [] }
}
