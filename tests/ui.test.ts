/**
 * Shell tests (issue #28).
 *
 * The shell's decisions are data — the shortcut map, the menu model, the panel
 * layout, the viewport arithmetic, the layer rows — so they are testable without a
 * browser. Anything that touches the document still goes through the store's
 * validated command path, which is what makes these assertions meaningful.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTION_IDS, canRunAction, panelActionId, runEditorAction } from '../src/app/actions.ts'
import { MENU_BAR, OMITTED_MENUS, menuCommands, menuForMnemonic, menuMnemonic, separatorsAreSane } from '../src/app/menuModel.ts'
import { chordFromEvent, chordLabel, chordKeys, matchShortcut, SHORTCUTS, shortcutLabel } from '../src/app/shortcuts.ts'
import { actualSize, clampZoom, fitArtboard, nextZoomStep, zoomAtPoint, zoomByStep } from '../src/app/viewportOps.ts'
import { expandedGroupIds, layerRows, rowDescription } from '../src/app/layerRows.ts'
import { DOCK_WIDTH, LAYER_INDENT, PALETTE_WIDTH, ZOOM_MAX, ZOOM_MIN, ZOOM_STEPS } from '../src/app/theme.ts'
import { PANEL_IDS, WorkspaceStore, workspaceStore } from '../src/state/workspaceStore.ts'
import { createDocument, createEllipse, createGroup, createRect } from '../src/doc/document.ts'
import { documentStore } from '../src/state/documentStore.ts'
import type { LayerNode } from '../src/doc/types.ts'

const ACTION_SET = new Set<string>(ACTION_IDS)

function resetEditor() {
  documentStore.replaceDocument(createDocument('UI tests'))
  documentStore.setTool('select')
  documentStore.clearSelection()
  documentStore.setViewport({ zoom: 1, panX: 0, panY: 0 })
}

function insert(nodes: LayerNode[], parentId = 'root'): LayerNode[] {
  const parent = documentStore.getState().document.root
  const index = parentId === 'root' ? parent.children.length : 0
  const result = documentStore.dispatch({ type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
  return nodes
}

test('every shortcut chord is unique and names a real action', () => {
  const chords = chordKeys()
  assert.equal(new Set(chords).size, chords.length, 'two actions share one chord')
  for (const spec of SHORTCUTS) {
    assert.equal(ACTION_SET.has(spec.id), true, `${spec.id} is not an action`)
    if (!spec.illustratorDefault) assert.ok(spec.note, `${spec.id} diverges without a reason`)
  }
})

test('the shortcut map carries Illustrator defaults', () => {
  const expected: Array<[string, Record<string, boolean>, string]> = [
    ['v', {}, 'tool.select'],
    ['m', {}, 'tool.rect'],
    ['l', {}, 'tool.ellipse'],
    ['z', { ctrlKey: true }, 'edit.undo'],
    ['z', { ctrlKey: true, shiftKey: true }, 'edit.redo'],
    ['a', { ctrlKey: true }, 'select.all'],
    ['a', { ctrlKey: true, shiftKey: true }, 'select.deselect'],
    ['3', { ctrlKey: true }, 'object.hideSelection'],
    ['3', { ctrlKey: true, altKey: true }, 'object.showAll'],
    ['2', { ctrlKey: true }, 'object.lockSelection'],
    ['2', { ctrlKey: true, altKey: true }, 'object.unlockAll'],
    ['0', { ctrlKey: true }, 'view.fitArtboard'],
    ['1', { ctrlKey: true }, 'view.actualSize'],
    ['f7', {}, 'window.togglePanel.layers'],
    ['f6', {}, 'window.togglePanel.color'],
    ['f6', { shiftKey: true }, 'window.togglePanel.appearance'],
  ]
  for (const [key, modifiers, id] of expected) {
    assert.equal(matchShortcut(chordFromEvent({ key, ...modifiers })), id, `${key} should be ${id}`)
  }
})

test('modifiers must match exactly and Command acts as Control', () => {
  assert.equal(matchShortcut(chordFromEvent({ key: 'a', ctrlKey: true, shiftKey: true })), 'select.deselect')
  assert.notEqual(matchShortcut(chordFromEvent({ key: 'a', ctrlKey: true, shiftKey: true })), 'select.all')
  assert.equal(matchShortcut(chordFromEvent({ key: 'a', metaKey: true })), 'select.all', 'macOS Command')
  assert.equal(matchShortcut(chordFromEvent({ key: 'q' })), null, 'unbound keys stay unbound')
  assert.equal(matchShortcut(chordFromEvent({ key: 'z' })), null, 'Ctrl+Z must not fire from bare Z')
})

test('chords print the way a menu shows them', () => {
  assert.equal(chordLabel({ key: 'z', ctrl: true, shift: true }), 'Ctrl+Shift+Z')
  assert.equal(chordLabel({ key: 'f7' }), 'F7')
  assert.equal(chordLabel({ key: 'escape' }), 'Esc')
  assert.equal(chordLabel({ key: 'delete' }), 'Del')
  assert.equal(shortcutLabel('view.fitArtboard'), 'Ctrl+0')
  assert.equal(shortcutLabel('window.togglePanel.properties'), null, 'Properties has no default key in Illustrator')
})

test('Escape cancels instead of deselecting, as it does in Illustrator', () => {
  assert.equal(matchShortcut(chordFromEvent({ key: 'escape' })), null, 'Escape is not bound to an action')
  assert.equal(shortcutLabel('select.deselect'), 'Ctrl+Shift+A', 'Deselect keeps Illustrator’s chord')
})

test('menu mnemonics are distinct, so Alt+letter is unambiguous', () => {
  const letters = MENU_BAR.map(menuMnemonic)
  assert.deepEqual(letters, ['e', 'o', 's', 'v', 'w', 'h'])
  assert.equal(new Set(letters).size, MENU_BAR.length)
  assert.equal(menuForMnemonic('e'), 0)
  assert.equal(menuForMnemonic('E'), 0, 'case does not matter')
  assert.equal(menuForMnemonic('w'), MENU_BAR.findIndex((menu) => menu.label === 'Window'))
  assert.equal(menuForMnemonic('q'), -1, 'an unbound letter opens nothing')
})

test('the menu model uses Illustrator names, order, and sane separators', () => {
  assert.deepEqual(
    MENU_BAR.map((menu) => menu.label),
    ['Edit', 'Object', 'Select', 'View', 'Window', 'Help'],
  )
  for (const menu of MENU_BAR) {
    assert.ok(menuCommands(menu).length > 0, `${menu.label} would be an empty menu`)
    assert.equal(separatorsAreSane(menu), true, `${menu.label} has a misplaced separator`)
    for (const item of menuCommands(menu)) {
      assert.equal(ACTION_SET.has(item.id), true, `${menu.label} -> ${item.id} is not an action`)
      assert.ok(item.label.length > 0)
    }
  }
  for (const omitted of OMITTED_MENUS) {
    assert.ok(omitted.reason.length > 20, `${omitted.label} is omitted without a real reason`)
  }
  assert.deepEqual(
    OMITTED_MENUS.map((menu) => menu.label),
    ['File', 'Type', 'Effect'],
  )
})

test('Undo and Clear are gated by state, so the menu greys them out', () => {
  resetEditor()
  const empty = documentStore.getState()
  assert.equal(canRunAction('edit.undo', empty), false)
  assert.equal(canRunAction('edit.clear', empty), false)
  assert.equal(canRunAction('object.hideSelection', empty), false)
  assert.equal(canRunAction('object.showAll', empty), false)
  assert.equal(canRunAction('select.all', empty), true)
  assert.equal(canRunAction('view.fitArtboard', empty), true)
})

test('Clear deletes the selection and cannot leave it selected', () => {
  resetEditor()
  const [rect] = insert([createRect('Rect', 0, 0, 40, 40)])
  documentStore.setSelection([rect.id])
  runEditorAction('edit.clear')
  assert.equal(documentStore.getState().document.root.children.length, 0)
  assert.deepEqual(documentStore.getState().selection, [])
  documentStore.undo()
  assert.equal(documentStore.getState().document.root.children.length, 1)
})

test('Hide, Show All, Lock, and Unlock All change flags and undo in one step', () => {
  resetEditor()
  const [rect, ellipse, group] = insert([
    createRect('Rect', 0, 0, 40, 40),
    createEllipse('Ellipse', 60, 0, 40, 40),
    createGroup('Group'),
  ])
  insert([createRect('Nested', 0, 80, 20, 20)], group.id)

  documentStore.setSelection([rect.id, ellipse.id])
  const before = documentStore.getState().undoDepth
  runEditorAction('object.hideSelection')
  assert.equal(documentStore.getState().document.root.children.filter((node) => node.hidden).length, 2)
  assert.equal(
    documentStore.getState().undoDepth,
    before + 1,
    'a multi-object hide is one transaction, so it is one undo step (issue #34 aggregate inverse)',
  )
  // The aggregate inverse restores every node in that one step.
  documentStore.undo()
  assert.equal(
    documentStore.getState().document.root.children.filter((node) => node.hidden).length,
    0,
    'one undo restores both layers',
  )
  assert.equal(documentStore.getState().undoDepth, before)
  documentStore.redo()
  assert.equal(
    documentStore.getState().document.root.children.filter((node) => node.hidden).length,
    2,
    'redo hides both again in one step',
  )
  documentStore.undo()

  documentStore.setSelection([rect.id])
  runEditorAction('object.hideSelection')
  const depth = documentStore.getState().undoDepth
  runEditorAction('object.hideSelection')
  assert.equal(documentStore.getState().undoDepth, depth, 'a no-op hide records nothing')

  documentStore.dispatch({ type: 'setFlags', nodeId: group.id, locked: false, hidden: true })
  assert.equal(canRunAction('object.showAll', documentStore.getState()), true)
  runEditorAction('object.showAll')
  assert.equal(
    documentStore.getState().document.root.children.some((node) => node.hidden),
    false,
  )
  assert.equal(canRunAction('object.showAll', documentStore.getState()), false, 'nothing left to show')

  documentStore.setSelection([ellipse.id])
  runEditorAction('object.lockSelection')
  assert.equal(canRunAction('object.unlockAll', documentStore.getState()), true)
  runEditorAction('object.unlockAll')
  assert.equal(
    documentStore.getState().document.root.children.some((node) => node.locked),
    false,
  )
  assert.equal(canRunAction('object.unlockAll', documentStore.getState()), false)
})

test('the tool, zoom, and panel actions drive the two stores', () => {
  resetEditor()
  workspaceStore.setCanvasSize(800, 600)

  runEditorAction('tool.rect')
  assert.equal(documentStore.getState().tool, 'rect')
  runEditorAction('tool.ellipse')
  assert.equal(documentStore.getState().tool, 'ellipse')
  runEditorAction('tool.select')
  assert.equal(documentStore.getState().tool, 'select')

  runEditorAction('view.zoomIn')
  assert.equal(documentStore.getState().viewport.zoom, 1.5, 'zoom in walks the standard steps')
  runEditorAction('view.zoomOut')
  assert.equal(documentStore.getState().viewport.zoom, 1)
  runEditorAction('view.actualSize')
  assert.equal(documentStore.getState().viewport.zoom, 1)
  runEditorAction('view.fitArtboard')
  const fitted = documentStore.getState().viewport
  assert.ok(fitted.zoom > 0 && fitted.zoom < 1, `fit artboard zoom ${fitted.zoom}`)
  assert.ok(fitted.panX > 0 && fitted.panY > 0, 'the artboard is centered, not parked at the origin')

  // Every panel id has exactly one Window action, and the dock lists each of them.
  assert.equal(new Set(PANEL_IDS.map(panelActionId)).size, PANEL_IDS.length)
  for (const panel of PANEL_IDS) {
    assert.equal(ACTION_SET.has(panelActionId(panel)), true)
  }
  assert.deepEqual(workspaceStore.getState().groups[0].tabs, ['layers'])
  assert.deepEqual(workspaceStore.getState().groups[1].tabs, ['properties', 'appearance', 'color'])
})

test('a panel group collapses by choosing the panel that is already on top', () => {
  const workspace = new WorkspaceStore()
  assert.equal(workspace.getState().groups[1].active, 'properties')
  assert.equal(workspace.getState().groups[1].collapsed, false)

  workspace.togglePanel('properties')
  assert.equal(workspace.getState().groups[1].collapsed, true, 're-choosing the active panel collapses its group')

  workspace.togglePanel('color')
  assert.equal(workspace.getState().groups[1].collapsed, false)
  assert.equal(workspace.getState().groups[1].active, 'color')

  workspace.toggleGroup('group.style')
  assert.equal(workspace.getState().groups[1].collapsed, true)
  workspace.activate('appearance')
  assert.equal(workspace.getState().groups[1].collapsed, false)
  assert.equal(workspace.getState().groups[1].active, 'appearance')
  assert.equal(workspace.getState().visible.appearance, true)
})

test('hiding the active tab of a multi-tab group moves the strip to another tab', () => {
  const workspace = new WorkspaceStore()
  workspace.setPanelVisible('properties', false)
  assert.equal(workspace.getState().groups[1].active, 'appearance', 'the strip cannot point at a hidden tab')
  assert.equal(workspace.getState().visible.properties, false)
  workspace.setPanelVisible('layers', false)
  assert.equal(workspace.getState().groups[0].active, 'layers', 'a single-tab group keeps its tab')
  workspace.setPanelVisible('properties', true)
  assert.equal(workspace.getState().visible.properties, true)
})

test('the workspace notifies subscribers once per real change', () => {
  const workspace = new WorkspaceStore()
  let notifications = 0
  const unsubscribe = workspace.subscribe(() => {
    notifications += 1
  })
  workspace.setCanvasSize(800, 600)
  workspace.setCanvasSize(800, 600)
  workspace.setAboutOpen(true)
  workspace.setAboutOpen(true)
  workspace.togglePanel('layers')
  unsubscribe()
  workspace.setAboutOpen(false)
  assert.equal(notifications, 3, 'one canvas change, one dialog, one collapse — and nothing for the repeats')
})

test('viewport arithmetic keeps the anchor fixed and stays inside the zoom bounds', () => {
  assert.equal(clampZoom(0), ZOOM_MIN)
  assert.equal(clampZoom(1000), ZOOM_MAX)
  assert.equal(clampZoom(Number.NaN), 1)

  const viewport = { zoom: 1, panX: 100, panY: 50 }
  const zoomed = zoomAtPoint(viewport, { x: 200, y: 150 }, 2)
  assert.equal(zoomed.zoom, 2)
  // The scene point under (200, 150) must not move: screen = scene * zoom + pan.
  assert.equal((200 - viewport.panX) / viewport.zoom, (200 - zoomed.panX) / zoomed.zoom)
  assert.equal((150 - viewport.panY) / viewport.zoom, (150 - zoomed.panY) / zoomed.zoom)

  assert.equal(nextZoomStep(1, 1), 1.5)
  assert.equal(nextZoomStep(1, -1), 0.75)
  assert.equal(nextZoomStep(ZOOM_MAX, 1), ZOOM_MAX)
  assert.equal(nextZoomStep(ZOOM_MIN, -1), ZOOM_MIN)
  assert.equal(zoomByStep(viewport, 1, { width: 0, height: 0 }).zoom, 1.5, 'no canvas size still zooms')
})

test('Fit Artboard in Window centers the artboard and honors the margin', () => {
  const artboard = { id: 'a', name: 'Artboard 1', width: 1200, height: 800 }
  const canvas = { width: 800, height: 600 }
  const fitted = fitArtboard(artboard, canvas)
  assert.ok(fitted.zoom > 0 && fitted.zoom < 1)
  assert.equal(fitted.panX, (canvas.width - artboard.width * fitted.zoom) / 2)
  assert.equal(fitted.panY, (canvas.height - artboard.height * fitted.zoom) / 2)
  assert.ok(Math.abs(artboard.width * fitted.zoom - (canvas.width - 64)) < 1e-6, 'width is the binding side here')
  assert.deepEqual(fitArtboard(artboard, { width: 0, height: 0 }), { zoom: 1, panX: 0, panY: 0 })
  assert.equal(actualSize({ zoom: 4, panX: 10, panY: 10 }, canvas).zoom, 1)
  assert.equal(actualSize({ zoom: 4, panX: 10, panY: 10 }, { width: 0, height: 0 }).panX, 10)
})

test('layer rows follow the tree, respect collapse, and inherit flags', () => {
  const group = createGroup('Group')
  const rect = createRect('Rect', 0, 0, 10, 10)
  const nested = createGroup('Nested')
  const leaf = createRect('Leaf', 0, 0, 10, 10)
  nested.children = [leaf]
  group.children = [rect, nested]
  const roots = [createEllipse('Ellipse', 0, 0, 10, 10), group]

  const all = expandedGroupIds(roots)
  assert.deepEqual(all, [group.id, nested.id])

  const expanded = new Set(all)
  const rows = layerRows(roots, expanded)
  assert.deepEqual(
    rows.map((row) => [row.node.name, row.depth]),
    [
      ['Ellipse', 0],
      ['Group', 0],
      ['Rect', 1],
      ['Nested', 1],
      ['Leaf', 2],
    ],
  )
  assert.equal(rows[0].hasChildren, false)
  assert.equal(rows[1].hasChildren, true)
  assert.equal(rows[1].expanded, true)

  const groupCollapsed = layerRows(roots, new Set())
  assert.deepEqual(
    groupCollapsed.map((row) => row.node.name),
    ['Ellipse', 'Group'],
    'a collapsed group shows its own row and hides its subtree',
  )

  const nestedCollapsed = layerRows(roots, new Set([group.id]))
  assert.deepEqual(
    nestedCollapsed.map((row) => row.node.name),
    ['Ellipse', 'Group', 'Rect', 'Nested'],
    'expanding a group reveals its children, and only the inner group stays closed',
  )

  group.hidden = true
  group.locked = true
  const inherited = layerRows([group], new Set([group.id, nested.id]))
  const leafRow = inherited.find((row) => row.node.name === 'Leaf')
  assert.equal(leafRow?.hidden, false, 'the leaf sets no flag of its own')
  assert.equal(leafRow?.inheritedHidden, true, 'but it reports the hidden ancestor')
  assert.equal(leafRow?.inheritedLocked, true, 'and the locked ancestor')
  assert.equal(rowDescription(leafRow!), 'rect, hidden by parent layer, locked by parent layer')
})

test('geometry and zoom tokens stay coherent', () => {
  assert.ok(DOCK_WIDTH >= 220 && DOCK_WIDTH <= 400, `dock width ${DOCK_WIDTH}`)
  assert.ok(PALETTE_WIDTH > 0 && LAYER_INDENT > 0)
  assert.deepEqual([...ZOOM_STEPS], [...ZOOM_STEPS].slice().sort((a, b) => a - b))
  assert.equal(ZOOM_STEPS[0], ZOOM_MIN)
  assert.equal(ZOOM_STEPS[ZOOM_STEPS.length - 1], ZOOM_MAX)
  assert.ok(ZOOM_STEPS.includes(1), 'Actual Size must be a step the menu can reach')
})
