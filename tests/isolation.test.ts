/** Isolation mode (Phase 2.8, issue #71): the pure filters the canvas applies. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createEllipse, createGroup, createRect } from "../src/doc/document.ts"
import {
  deepHitWithin,
  groupToIsolate,
  isolatedIds,
  isolationLabel,
  isSelectable,
  withinIsolation,
} from "../src/app/editing/isolation.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, parentId: string, nodes: LayerNode[]): Document {
  const parent = document.root.id === parentId ? (document.root as GroupNode) : (findWithinGroups(document, parentId) as GroupNode)
  const result = applyCommand(document, { type: "insertNodes", parentId, index: parent.children.length, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

function findWithinGroups(document: Document, id: string): LayerNode | null {
  const walk = (nodes: LayerNode[]): LayerNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.type === "group") {
        const found = walk(node.children)
        if (found !== null) return found
      }
    }
    return null
  }
  return walk(document.root.children)
}

function fixture() {
  const group = createGroup("Island")
  const inside = createRect("Inside", 20, 20, 60, 60)
  const outsider = createEllipse("Outside", 400, 400, 80, 80)
  let document = createDocument("Isolation")
  document = inserted(document, document.root.id, [group, outsider])
  document = inserted(document, group.id, [inside])
  return { document, group, inside, outsider }
}

test("isolation names a group's subtree and nothing else", () => {
  const { document, group, inside, outsider } = fixture()
  const ids = isolatedIds(document, group.id)
  assert.ok(ids !== null && ids.has(inside.id))
  assert.equal(ids?.has(outsider.id), false)
  assert.equal(ids?.has(group.id), true, "the group itself is in its subtree")
  assert.equal(isSelectable(document, group.id, inside.id), true)
  assert.equal(isSelectable(document, group.id, outsider.id), false)
  assert.equal(isSelectable(document, group.id, group.id), false, "the isolated group itself is not selectable")
  assert.equal(isSelectable(document, null, outsider.id), true, "outside isolation everything is selectable")
  assert.equal(isolatedIds(document, null), null)
  assert.equal(isolatedIds(document, "missing"), null)
  assert.equal(isolationLabel(document, group.id), "Island")
  assert.equal(isolationLabel(document, null), null)
})

test("a selection is filtered to the isolated subtree, keeping order", () => {
  const { document, group, inside, outsider } = fixture()
  assert.deepEqual(withinIsolation(document, group.id, [outsider.id, inside.id]), [inside.id])
  assert.deepEqual(withinIsolation(document, null, [outsider.id, inside.id]), [outsider.id, inside.id])
})

test("a click inside isolation resolves to a leaf inside it, and nothing outside it", () => {
  const { document, group, inside, outsider } = fixture()
  assert.equal(deepHitWithin(document, group.id, { x: 40, y: 40 }), inside.id)
  assert.equal(deepHitWithin(document, group.id, { x: 440, y: 440 }), null, "the outsider is out of reach")
  assert.equal(deepHitWithin(document, group.id, { x: 900, y: 900 }), null)
  assert.equal(deepHitWithin(document, null, { x: 40, y: 40 }), null, "no isolation, no deep hit")
})

test("isolation targets the group you clicked into", () => {
  const { document, group, inside, outsider } = fixture()
  assert.equal(groupToIsolate(document, [group.id]), group.id, "a selected group isolates itself")
  assert.equal(groupToIsolate(document, [inside.id]), group.id, "a selected child isolates its parent group")
  assert.equal(groupToIsolate(document, [outsider.id]), null, "a top-level object has no group to isolate")
  assert.equal(groupToIsolate(document, []), null)
})
