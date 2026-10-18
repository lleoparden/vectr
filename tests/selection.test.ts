/**
 * Selection modes (Phase 2.1, issue #64).
 *
 * Covers the pure selection maths — polygon containment, the lasso's touched-bounds rule, and
 * double-click hierarchy drilling — plus the `setCornerRadius` command and the UI wiring that
 * makes the new tools reachable (palette grouping, chords, and the Control panel's radius field).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand } from '../src/doc/commands.ts'
import {
  createDocument,
  createEllipse,
  createGroup,
  createRect,
  findNode,
} from '../src/doc/document.ts'
import { hierarchySelection, lassoHitTest, polygonContains } from '../src/doc/hitTest.ts'
import { TOOL_GROUPS, groupFor, memberFor, toolOptionsModel } from '../src/app/ui/toolOptions.ts'
import { matchShortcut } from '../src/app/menus/shortcuts.ts'
import { setSelectionCornerRadius } from '../src/app/actions.ts'
import { documentStore } from '../src/state/documentStore.ts'
import { INITIAL_CREATION_DEFAULTS } from '../src/state/workspaceStore.ts'
import type { Document, GroupNode, LayerNode, NodeId } from '../src/doc/types.ts'

function inserted(document: Document, parentId: NodeId, nodes: LayerNode[]): Document {
  const parent = findNode(document, parentId) as GroupNode
  const result = applyCommand(document, {
    type: 'insertNodes',
    parentId,
    index: parent.children.length,
    nodes,
  })
  assert.equal(result.ok, true)
  return result.ok ? result.document : document
}

/**
 * root
 *   group outer
 *     ellipse leaf        (20,20 100×100)
 *     group inner
 *       rect rounded      (200,20 100×100, radius 12)
 *   ellipse loose         (400,400 100×100)
 */
function fixture() {
  const outer = createGroup('Outer')
  const inner = createGroup('Inner')
  const leaf = createEllipse('Leaf', 20, 20, 100, 100)
  const rounded = createRect('Rounded', 200, 20, 100, 100, '#4f7cff', 12)
  const loose = createEllipse('Loose', 400, 400, 100, 100)
  let document = createDocument('Selection')
  document = inserted(document, document.root.id, [outer, loose])
  document = inserted(document, outer.id, [leaf, inner])
  document = inserted(document, inner.id, [rounded])
  return { document, outer, inner, leaf, rounded, loose }
}

test('polygon containment treats edges as inside and outside as outside', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  assert.equal(polygonContains(square, { x: 5, y: 5 }), true)
  assert.equal(polygonContains(square, { x: 15, y: 5 }), false)
  assert.equal(polygonContains(square, { x: -1, y: 5 }), false)
  assert.equal(polygonContains(square, { x: 0, y: 0 }), true, 'a vertex is on the path')
  // A concave "U": the notch between the arms is outside.
  const u = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 7, y: 10 },
    { x: 7, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 10 },
    { x: 0, y: 10 },
  ]
  assert.equal(polygonContains(u, { x: 5, y: 7 }), false, 'inside the notch, not the shape')
  assert.equal(polygonContains(u, { x: 1, y: 7 }), true)
})

test('a lasso selects the objects its path encloses, deepest or collapsed', () => {
  const { document, outer, leaf, rounded, loose } = fixture()
  const aroundLeaf = [
    { x: 10, y: 10 },
    { x: 130, y: 10 },
    { x: 130, y: 130 },
    { x: 10, y: 130 },
  ]
  assert.deepEqual(
    lassoHitTest(document, aroundLeaf, { deep: true }),
    [leaf.id],
    'the nested leaf is the only thing the path touches',
  )
  assert.deepEqual(
    lassoHitTest(document, aroundLeaf),
    [outer.id],
    'without direct selection the hit collapses to the top-level object',
  )

  const aroundRounded = [
    { x: 190, y: 10 },
    { x: 310, y: 10 },
    { x: 310, y: 130 },
    { x: 190, y: 130 },
  ]
  assert.deepEqual(lassoHitTest(document, aroundRounded, { deep: true }), [rounded.id])

  const aroundBoth = [
    { x: 0, y: 0 },
    { x: 320, y: 0 },
    { x: 320, y: 140 },
    { x: 0, y: 140 },
  ]
  assert.deepEqual(
    lassoHitTest(document, aroundBoth, { deep: true }),
    [leaf.id, rounded.id],
    'paint order, one entry per leaf',
  )

  const empty = [
    { x: 600, y: 600 },
    { x: 620, y: 600 },
    { x: 620, y: 620 },
    { x: 600, y: 620 },
  ]
  assert.deepEqual(lassoHitTest(document, empty), [], 'a path that touches nothing selects nothing')
  assert.deepEqual(lassoHitTest(document, aroundBoth, { deep: true }).includes(loose.id), false)

  // Illustrator's lasso is an area selection: a path across an object's middle encloses nothing,
  // so it selects nothing, and a path covering only part of an object does not select it either.
  const through = [
    { x: 350, y: 450 },
    { x: 550, y: 450 },
    { x: 550, y: 455 },
    { x: 350, y: 455 },
  ]
  assert.deepEqual(lassoHitTest(document, through), [], 'a path crossing an object does not select it')
  const partial = [
    { x: 350, y: 390 },
    { x: 450, y: 390 },
    { x: 450, y: 510 },
    { x: 350, y: 510 },
  ]
  assert.deepEqual(lassoHitTest(document, partial, { deep: true }), [], 'half an object is not enclosed')
})

