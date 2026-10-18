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
import { MENU_BAR, OMITTED_MENUS, menuCommands, menuForMnemonic, menuMnemonic, separatorsAreSane } from '../src/app/menus/menuModel.ts'
import { needsUnsavedPrompt, promptChoiceFor, unsavedCopy } from '../src/app/files/unsavedPrompt.ts'
import { chordFromEvent, chordLabel, chordKeys, matchShortcut, SHORTCUTS, shortcutLabel } from '../src/app/menus/shortcuts.ts'
import { actualSize, clampZoom, fitArtboard, nextZoomStep, zoomAtPoint, zoomByStep } from '../src/geom/viewport.ts'
import { expandedGroupIds, layerRows, rowDescription } from '../src/app/panels/layerRows.ts'
import { DOCK_WIDTH, LAYER_INDENT, PALETTE_WIDTH, ZOOM_MAX, ZOOM_MIN, ZOOM_STEPS } from '../src/app/ui/theme.ts'
import { INITIAL_CREATION_DEFAULTS, PANEL_IDS, WorkspaceStore, workspaceStore } from '../src/state/workspaceStore.ts'
import { createDocument, createEllipse, createGroup, createRect, createText } from '../src/doc/document.ts'
import { documentStore } from '../src/state/documentStore.ts'
import {
  TOOL_GROUPS,
  TOOL_SWATCHES,
  displayToolFor,
  groupFor,
  hasSelectedText,
  memberFor,
  toolOptionsModel,
  type ToolOptionControl,
} from '../src/app/ui/toolOptions.ts'
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
  assert.equal(matchShortcut(chordFromEvent({ key: 'w' })), null, 'unbound keys stay unbound')
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

test('the unsaved-changes dialog says the right thing for each way work can be lost', () => {
  const closing = unsavedCopy('close', 'Poster')
  assert.match(closing.title, /closing/i)
  assert.match(closing.message, /Poster/)
  assert.match(closing.detail, /recovery/i, 'closing explains that a snapshot is kept')
  assert.equal(closing.confirmLabel, 'Save')
  assert.match(closing.discardLabel, /^Don.t Save$/)

  const starting = unsavedCopy('new', 'Poster')
  assert.match(starting.title, /new document/i)
  assert.match(starting.detail, /discard/i, 'starting a new document warns that it discards')

  const opening = unsavedCopy('open', 'Poster')
  assert.match(opening.title, /opening another document/i)

  // An unnamed document still reads correctly rather than showing an empty name.
  assert.match(unsavedCopy('close', '   ').message, /Untitled/)
  // The three kinds are distinct copy, not one string reused.
  assert.equal(new Set([closing.title, starting.title, opening.title]).size, 3)
})

test('the unsaved-changes guard only fires when there is something to lose', () => {
  assert.equal(needsUnsavedPrompt(false), false, 'a saved document closes or reopens without asking')
  assert.equal(needsUnsavedPrompt(true), true, 'unsaved work always asks')
  assert.equal(promptChoiceFor('confirm'), 'save')
  assert.equal(promptChoiceFor('discard'), 'discard')
  assert.equal(promptChoiceFor('cancel'), 'cancel')
})

test('menu mnemonics are distinct, so Alt+letter is unambiguous', () => {
  const letters = MENU_BAR.map(menuMnemonic)
  assert.deepEqual(letters, ['f', 'e', 'o', 't', 's', 'v', 'w', 'h'])
  assert.equal(new Set(letters).size, MENU_BAR.length)
  assert.equal(menuForMnemonic('f'), 0)
  assert.equal(menuForMnemonic('e'), MENU_BAR.findIndex((menu) => menu.label === 'Edit'))
  assert.equal(menuForMnemonic('E'), 1, 'case does not matter')
  assert.equal(menuForMnemonic('w'), MENU_BAR.findIndex((menu) => menu.label === 'Window'))
  assert.equal(menuForMnemonic('q'), -1, 'an unbound letter opens nothing')
})

