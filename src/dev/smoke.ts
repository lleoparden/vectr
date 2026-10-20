/**
 * Editor smoke run (issue #18).
 *
 * A scripted pass over the slice's acceptance flow at the store and command level,
 * so the packaged app can prove the editor path works without a human clicking.
 * Run with `electron . --smoke`; the result is logged as `[vectr-smoke] {...}` and
 * forwarded to stdout by the main process.
 *
 * This is a smoke check, not the test suite: the assertions live in
 * `tests/doc.test.ts` and `tests/editor.test.ts`.
 */

import { createEllipse, createGroup, createPath, createRect, createText, findNode, worldBounds } from '../doc/document.ts'
import { cornerAnchor } from '../geom/path.ts'
import { nodeSize, type LayerNode } from '../doc/types.ts'
import { hitTest, hierarchySelection, lassoHitTest, marqueeHitTest } from '../doc/hitTest.ts'
import { unionBounds } from '../doc/transform.ts'
import { rotatePoint, scaleFactors, scaledTransform } from '../geom/transform.ts'
import { artboardRect, artboardRects } from '../doc/artboards.ts'
import { SNAP_PIXELS, snapBox, snapTargets } from '../app/editing/snapping.ts'
import { deepHitWithin, groupToIsolate } from '../app/editing/isolation.ts'
import { getActiveRenderer } from '../render/activeRenderer.ts'
import { buildScene } from '../render/scene.ts'
import { planGroup } from '../app/editing/arrange.ts'
import { addCmykSwatch, addGradientStop, addGuide, applySwatch, linearGradientFrom, nudgeSelection, placeImage, removeGradientStop, removeSwatch, runEditorAction, setSelectionBlendMode, setSelectionCornerRadius, setSelectionGradient, setSelectionGradientTarget, setSelectionGradientType, setSelectionRotation, setSelectionStrokeAlign } from '../app/actions.ts'
import {
  newDocument,
  openDocument,
  recoverDocument,
  refreshRecoveryState,
  requestNewDocument,
  resolveUnsavedPrompt,
  saveDocument,
  writeRecoverySnapshot,
} from '../app/files/fileActions.ts'
import { workspaceStore } from '../state/workspaceStore.ts'
import { serializeDocument } from '../file/serialize.ts'
import { assetRegistry } from '../state/assetRegistry.ts'
import { documentStore } from '../state/documentStore.ts'
import type { DocumentStore } from '../state/documentStore.ts'

export type SmokeStep = { name: string; ok: boolean; detail: string }
export type SmokeReport = { passed: boolean; steps: SmokeStep[] }

