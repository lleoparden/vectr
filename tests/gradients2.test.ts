/** Radial gradients, gradient stops, targets, and the full blend set (issue #70). */
import test from "node:test"
import assert from "node:assert/strict"
import { applyCommand } from "../src/doc/commands.ts"
import { createDocument, createRect, findNode } from "../src/doc/document.ts"
import { validateDocument } from "../src/doc/validate.ts"
import { buildScene } from "../src/render/scene.ts"
import { BLEND_MODES } from "../src/doc/types.ts"
import { documentStore } from "../src/state/documentStore.ts"
import {
  addGradientStop,
  linearGradientFrom,
  removeGradientStop,
  setGradientStop,
  setSelectionBlendMode,
  setSelectionGradient,
  setSelectionGradientTarget,
  setSelectionGradientType,
} from "../src/app/actions.ts"
import type { Document, GroupNode, LayerNode } from "../src/doc/types.ts"

function inserted(document: Document, nodes: LayerNode[]): Document {
  const root = document.root as GroupNode
  const result = applyCommand(document, { type: "insertNodes", parentId: root.id, index: 0, nodes })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

function withGradient() {
  let document = createDocument("Gradients")
  const rect = createRect("A", 0, 0, 100, 100)
  document = inserted(document, [rect])
  documentStore.replaceDocument(document)
  documentStore.setSelection([rect.id])
  setSelectionGradient(linearGradientFrom(0, "#000000", "#ffffff"))
  return rect.id
}

test("a radial gradient needs a radius, and only known types and targets pass", () => {
  const rectId = withGradient()
  setSelectionGradientType("radial")
  const radial = findNode(documentStore.getState().document, rectId)
  assert.ok(radial !== null && radial.type !== "group")
  if (radial !== null && radial.type !== "group") assert.equal(radial.style.gradient?.type, "radial")
  assert.equal(validateDocument(documentStore.getState().document).ok, true, "a linear gradient turned radial is valid")

  const style = (findNode(documentStore.getState().document, rectId) as { style: never }).style
  const broken = applyCommand(documentStore.getState().document, {
    type: "setStyle",
    nodeId: rectId,
    style: { ...style, gradient: { type: "radial", stops: [{ offset: 0, color: "#000000" }, { offset: 1, color: "#ffffff" }], from: { x: 0.5, y: 0.5 }, to: { x: 0.5, y: 0.5 } } },
  })
  assert.equal(broken.ok, true, "the command stores it; validation is the boundary that refuses it")
  assert.equal(validateDocument(broken.ok ? broken.document : documentStore.getState().document).ok, false, "no radius is refused")

  const unknownTarget = { ...style, gradientTarget: "outline" }
  assert.equal(validateDocument({ ...documentStore.getState().document, root: withStyle(broken.ok ? broken.document : documentStore.getState().document, rectId, unknownTarget) }).ok, false)
})

test("stops can be added, moved, recoloured, and removed, keeping at least two", () => {
  const rectId = withGradient()
  addGradientStop(0.5, "#ff0000")
  let gradient = (findNode(documentStore.getState().document, rectId) as { style: { gradient: { stops: Array<{ offset: number; color: string }> } } }).style.gradient
  assert.equal(gradient.stops.length, 3)
  assert.deepEqual(gradient.stops.map((stop) => stop.offset), [0, 0.5, 1], "stops stay ordered by offset")

  setGradientStop(1, { offset: 0.25 })
  gradient = (findNode(documentStore.getState().document, rectId) as { style: { gradient: { stops: Array<{ offset: number }> } } }).style.gradient
  assert.deepEqual(gradient.stops.map((stop) => stop.offset), [0, 0.25, 1])

  removeGradientStop(1)
  gradient = (findNode(documentStore.getState().document, rectId) as { style: { gradient: { stops: unknown[] } } }).style.gradient
  assert.equal(gradient.stops.length, 2)
  removeGradientStop(0)
  removeGradientStop(0)
  gradient = (findNode(documentStore.getState().document, rectId) as { style: { gradient: { stops: unknown[] } } }).style.gradient
  assert.equal(gradient.stops.length, 2, "a gradient always keeps two stops")
})

test("the gradient can paint the stroke or both, and the scene carries that", () => {
  const rectId = withGradient()
  setSelectionGradientTarget("both")
  const scene = buildScene(documentStore.getState().document)
  assert.equal(scene.shapes[0].gradientTarget, "both")
  assert.equal(validateDocument(documentStore.getState().document).ok, true)
  void rectId
})

test("every standard blend mode is accepted and an unknown one is refused", () => {
  const rectId = withGradient()
  for (const mode of BLEND_MODES) {
    setSelectionBlendMode(mode)
    const node = findNode(documentStore.getState().document, rectId)
    assert.ok(node !== null && node.type !== "group")
    if (node !== null && node.type !== "group") assert.equal(node.style.blendMode, mode)
  }
  assert.equal(BLEND_MODES.length, 16, "normal plus the fifteen compositing modes")
  const node = findNode(documentStore.getState().document, rectId)
  if (node === null || node.type === "group") throw new Error("expected a leaf")
  const broken = { ...documentStore.getState().document, root: withStyle(documentStore.getState().document, rectId, { ...node.style, blendMode: "vivid-light" as never }) }
  assert.equal(validateDocument(broken).ok, false)
})

function withStyle(document: Document, id: string, style: unknown): GroupNode {
  const walk = (node: LayerNode): LayerNode => {
    if (node.id === id) return { ...node, style } as LayerNode
    if (node.type === "group") return { ...node, children: node.children.map(walk) }
    return node
  }
  return walk(document.root) as GroupNode
}
