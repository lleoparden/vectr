/** The Layers panel locate column (Phase 4.5). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createGroup, createRect, findNode } from "../src/doc/document.ts"
import { locateRowIds } from "../src/app/editing/locate.ts"
import type { Document, GroupNode } from "../src/doc/types.ts"

function withNesting(): { document: Document; groupId: string; childId: string; leafId: string } {
  const document = createDocument("Locate")
  const root = document.root as GroupNode
  const leaf = createRect("Leaf", 0, 0, 10, 10)
  const child = createRect("Child", 20, 20, 10, 10)
  const group = createGroup("Group")
  const insertedGroup = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes: [leaf, group] })
  assert.equal(insertedGroup.ok, true)
  const withGroup = insertedGroup.ok ? insertedGroup.document : document
  // The child is placed into the group by a second command, which is how the panel builds a tree too.
  const insertedChild = applyCommand(withGroup, { type: "insertNodes", parentId: group.id, index: 0, nodes: [child] })
  assert.equal(insertedChild.ok, true)
  return { document: insertedChild.ok ? insertedChild.document : withGroup, groupId: group.id, childId: child.id, leafId: leaf.id }
}

test("the locate column marks the ancestors that contain the selection", () => {
  const { document, groupId, childId, leafId } = withNesting()
  assert.deepEqual([...locateRowIds(document, [leafId])], [], "a top-level object has no ancestor row to point at")
  assert.deepEqual([...locateRowIds(document, [childId])], [groupId], "a child points at its group")
  assert.deepEqual([...locateRowIds(document, [groupId, childId])], [], "a selected group needs no pointer to itself")
})

test("a selection spanning two parents marks both, and unknown ids are ignored", () => {
  const { document, groupId, childId, leafId } = withNesting()
  const located = locateRowIds(document, [childId, leafId, "missing-node"])
  assert.deepEqual([...located], [groupId])
})