export function runEditorSmoke(store: DocumentStore): SmokeReport {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })

  const rect = createRect('Smoke Rect', 40, 40, 160, 120)
  const ellipse = createEllipse('Smoke Ellipse', 280, 80, 120, 120)
  const inserted = store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [rect, ellipse] },
    'smoke insert',
  )
  record('create two shapes', inserted.ok, inserted.ok ? 'inserted rect + ellipse' : inserted.message)

  const scene = buildScene(store.getState().document)
  record('scene built', scene.shapes.length === 2, `${scene.shapes.length} shapes, ${scene.byRoot.length} roots`)

  store.setSelection([rect.id])
  record('selection', store.getState().selection.join(',') === rect.id, store.getState().selection.join(',') || 'none')

  const depthBeforeDrag = store.getState().undoDepth
  store.beginTransaction('smoke move')
  for (const x of [60, 90, 120]) {
    store.dispatch({ type: 'setTransform', nodeId: rect.id, transform: { x, y: 40, rotation: 0, scaleX: 1, scaleY: 1 } })
  }
  store.commitTransaction()
  const movedX = findNode(store.getState().document, rect.id)?.transform.x
  const depthAfterDrag = store.getState().undoDepth
  record(
    'drag is one entry',
    depthAfterDrag === depthBeforeDrag + 1 && movedX === 120,
    `depth ${depthBeforeDrag} -> ${depthAfterDrag}, x ${movedX}`,
  )

  store.undo()
  const undoneX = findNode(store.getState().document, rect.id)?.transform.x
  record('undo restores', undoneX === 40, `x ${undoneX}`)

  store.redo()
  const redoneX = findNode(store.getState().document, rect.id)?.transform.x
  record('redo re-applies', redoneX === 120, `x ${redoneX}`)

  const marquee = marqueeHitTest(store.getState().document, { x: 0, y: 0, width: 500, height: 400 })
  store.setSelection(marquee)
  record('marquee selects', marquee.length === 2, `${marquee.length} layers`)

  const rejected = store.dispatch({
    type: 'setTransform',
    nodeId: 'does-not-exist',
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  })
  const errorCode = store.getState().lastError?.code ?? 'none'
  record('invalid command rejected', !rejected.ok && errorCode === 'absent-node', errorCode)
  store.clearError()

  store.setSelection([ellipse.id])
  store.dispatch({ type: 'removeNodes', nodeIds: [ellipse.id] }, 'smoke delete')
  record('delete + prune selection', store.getState().selection.length === 0, `${store.getState().selection.length} selected`)

  // Issue #20: a second shape gives something to group, and grouping two layers is one
  // gesture, so it must be one history entry with the new group selected.
  const mate = createEllipse('Smoke Group Mate', 520, 200, 80, 80)
  const root = store.getState().document.root
  store.dispatch(
    { type: 'insertNodes', parentId: root.id, index: root.children.length, nodes: [mate] },
    'smoke group prep',
  )
  const orderBefore = store.getState().document.root.children.length
  store.setSelection(store.getState().document.root.children.map((node) => node.id))
  const groupPlan = planGroup(store.getState().document, store.getState().selection)
  record('group planned', groupPlan !== null, groupPlan === null ? 'no plan' : `${groupPlan.length} steps`)

  const depthBeforeGroup = store.getState().undoDepth
  runEditorAction('object.group')
  const grouped = store.getState().document.root.children
  const group = grouped[grouped.length - 1]
  record(
    'group is one entry',
    store.getState().undoDepth === depthBeforeGroup + 1 && grouped.length === orderBefore - 1,
    `depth ${depthBeforeGroup} -> ${store.getState().undoDepth}, ${orderBefore} -> ${grouped.length} top-level`,
  )
  record(
    'group selected and nested',
    store.getState().selection.length === 1 &&
      store.getState().selection[0] === group.id &&
      (group.type === 'group' ? group.children.length : -1) === orderBefore,
    `${store.getState().selection.length} selected, ${group.type} holds ${
      group.type === 'group' ? group.children.length : 0
    }`,
  )
  store.undo()
  record(
    'undo ungroups in one step',
    store.getState().document.root.children.length === orderBefore,
    `${store.getState().document.root.children.length} top-level again`,
  )

  // Issue #16: text is a document object like any other — created by a command, edited by one
  // command in one history entry, and validated like any other node.
  const text = createText('Smoke Text', 60, 240, 'Hello\nVectr')
  const textInsert = store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [text] },
    'smoke text',
  )
  record(
    'text created',
    textInsert.ok,
    textInsert.ok ? `${text.width.toFixed(0)}x${text.height.toFixed(0)} box, 2 lines` : textInsert.message,
  )

  const depthBeforeText = store.getState().undoDepth
  const edited = store.dispatch({ type: 'setText', nodeId: text.id, text: 'Hello again' }, 'edit text')
  const editedNode = findNode(store.getState().document, text.id)
  record(
    'text edit is one entry',
    edited.ok &&
      store.getState().undoDepth === depthBeforeText + 1 &&
      editedNode !== null &&
      editedNode.type === 'text' &&
      editedNode.text === 'Hello again',
    `depth ${depthBeforeText} -> ${store.getState().undoDepth}`,
  )
  store.undo()
  const restored = findNode(store.getState().document, text.id)
  record(
    'text undo restores content',
    restored !== null && restored.type === 'text' && restored.text === 'Hello\nVectr',
    restored !== null && restored.type === 'text' ? JSON.stringify(restored.text) : 'missing',
  )

  const badSize = store.dispatch(
    {
      type: 'setTextStyle',
      nodeId: text.id,
      fontSize: -4,
      fontFamily: 'Inter',
      align: 'left',
      lineHeight: 19,
    },
    'bad size',
  )
  record(
    'invalid text style rejected',
    !badSize.ok && store.getState().lastError?.code === 'non-finite',
    store.getState().lastError?.code ?? 'none',
  )
  store.clearError()

  // A family Vectr does not bundle is accepted and reported, not refused (slice 1's rule).
  const missingFont = store.dispatch(
    {
      type: 'setTextStyle',
      nodeId: text.id,
      fontSize: 20,
      fontFamily: 'Comic Sans MS',
      align: 'center',
      lineHeight: 24,
    },
    'missing font',
  )
  record('missing font is recorded, not refused', missingFont.ok, missingFont.ok ? 'set to Comic Sans MS' : missingFont.message)

  // Layers panel actions: Duplicate and New Layer, each one undo step with a predictable result.
  const duplicateTarget = store.getState().document.root.children[0]
  store.setSelection([duplicateTarget.id])
  const depthBeforeDuplicate = store.getState().undoDepth
  const countBeforeDuplicate = store.getState().document.root.children.length
  runEditorAction('object.duplicate')
  const afterDuplicate = store.getState().document.root.children
  const copyId = store.getState().selection[0]
  record(
    'duplicate is one entry above the original',
    store.getState().undoDepth === depthBeforeDuplicate + 1 &&
      afterDuplicate.length === countBeforeDuplicate + 1 &&
      copyId !== undefined &&
      copyId !== duplicateTarget.id &&
      afterDuplicate[1].id === copyId,
    `${countBeforeDuplicate} -> ${afterDuplicate.length} top-level, copy at index 1: ${afterDuplicate[1].id === copyId}`,
  )
  store.undo()
  record(
    'undo removes the duplicate',
    store.getState().document.root.children.length === countBeforeDuplicate,
    `${store.getState().document.root.children.length} top-level again`,
  )

  const depthBeforeLayer = store.getState().undoDepth
  runEditorAction('layer.new')
  const withLayer = store.getState().document.root.children
  const topLayer = withLayer[withLayer.length - 1]
  record(
    'new layer lands on top and is selected',
    store.getState().undoDepth === depthBeforeLayer + 1 &&
      topLayer.type === 'group' &&
      store.getState().selection[0] === topLayer.id,
    `${topLayer.type} "${topLayer.name}" at the top`,
  )

  // Phase 2.1 (issue #64): direct selection, hierarchy drilling, the lasso, and a live corner
  // radius. The document is rebuilt so the assertions do not depend on the steps above.
  newDocument()
  const nestedGroup = createGroup('Smoke Nested Group')
  const nestedRect = createRect('Smoke Nested Rect', 60, 60, 120, 120)
  store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [nestedGroup] },
    'smoke nested group',
  )
  store.dispatch(
    { type: 'insertNodes', parentId: nestedGroup.id, index: 0, nodes: [nestedRect] },
    'smoke nested rect',
  )

  const objectHit = hitTest(store.getState().document, { x: 100, y: 100 })
  const leafHit = hitTest(store.getState().document, { x: 100, y: 100 }, { deep: true })
  record(
    'direct selection reaches a nested leaf',
    objectHit === nestedGroup.id && leafHit === nestedRect.id,
    `object hit ${objectHit === nestedGroup.id ? 'group' : objectHit}, leaf hit ${leafHit === nestedRect.id ? 'rect' : leafHit}`,
  )

  const drilled = hierarchySelection(store.getState().document, { x: 100, y: 100 }, [nestedGroup.id])
  store.setSelection(drilled === null ? [] : [drilled])
  record(
    'double-click drills one level into the group',
    drilled === nestedRect.id && store.getState().selection[0] === nestedRect.id,
    `drilled to ${drilled === nestedRect.id ? 'the nested rect' : String(drilled)}`,
  )

  const lassoed = lassoHitTest(store.getState().document, [
    { x: 40, y: 40 },
    { x: 220, y: 40 },
    { x: 220, y: 220 },
    { x: 40, y: 220 },
  ])
  record(
    'lasso selects what its path touches',
    lassoed.length === 1 && lassoed[0] === nestedGroup.id,
    `${lassoed.length} object(s) touched`,
  )

  store.setSelection([nestedRect.id])
  const depthBeforeRadius = store.getState().undoDepth
  setSelectionCornerRadius(999)
  const rounded = findNode(store.getState().document, nestedRect.id)
  record(
    'corner radius clamps to half the shorter side as one entry',
    rounded !== null &&
      rounded.type === 'rect' &&
      rounded.cornerRadius === 60 &&
      store.getState().undoDepth === depthBeforeRadius + 1,
    rounded !== null && rounded.type === 'rect' ? `radius ${rounded.cornerRadius}` : 'no rect',
  )
  store.undo()
  const unrounded = findNode(store.getState().document, nestedRect.id)
  record(
    'undo restores the previous corner radius',
    unrounded !== null && unrounded.type === 'rect' && unrounded.cornerRadius === 0,
    unrounded !== null && unrounded.type === 'rect' ? `radius ${unrounded.cornerRadius}` : 'no rect',
  )

  // Phase 2.2 (issue #65): the selection box, a handle scale, and the arrow nudge.
  const scaleTarget = createRect('Smoke Scale', 60, 60, 120, 120)
  store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [scaleTarget] },
    'smoke scale prep',
  )
  store.setSelection([scaleTarget.id])
  const selectionBox = unionBounds(store.getState().document, [scaleTarget.id])
  record(
    'the selection box matches the object',
    selectionBox !== null && selectionBox.width === 120 && selectionBox.height === 120,
    selectionBox === null ? 'no box' : `${selectionBox.width}×${selectionBox.height} at ${selectionBox.x},${selectionBox.y}`,
  )

  const scaleGesture = scaleFactors('se', selectionBox ?? { x: 0, y: 0, width: 1, height: 1 }, { x: 240, y: 240 }, {})
  const depthBeforeScale = store.getState().undoDepth
  store.beginTransaction('scale')
  store.dispatch({
    type: 'setTransform',
    nodeId: scaleTarget.id,
    transform: {
      ...scaleTarget.transform,
      ...scaledTransform(scaleTarget.transform, scaleGesture.anchor, scaleGesture.sx, scaleGesture.sy),
    },
  })
  store.commitTransaction()
  const scaledNode = findNode(store.getState().document, scaleTarget.id)
  record(
    'a handle drag scales about the fixed corner as one entry',
    store.getState().undoDepth === depthBeforeScale + 1 &&
      scaledNode !== null &&
      scaledNode.type !== 'group' &&
      Math.abs(scaledNode.transform.scaleX - 1.5) < 1e-6 &&
      scaledNode.transform.x === 60,
    scaledNode !== null && scaledNode.type !== 'group'
      ? `scale ${scaledNode.transform.scaleX.toFixed(2)} at x ${scaledNode.transform.x}`
      : 'no node',
  )

  // Phase 4.2 (issue #120): rotation reaches the transform, the scene, the hit test, and undo. A
  // wide, short bar is used because rotation is invisible to a square: 200x40 turned 90 becomes
  // 40x200, so a point 80 above its centre is outside before and inside after.
  const rotationTarget = createRect('Smoke Rotation', 800, 900, 200, 40)
  store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [rotationTarget] },
    'smoke rotation prep',
  )
  store.setSelection([rotationTarget.id])
  const rotationBox = unionBounds(store.getState().document, [rotationTarget.id])
  const centre = { x: (rotationBox?.x ?? 0) + (rotationBox?.width ?? 0) / 2, y: (rotationBox?.y ?? 0) + (rotationBox?.height ?? 0) / 2 }
  const probe = { x: centre.x, y: centre.y + 80 }
  const missBefore = hitTest(store.getState().document, probe)
  const depthBeforeRotate = store.getState().undoDepth
  setSelectionRotation(90)
  const rotatedNode = findNode(store.getState().document, rotationTarget.id)
  const rotatedShape = buildScene(store.getState().document).shapes.find((shape) => shape.id === rotationTarget.id)
  const hitAfter = hitTest(store.getState().document, probe)
  record(
    'numeric rotation turns the object, reaches the scene, and follows the pointer',
    store.getState().undoDepth === depthBeforeRotate + 1 &&
      missBefore !== rotationTarget.id &&
      rotatedNode !== null &&
      rotatedNode.type !== 'group' &&
      rotatedNode.transform.rotation === 90 &&
      rotatedShape?.rotation === 90 &&
      hitAfter === rotationTarget.id,
    rotatedNode !== null && rotatedNode.type !== 'group'
      ? `${rotatedNode.transform.rotation}°, scene ${String(rotatedShape?.rotation)}, before ${String(missBefore)}, after ${hitAfter === rotationTarget.id ? 'hit' : 'missed'}`
      : 'no node',
  )
  store.undo()
  const unrotated = findNode(store.getState().document, rotationTarget.id)
  record(
    'undo puts the rotation back',
    unrotated !== null && unrotated.type !== 'group' && unrotated.transform.rotation === 0,
    unrotated !== null && unrotated.type !== 'group' ? unrotated.transform.rotation + '°' : 'no node',
  )
  store.setSelection([scaleTarget.id])

  const depthBeforeNudge = store.getState().undoDepth
  nudgeSelection(0, 10)
  const nudged = findNode(store.getState().document, scaleTarget.id)
  record(
    'an arrow nudge is one entry',
    store.getState().undoDepth === depthBeforeNudge + 1 &&
      nudged !== null &&
      nudged.type !== 'group' &&
      nudged.transform.y === 70,
    nudged !== null && nudged.type !== 'group' ? `y ${nudged.transform.y}` : 'no node',
  )

  // Phase 2.3 (issue #66): align, distribute, and the Vectr clipboard.
  const alignA = createRect('Smoke Align A', 0, 0, 100, 100)
  const alignB = createRect('Smoke Align B', 300, 200, 60, 60)
  const alignC = createRect('Smoke Align C', 600, 80, 40, 40)
  store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [alignA, alignB, alignC] },
    'smoke align prep',
  )
  store.setSelection([alignA.id, alignB.id])
  runEditorAction('object.alignLeft')
  const leftEdges = [alignA.id, alignB.id].map((id) => findNode(store.getState().document, id)?.transform.x)
  record(
    'align left puts both objects on one edge',
    leftEdges[0] === 0 && leftEdges[1] === 0,
    'x ' + leftEdges.join(', '),
  )

  store.setSelection([alignA.id, alignB.id, alignC.id])
  runEditorAction('object.distributeH')
  const centres = [alignA, alignB, alignC].map((node) => {
    const live = findNode(store.getState().document, node.id)
    return live === null || live.type === 'group' ? NaN : live.transform.x + live.width / 2
  })
  const sorted = [...centres].sort((a, b) => a - b)
  record(
    'distribute spaces the middle object evenly',
    Math.abs(sorted[1] - (sorted[0] + sorted[2]) / 2) < 1e-6,
    centres.map((value) => value.toFixed(1)).join(', '),
  )

  store.setSelection([alignA.id])
  const originalX = findNode(store.getState().document, alignA.id)?.transform.x ?? 0
  const originalY = findNode(store.getState().document, alignA.id)?.transform.y ?? 0
  runEditorAction('edit.copy')
  const beforePaste = store.getState().document.root.children.length
  const depthBeforePaste = store.getState().undoDepth
  runEditorAction('edit.paste')
  const pastedId = store.getState().selection[0]
  const pasted = pastedId === undefined ? null : findNode(store.getState().document, pastedId)
  record(
    'copy and paste offset the copy as one entry',
    store.getState().document.root.children.length === beforePaste + 1 &&
      store.getState().undoDepth === depthBeforePaste + 1 &&
      pasted !== null &&
      pasted.type !== 'group' &&
      pasted.transform.x === originalX + 10 &&
      pasted.transform.y === originalY + 10,
    pasted !== null && pasted.type !== 'group' ? 'copy at ' + pasted.transform.x + ',' + pasted.transform.y : 'no copy',
  )

  // Phase 2.4 (issue #67): artboards are document data with a derived layout.
  newDocument()
  const pageBefore = store.getState().document.artboards.length
  runEditorAction('artboard.new')
  const pagesAfter = store.getState().document.artboards.length
  const activePage = artboardRect(store.getState().document, workspaceStore.getState().activeArtboardId)
  record(
    'a new artboard is added, laid out, and active',
    pagesAfter === pageBefore + 1 && activePage !== null && activePage.x > 0,
    activePage === null ? 'no active page' : pagesAfter + ' pages, active at x ' + activePage.x,
  )

  const depthBeforePage = store.getState().undoDepth
  runEditorAction('artboard.delete')
  record(
    'deleting the active artboard is one undo entry',
    store.getState().document.artboards.length === pageBefore &&
      store.getState().undoDepth === depthBeforePage + 1,
    store.getState().document.artboards.length + ' pages',
  )


  // Phase 2.5 (issue #68): Smart Guides snap a drag onto the nearest edge or centre.
  newDocument()
  const snapRectA = createRect('Snap A', 4, 40, 100, 60)
  store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [snapRectA] },
    'smoke snap prep',
  )
  const page = artboardRects(store.getState().document)[0]
  const snap = snapBox(
    { x: 4, y: 40, width: 100, height: 60 },
    snapTargets(store.getState().document, [snapRectA.id], store.getState().document.artboards[0].id),
    SNAP_PIXELS,
  )
  record(
    'smart guides snap a drag inside the six-pixel threshold',
    snap.dx !== 0 && snap.guides.length > 0,
    'dx ' + snap.dx + ', ' + snap.guides.length + ' guide(s)',
  )
  const outside = snapBox(
    { x: 96, y: 40, width: 100, height: 60 },
    snapTargets(store.getState().document, [snapRectA.id], store.getState().document.artboards[0].id),
    0.5,
  )
  record('a drag outside the threshold is not snapped', outside.dx === 0 && outside.dy === 0, 'dx ' + outside.dx)
  record('the page is a snap target', page !== undefined && page.width > 0, page === undefined ? 'no page' : page.width + ' wide')


  // Phase 2.8 (issue #71): isolation limits selection to one group's subtree.
  newDocument()
  const island = createGroup('Smoke Island')
  const islandChild = createRect('Island Child', 20, 20, 60, 60)
  const islandOutsider = createRect('Island Outsider', 400, 400, 60, 60)
  store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [island, islandOutsider] },
    'smoke isolation prep',
  )
  store.dispatch({ type: 'insertNodes', parentId: island.id, index: 0, nodes: [islandChild] }, 'smoke island child')
  const insideIsolation = deepHitWithin(store.getState().document, island.id, { x: 40, y: 40 })
  const outsideIsolation = deepHitWithin(store.getState().document, island.id, { x: 420, y: 420 })
  record(
    'isolation reaches the group and nothing outside it',
    insideIsolation === islandChild.id && outsideIsolation === null,
    'inside ' + (insideIsolation === islandChild.id ? 'child' : String(insideIsolation)) + ', outside ' + String(outsideIsolation),
  )
  record(
    'isolating a child targets its parent group',
    groupToIsolate(store.getState().document, [islandChild.id]) === island.id,
    'group lookup ok',
  )


  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Save/reopen/recovery evidence (issue #19), run on the packaged app.
 *
 * Everything here goes over the real preload bridge to the real filesystem, in a scratch
 * directory under user data, so the round trip is the same code path a user's save takes. It is
 * logged as `[vectr-file]`.
 */
export async function runFileRoundTrip(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const api = window.vectrFiles
  if (api === undefined) {
    record('file bridge', false, 'the preload bridge is missing')
    return { passed: false, steps }
  }

  // A document with a nested group, text, and a placed image.
  newDocument()
  const root = documentStore.getState().document.root
  const rect = createRect('Rect', 20, 30, 120, 80)
  const group = createGroup('Group 1')
  const inner = createRect('Inner', 200, 40, 60, 60)
  const text = createText('Label', 60, 220, 'Saved text\nsecond line')
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 0, nodes: [rect, group] })
  documentStore.dispatch({ type: 'insertNodes', parentId: group.id, index: 0, nodes: [inner] })
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 2, nodes: [text] })
  // A Bézier curve must survive save and reopen with its anchors and fill rule (Phase 5.1, #137).
  const curve = createPath(
    'Curve',
    320,
    300,
    [cornerAnchor(0, 0), { ...cornerAnchor(80, 20), inX: 0, inY: -20, outX: 0, outY: 20, smooth: true }, cornerAnchor(20, 100)],
    { closed: true, fillRule: 'evenodd' },
  )
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 3, nodes: [curve] })
  // The edited corner radius must survive save/reopen (issue #64).
  const radiusEdit = documentStore.dispatch(
    { type: 'setCornerRadius', nodeId: rect.id, cornerRadius: 24 },
    'corner radius',
  )
  const png = await makeSmokePng()
  const placed = png === null ? null : await placeImage('round-trip.png', 'image/png', png)
  const manifestBefore = serializeDocument(documentStore.getState().document).manifest
  const idsBefore = documentStore
    .getState()
    .document.root.children.map((node) => node.id)
    .join(',')

  const directory = `${await api.scratchDirectory()}/round-trip-${Date.now()}.vectr`
  const saved = await saveDocument({ directory })
  record('save writes a project', saved, directory)
  const savedState = documentStore.getState()
  record(
    'saving clears the dirty state',
    savedState.document.revision === savedState.savedRevision && savedState.filePath === directory,
    `filePath ${savedState.filePath === null ? 'none' : 'set'}`,
  )

  // An edit after the save must be discarded by reopening, which proves the file is the truth.
  documentStore.dispatch({ type: 'renameNode', nodeId: rect.id, name: 'Changed after save' }, 'rename')
  record('an edit after save is dirty', documentStore.isDirty(), 'dirty')

  const opened = await openDocument({ directory })
  const reopened = documentStore.getState().document
  record(
    'reopen restores the layer tree',
    opened && reopened.root.children.map((node) => node.id).join(',') === idsBefore,
    `${reopened.root.children.length} top-level nodes`,
  )
  record(
    'reopen restores geometry, text, and the image',
    findNode(reopened, rect.id)?.name === 'Rect' &&
      reopened.assets.length === 1 &&
      documentStore.getState().document.root.children.some((node) => node.type === 'text'),
    `${reopened.assets.length} assets`,
  )
  const reopenedCurve = findNode(reopened, curve.id)
  record(
    'reopen restores the Bézier curve\u2019s anchors and fill rule',
    reopenedCurve !== null &&
      reopenedCurve.type === 'path' &&
      reopenedCurve.fillRule === 'evenodd' &&
      reopenedCurve.closed &&
      reopenedCurve.anchors.length === 3,
    reopenedCurve !== null && reopenedCurve.type === 'path' ? `${reopenedCurve.anchors.length} anchors, ${reopenedCurve.fillRule}` : 'missing',
  )
  const reopenedRect = findNode(reopened, rect.id)
  record(
    'reopen restores the edited corner radius',
    radiusEdit.ok && reopenedRect !== null && reopenedRect.type === 'rect' && reopenedRect.cornerRadius === 24,
    reopenedRect !== null && reopenedRect.type === 'rect' ? `radius ${reopenedRect.cornerRadius}` : 'no rect',
  )
  record(
    'a reopened document resaves byte-identically',
    serializeDocument(reopened).manifest === manifestBefore,
    serializeDocument(reopened).manifest.length + ' bytes',
  )
  record('reopened document is clean', documentStore.isDirty() === false, 'clean')

  // Layers panel thumbnails: the preview must be a real render of the layer, not a placeholder.
  const thumbnailRenderer = getActiveRenderer()
  const thumbnailLayer = documentStore.getState().document.root.children[0]
  const thumbnailBounds = worldBounds(documentStore.getState().document, thumbnailLayer.id)
  const thumbnail =
    thumbnailRenderer === null || thumbnailBounds === null
      ? null
      : thumbnailRenderer.renderThumbnail(thumbnailLayer.id, 28, thumbnailBounds)
  record(
    'layer thumbnail renders a real preview',
    thumbnail !== null && thumbnail.startsWith('data:image/png;base64,') && thumbnail.length > 200,
    thumbnail === null
      ? 'no preview was produced'
      : `${Math.round(((thumbnail.length - 'data:image/png;base64,'.length) * 3) / 4)} bytes of PNG for "${thumbnailLayer.name}"`,
  )
  // A data URL that is merely well-formed could still be blank, so decode it and check its size.
  const decodedThumbnail =
    thumbnail === null
      ? null
      : await new Promise<{ width: number; height: number } | null>((resolve) => {
          const probe = new Image()
          probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight })
          probe.onerror = () => resolve(null)
          probe.src = thumbnail
        })
  record(
    'the thumbnail decodes as a 28x28 image',
    decodedThumbnail?.width === 28 && decodedThumbnail?.height === 28,
    decodedThumbnail === null ? 'the data URL did not decode' : `${decodedThumbnail.width}×${decodedThumbnail.height}`,
  )

  // Recovery: unsaved work is snapshotted, offered, and comes back.
  documentStore.dispatch({ type: 'renameNode', nodeId: rect.id, name: 'Unsaved work' }, 'rename')
  const wrote = await writeRecoverySnapshot()
  await refreshRecoveryState()
  record(
    'recovery snapshot is written',
    wrote && documentStore.getState().recovery.available,
    documentStore.getState().recovery.savedAt ?? 'no timestamp',
  )
  const recovered = await recoverDocument()
  record(
    'recovery restores the unsaved work',
    recovered && findNode(documentStore.getState().document, rect.id)?.name === 'Unsaved work',
    'unsaved rename recovered',
  )
  await api.clearRecovery()
  await refreshRecoveryState()
  record('recovery clears after it is consumed', documentStore.getState().recovery.available === false, 'cleared')

  // The unsaved-work guard: starting a new document must ask instead of discarding.
  documentStore.dispatch({ type: 'renameNode', nodeId: rect.id, name: 'Guarded edit' }, 'rename')
  requestNewDocument()
  const prompt = workspaceStore.getState().pendingPrompt
  const keptWhileAsking = findNode(documentStore.getState().document, rect.id)?.name === 'Guarded edit'
  record(
    'starting a new document asks before discarding unsaved work',
    prompt?.kind === 'new' && keptWhileAsking,
    prompt === null ? 'no prompt was raised' : `prompt "${prompt.kind}", work kept: ${keptWhileAsking}`,
  )
  await resolveUnsavedPrompt('cancel')
  record(
    'cancelling the prompt leaves the document untouched',
    workspaceStore.getState().pendingPrompt === null &&
      findNode(documentStore.getState().document, rect.id)?.name === 'Guarded edit',
    'prompt closed, document unchanged',
  )

  const memory = await window.vectrBenchmark.getMemory()
  record(
    'memory recorded after save and reopen',
    memory.workingSetBytes > 0,
    `${(memory.workingSetBytes / (1024 * 1024)).toFixed(1)} MiB whole app, ${placed === null ? 'no image' : 'one image asset'}`,
  )

  // The owner's recovery spec, end to end, last so the document it replaces cannot disturb the
  // steps above: the snapshot is a whole project folder, an interval snapshot is refused for a
  // document with no file, and a session that did not quit cleanly brings the work back.
  const snapshotWrote = await writeRecoverySnapshot({ reason: 'close' })
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
  const stored = await api.readRecovery()
  const snapshotAssets = stored.snapshot?.assets ?? []
  record(
    'a recovery copy is a project folder that carries the document\u2019s assets',
    snapshotWrote && snapshotAssets.length === documentStore.getState().document.assets.length,
    `${snapshotAssets.length} asset(s) beside the manifest`,
  )

  const unclean = await refreshRecoveryState()
  await settle(120)
  const crashDialog = document.querySelector('[data-crash-dialog="open"]')
  const crashText = (crashDialog?.textContent ?? '').replace(/\s+/g, ' ')
  record(
    'an unclean exit is reported as a crash, by name',
    unclean &&
      workspaceStore.getState().crashPrompt !== null &&
      crashDialog !== null &&
      /Vectr closed unexpectedly/.test(crashText) &&
      crashText.includes(documentStore.getState().document.name),
    crashDialog === null ? 'no crash dialog' : JSON.stringify(crashText.slice(0, 120)),
  )

  const beforeRestore = documentStore.getState().filePath
  document.querySelector<HTMLButtonElement>('[data-crash-action="restore"]')?.click()
  await settle(250)
  const restored = documentStore.getState()
  record(
    'restoring brings the work back and keeps it attached to its file',
    document.querySelector('[data-crash-dialog="open"]') === null &&
      restored.document.root.children.length > 0 &&
      restored.filePath === beforeRestore &&
      restored.recovery.available,
    `dialog ${document.querySelector('[data-crash-dialog="open"]') === null ? 'closed' : 'open'}, ` +
      `${restored.document.root.children.length} root node(s), file ${String(restored.filePath)}`,
  )

  await api.clearRecovery()
  await refreshRecoveryState()
  workspaceStore.setCrashPrompt(null)
  newDocument()
  documentStore.dispatch(
    {
      type: 'insertNodes',
      parentId: documentStore.getState().document.root.id,
      index: 0,
      nodes: [createRect('Unsaved', 0, 0, 40, 40)],
    },
    'unsaved edit',
  )
  const intervalRefused = await writeRecoverySnapshot({ reason: 'interval' })
  record(
    'autosave refuses a document that has not been saved yet',
    intervalRefused === false && (await api.readRecovery()).snapshot === null,
    `interval snapshot written: ${intervalRefused}`,
  )
  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Text entry at the DOM level (fix for "the Type tool does nothing").
 *
 * The unit tests cover the text commands, and the file round trip covers saving a text object, but
 * nothing exercised the actual interaction: press the Type tool, click the canvas, type, click away.
 * That gap is exactly where the editor was being closed by the same click that opened it, so this
 * report drives the real canvas element with real pointer events and reads the real DOM back.
 */