test('a lasso skips hidden and locked leaves unless asked to include them', () => {
  const { document, loose } = fixture()
  const aroundLoose = [
    { x: 390, y: 390 },
    { x: 510, y: 390 },
    { x: 510, y: 510 },
    { x: 390, y: 510 },
  ]
  const locked = applyCommand(document, { type: 'setFlags', nodeId: loose.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  const lockedDocument = locked.ok ? locked.document : document
  assert.deepEqual(lassoHitTest(lockedDocument, aroundLoose), [])
  assert.deepEqual(lassoHitTest(lockedDocument, aroundLoose, { includeLocked: true }), [loose.id])

  const hidden = applyCommand(document, { type: 'setFlags', nodeId: loose.id, locked: false, hidden: true })
  const hiddenDocument = hidden.ok ? hidden.document : document
  assert.deepEqual(lassoHitTest(hiddenDocument, aroundLoose), [])
})

test('double-click drills one level into the group chain under the pointer', () => {
  const { document, outer, inner, leaf, rounded, loose } = fixture()
  const onLeaf = { x: 70, y: 70 }
  const onRounded = { x: 250, y: 70 }

  // `leaf` is a direct child of `outer`, so one level in from the top is the leaf itself.
  assert.equal(hierarchySelection(document, onLeaf, []), leaf.id, 'a group-child leaf is reached in one step')
  assert.equal(hierarchySelection(document, onLeaf, [outer.id]), leaf.id, 'a selected group descends into it')
  assert.equal(hierarchySelection(document, onLeaf, [leaf.id]), leaf.id, 'a leaf cannot drill further')

  // `rounded` sits two groups deep: outer -> inner -> rounded.
  assert.equal(hierarchySelection(document, onRounded, []), inner.id, 'a nested object enters its group first')
  assert.equal(hierarchySelection(document, onRounded, [outer.id]), inner.id)
  assert.equal(hierarchySelection(document, onRounded, [inner.id]), rounded.id, 'the second double-click reaches it')
  assert.equal(hierarchySelection(document, onRounded, [leaf.id]), inner.id, 'an unrelated selection starts over')

  const onLoose = { x: 450, y: 450 }
  assert.equal(hierarchySelection(document, onLoose, []), loose.id, 'a top-level object selects itself')

  assert.equal(hierarchySelection(document, { x: 900, y: 900 }, []), null, 'empty space hits nothing')
})

test('setCornerRadius changes a rectangle and restores it exactly', () => {
  const { document, rounded } = fixture()
  const result = applyCommand(document, { type: 'setCornerRadius', nodeId: rounded.id, cornerRadius: 30 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const changed = findNode(result.document, rounded.id)
  assert.equal(changed !== null && changed.type === 'rect' && changed.cornerRadius, 30)
  assert.equal(result.document.revision, document.revision + 1)

  const undone = applyCommand(result.document, result.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  const restored = findNode(undone.document, rounded.id)
  assert.equal(restored !== null && restored.type === 'rect' && restored.cornerRadius, 12)
})

test('setCornerRadius refuses what a rectangle cannot be', () => {
  const { document, leaf, rounded } = fixture()

  const wrongKind = applyCommand(document, { type: 'setCornerRadius', nodeId: leaf.id, cornerRadius: 4 })
  assert.equal(wrongKind.ok, false)
  assert.equal(wrongKind.ok ? '' : wrongKind.code, 'invalid-parent')

  const missing = applyCommand(document, { type: 'setCornerRadius', nodeId: 'nope', cornerRadius: 4 })
  assert.equal(missing.ok, false)
  assert.equal(missing.ok ? '' : missing.code, 'absent-node')

  const notFinite = applyCommand(document, { type: 'setCornerRadius', nodeId: rounded.id, cornerRadius: Number.NaN })
  assert.equal(notFinite.ok, false)
  assert.equal(notFinite.ok ? '' : notFinite.code, 'non-finite')

  const negative = applyCommand(document, { type: 'setCornerRadius', nodeId: rounded.id, cornerRadius: -1 })
  assert.equal(negative.ok, false)
  assert.equal(negative.ok ? '' : negative.code, 'non-finite')

  const tooBig = applyCommand(document, { type: 'setCornerRadius', nodeId: rounded.id, cornerRadius: 51 })
  assert.equal(tooBig.ok, false)
  assert.equal(tooBig.ok ? '' : tooBig.code, 'invalid-index')
  assert.equal(
    findNode(document, rounded.id) !== null &&
      (findNode(document, rounded.id) as { cornerRadius: number }).cornerRadius,
    12,
    'a refused command leaves the document untouched',
  )

  const locked = applyCommand(document, { type: 'setFlags', nodeId: rounded.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  const lockedDocument = locked.ok ? locked.document : document
  const refused = applyCommand(lockedDocument, { type: 'setCornerRadius', nodeId: rounded.id, cornerRadius: 20 })
  assert.equal(refused.ok, false)
  assert.equal(refused.ok ? '' : refused.code, 'locked')
})

test('the corner-radius control clamps the typed value and is one undo step', () => {
  const { document, rounded } = fixture()
  documentStore.replaceDocument(document)
  documentStore.setSelection([rounded.id])
  const before = documentStore.getState().undoDepth

  setSelectionCornerRadius(999)
  const node = findNode(documentStore.getState().document, rounded.id)
  assert.equal(node !== null && node.type === 'rect' && node.cornerRadius, 50, 'clamped to half the shorter side')
  assert.equal(documentStore.getState().undoDepth, before + 1, 'one history entry')

  documentStore.undo()
  const restored = findNode(documentStore.getState().document, rounded.id)
  assert.equal(restored !== null && restored.type === 'rect' && restored.cornerRadius, 12)
})

test('the corner-radius control ignores a selection it cannot edit', () => {
  const { document, leaf } = fixture()
  documentStore.replaceDocument(document)
  documentStore.setSelection([leaf.id])
  const before = documentStore.getState().undoDepth
  setSelectionCornerRadius(8)
  assert.equal(documentStore.getState().undoDepth, before, 'an ellipse records no history')
  assert.equal(documentStore.getState().lastError, null, 'and reports no error, because nothing was attempted')
})

test('Direct Selection and Lasso are reachable the way Illustrator users expect', () => {
  // Illustrator's top tool slot is the black/white arrow pair, so the two selection tools share one
  // palette group; the Lasso is its own slot with its own Q chord.
  assert.equal(groupFor('directSelect').id, 'select')
  assert.equal(memberFor('directSelect').action, 'tool.directSelect')
  assert.equal(TOOL_GROUPS.length, 5, 'arrows, lasso, shapes, type, artboard')
  assert.equal(groupFor('lasso').id, 'lasso')
  assert.equal(memberFor('lasso').action, 'tool.lasso')

  assert.equal(matchShortcut({ key: 'a' }), 'tool.directSelect')
  assert.equal(matchShortcut({ key: 'q' }), 'tool.lasso')
  assert.equal(matchShortcut({ key: 'o', shift: true }), 'tool.artboard', 'Shift+O is Illustrator\'s Artboard tool')
  assert.equal(memberFor('artboard').action, 'tool.artboard')
  assert.equal(matchShortcut({ key: 'v' }), 'tool.select')
})

test('the Control panel offers the radius of the selected rounded rectangle', () => {
  const { document, rounded, leaf } = fixture()
  const modelFor = (selection: NodeId[]) =>
    toolOptionsModel({
      tool: 'select',
      selection,
      document,
      defaults: INITIAL_CREATION_DEFAULTS,
      canRun: () => true,
    })
  const radiusControl = (selection: NodeId[]) =>
    modelFor(selection).find((control) => control.kind === 'number' && control.id === 'selection.cornerRadius')

  const radius = radiusControl([rounded.id])
  assert.notEqual(radius, undefined, 'the radius field is offered for a selected rectangle')
  if (radius !== undefined && radius.kind === 'number') {
    assert.equal(radius.value, 12)
    assert.equal(radius.max, 50, 'the field cannot ask for more than half the shorter side')
  }

  assert.equal(radiusControl([leaf.id]), undefined, 'an ellipse has no corner radius')
  assert.equal(radiusControl([rounded.id, leaf.id]), undefined, 'two objects have no single radius')
})

test('the tool options bar describes the new selection tools', () => {
  const { document } = fixture()
  const model = (tool: 'directSelect' | 'lasso') =>
    toolOptionsModel({
      tool,
      selection: [],
      document,
      defaults: INITIAL_CREATION_DEFAULTS,
      canRun: () => true,
    })
  const direct = model('directSelect')
  assert.equal(
    direct.some((control) => control.kind === 'label' && control.text === 'Direct Selection Tool'),
    true,
  )
  const lasso = model('lasso')
  assert.equal(lasso.some((control) => control.kind === 'label' && control.text === 'Lasso Tool'), true)
})
