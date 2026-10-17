/** Blend modes (Phase 2.7/APP-01): a deliberately small set on the style. */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { buildScene } from "../src/render/scene.ts"
import { documentStore } from "../src/state/documentStore.ts"
import { setSelectionBlendMode } from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

test("a blend mode applies to the selection as one entry and reaches the scene", () => {
  let document = createDocument("Blend")
  const rect = createRect("A", 0, 0, 100, 100)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])
  const depth = documentStore.getState().undoDepth

  setSelectionBlendMode("multiply")
  const styled = findNode(documentStore.getState().document, rect.id)
  assert.ok(styled !== null && styled.type !== "group")
  if (styled !== null && styled.type !== "group") assert.equal(styled.style.blendMode, "multiply")
  assert.equal(documentStore.getState().undoDepth, depth + 1)

  const scene = buildScene(documentStore.getState().document)
  assert.equal(scene.shapes[0].blendMode, "multiply")
})

test("a shape with no blend mode reports null, not a default", () => {
  let document = createDocument("Blend")
  const rect = createRect("A", 0, 0, 10, 10)
  document = inserted(document, [rect])
  assert.equal(buildScene(document).shapes[0].blendMode, null)
})

test("an unsupported blend mode is refused at the boundary", () => {
  let document = createDocument("Blend")
  const rect = createRect("A", 0, 0, 10, 10)
  document = inserted(document, [rect])
  const node = document.root.children[0]
  if (node.type === "group") throw new Error("expected a leaf")
  node.style = { ...node.style, blendMode: "color-dodge" as never }
  assert.equal(validateDocument(document).ok, false)

  node.style = { ...node.style, blendMode: "screen" }
  assert.equal(validateDocument(document).ok, true, "a supported mode is fine")
})