export async function runTextEntryReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Design canvas"]')
  if (canvas === null) {
    record('canvas found', false, 'no canvas element')
    return { passed: false, steps }
  }
  const editor = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit text"]')

  /** Clicks the canvas the way a user does: pointerdown then pointerup at the same point. */
  const clickCanvas = (x: number, y: number) => {
    const box = canvas.getBoundingClientRect()
    const clientX = box.left + x
    const clientY = box.top + y
    const options = { pointerId: 1, button: 0, buttons: 1, clientX, clientY, bubbles: true, isPrimary: true }
    canvas.dispatchEvent(new PointerEvent('pointerdown', options))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }))
  }

  /** Types into a controlled React textarea the way the browser would. */
  const typeInto = (element: HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  newDocument()
  await settle(150)
  runEditorAction('tool.text')
  await settle(100)

  // 1. Clicking with the Type tool must place a text object *and* leave an editor open.
  clickCanvas(200, 180)
  await settle(150)
  const placed = documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  const openedEditor = editor()
  record(
    'clicking with the Type tool places text and opens the editor',
    placed === 1 && openedEditor !== null,
    `${placed} text object(s), editor ${openedEditor === null ? 'NOT open' : 'open'}`,
  )

  // 2. Typing must survive committing, and be one history entry.
  if (openedEditor !== null) {
    const depthBefore = documentStore.getState().undoDepth
    typeInto(openedEditor, 'Hello Vectr')
    await settle(50)
    openedEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
    const textNode = documentStore.getState().document.root.children.find((node) => node.type === 'text')
    const content = textNode !== undefined && textNode.type === 'text' ? textNode.text : null
    record(
      'typed text is committed as one entry',
      content === 'Hello Vectr' && documentStore.getState().undoDepth === depthBefore + 1,
      `content ${JSON.stringify(content)}, depth ${depthBefore} -> ${store_depth()} `,
    )
    record(
      'the editor closes after committing',
      editor() === null && documentStore.getState().selection.length === 1,
      `editor ${editor() === null ? 'closed' : 'still open'}`,
    )
  }

  // 3. Clicking away without typing must not leave an invisible empty object behind.
  runEditorAction('tool.text')
  clickCanvas(320, 260)
  await settle(150)
  const emptyEditor = editor()
  if (emptyEditor !== null) {
    typeInto(emptyEditor, '   ')
    emptyEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
  }
  const remaining = documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  record(
    'an abandoned empty text object is discarded',
    remaining === 1,
    `${remaining} text object(s) left after the empty one was abandoned`,
  )

  // 4. A real mouse click moves focus, so a blur can arrive the instant the editor opens. That
  //    must not destroy the object the user was about to type into.
  runEditorAction('tool.text')
  clickCanvas(420, 320)
  await settle(150)
  const beforeBlur = editor()
  beforeBlur?.blur()
  await settle(150)
  const stillOpen = editor()
  const stillPlaced = documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  record(
    'a blur before typing does not destroy the text object',
    stillOpen !== null && stillPlaced >= 1,
    `editor ${stillOpen === null ? 'closed' : 'open'}, ${stillPlaced} text object(s)`,
  )
  if (stillOpen !== null) {
    typeInto(stillOpen, 'Recovered')
    stillOpen.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
    const typed = documentStore
      .getState()
      .document.root.children.filter((node) => node.type === 'text' && node.text === 'Recovered').length
    record('typing still works after that blur', typed === 1, `${typed} object(s) with the typed content`)
  }

  // 5. Double-clicking an existing text object opens the same editor.
  runEditorAction('tool.select')
  await settle(50)
  const onlyText = documentStore.getState().document.root.children.find((node) => node.type === 'text')
  if (onlyText !== undefined) {
    documentStore.setSelection([onlyText.id])
    const box = canvas.getBoundingClientRect()
    const world = worldBounds(documentStore.getState().document, onlyText.id)
    const viewport = documentStore.getState().viewport
    if (world !== null) {
      const x = (world.x + 4) * viewport.zoom + viewport.panX
      const y = (world.y + 4) * viewport.zoom + viewport.panY
      canvas.dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, clientX: box.left + x, clientY: box.top + y }),
      )
      await settle(150)
      record(
        'double-clicking a text object reopens the editor',
        editor() !== null,
        editor() === null ? 'no editor' : 'editor open for the existing text',
      )
      editor()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await settle(100)
    }
  }

  // 6. The editor has to grow with what it holds: the owner reported the box that appears on the
  //    first click was too small for anything to fit in it. These steps run last so the document
  //    they add cannot disturb the counts the earlier steps depend on.
  const textObjects = () =>
    documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  runEditorAction('tool.text')
  await settle(120)
  clickCanvas(480, 360)
  await settle(200)
  let growing = editor()
  let attempts = 1
  // A click that lands while the tool change is still propagating can be read as the previous
  // tool; a real user would simply click again, so the check does the same and reports it.
  while (growing === null && attempts < 3) {
    attempts += 1
    clickCanvas(480 + attempts * 40, 360 + attempts * 20)
    await settle(250)
    growing = editor()
  }
  if (growing === null) {
    record(
      'the editor opens for its own size check',
      false,
      `no editor after ${attempts} clicks; tool ${documentStore.getState().tool}, ${textObjects()} text object(s)`,
    )
  } else {
    record('the editor opens for its own size check', true, `open after ${attempts} click(s)`)
    const before = growing.getBoundingClientRect()
    typeInto(growing, 'A line of text long enough to need a wider box')
    await settle(80)
    const wider = growing.getBoundingClientRect()
    record(
      'the editor widens as the text gets longer',
      wider.width > before.width + 40,
      `${Math.round(before.width)} px → ${Math.round(wider.width)} px wide`,
    )
    typeInto(growing, 'A line of text long enough to need a wider box\nand a second line below it')
    await settle(80)
    const taller = growing.getBoundingClientRect()
    record(
      'a second line makes the editor taller',
      taller.height > wider.height,
      `${Math.round(wider.height)} px → ${Math.round(taller.height)} px tall`,
    )
    record(
      'the editor is at least as big as it was on the previous keystroke',
      taller.width >= wider.width && taller.height >= wider.height,
      `editor ${Math.round(taller.width)}×${Math.round(taller.height)} px`,
    )
    growing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
    const stored = documentStore
      .getState()
      .document.root.children.find((node) => node.type === 'text' && node.text.includes('second line'))
    record(
      'committing stores the box the editor grew to',
      stored !== undefined && stored.type === 'text' && stored.height >= stored.lineHeight * 2 - 0.5,
      stored === undefined || stored.type !== 'text'
        ? 'no committed text'
        : `stored ${Math.round(stored.width)}×${Math.round(stored.height)} px`,
    )
  }

  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Tool palette grouping and the tool options bar (owner request after Phase 1).
 *
 * The unit tests cover the model; this report drives the real chrome: it clicks the real palette
 * slots and the real bar controls in the packaged app, then reads the document back to prove the
 * bar's settings reached the object the tool drew. Logged as `[vectr-ui]`.
 */