test('the menu model uses Illustrator names, order, and sane separators', () => {
  assert.deepEqual(
    MENU_BAR.map((menu) => menu.label),
    ['File', 'Edit', 'Object', 'Type', 'Select', 'View', 'Window', 'Help'],
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
    ['Effect'],
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

test('the palette groups the shape tools the way Illustrator does', () => {
  assert.equal(TOOL_GROUPS.length, 5, 'five palette slots: arrows, lasso, shapes, type, hand')
  const shape = groupFor('rect')
  assert.equal(shape.id, 'shape')
  assert.equal(groupFor('ellipse').id, 'shape', 'every shape lives in one group')
  assert.deepEqual(
    shape.members.map((member) => member.tool),
    ['rect', 'roundedRect', 'ellipse', 'polygon', 'star', 'line', 'arc'],
    'the seven shape tools Illustrator ships that Vectr draws',
  )
  assert.equal(memberFor('ellipse').action, 'tool.ellipse')
  assert.equal(memberFor('line').action, 'tool.line')
  // Illustrator's top slot is the black/white arrow pair; the Lasso keeps its own slot and Q.
  assert.deepEqual(
    groupFor('select').members.map((member) => member.tool),
    ['select', 'directSelect'],
    'Selection and Direct Selection share one slot',
  )
  assert.equal(groupFor('lasso').id, 'lasso')
  assert.equal(memberFor('lasso').action, 'tool.lasso')

  const remembersEllipse = { ...INITIAL_CREATION_DEFAULTS, shapeTool: 'ellipse' as const }
  assert.equal(
    displayToolFor(shape, 'select', remembersEllipse),
    'ellipse',
    'an inactive group shows the member last picked',
  )
  assert.equal(displayToolFor(shape, 'rect', remembersEllipse), 'rect', 'an active group shows the tool in use')
  assert.equal(
    displayToolFor(groupFor('select'), 'text', remembersEllipse),
    'select',
    'an inactive arrow slot shows the Selection tool',
  )
})

test('picking a shape member anywhere remembers it for the palette', () => {
  resetEditor()
  workspaceStore.setCreationDefaults({ shapeTool: 'ellipse' })
  // The tool action is the path the palette, the flyout, and M / L all take.
  runEditorAction('tool.rect')
  assert.equal(documentStore.getState().tool, 'rect')
  assert.equal(workspaceStore.getState().creationDefaults.shapeTool, 'rect', 'the slot remembers what was picked')
  runEditorAction('tool.ellipse')
  assert.equal(workspaceStore.getState().creationDefaults.shapeTool, 'ellipse')
  assert.equal(documentStore.getState().tool, 'ellipse')
  assert.equal(
    displayToolFor(groupFor('rect'), 'select', workspaceStore.getState().creationDefaults),
    'ellipse',
    'and the slot still shows it after switching to another tool',
  )
  workspaceStore.setCreationDefaults({ shapeTool: INITIAL_CREATION_DEFAULTS.shapeTool })
})

test('the tool options bar shows the controls of the active tool', () => {
  resetEditor()
  const defaults = { ...INITIAL_CREATION_DEFAULTS }
  const model = (input: Partial<Parameters<typeof toolOptionsModel>[0]>) =>
    toolOptionsModel({
      tool: 'select',
      selection: [],
      document: documentStore.getState().document,
      defaults,
      canRun: () => true,
      ...input,
    })
  const of = <K extends ToolOptionControl['kind']>(controls: ToolOptionControl[], kind: K) =>
    controls.filter((control): control is Extract<ToolOptionControl, { kind: K }> => control.kind === kind)

  // Selection tool, nothing selected: an empty state, and no commands offered.
  const empty = model({ tool: 'select' })
  assert.equal(of(empty, 'hint').length, 1)
  assert.equal(of(empty, 'action').length, 0)

  // Shape tool: the member switch, the controls the member actually uses, and the fill.
  const shapeRow = model({ tool: 'ellipse' })
  const members = of(shapeRow, 'segmented')[0]
  assert.equal(members.id, 'shape.tool')
  assert.deepEqual(
    members.options.map((option) => option.value),
    ['rect', 'roundedRect', 'ellipse', 'polygon', 'star', 'line', 'arc'],
  )
  assert.equal(members.options.find((option) => option.value === 'ellipse')?.active, true)
  assert.equal(of(shapeRow, 'swatches')[0].active, defaults.shape.fill)
  assert.deepEqual(of(shapeRow, 'number'), [], 'an ellipse has no parameters beyond its box')

  // Each member brings its own options, and they read the creation defaults.
  const withShape = (patch: Partial<typeof defaults.shape>) => ({
    ...defaults,
    shape: { ...defaults.shape, ...patch },
  })
  const polygonRow = model({ tool: 'polygon', defaults: withShape({ sides: 8 }) })
  assert.equal(of(polygonRow, 'number')[0].id, 'shape.sides')
  assert.equal(of(polygonRow, 'number')[0].value, 8)

  const starRow = model({ tool: 'star', defaults: withShape({ points: 7, innerRadius: 0.35 }) })
  assert.deepEqual(of(starRow, 'number').map((control) => [control.id, control.value]), [
    ['shape.points', 7],
    ['shape.innerRadius', 35],
  ])

  const roundedRow = model({ tool: 'roundedRect', defaults: withShape({ cornerRadius: 18 }) })
  assert.deepEqual(of(roundedRow, 'number').map((control) => [control.id, control.value]), [['shape.cornerRadius', 18]])

  const lineRow = model({ tool: 'line', defaults: withShape({ strokeWidth: 3 }) })
  assert.deepEqual(of(lineRow, 'number').map((control) => control.id), ['shape.strokeWidth'])

  const arcRow = model({ tool: 'arc', defaults: withShape({ startAngle: 45, sweepAngle: -90, pie: true }) })
  assert.deepEqual(of(arcRow, 'number').map((control) => control.id), ['shape.startAngle', 'shape.sweepAngle'])
  assert.deepEqual(of(arcRow, 'toggle').map((control) => [control.id, control.active]), [['shape.pie', true]])

  // Type tool: size, alignment, colour — and the hint says where they apply.
  const typeRow = model({ tool: 'text', defaults: { ...defaults, textFontSize: 18, textAlign: 'center' } })
  assert.equal(of(typeRow, 'number')[0].value, 18)
  assert.equal(of(typeRow, 'segmented')[0].options.find((option) => option.value === 'center')?.active, true)
  assert.equal(of(typeRow, 'swatches')[0].colors.length, TOOL_SWATCHES.length)
  assert.match(of(typeRow, 'hint')[0].text, /next text object/)

  // Selection with one shape: its numbers, and commands gated by what can actually run.
  const [rect] = insert([createRect('Rect', 10, 20, 30, 40)])
  const selected = model({
    tool: 'select',
    selection: [rect.id],
    canRun: (id) => id !== 'object.ungroup',
  })
  assert.deepEqual(
    of(selected, 'readout').map((control) => `${control.label}:${control.value}`),
    ['X:10', 'Y:20', 'W:30', 'H:40'],
  )
  const actions = of(selected, 'action')
  assert.equal(actions.find((control) => control.id === 'object.ungroup')?.enabled, false)
  assert.equal(actions.find((control) => control.id === 'object.duplicate')?.enabled, true)
  assert.equal(hasSelectedText(documentStore.getState().document, [rect.id]), false)

  // The same row with text selected points the controls at the selection instead.
  const [text] = insert([createText('Note', 0, 0, 'hi')])
  assert.equal(hasSelectedText(documentStore.getState().document, [text.id]), true)
  assert.match(of(model({ tool: 'text', selection: [text.id] }), 'hint')[0].text, /selected text/)
})

test('geometry and zoom tokens stay coherent', () => {
  assert.ok(DOCK_WIDTH >= 220 && DOCK_WIDTH <= 400, `dock width ${DOCK_WIDTH}`)
  assert.ok(PALETTE_WIDTH > 0 && LAYER_INDENT > 0)
  assert.deepEqual([...ZOOM_STEPS], [...ZOOM_STEPS].slice().sort((a, b) => a - b))
  assert.equal(ZOOM_STEPS[0], ZOOM_MIN)
  assert.equal(ZOOM_STEPS[ZOOM_STEPS.length - 1], ZOOM_MAX)
  assert.ok(ZOOM_STEPS.includes(1), 'Actual Size must be a step the menu can reach')
})