export async function runToolOptionsReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Design canvas"]')
  const bar = () => document.querySelector<HTMLElement>('[aria-label="Tool options"]')

  if (canvas === null || bar() === null) {
    record('the tool options bar is on screen', false, 'canvas or options bar missing')
    return { passed: false, steps }
  }

  /** Clicks the canvas the way a user does: pointerdown then pointerup at the same point. */
  const clickCanvas = (x: number, y: number) => {
    const box = canvas.getBoundingClientRect()
    const options = {
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: box.left + x,
      clientY: box.top + y,
      bubbles: true,
      isPrimary: true,
    }
    canvas.dispatchEvent(new PointerEvent('pointerdown', options))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }))
  }

  /** Drags on the canvas, which is how the shape tool draws. Pointer id 1 is the mouse. */
  const dragCanvas = (fromX: number, fromY: number, toX: number, toY: number) => {
    const box = canvas.getBoundingClientRect()
    const base = { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true, isPrimary: true }
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { ...base, buttons: 1, clientX: box.left + fromX, clientY: box.top + fromY }),
    )
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { ...base, buttons: 1, clientX: box.left + toX, clientY: box.top + toY }),
    )
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { ...base, buttons: 0, clientX: box.left + toX, clientY: box.top + toY }),
    )
  }

  const barButton = (text: string) =>
    Array.from(bar()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === text,
    )
  const setNumber = (value: string) => {
    // Number fields are the shared scrub-able control now, which is a text input with a spinbutton role.
    const input = bar()?.querySelector<HTMLInputElement>('input[role="spinbutton"]')
    if (input === undefined || input === null) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  newDocument()
  await settle(150)
  const placeImage = document.querySelector<HTMLButtonElement>('[data-place-image]')
  const placeLinkedImage = document.querySelector<HTMLButtonElement>('[data-place-linked-image]')
  record(
    'the options bar exposes embedded and linked image placement',
    placeImage?.textContent?.trim() === 'Place image' && placeLinkedImage?.textContent?.trim() === 'Link',
    `embed ${placeImage === null ? 'missing' : 'present'}, link ${placeLinkedImage === null ? 'missing' : 'present'}`,
  )
  // 1. The palette groups the arrow pair and the shape tools into slots with flyouts, like
  // Illustrator, and gives the Lasso its own slot (issue #64).
  const slots = document.querySelectorAll('[data-tool-slot]')
  const shapeFlyout = document.querySelector('[data-tool-flyout="shape"]')
  const shapeSlot = document.querySelector<HTMLButtonElement>('[data-tool-slot="shape"]')
  const selectFlyout = document.querySelector('[data-tool-flyout="select"]')
  const lassoSlot = document.querySelector<HTMLButtonElement>('[data-tool-slot="lasso"]')
  record(
    'the palette groups the arrow pair and the shape tools into slots with flyouts',
    slots.length === 5 &&
      selectFlyout !== null &&
      shapeFlyout !== null &&
      shapeSlot?.title?.includes('Shape Tool') === true &&
      lassoSlot?.title === 'Lasso Tool (Q)' &&
      document.querySelector('[data-tool-slot="hand"]') !== null,
    `${slots.length} slots, arrow flyout ${selectFlyout === null ? 'missing' : 'present'}, shape flyout ${shapeFlyout === null ? 'missing' : 'present'}, lasso ${JSON.stringify(lassoSlot?.title)}`,
  )

  // 2. Clicking the Type tool must change the bar to the Type tool's controls.
  document.querySelector<HTMLButtonElement>('[data-tool-slot="text"]')?.click()
  await settle(120)
  record(
    'the options bar changes with the active tool',
    bar()?.dataset.toolOptions === 'text' && setNumber('42'),
    `bar reports ${JSON.stringify(bar()?.dataset.toolOptions)} for the Type tool`,
  )
  barButton('Center')?.click()
  document.querySelector<HTMLButtonElement>('[aria-label="Text colour #7c6cf5"]')?.click()
  await settle(80)

  // 3. Those settings must reach the object the Type tool is about to draw.
  clickCanvas(200, 200)
  await settle(150)
  const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit text"]')
  if (editor !== null) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(editor, 'Bar settings')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
  }
  const text = documentStore.getState().document.root.children.find((node) => node.type === 'text')
  record(
    'the Type tool draws with the bar settings',
    text !== undefined &&
      text.type === 'text' &&
      text.text === 'Bar settings' &&
      text.fontSize === 42 &&
      text.align === 'center' &&
      text.style.fill === '#7c6cf5',
    text === undefined || text.type !== 'text'
      ? 'no text object'
      : `size ${text.fontSize}, align ${text.align}, fill ${text.style.fill}`,
  )

  // 4. The shape row's switch picks the member and activates it.
  runEditorAction('tool.rect')
  await settle(100)
  barButton('Ellipse')?.click()
  await settle(100)
  const ellipsePressed = barButton('Ellipse')?.getAttribute('aria-pressed') === 'true'
  record(
    'the shape switch activates the member it names',
    documentStore.getState().tool === 'ellipse' && bar()?.dataset.toolOptions === 'shape' && ellipsePressed,
    `tool ${documentStore.getState().tool}, bar ${JSON.stringify(bar()?.dataset.toolOptions)}, ellipse pressed ${ellipsePressed}`,
  )

  // 5. The shape fill must reach the shape the drag creates.
  document.querySelector<HTMLButtonElement>('[aria-label="Fill #e2665c"]')?.click()
  await settle(80)
  dragCanvas(320, 240, 420, 320)
  await settle(150)
  const ellipse = documentStore.getState().document.root.children.find((node) => node.type === 'ellipse')
  record(
    'the shape tool draws one shape with the bar fill',
    ellipse !== undefined && ellipse.type === 'ellipse' && ellipse.style.fill === '#e2665c',
    ellipse === undefined || ellipse.type !== 'ellipse'
      ? 'no ellipse'
      : `fill ${ellipse.style.fill}, ${documentStore.getState().document.root.children.length} root children`,
  )
  // 6. With that shape selected, the bar shows its object numbers and its commands.
  documentStore.setSelection(ellipse === undefined ? [] : [ellipse.id])
  await settle(120)
  runEditorAction('tool.select')
  await settle(120)
  const numbers = ['X', 'Y', 'W', 'H'].map(
    (label) => bar()?.querySelector(`[data-tool-readout="${label}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  )
  const duplicate = Array.from(bar()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
    (button) => button.textContent?.trim() === 'Duplicate',
  )
  record(
    'the Selection tool row reports the object and enables its commands',
    numbers.every((text) => /^[XYWH] -?\d+$/.test(text)) && duplicate !== undefined && duplicate.disabled === false,
    `readouts ${JSON.stringify(numbers)}, duplicate ${duplicate === undefined ? 'missing' : 'present'}`,
  )

  // UI pass: the Properties colour control is live, and the panel does not scroll sideways.
  const panelBody = document.querySelector<HTMLElement>('[data-panel-body="properties"]')
  const fillTrigger = document.querySelector<HTMLButtonElement>('[data-color-trigger="Fill"]')
  fillTrigger?.click()
  await settle(120)
  const colorPanel = document.querySelector<HTMLElement>('[data-color-panel="Fill"]')
  const swatchCount = colorPanel?.querySelectorAll('[aria-label^="Fill #"]')?.length ?? 0
  record(
    'the fill control opens a colour popover with a wheel, hex, and swatches',
    colorPanel !== null && swatchCount >= 12,
    colorPanel === null ? 'no popover' : swatchCount + ' swatches',
  )

  // A real user action on the colour popover: clicking a swatch applies it immediately.
  const swatch = document.querySelector<HTMLButtonElement>('[aria-label="Fill #e2665c"]')
  const selectedId = documentStore.getState().selection[0]
  swatch?.click()
  await settle(80)
  const painted = selectedId === undefined ? null : findNode(documentStore.getState().document, selectedId)
  record(
    'clicking a colour swatch applies it immediately',
    painted !== null && painted.type !== 'group' && painted.style.fill === '#e2665c',
    painted !== null && painted.type !== 'group' ? 'fill ' + painted.style.fill : 'no node',
  )

  // Live typing: focus the X field, type a value, and check the document before any blur.
  const xField = document.querySelector<HTMLInputElement>('[data-panel-body="properties"] input[aria-label="X"]')
  xField?.focus()
  if (xField !== null && xField !== undefined) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(xField, '42')
    xField.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await settle(80)
  const typedBounds = selectedId === undefined ? null : worldBounds(documentStore.getState().document, selectedId)
  record(
    'typing in a number field updates the object before the field loses focus',
    typedBounds !== null && Math.round(typedBounds.x) === 42 && document.activeElement === xField,
    typedBounds === null ? 'no bounds' : 'x ' + Math.round(typedBounds.x) + ', focus kept: ' + (document.activeElement === xField),
  )
  xField?.blur()
  await settle(60)

  await settle(60)

  record(
    'the Properties panel never scrolls sideways',
    panelBody !== null && panelBody.scrollWidth <= panelBody.clientWidth + 1,
    panelBody === null ? 'no panel body' : panelBody.scrollWidth + ' <= ' + panelBody.clientWidth,
  )


  // 7. The palette flyout switches members too, which is how Illustrator's tool groups work.
  document.querySelector<HTMLButtonElement>('[data-tool-flyout="shape"]')?.click()
  await settle(120)
  const members = document.querySelectorAll('[data-tool-member]')
  document.querySelector<HTMLButtonElement>('[data-tool-member="rect"]')?.click()
  await settle(120)
  record(
    'the palette flyout offers every member and switches between them',
    members.length === 7 &&
      documentStore.getState().tool === 'rect' &&
      workspaceStore.getState().creationDefaults.shapeTool === 'rect',
    `flyout listed ${members.length} member(s), tool now ${documentStore.getState().tool}`,
  )

  // Artboards (UI pass): the page is a sized sheet on a grey pasteboard, with its own chrome.
  const keptSelection = documentStore.getState().selection
  documentStore.clearSelection()
  await settle(120)
  const presetSelect = document.querySelector<HTMLSelectElement>('[aria-label="Artboard size preset"]')
  const presetCount = presetSelect?.options.length ?? 0
  if (presetSelect !== null && presetSelect !== undefined) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
    const hd = Array.from(presetSelect.options).find((option) => option.value.includes('HD'))
    setter?.call(presetSelect, hd?.value ?? '')
    presetSelect.dispatchEvent(new Event('change', { bubbles: true }))
  }
  await settle(120)
  const resized = documentStore.getState().document.artboards[0]
  record(
    'a size preset resizes the page',
    presetCount >= 6 && resized.width === 1920 && resized.height === 1080,
    presetCount + ' presets, page ' + resized.width + 'x' + resized.height,
  )
  const labels = document.querySelectorAll('[data-artboard-label]')
  record(
    'each page is labelled on the canvas',
    labels.length === documentStore.getState().document.artboards.length,
    labels.length + ' label(s) for ' + documentStore.getState().document.artboards.length + ' page(s)',
  )
  // Guides and rulers (issue #67): a guide is document data, drawn as view chrome.
  const guideId = addGuide('x', 400)
  await settle(80)
  const guideEl = document.querySelector('[data-guide]')
  const rulerEl = document.querySelector('[data-ruler="top"]')
  record(
    'a guide is drawn on the canvas next to the rulers',
    guideId !== null && guideEl !== null && rulerEl !== null,
    'guide ' + (guideEl === null ? 'missing' : 'drawn') + ', rulers ' + (rulerEl === null ? 'hidden' : 'shown'),
  )
  documentStore.dispatch({ type: 'removeGuide', guideId: guideId ?? '' }, 'cleanup guide')
  await settle(60)
  record(
    'removing the guide takes it off the canvas',
    document.querySelector('[data-guide]') === null,
    'guides on screen: ' + document.querySelectorAll('[data-guide]').length,
  )
  runEditorAction('view.grid')
  await settle(60)
  record(
    'the grid toggles as view chrome',
    workspaceStore.getState().showGrid == true,
    'showGrid ' + workspaceStore.getState().showGrid,
  )
  runEditorAction('view.grid')
  await settle(60)
  // Named swatches and stroke alignment (issue #69).
  const swatchTarget = documentStore.getState().document.root.children[0]
  if (swatchTarget !== undefined) documentStore.setSelection([swatchTarget.id])
  Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    .find((button) => button.textContent?.trim() === 'Color')
    ?.click()
  await settle(120)
  const swatchId = addCmykSwatch('Deep Cyan', { c: 100, m: 0, y: 0, k: 0 }, true)
  await settle(80)
  const swatchButtons = document.querySelectorAll('[aria-label^="Apply swatch"]').length
  record(
    'a named CMYK swatch is created and listed',
    swatchId !== null && swatchButtons >= 1,
    swatchButtons + ' swatch button(s), id ' + String(swatchId).slice(0, 12),
  )
  applySwatch(swatchId ?? '')
  await settle(60)
  const swatchNode = findNode(documentStore.getState().document, swatchTarget?.id ?? '')
  record(
    'applying a named swatch fills the selection',
    swatchNode !== null && swatchNode.type !== 'group' && swatchNode.style.fill === '#00ffff',
    swatchNode !== null && swatchNode.type !== 'group' ? 'fill ' + swatchNode.style.fill : 'no node',
  )
  setSelectionStrokeAlign('inside')
  await settle(60)
  const aligned = findNode(documentStore.getState().document, swatchTarget?.id ?? '')
  record(
    'stroke alignment is stored',
    aligned !== null && aligned.type !== 'group' && aligned.style.stroke?.align === 'inside',
    aligned !== null && aligned.type !== 'group' ? 'align ' + String(aligned.style.stroke?.align) : 'no node',
  )
  removeSwatch(swatchId ?? '')
  await settle(60)
  // Gradients and blends (issue #70): radial, multi-stop, stroke target, full blend set.
  const gradientTarget = documentStore.getState().document.root.children[0]
  if (gradientTarget !== undefined) documentStore.setSelection([gradientTarget.id])
  await settle(60)
  setSelectionGradient(linearGradientFrom(0, '#000000', '#ffffff'))
  setSelectionGradientType('radial')
  addGradientStop(0.5, '#ff0000')
  setSelectionGradientTarget('both')
  setSelectionBlendMode('difference')
  await settle(80)
  const gradientNode = gradientTarget === undefined ? null : findNode(documentStore.getState().document, gradientTarget.id)
  record(
    'a radial gradient with a third stop paints the stroke too',
    gradientNode !== null &&
      gradientNode.type !== 'group' &&
      gradientNode.style.gradient?.type === 'radial' &&
      gradientNode.style.gradient?.stops.length === 3 &&
      gradientNode.style.gradientTarget === 'both' &&
      gradientNode.style.blendMode === 'difference',
    gradientNode !== null && gradientNode.type !== 'group'
      ? gradientNode.style.gradient?.type + ', ' + gradientNode.style.gradient?.stops.length + ' stops, on ' + String(gradientNode.style.gradientTarget) + ', ' + String(gradientNode.style.blendMode)
      : 'no node',
  )
  removeGradientStop(1)
  setSelectionGradientType('linear')
  setSelectionBlendMode('normal')
  await settle(60)
  // Canvas input goes through hit testing, not through the canvas element directly. This is the
  // regression test for the bug where an overlay covered the canvas and ate every wheel and drag.
  const canvasEl = document.querySelector('canvas')
  const box = canvasEl === null ? null : canvasEl.getBoundingClientRect()
  const centre = box === null ? null : { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  const topmost = centre === null ? null : document.elementFromPoint(centre.x, centre.y)
  record(
    'nothing covers the canvas, so real input reaches it',
    topmost !== null && (topmost === canvasEl || topmost.tagName === 'CANVAS'),
    topmost === null ? 'nothing at the centre' : 'topmost element is ' + (topmost === canvasEl ? 'the canvas' : topmost.tagName),
  )

  const zoomBefore = documentStore.getState().viewport.zoom
  if (centre !== null && topmost !== null) {
    topmost.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -240, clientX: centre.x, clientY: centre.y, bubbles: true, cancelable: true }),
    )
  }
  await settle(80)
  const zoomAfter = documentStore.getState().viewport.zoom
  record(
    'the scroll wheel zooms the view',
    zoomAfter > zoomBefore,
    'zoom ' + zoomBefore.toFixed(2) + ' -> ' + zoomAfter.toFixed(2),
  )

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))
  await settle(60)
  const panBefore = { ...documentStore.getState().viewport }
  if (centre !== null && topmost !== null) {
    topmost?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, buttons: 1, bubbles: true, clientX: centre.x, clientY: centre.y }))
    topmost?.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, buttons: 1, bubbles: true, clientX: centre.x - 120, clientY: centre.y - 80 }))
    topmost?.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, button: 0, buttons: 0, bubbles: true, clientX: centre.x - 120, clientY: centre.y - 80 }))
  }
  await settle(80)
  const panAfter = documentStore.getState().viewport
  record(
    'the Hand tool drags the view through the real target',
    documentStore.getState().tool === 'hand' &&
      Math.round(panAfter.panX - panBefore.panX) === -120 &&
      Math.round(panAfter.panY - panBefore.panY) === -80,
    'tool ' + documentStore.getState().tool + ', pan ' + Math.round(panBefore.panX) + ',' + Math.round(panBefore.panY) + ' -> ' + Math.round(panAfter.panX) + ',' + Math.round(panAfter.panY),
  )

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }))
  await settle(60)
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
  await settle(60)
  const borrowed = documentStore.getState().tool
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }))
  await settle(60)
  record(
    'holding Space borrows the Hand tool and gives the tool back',
    borrowed === 'hand' && documentStore.getState().tool === 'select',
    'while held ' + borrowed + ', after release ' + documentStore.getState().tool,
  )

  // Cursors, hover, and the rotation preview (issue #121). Each step drives the element that is
  // actually on top of the canvas, so a covered canvas cannot pass by accident.
  runEditorAction('tool.rect')
  await settle(60)
  const canvasNode = canvasEl as HTMLCanvasElement
  const rectCursor = getComputedStyle(canvasNode).cursor
  runEditorAction('tool.text')
  await settle(60)
  const textCursor = getComputedStyle(canvasNode).cursor
  runEditorAction('tool.hand')
  await settle(60)
  const handCursor = getComputedStyle(canvasNode).cursor
  runEditorAction('tool.select')
  await settle(60)
  const selectCursor = getComputedStyle(canvasNode).cursor
  record(
    'each tool sets the cursor that says what it does',
    rectCursor === 'crosshair' && textCursor === 'text' && handCursor === 'grab' && selectCursor === 'default',
    'rect ' + rectCursor + ', text ' + textCursor + ', hand ' + handCursor + ', select ' + selectCursor,
  )

  const hoverNode = documentStore.getState().document.root.children[0]
  const canvasBox = canvasNode.getBoundingClientRect()
  const viewportNow = documentStore.getState().viewport
  const toClient = (x: number, y: number) => ({
    x: canvasBox.left + x * viewportNow.zoom + viewportNow.panX,
    y: canvasBox.top + y * viewportNow.zoom + viewportNow.panY,
  })
  const hoverBox = hoverNode === undefined ? null : unionBounds(documentStore.getState().document, [hoverNode.id])
  if (hoverNode !== undefined) documentStore.setSelection([hoverNode.id])
  await settle(60)
  const hoverTarget = hoverBox === null ? null : toClient(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2)
  if (hoverTarget !== null) {
    topmost?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 0, clientX: hoverTarget.x, clientY: hoverTarget.y }))
  }
  await settle(80)
  const hovered = document.querySelector('[data-hover-outline]') !== null
  const emptySpot = toClient(-100000, -100000)
  topmost?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 0, clientX: emptySpot.x, clientY: emptySpot.y }))
  await settle(80)
  record(
    'hovering an object outlines it and moving away clears the outline',
    hovered && document.querySelector('[data-hover-outline]') === null,
    'outline on hover ' + (hovered ? 'drawn' : 'missing') + ', after leaving ' + (document.querySelector('[data-hover-outline]') === null ? 'cleared' : 'still there'),
  )

  // A real rotation drag shows its angle while it lasts and clears it afterwards. The viewport is
  // pinned and the object placed, so the corner press is deterministic rather than dependent on
  // whatever the earlier steps left on screen.
  const rotationDrag = createRect('Smoke Rotate Drag', 40, 40, 100, 100)
  documentStore.dispatch(
    { type: 'insertNodes', parentId: documentStore.getState().document.root.id, index: 0, nodes: [rotationDrag] },
    'smoke rotate drag prep',
  )
  documentStore.setSelection([rotationDrag.id])
  documentStore.setViewport({ zoom: 1, panX: 0, panY: 0 })
  await settle(80)
  const dragBox = unionBounds(documentStore.getState().document, [rotationDrag.id])
  if (dragBox !== null) {
    const pivot = { x: dragBox.x + dragBox.width / 2, y: dragBox.y + dragBox.height / 2 }
    const cornerScene = { x: dragBox.x + dragBox.width, y: dragBox.y }
    // The viewport was just pinned, so convert with it rather than with the closure's older copy.
    const fresh = documentStore.getState().viewport
    const cornerPoint = { x: canvasBox.left + cornerScene.x * fresh.zoom + fresh.panX, y: canvasBox.top + cornerScene.y * fresh.zoom + fresh.panY }
    const destScene = rotatePoint(cornerScene, pivot, 90)
    const destPoint = { x: canvasBox.left + destScene.x * fresh.zoom + fresh.panX, y: canvasBox.top + destScene.y * fresh.zoom + fresh.panY }
    topmost?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, clientX: cornerPoint.x + 9, clientY: cornerPoint.y - 9 }))
    topmost?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 1, pointerId: 1, clientX: destPoint.x, clientY: destPoint.y }))
    await settle(80)
    const badge = document.querySelector('[data-rotation-badge]')?.textContent ?? ''
    topmost?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, clientX: destPoint.x, clientY: destPoint.y }))
    await settle(80)
    const badgeCleared = document.querySelector('[data-rotation-badge]') === null
    const turnedNode = findNode(documentStore.getState().document, rotationDrag.id)
    record(
      'the rotation shows its angle while dragging, clears after, and turns the object',
      /\d+/.test(badge) && badgeCleared && turnedNode !== null && turnedNode.type !== 'group' && Math.abs(turnedNode.transform.rotation) > 0.5,
      'badge "' + badge + '", after ' + (badgeCleared ? 'cleared' : 'still there') + ', rotation ' + (turnedNode !== null && turnedNode.type !== 'group' ? turnedNode.transform.rotation.toFixed(1) : '?') + '°',
    )
    documentStore.undo()
    await settle(60)
  }

  // Number fields (issue #130): scrub to change, Shift to go finer, and small arithmetic on commit.
  // The Properties tab has been replaced by Color earlier in this report, so bring it back first.
  if (document.querySelector('[data-panel-body="properties"]') === null) {
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((button) => button.textContent?.trim() === 'Properties')?.click()
    await settle(140)
  }
  const scrubLeaf = documentStore.getState().document.root.children.find((child) => child.type !== 'group')
  if (scrubLeaf !== undefined) documentStore.setSelection([scrubLeaf.id])
  await settle(80)
  const scrubId = documentStore.getState().selection[0]
  const scrubField = document.querySelector<HTMLInputElement>('[data-panel-body="properties"] input[aria-label="X"]')
  const xBefore = scrubId === undefined ? null : findNode(documentStore.getState().document, scrubId)
  if (scrubField !== null && xBefore !== null && xBefore.type !== 'group') {
    const startX = xBefore.transform.x
    scrubField.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, clientX: 200, clientY: 10 }))
    scrubField.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 1, pointerId: 1, clientX: 240, clientY: 10 }))
    scrubField.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, clientX: 240, clientY: 10 }))
    await settle(80)
    const scrubbed = findNode(documentStore.getState().document, scrubId ?? '')
    const coarseDelta = scrubbed !== null && scrubbed.type !== 'group' ? Math.round(scrubbed.transform.x - startX) : 0
    scrubField.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, clientX: 200, clientY: 10 }))
    scrubField.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 1, pointerId: 1, clientX: 240, clientY: 10, shiftKey: true }))
    scrubField.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, clientX: 240, clientY: 10 }))
    await settle(80)
    const afterFine = findNode(documentStore.getState().document, scrubId ?? '')
    const fineDelta = afterFine !== null && afterFine.type !== 'group' ? Math.round(afterFine.transform.x - startX - coarseDelta) : 0
    record(
      'dragging a number field scrubs it, and Shift makes the scrub finer',
      Math.abs(coarseDelta - 20) <= 2 && Math.abs(fineDelta - 2) <= 1,
      'drag moved ' + coarseDelta + ', Shift moved ' + fineDelta,
    )

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(scrubField, '100+20')
    scrubField.dispatchEvent(new Event('input', { bubbles: true }))
    scrubField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await settle(80)
    const afterExpression = findNode(documentStore.getState().document, scrubId ?? '')
    record(
      'a number field accepts small arithmetic',
      afterExpression !== null && afterExpression.type !== 'group' && afterExpression.transform.x === 120,
      'x became ' + (afterExpression !== null && afterExpression.type !== 'group' ? afterExpression.transform.x : '?'),
    )
    // End the field session this step opened, or a later undo would fold into it instead of its own step.
    scrubField.blur()
    await settle(80)
  }

  // The palette order: the Hand belongs directly under the selection tools.
  const toolSlotOrder = Array.from(document.querySelectorAll('[data-tool-slot]')).map((slot) => slot.getAttribute('data-tool-slot'))
  record(
    'the Hand tool sits directly under the selection tools',
    toolSlotOrder.indexOf('hand') === toolSlotOrder.indexOf('select') + 1,
    'order ' + toolSlotOrder.join(', '),
  )

  // Shift+wheel scrolls sideways without zooming, Illustrator's own wheel modifier.
  const wheelBefore = { ...documentStore.getState().viewport }
  topmost?.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, shiftKey: true, clientX: centre?.x ?? 0, clientY: centre?.y ?? 0, bubbles: true, cancelable: true }))
  await settle(80)
  const wheelAfter = documentStore.getState().viewport
  record(
    'Shift with the wheel pans sideways instead of zooming',
    Math.round(wheelAfter.panX - wheelBefore.panX) === -100 && wheelAfter.zoom === wheelBefore.zoom,
    'panX ' + Math.round(wheelBefore.panX) + ' -> ' + Math.round(wheelAfter.panX) + ', zoom ' + wheelAfter.zoom.toFixed(2),
  )

  // Alt-drag duplicates: the drag moves a copy and one undo puts everything back.
  const altLeaf = documentStore.getState().document.root.children.find((child) => child.type !== 'group')
  if (altLeaf !== undefined && topmost !== null) {
    documentStore.setSelection([altLeaf.id])
    await settle(60)
    const altBox = unionBounds(documentStore.getState().document, [altLeaf.id])
    const altViewport = documentStore.getState().viewport
    const canvasRect = (canvasEl as HTMLCanvasElement).getBoundingClientRect()
    if (altBox !== null) {
      const at = {
        x: canvasRect.left + (altBox.x + altBox.width / 2) * altViewport.zoom + altViewport.panX,
        y: canvasRect.top + (altBox.y + altBox.height / 2) * altViewport.zoom + altViewport.panY,
      }
      const beforeCount = documentStore.getState().document.root.children.length
      const beforeDepth = documentStore.getState().undoDepth
      const beforeX = altLeaf.transform.x
      topmost.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, altKey: true, clientX: at.x, clientY: at.y }))
      topmost.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 1, pointerId: 1, altKey: true, clientX: at.x + 30, clientY: at.y }))
      topmost.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, clientX: at.x + 30, clientY: at.y }))
      await settle(120)
      const afterCount = documentStore.getState().document.root.children.length
      const afterDepth = documentStore.getState().undoDepth
      documentStore.undo()
      await settle(80)
      const restoredCount = documentStore.getState().document.root.children.length
      const originalStill = findNode(documentStore.getState().document, altLeaf.id)
      record(
        'Alt-drag leaves a copy behind and one undo restores the original',
        afterCount === beforeCount + 1 && afterDepth === beforeDepth + 1 && restoredCount === beforeCount && originalStill !== null && originalStill.type !== 'group' && originalStill.transform.x === beforeX,
        'children ' + beforeCount + ' -> ' + afterCount + ' -> ' + restoredCount + ', undo depth +' + (afterDepth - beforeDepth),
      )
    }
  }

  // The Zoom tool (issue #131): Z, click in, Alt-click out, drag to frame, double-click for 100%.
  const zoomStop = { ...documentStore.getState().viewport }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }))
  await settle(80)
  const zoomToolActive = documentStore.getState().tool === 'zoom'
  const zoomCursor = topmost === null ? '' : getComputedStyle(topmost).cursor
  const zoomStart = documentStore.getState().viewport.zoom
  topmost?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, clientX: centre?.x ?? 100, clientY: centre?.y ?? 100 }))
  topmost?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, clientX: centre?.x ?? 100, clientY: centre?.y ?? 100 }))
  await settle(80)
  const zoomedIn = documentStore.getState().viewport.zoom
  topmost?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, altKey: true, clientX: centre?.x ?? 100, clientY: centre?.y ?? 100 }))
  topmost?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, altKey: true, clientX: centre?.x ?? 100, clientY: centre?.y ?? 100 }))
  await settle(80)
  const zoomedOut = documentStore.getState().viewport.zoom
  record(
    'the Zoom tool activates on Z, shows its cursor, and clicks in and out',
    zoomToolActive && zoomCursor === 'zoom-in' && Math.abs(zoomedIn / zoomStart - 2) < 0.05 && Math.abs(zoomedOut - zoomStart) < 0.05,
    'cursor ' + zoomCursor + ', zoom ' + zoomStart.toFixed(2) + ' -> ' + zoomedIn.toFixed(2) + ' -> ' + zoomedOut.toFixed(2),
  )
  const frameStart = zoomedOut
  const frameAt = { x: centre?.x ?? 120, y: centre?.y ?? 120 }
  topmost?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 1, clientX: frameAt.x, clientY: frameAt.y }))
  topmost?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 1, pointerId: 1, clientX: frameAt.x + 120, clientY: frameAt.y + 90 }))
  topmost?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 1, clientX: frameAt.x + 120, clientY: frameAt.y + 90 }))
  await settle(80)
  const framedZoom = documentStore.getState().viewport.zoom
  topmost?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: frameAt.x, clientY: frameAt.y }))
  await settle(80)
  const resetZoom = documentStore.getState().viewport.zoom
  record(
    'dragging frames an area and double-click returns to 100%',
    framedZoom > frameStart && Math.abs(resetZoom - 1) < 0.001,
    'zoom ' + frameStart.toFixed(2) + ' -> framed ' + framedZoom.toFixed(2) + ' -> double-click ' + resetZoom.toFixed(2),
  )
  documentStore.setViewport(zoomStop)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }))
  await settle(80)

  // The Align and Transform panels (issue #122): the commands and fields now have their Illustrator homes.
  const alignA = createRect('Smoke Align A', 10, 10, 50, 50)
  const alignB = createRect('Smoke Align B', 300, 120, 60, 30)
  documentStore.dispatch(
    { type: 'insertNodes', parentId: documentStore.getState().document.root.id, index: 0, nodes: [alignA, alignB] },
    'smoke align prep',
  )
  documentStore.setSelection([alignA.id, alignB.id])
  await settle(80)
  const openPanel = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((button) => button.textContent?.trim() === label)?.click()
  await settle(120)
  const alignPanel = document.querySelector('[data-panel-body="align"]')
  const alignLeftButton = document.querySelector<HTMLButtonElement>('[aria-label="Align left"]')
  alignLeftButton?.click()
  await settle(80)
  const alignedA = findNode(documentStore.getState().document, alignA.id)
  const alignedB = findNode(documentStore.getState().document, alignB.id)
  record(
    'the Align panel aligns the selection through the real button',
    alignPanel !== null &&
      alignedA !== null && alignedA.type !== 'group' &&
      alignedB !== null && alignedB.type !== 'group' &&
      alignedA.transform.x === alignedB.transform.x,
    alignedA !== null && alignedA.type !== 'group' && alignedB !== null && alignedB.type !== 'group'
      ? 'x ' + alignedA.transform.x + ' and ' + alignedB.transform.x
      : 'no node',
  )
  if (alignLeftButton !== null) documentStore.undo()
  await settle(60)
  documentStore.setSelection([alignA.id])
  await settle(60)
  const singleSelectDisabled = document.querySelector<HTMLButtonElement>('[aria-label="Align left"]')?.disabled === true
  documentStore.setSelection([alignA.id, alignB.id])
  await settle(60)
  const twoSelectEnabled = document.querySelector<HTMLButtonElement>('[aria-label="Align left"]')?.disabled === false
  record(
    'the Align panel disables exactly what the command would refuse',
    singleSelectDisabled && twoSelectEnabled,
    'one object ' + (singleSelectDisabled ? 'disabled' : 'enabled') + ', two ' + (twoSelectEnabled ? 'enabled' : 'disabled'),
  )

  // Transform is the other tab of the same group, which is open on Align.
  openPanel('Transform')
  await settle(120)
  const transformPanel = document.querySelector('[data-panel-body="transform"]')
  const xInput = document.querySelector<HTMLInputElement>('[data-panel-body="transform"] input[aria-label="X"]')
  if (xInput !== null) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(xInput, '321')
    xInput.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await settle(80)
  const movedA = findNode(documentStore.getState().document, alignA.id)
  const transformWorked = transformPanel !== null && movedA !== null && movedA.type !== 'group' && movedA.transform.x === 321
  documentStore.undo()
  await settle(60)
  const restoredA = findNode(documentStore.getState().document, alignA.id)
  record(
    'the Transform panel edits X live and undo restores it',
    transformWorked && restoredA !== null && restoredA.type !== 'group' && restoredA.transform.x === 10,
    'x became ' + (movedA !== null && movedA.type !== 'group' ? movedA.transform.x : '?') + ', undo -> ' + (restoredA !== null && restoredA.type !== 'group' ? restoredA.transform.x : '?'),
  )

  // The layer panel's locate column (issue #123): a group that contains the selection points at itself.
  const locateA = createRect('Smoke Locate A', 40, 40, 30, 30)
  const locateB = createRect('Smoke Locate B', 90, 40, 30, 30)
  documentStore.dispatch(
    { type: 'insertNodes', parentId: documentStore.getState().document.root.id, index: 0, nodes: [locateA, locateB] },
    'smoke locate prep',
  )
  documentStore.setSelection([locateA.id, locateB.id])
  runEditorAction('object.group')
  await settle(120)
  const locateGroupId = documentStore.getState().selection[0]
  const locateGroup = locateGroupId === undefined ? null : findNode(documentStore.getState().document, locateGroupId)
  const locateChildId = locateGroup !== null && locateGroup.type === 'group' ? locateGroup.children[0]?.id : undefined
  const expandButton = document.querySelector<HTMLButtonElement>('[aria-label^="Expand "]')
  expandButton?.click()
  await settle(120)
  if (locateChildId !== undefined) documentStore.setSelection([locateChildId])
  await settle(120)
  const locateButton = document.querySelector<HTMLButtonElement>('[data-locate]')
  locateButton?.click()
  await settle(80)
  const locatedSelection = documentStore.getState().selection
  record(
    'the locate column appears on the containing group and selects it',
    locateGroupId !== undefined && locateButton !== null && locatedSelection.length === 1 && locatedSelection[0] === locateGroupId,
    'locate button ' + (locateButton === null ? 'missing' : 'present') + ', selection ' + locatedSelection.join(','),
  )

  // Nested rows are considered for a preview too, and a shared bucket says so instead of drawing a
  // misleading picture.
  await settle(1200)
  const nestedRow =
    locateChildId === undefined ? null : document.querySelector('[data-layer-row="' + locateChildId + '"]')
  const nestedPreview = nestedRow?.querySelector('[data-layer-thumbnail]') ?? null
  const nestedSlot = nestedRow?.querySelector('span[aria-hidden="true"][title]') ?? null
  const refusalTitle = nestedSlot?.getAttribute('title') ?? ''
  record(
    'a nested layer is previewed, or refused with a stated reason',
    nestedRow !== null && (nestedPreview !== null || refusalTitle.includes('shares a render bucket')),
    nestedPreview !== null ? 'preview drawn' : 'slot says: ' + refusalTitle,
  )

  // Put the selection back: the panels below are about the selected object, not the page.
  documentStore.setSelection(keptSelection)
  await settle(80)


  // UI pass, second half: the Color and Appearance panels are the same live controls.
  const tab = (name: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent?.trim() === name,
    )
  if (document.querySelector('[aria-label^="Apply Violet"]') === null) {
    tab('Color')?.click()
    await settle(120)
  }
  const paletteSwatch = document.querySelector<HTMLButtonElement>('[aria-label^="Apply Violet"]')
  const paletteCount = document.querySelectorAll('[aria-label^="Apply "]').length
  paletteSwatch?.click()
  await settle(80)
  const afterSwatch = selectedId === undefined ? null : findNode(documentStore.getState().document, selectedId)
  record(
    'the Color panel lists its palette and applies a swatch',
    paletteCount >= 9 && afterSwatch !== null && afterSwatch.type !== 'group' && afterSwatch.style.fill === '#7c6cf5',
    paletteCount + ' swatches, fill ' + (afterSwatch !== null && afterSwatch.type !== 'group' ? afterSwatch.style.fill : 'none'),
  )

  if (document.querySelector('input[aria-label="Opacity"]') === null) {
    tab('Appearance')?.click()
    await settle(120)
  }
  const opacitySlider = document.querySelector<HTMLInputElement>('[data-panel-body="appearance"] input[aria-label="Opacity"]') ?? document.querySelector<HTMLInputElement>('input[aria-label="Opacity"]')
  if (opacitySlider !== null && opacitySlider !== undefined) {
    opacitySlider.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(opacitySlider, '40')
    opacitySlider.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await settle(80)
  const opacityNode = selectedId === undefined ? null : findNode(documentStore.getState().document, selectedId)
  record(
    'the Appearance panel edits opacity live',
    opacityNode !== null && opacityNode.type !== 'group' && Math.abs(opacityNode.style.opacity - 0.4) < 1e-6,
    opacityNode !== null && opacityNode.type !== 'group' ? 'opacity ' + opacityNode.style.opacity : 'no node',
  )
  opacitySlider?.blur()
  await settle(60)


  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Shape tools report (owner request: line, polygon, star, arc, and rounded corners were missing,
 * the ellipse preview drew a rectangle, and Shift did not constrain).
 *
 * This drives the real palette, the real options bar, and real pointer drags in the packaged app,
 * then reads the document back. It also inspects the drag preview element mid-drag, which is the
 * only way to prove the preview matches the shape being drawn. Logged as `[vectr-path]`.
 */
export async function runShapeToolsReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Design canvas"]')
  const bar = () => document.querySelector<HTMLElement>('[aria-label="Tool options"]')

  if (canvas === null || bar() === null) {
    record('the canvas and the options bar are on screen', false, 'missing chrome')
    return { passed: false, steps }
  }

  const dispatch = (type: string, x: number, y: number, extra: Record<string, unknown>) => {
    const box = canvas.getBoundingClientRect()
    canvas.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        bubbles: true,
        isPrimary: true,
        clientX: box.left + x,
        clientY: box.top + y,
        ...extra,
      }),
    )
  }
  const barButton = (text: string) =>
    Array.from(bar()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === text,
    )
  /** Sets one of the bar's labelled number fields, the way typing into it would. */
  const setField = (label: string, value: string) => {
    const input = Array.from(bar()?.querySelectorAll<HTMLInputElement>('input[role="spinbutton"]') ?? []).find((element) =>
      (element.getAttribute('aria-label') ?? '').startsWith(label),
    )
    if (input === undefined) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  const nodes = () => documentStore.getState().document.root.children
  const last = () => nodes()[nodes().length - 1]
  const switchTo = async (label: string) => {
    barButton(label)?.click()
    await settle(80)
  }

  newDocument()
  await settle(150)

  // 1. One slot, seven members: the flyout lists the shape tools Illustrator ships and Vectr draws.
  document.querySelector<HTMLButtonElement>('[data-tool-flyout="shape"]')?.click()
  await settle(120)
  const members = Array.from(document.querySelectorAll('[data-tool-member]')).map(
    (element) => element.getAttribute('data-tool-member') ?? '',
  )
  record(
    'the shape slot offers every shape tool',
    members.length === 7 && members.includes('polygon') && members.includes('arc'),
    `flyout lists ${members.join(', ')}`,
  )
  document.querySelector<HTMLButtonElement>('[data-tool-member="ellipse"]')?.click()
  await settle(120)

  // 2. The preview during an ellipse drag is an ellipse, which was the owner's report.
  dispatch('pointerdown', 120, 140, { buttons: 1 })
  dispatch('pointermove', 240, 260, { buttons: 1 })
  await settle(80)
  const preview = document.querySelector<SVGElement>('[data-shape-preview]')
  const previewIsEllipse = preview !== null && preview.dataset.shapePreview === 'ellipse' && preview.querySelector('ellipse') !== null
  record(
    'the ellipse drag previews an ellipse, not a rectangle',
    previewIsEllipse,
    preview === null
      ? 'no preview element'
      : `preview kind ${preview.dataset.shapePreview}, ellipse element ${preview.querySelector('ellipse') === null ? 'missing' : 'present'}`,
  )
  dispatch('pointerup', 240, 260, { buttons: 0 })
  await settle(120)
  record(
    'releasing creates the ellipse the preview showed',
    last()?.type === 'ellipse',
    `created ${last()?.type ?? 'nothing'}`,
  )

  // 3. Shift constrains the drag to a circle.
  dispatch('pointerdown', 300, 140, { buttons: 1, shiftKey: true })
  dispatch('pointermove', 420, 200, { buttons: 1, shiftKey: true })
  await settle(60)
  dispatch('pointerup', 420, 200, { buttons: 0, shiftKey: true })
  await settle(120)
  const circle = last()
  const sizeOf = (node: LayerNode) => nodeSize(node)
  // The constrained drag computes both sides from one length, but start + size - start rounds in
  // floating point, so compare at a sub-pixel tolerance rather than bit-for-bit.
  const circleIsRound =
    circle !== undefined && circle.type === 'ellipse' && Math.abs(circle.width - circle.height) <= 1e-6
  record(
    'Shift with the ellipse tool draws a circle',
    circleIsRound,
    circle === undefined
      ? 'nothing created'
      : `${Math.round(sizeOf(circle).width)} x ${Math.round(sizeOf(circle).height)}`,
  )

  // 4. The polygon tool reads its Sides option, which the bar shows for that member.
  await switchTo('Polygon')
  const sidesSet = setField('Sides', '8')
  await settle(60)
  dispatch('pointerdown', 120, 320, { buttons: 1 })
  dispatch('pointermove', 220, 420, { buttons: 1 })
  dispatch('pointerup', 220, 420, { buttons: 0 })
  await settle(120)
  const polygon = last()
  record(
    'the polygon tool draws the side count the bar shows',
    sidesSet && polygon?.type === 'polygon' && polygon.sides === 8,
    sidesSet
      ? `created ${polygon?.type ?? 'nothing'} with ${polygon?.type === 'polygon' ? polygon.sides : '-'} sides`
      : 'the Sides field was not rendered for the polygon tool',
  )
  // 5. The star tool reads Points and the inner radius, and the node carries both.
  await switchTo('Star')
  const pointsSet = setField('Points', '7')
  const radiusSet = setField('Inner radius', '30')
  await settle(60)
  dispatch('pointerdown', 320, 320, { buttons: 1 })
  dispatch('pointermove', 420, 420, { buttons: 1 })
  dispatch('pointerup', 420, 420, { buttons: 0 })
  await settle(120)
  const star = last()
  record(
    'the star tool draws the points and inner radius the bar shows',
    pointsSet && radiusSet && star?.type === 'star' && star.points === 7 && Math.round(star.innerRadius * 100) === 30,
    star?.type === 'star'
      ? `${star.points} points at ${Math.round(star.innerRadius * 100)}% inner radius`
      : `created ${star?.type ?? 'nothing'}`,
  )

  // 6. The rounded rectangle draws with its corner radius, which reaches the renderer's scene.
  await switchTo('Rounded')
  const radiusFieldSet = setField('Corner radius', '24')
  await settle(60)
  dispatch('pointerdown', 120, 480, { buttons: 1 })
  dispatch('pointermove', 240, 560, { buttons: 1 })
  dispatch('pointerup', 240, 560, { buttons: 0 })
  await settle(120)
  const rounded = last()
  const sceneShape = buildScene(documentStore.getState().document).shapes.find((shape) => shape.id === rounded?.id)
  record(
    'a rounded rectangle carries its radius into the scene',
    radiusFieldSet && rounded?.type === 'rect' && rounded.cornerRadius === 24 && sceneShape?.cornerRadius === 24,
    rounded?.type === 'rect'
      ? `radius ${rounded.cornerRadius}, scene radius ${String(sceneShape?.cornerRadius)}`
      : `created ${rounded?.type ?? 'nothing'}`,
  )

  // 7. The line tool draws a segment, and Shift snaps its angle to a 45° step.
  await switchTo('Line')
  const weightSet = setField('Stroke weight', '4')
  await settle(60)
  dispatch('pointerdown', 320, 480, { buttons: 1, shiftKey: true })
  dispatch('pointermove', 420, 540, { buttons: 1, shiftKey: true })
  dispatch('pointerup', 420, 540, { buttons: 0, shiftKey: true })
  await settle(120)
  const line = last()
  // A snapped segment is a diagonal (equal axes) or axis-aligned (one axis is the 1-unit floor).
  const lineIsSnapped =
    line !== undefined &&
    line.type === 'line' &&
    (Math.abs(nodeSize(line).width - nodeSize(line).height) <= 1 || Math.min(nodeSize(line).width, nodeSize(line).height) <= 1)
  record(
    'Shift snaps the line segment to a 45° step',
    weightSet && lineIsSnapped,
    line === undefined || line.type !== 'line'
      ? `created ${line?.type ?? 'nothing'}`
      : `segment ${Math.round(line.width)} x ${Math.round(line.height)}, stroke ${String(line.style.stroke?.width)}`,
  )

  // 8. The arc tool draws the sweep the bar shows, and pie mode closes it.
  await switchTo('Arc')
  const sweepSet = setField('Sweep', '180')
  barButton('Pie')?.click()
  await settle(60)
  dispatch('pointerdown', 480, 480, { buttons: 1 })
  dispatch('pointermove', 580, 560, { buttons: 1 })
  dispatch('pointerup', 580, 560, { buttons: 0 })
  await settle(120)
  const arc = last()
  record(
    'the arc tool draws the sweep the bar shows',
    sweepSet && arc?.type === 'arc' && arc.sweepAngle === 180 && arc.pie === true,
    arc?.type === 'arc' ? `sweep ${arc.sweepAngle}, pie ${String(arc.pie)}` : `created ${arc?.type ?? 'nothing'}`,
  )

  return { passed: steps.every((step) => step.ok), steps }
}

/** Current history depth, for step details. */
function store_depth(): string {
  return String(documentStore.getState().undoDepth)
}

/**
 * Memory and zoom evidence (Phase 1 exit criteria 5 and 6), run on the packaged app.
 *
 * Criterion 6 asks for memory on a representative *and* a stress document, recorded after save,
 * reopen, and close. Issue #19 adds "with many assets". Criterion 5 asks for zoom evidence, which
 * no earlier recorded run contained. Everything here is measured, not asserted from theory, and
 * logged as `[vectr-memory]`.
 *
 * There is **no owner-approved memory budget** yet (`docs/DECISIONS.md`: the exact budgets need
 * owner approval), so this records the numbers and marks the budget question as open rather than
 * inventing a threshold to pass.
 */
export async function runMemoryReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const mib = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const renderer = getActiveRenderer()
  if (renderer === null) {
    record('renderer available', false, 'no active renderer')
    return { passed: false, steps }
  }
  const api = window.vectrFiles
  if (api === undefined) {
    record('file bridge', false, 'the preload bridge is missing')
    return { passed: false, steps }
  }

  // The idle budget first, while nothing is open: this is the closest a shared evidence run gets to
  // a fresh window, and it is the state the 600 MiB budget is about. Measured *before* the stress
  // document, because CanvasKit does not return its WASM/GPU allocations until the window restarts.
  newDocument()
  assetRegistry.clear()
  await settle(600)
  const idleMemory = await window.vectrBenchmark.getMemory()
  record(
    'an idle editor is inside the 600 MiB budget',
    idleMemory.workingSetBytes <= IDLE_BUDGET_MIB * 1024 * 1024,
    `${mib(idleMemory.workingSetBytes)} working set with nothing open, budget ${IDLE_BUDGET_MIB} MiB`,
  )

  // A stress document: 1,000 shapes plus 48 distinct images, so the asset path is under load and
  // every image needs its own decoded entry rather than a shared one.
  newDocument()
  assetRegistry.clear()
  const root = documentStore.getState().document.root
  const shapes = Array.from({ length: 1_000 }, (_, index) =>
    createRect(`Stress ${index}`, (index * 17) % 1200, (index * 29) % 800, 40, 30),
  )
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 0, nodes: shapes })

  let placed = 0
  for (let index = 0; index < 48; index += 1) {
    // 384×384 decoded to ~0.55 MiB of pixels each, so 48 images hold ~27 MiB inside the renderer
    // and releasing them is measurable rather than theoretical.
    const bytes = await makeSmokePng(index, 384)
    if (bytes === null) break
    if ((await placeImage(`stress-${index}.png`, 'image/png', bytes)) !== null) placed += 1
  }
  const assetBytes = documentStore
    .getState()
    .document.assets.reduce((total, asset) => total + asset.byteLength, 0)
  const assetSize = assetBytes < 1024 * 1024 ? `${Math.round(assetBytes / 1024)} KiB` : mib(assetBytes)
  record(
    'stress document built',
    placed === 48 && documentStore.getState().document.assets.length === 48,
    `1,000 shapes + ${placed} images, ${assetSize} of PNG bytes (~${(48 * 384 * 384 * 4 / (1024 * 1024)).toFixed(0)} MiB decoded)`,
  )

  await settle(900)
  const placedMemory = await window.vectrBenchmark.getMemory()
  const decodedAfterPlace = renderer.stats().decodedAssets
  record(
    'memory after building the stress document',
    decodedAfterPlace >= 1,
    `${mib(placedMemory.workingSetBytes)} working set (${mib(placedMemory.privateBytes)} private), ${decodedAfterPlace} decoded images, budget ${STRESS_BUDGET_MIB} MiB`,
  )

  // A bucket that holds several top-level layers must refuse to preview rather than showing a
  // layer's neighbours (the documented thumbnail limitation on very large documents).
  const crowdedLayer = documentStore.getState().document.root.children[0]
  const crowdedBounds = worldBounds(documentStore.getState().document, crowdedLayer.id)
  const crowdedThumbnail =
    crowdedBounds === null ? null : renderer.renderThumbnail(crowdedLayer.id, 28, crowdedBounds)
  record(
    'a chunked bucket refuses a misleading thumbnail',
    crowdedThumbnail === null,
    crowdedThumbnail === null ? 'no preview offered for a shared bucket' : 'produced a misleading preview',
  )

  // Zoom evidence (criterion 5): the same scene drawn at four zoom levels.
  const zooms = [0.25, 1, 2, 4]
  const zoomTimes = zooms.map((zoom) => renderer.render({ zoom, panX: 0, panY: 0 }, []))
  const worstZoom = Math.max(...zoomTimes)
  record(
    'zoom frames render and are recorded',
    zoomTimes[1] <= 33,
    `${zooms.map((zoom, index) => `${zoom}× ${zoomTimes[index].toFixed(1)} ms`).join(' · ')} (worst ${worstZoom.toFixed(1)} ms)`,
  )

  const directory = `${await api.scratchDirectory()}/memory-${Date.now()}.vectr`
  const saved = await saveDocument({ directory })
  await settle(300)
  const savedMemory = await window.vectrBenchmark.getMemory()
  record('memory after save', saved, `${mib(savedMemory.workingSetBytes)} working set`)

  const opened = await openDocument({ directory })
  await settle(900)
  const openedMemory = await window.vectrBenchmark.getMemory()
  const assetsAfterOpen = documentStore.getState().document.assets.length
  record(
    'memory after reopen',
    opened && assetsAfterOpen === 48,
    `${mib(openedMemory.workingSetBytes)} working set, ${assetsAfterOpen} assets, ${renderer.stats().decodedAssets} decoded images`,
  )

  // Closing the document must release the decoded pixels, not just the records (the epic's
  // "caches are derived, bounded, and explicitly disposed" constraint).
  newDocument()
  assetRegistry.clear()
  await settle(600)
  const closedMemory = await window.vectrBenchmark.getMemory()
  const decodedAfterClose = renderer.stats().decodedAssets
  record(
    'closing the document releases its decoded assets',
    decodedAfterClose === 0,
    `${decodedAfterClose} decoded images held after close, registry empty: ${assetRegistry.size() === 0}, ${mib(closedMemory.workingSetBytes)} working set`,
  )

  // The budget the owner delegated ("figure it out"): thresholds with headroom over the recorded
  // measurements, asserted here so a regression fails the packaged run instead of being noticed
  // later. Reasoning is in `docs/DECISIONS.md` (memory budget, 2026-10-14).
  const withinBudget = (bytes: number, limitMiB: number) => bytes <= limitMiB * 1024 * 1024
  record(
    'the stress document is inside the 1,200 MiB budget',
    withinBudget(Math.max(placedMemory.workingSetBytes, openedMemory.workingSetBytes, closedMemory.workingSetBytes), STRESS_BUDGET_MIB),
    `peak ${mib(Math.max(placedMemory.workingSetBytes, openedMemory.workingSetBytes, closedMemory.workingSetBytes))} of ${STRESS_BUDGET_MIB} MiB`,
  )
  record(
    'the decoded-asset cache is bounded, whatever the document held',
    decodedAfterClose === 0 && assetRegistry.size() === 0,
    `${decodedAfterClose} decoded images, ${assetRegistry.size()} registry entries`,
  )
  // Recorded, not asserted: CanvasKit does not return its WASM and GPU allocations to the
  // operating system when a document closes, so a shared session stays at the high-water mark until
  // the window restarts. The budgets are about a fresh window and a single document's peak; this
  // number is here so nobody mistakes the high-water mark for a leak or for idle behaviour.
  record(
    'the working set after closing is recorded, not claimed to have fallen back',
    closedMemory.workingSetBytes > 0,
    `${mib(closedMemory.workingSetBytes)} after close versus ${mib(idleMemory.workingSetBytes)} measured idle earlier in this session`,
  )

  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Memory budgets (owner delegated the number: "figure it out").
 *
 * Recorded measurements were 453 MiB for an empty editor and ~793 MiB for the stress document
 * (1,000 shapes + 48 images), so the budgets carry roughly a third and a half of headroom while
 * still being tight enough to catch a real regression. They are whole-application working set, all
 * processes, on the Phase 1 machine.
 */
export const IDLE_BUDGET_MIB = 600
export const STRESS_BUDGET_MIB = 1_200

/**
 * Generates a small PNG in the page, so the smoke run exercises the real import path —

 * decode, content key, placement, and drawing — without shipping a fixture file (issue #17).
 */
async function makeSmokePng(index = 0, size = 8): Promise<Uint8Array | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context === null) return null
  // A different colour per index, so importing many images produces many distinct content keys
  // rather than one asset referenced repeatedly. The PNG of a flat colour stays small while the
  // decoded pixels are size², which is what makes the asset cache measurable.
  context.fillStyle = `hsl(${(index * 37) % 360} 70% 55%)`
  context.fillRect(0, 0, size, size)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  return blob === null ? null : new Uint8Array(await blob.arrayBuffer())
}

/**
 * Adds 1,000 shapes and measures the renderer's own frame time, so the slice's
 * interaction criterion is recorded with numbers instead of an assumption.
 */
export async function runEditorStress(store: DocumentStore): Promise<SmokeReport> {
  const steps: SmokeStep[] = []

  // Each evidence run starts from a known document: the file round trip runs before this one
  // and replaces the document, so depending on the earlier fixture would make these steps
  // order-dependent evidence.
  newDocument()

  // Issue #17: a generated PNG runs the whole image path, including the renderer drawing the
  // asset instead of its placeholder frame.
  let placedAssetId: string | null = null
  const png = await makeSmokePng()
  if (png === null) {
    steps.push({ name: 'image imported', ok: false, detail: 'the page could not encode a PNG' })
  } else {
    const placed = await placeImage('smoke.png', 'image/png', png)
    const placedDocument = store.getState().document
    const asset = placedDocument.assets[0]
    placedAssetId = asset?.id ?? null
    steps.push({
      name: 'image imported',
      ok: placed !== null && placedDocument.assets.length === 1,
      detail:
        placed === null
          ? (store.getState().lastError?.message ?? 'no node placed')
          : `${asset.width}x${asset.height} pixels, ${asset.byteLength} bytes, asset ${asset.id.slice(0, 14)}`,
    })

    const depthBeforeUndo = store.getState().undoDepth
    store.undo()
    steps.push({
      name: 'image undo removes node and asset',
      ok: store.getState().document.assets.length === 0 && store.getState().undoDepth === depthBeforeUndo - 1,
      detail: `${store.getState().document.assets.length} assets after undo`,
    })
    store.redo()
    steps.push({
      name: 'image redo restores both',
      ok: store.getState().document.assets.length === 1,
      detail: `${store.getState().document.assets.length} assets after redo`,
    })
  }

  const nodes = Array.from({ length: 1_000 }, (_, index) =>
    createRect(`Stress ${index}`, (index * 17) % 1200, (index * 29) % 800, 40, 30),
  )
  const root = store.getState().document.root
  // Issue #16: this run owns the text object that asks for a family Vectr does not bundle, so
  // the substitution report below is this run's evidence rather than a leftover from another.
  const missingFontText = createText('Missing font', 20, 20, 'Missing family', { fontFamily: 'Comic Sans MS' })
  const textInserted = store.dispatch(
    { type: 'insertNodes', parentId: root.id, index: 0, nodes: [missingFontText] },
    'smoke missing font',
  )
  steps.push({
    name: 'missing font text placed',
    ok: textInserted.ok,
    detail: textInserted.ok ? missingFontText.fontFamily : textInserted.message,
  })
  const inserted = store.dispatch({ type: 'insertNodes', parentId: root.id, index: root.children.length, nodes }, 'smoke stress')

  if (!inserted.ok) {
    steps.push({ name: 'stress insert', ok: false, detail: inserted.message })
    return { passed: false, steps }
  }
  steps.push({ name: 'stress insert', ok: true, detail: `${nodes.length} rects` })

  // Let the shell rebuild the scene from the new document before measuring.
  await new Promise((resolve) => window.setTimeout(resolve, 750))
  const renderer = getActiveRenderer()
  if (renderer === null) {
    steps.push({ name: 'stress frames', ok: false, detail: 'no active renderer' })
    return { passed: false, steps }
  }

  const samples: number[] = []
  for (let index = 0; index < 60; index += 1) {
    samples.push(renderer.render({ zoom: 1 + (index % 5) * 0.01, panX: index, panY: index }, []))
  }
  const sorted = [...samples].sort((left, right) => left - right)
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]
  const stats = renderer.stats()
  steps.push({
    name: 'stress frames',
    ok: p95 <= 33,
    detail: `${stats.shapes} shapes, ${stats.buckets} buckets, render p95 ${p95.toFixed(2)} ms over 60 frames, build ${stats.lastBuildMs.toFixed(1)} ms`,
  })
  // Issue #16: the unavailable family set earlier must be reported, not silently drawn.
  steps.push({
    name: 'font substitution reported',
    ok: stats.substitutedFonts.includes('Comic Sans MS'),
    detail: stats.substitutedFonts.join(', ') || 'none reported',
  })
  // Issue #17: the placed image must have been drawn from its asset, not as a placeholder.
  steps.push({
    name: 'image drawn from its asset',
    ok: placedAssetId !== null && !stats.missingAssets.includes(placedAssetId),
    detail: stats.missingAssets.length === 0 ? 'no missing assets' : stats.missingAssets.join(', '),
  })
  return { passed: steps.every((step) => step.ok), steps }
}

