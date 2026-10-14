/**
 * Editor actions (issue #28).
 *
 * The menu bar, the tool palette, and the keyboard map all name the same actions,
 * and every one of them ends up in the store's single `dispatch` path or on the
 * workspace store. Having one table is what keeps a menu item, its shortcut, and a
 * palette button from drifting apart.
 *
 * Nothing here adds a document command: object actions are built from the existing
 * `setFlags` command.
 */

import { findNode, paintOrder } from '../doc/document.ts'
import { isText, type LayerNode, type NodeId, type TextAlign, type TextNode } from '../doc/types.ts'
import { documentStore, type EditorState } from '../state/documentStore.ts'
import { workspaceStore, type PanelId } from '../state/workspaceStore.ts'
import {
  planArrange,
  planGroup,
  planUngroup,
  stepCommand,
  type ArrangeWhere,
  type PlanStep,
} from './arrange.ts'
import { planDrop } from './layerDrag.ts'
import type { LayerRow } from './layerRows.ts'
import { importImageBytes, pickImageFile } from './imageImport.ts'
import { assetRegistry } from '../state/assetRegistry.ts'
import { createImage } from '../doc/document.ts'
import { actualSize, canvasCenter, fitArtboard, zoomByStep } from './viewportOps.ts'
import type { Command } from '../doc/commands.ts'

export const ACTION_IDS = [
  'tool.select',
  'tool.rect',
  'tool.ellipse',
  'tool.text',
  'file.place',
  'type.sizeUp',
  'type.sizeDown',
  'type.alignLeft',
  'type.alignCenter',
  'type.alignRight',
  'edit.undo',
  'edit.redo',
  'edit.clear',
  'select.all',
  'select.deselect',
  'object.hideSelection',
  'object.showAll',
  'object.lockSelection',
  'object.unlockAll',
  'object.group',
  'object.ungroup',
  'object.arrangeFront',
  'object.arrangeForward',
  'object.arrangeBackward',
  'object.arrangeBack',
  'view.zoomIn',
  'view.zoomOut',
  'view.fitArtboard',
  'view.actualSize',
  'window.togglePanel.layers',
  'window.togglePanel.properties',
  'window.togglePanel.appearance',
  'window.togglePanel.color',
  'help.about',
] as const

export type EditorActionId = (typeof ACTION_IDS)[number]

export const ACTION_LABELS: Record<EditorActionId, string> = {
  'tool.select': 'Selection Tool',
  'tool.rect': 'Rectangle Tool',
  'tool.ellipse': 'Ellipse Tool',
  'tool.text': 'Type Tool',
  'file.place': 'Place…',
  'type.sizeUp': 'Increase Size',
  'type.sizeDown': 'Decrease Size',
  'type.alignLeft': 'Horizontal Align Left',
  'type.alignCenter': 'Horizontal Align Center',
  'type.alignRight': 'Horizontal Align Right',
  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'edit.clear': 'Clear',
  'select.all': 'All',
  'select.deselect': 'Deselect',
  'object.hideSelection': 'Hide Selection',
  'object.showAll': 'Show All',
  'object.lockSelection': 'Lock Selection',
  'object.unlockAll': 'Unlock All',
  'object.group': 'Group',
  'object.ungroup': 'Ungroup',
  'object.arrangeFront': 'Bring to Front',
  'object.arrangeForward': 'Bring Forward',
  'object.arrangeBackward': 'Send Backward',
  'object.arrangeBack': 'Send to Back',
  'view.zoomIn': 'Zoom In',
  'view.zoomOut': 'Zoom Out',
  'view.fitArtboard': 'Fit Artboard in Window',
  'view.actualSize': 'Actual Size',
  'window.togglePanel.layers': 'Layers',
  'window.togglePanel.properties': 'Properties',
  'window.togglePanel.appearance': 'Appearance',
  'window.togglePanel.color': 'Color',
  'help.about': 'About Vectr',
}

const PANEL_ACTION_IDS: Record<PanelId, EditorActionId> = {
  layers: 'window.togglePanel.layers',
  properties: 'window.togglePanel.properties',
  appearance: 'window.togglePanel.appearance',
  color: 'window.togglePanel.color',
}

export function isEditorActionId(value: string): value is EditorActionId {
  return (ACTION_IDS as readonly string[]).includes(value)
}

/** The Window-menu action that shows a panel, so both stay in step. */
export function panelActionId(panel: PanelId): EditorActionId {
  return PANEL_ACTION_IDS[panel]
}

/** Every node id in paint order, used by Show All and Unlock All. */
function allNodeIds(): NodeId[] {
  return paintOrder(documentStore.getState().document)
}

function anyNode(predicate: (node: LayerNode) => boolean): boolean {
  const document = documentStore.getState().document
  for (const id of allNodeIds()) {
    const node = findNode(document, id)
    if (node !== null && predicate(node)) return true
  }
  return false
}

function nodeOf(id: NodeId): LayerNode | null {
  return findNode(documentStore.getState().document, id)
}

/**
 * Applies flag changes through one transaction, so a multi-object Hide or Lock is a
 * single undo step, the way it is in Illustrator.
 *
 * This needs the aggregate inverse from issue #34: a transaction used to keep only the
 * first inverse, which restored the first node and left the others changed, so #28 had to
 * record one entry per node. Now the transaction commits a batch of every command with a
 * batch of the inverses in reverse order as its inverse, and one undo step restores all of
 * them. A change that would do nothing records no history at all.
 */
function applyFlags(
  ids: NodeId[],
  next: (node: LayerNode) => { locked: boolean; hidden: boolean } | null,
  label: string,
) {
  if (ids.length === 0) return
  documentStore.beginTransaction(label)
  let changed = false
  for (const id of ids) {
    const node = nodeOf(id)
    if (node === null) continue
    const flags = next(node)
    if (flags === null) continue
    const result = documentStore.dispatch({
      type: 'setFlags',
      nodeId: id,
      locked: flags.locked,
      hidden: flags.hidden,
    })
    if (result.ok) changed = true
  }
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

function selectedIds(): NodeId[] {
  return documentStore.getState().selection
}

/** Illustrator's font-size list, so Increase/Decrease Size steps the way its menu does. */
export const FONT_SIZE_STEPS = [6, 8, 9, 10, 11, 12, 14, 16, 18, 21, 24, 30, 36, 48, 60, 72, 96, 144]

export function nextFontSize(current: number, direction: 1 | -1): number {
  const epsilon = 1e-6
  if (direction === 1) {
    return FONT_SIZE_STEPS.find((step) => step > current + epsilon) ?? Math.min(1000, current * 1.2)
  }
  const descending = [...FONT_SIZE_STEPS].reverse()
  return descending.find((step) => step < current - epsilon) ?? Math.max(1, current / 1.2)
}

/** The text nodes in the selection. */
function selectedTextNodes() {
  const document = documentStore.getState().document
  return documentStore
    .getState()
    .selection.map((id) => findNode(document, id))
    .filter((node): node is TextNode => node !== null && isText(node))
}

/**
 * Applies a text-style change to every selected text node in one transaction, so a size or
 * alignment change is one history entry no matter how many text objects are selected.
 */
function applyTextStyle(patch: (node: TextNode) => { fontSize: number; fontFamily: string; align: TextAlign; lineHeight: number }, label: string) {
  const targets = selectedTextNodes()
  if (targets.length === 0) return
  documentStore.beginTransaction(label)
  let changed = false
  for (const node of targets) {
    const next = patch(node)
    if (next.fontSize === node.fontSize && next.align === node.align) continue
    const result = documentStore.dispatch({
      type: 'setTextStyle',
      nodeId: node.id,
      fontSize: next.fontSize,
      fontFamily: next.fontFamily,
      align: next.align,
      lineHeight: next.lineHeight,
      width: node.width,
      height: node.height,
    })
    if (result.ok) changed = true
  }
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/**
 * Runs a planned gesture: every step goes through `dispatch` inside one transaction, so the
 * whole gesture is one history entry (the aggregate inverse from #34). A step that fails
 * anyway rolls the applied steps back before the transaction is dropped, so a refused plan
 * leaves the document exactly as it was rather than half-applied.
 */
function runPlan(steps: PlanStep[] | null, label: string) {
  if (steps === null || steps.length === 0) return
  documentStore.beginTransaction(label)
  const applied: Command[] = []
  for (const step of steps) {
    const result = documentStore.dispatch(stepCommand(step))
    if (!result.ok) {
      for (const inverse of [...applied].reverse()) documentStore.dispatch(inverse)
      documentStore.abortTransaction()
      return
    }
    applied.push(result.inverse)
  }
  documentStore.commitTransaction()
}

const ARRANGE_WHERE: Partial<Record<EditorActionId, ArrangeWhere>> = {
  'object.arrangeFront': 'front',
  'object.arrangeForward': 'forward',
  'object.arrangeBackward': 'backward',
  'object.arrangeBack': 'back',
}

/** Runs a Layers-panel drop; exported so the panel shares the planning with the store. */
export function runLayerDrop(rows: LayerRow[], dragging: NodeId[], targetRowId: NodeId, ratio: number) {
  const document = documentStore.getState().document
  runPlan(planDrop(document, rows, dragging, targetRowId, ratio), 'reorder layers')
}

/**
 * Places an image from picked or dropped bytes (issue #17): limits and decode first, then one
 * `placeImage` command that inserts the node and registers the asset together, so undo removes
 * both. Any failure is reported through the store's error path and leaves the document alone.
 */
export async function placeImage(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<NodeId | null> {
  const document = documentStore.getState().document
  const imported = await importImageBytes(name, mimeType, bytes, document.assets.length)
  if (!imported.ok) {
    documentStore.reportError(imported.code, imported.message)
    return null
  }
  const { ref } = imported.asset
  const artboard = document.artboards[0]
  const node = createImage(
    name,
    Math.max(0, (artboard.width - ref.width) / 2),
    Math.max(0, (artboard.height - ref.height) / 2),
    ref.id,
    ref.width,
    ref.height,
  )
  const result = documentStore.dispatch(
    {
      type: 'placeImage',
      parentId: document.root.id,
      index: document.root.children.length,
      node,
      asset: ref,
    },
    'place image',
  )
  if (!result.ok) {
    documentStore.reportError(result.code, result.message)
    return null
  }
  // The bytes are remembered only after the document accepted the asset, so a rejected import
  // cannot leave an orphan in memory.
  assetRegistry.put({ ref, bytes: imported.asset.bytes, name: imported.asset.name })
  documentStore.setSelection([node.id])
  return node.id
}

/** Opens the platform file dialog and places whatever the user picks. */
export async function placeImageFromDialog(): Promise<void> {
  const picked = await pickImageFile()
  if (picked === null) return
  await placeImage(picked.name, picked.mimeType, picked.bytes)
}

/** Whether an action can do anything right now; menus disable what cannot run. */
export function canRunAction(id: EditorActionId, editor: EditorState): boolean {
  switch (id) {
    case 'edit.undo':
      return editor.canUndo
    case 'edit.redo':
      return editor.canRedo
    case 'edit.clear':
    case 'object.hideSelection':
    case 'object.lockSelection':
      return editor.selection.length > 0
    case 'object.showAll':
      return anyNode((node) => node.hidden)
    case 'object.unlockAll':
      return anyNode((node) => node.locked)
    case 'object.group':
      return planGroup(editor.document, editor.selection) !== null
    case 'object.ungroup':
      return planUngroup(editor.document, editor.selection) !== null
    case 'type.sizeUp':
    case 'type.sizeDown':
    case 'type.alignLeft':
    case 'type.alignCenter':
    case 'type.alignRight':
      // Illustrator greys the Type commands out until text is selected.
      return editor.selection.some((id) => {
        const node = findNode(editor.document, id)
        return node !== null && isText(node)
      })
    case 'object.arrangeFront':
    case 'object.arrangeForward':
    case 'object.arrangeBackward':
    case 'object.arrangeBack': {
      const where = ARRANGE_WHERE[id]
      return where !== undefined && planArrange(editor.document, editor.selection, where).length > 0
    }
    default:
      return true
  }
}

/** Runs one action. Components reach the stores through this table and nowhere else. */
export function runEditorAction(id: EditorActionId): void {
  const editor = documentStore.getState()
  const workspace = workspaceStore.getState()
  switch (id) {
    case 'tool.select':
      documentStore.setTool('select')
      return
    case 'tool.rect':
      documentStore.setTool('rect')
      return
    case 'tool.ellipse':
      documentStore.setTool('ellipse')
      return
    case 'tool.text':
      documentStore.setTool('text')
      return
    case 'file.place':
      // Importing is asynchronous (dialog, decode, hashing); failures surface through the
      // store's error path, which the canvas already renders.
      void placeImageFromDialog()
      return
    case 'type.sizeUp':
      applyTextStyle((node) => ({ ...node, fontSize: nextFontSize(node.fontSize, 1) }), 'increase size')
      return
    case 'type.sizeDown':
      applyTextStyle((node) => ({ ...node, fontSize: nextFontSize(node.fontSize, -1) }), 'decrease size')
      return
    case 'type.alignLeft':
      applyTextStyle((node) => ({ ...node, align: 'left' }), 'align left')
      return
    case 'type.alignCenter':
      applyTextStyle((node) => ({ ...node, align: 'center' }), 'align center')
      return
    case 'type.alignRight':
      applyTextStyle((node) => ({ ...node, align: 'right' }), 'align right')
      return
    case 'edit.undo':
      documentStore.undo()
      return
    case 'edit.redo':
      documentStore.redo()
      return
    case 'edit.clear': {
      const selection = selectedIds()
      if (selection.length === 0) return
      documentStore.dispatch({ type: 'removeNodes', nodeIds: selection }, 'delete')
      documentStore.clearSelection()
      return
    }
    case 'select.all':
      documentStore.selectAll()
      return
    case 'select.deselect':
      documentStore.clearSelection()
      documentStore.clearError()
      return
    case 'object.hideSelection':
      applyFlags(selectedIds(), (node) => (node.hidden ? null : { locked: node.locked, hidden: true }), 'hide selection')
      return
    case 'object.lockSelection':
      applyFlags(selectedIds(), (node) => (node.locked ? null : { locked: true, hidden: node.hidden }), 'lock selection')
      return
    case 'object.showAll':
      applyFlags(allNodeIds(), (node) => (node.hidden ? { locked: node.locked, hidden: false } : null), 'show all')
      return
    case 'object.unlockAll':
      applyFlags(allNodeIds(), (node) => (node.locked ? { locked: false, hidden: node.hidden } : null), 'unlock all')
      return
    case 'object.group': {
      const selection = selectedIds()
      const plan = planGroup(editor.document, selection)
      if (plan === null) return
      const created = plan[0]
      runPlan(plan, 'group')
      // Illustrator leaves the new group selected, which is what makes a following Ungroup
      // and the Arrange commands act on it.
      if (created.kind === 'insert' && created.nodes.length > 0 && documentStore.getState().document.root !== null) {
        documentStore.setSelection([created.nodes[0].id])
      }
      return
    }
    case 'object.ungroup': {
      const plan = planUngroup(editor.document, selectedIds())
      if (plan === null) return
      const released = plan.filter((step) => step.kind === 'move').map((step) => step.nodeId)
      runPlan(plan, 'ungroup')
      if (released.length > 0) documentStore.setSelection(released)
      return
    }
    case 'object.arrangeFront':
    case 'object.arrangeForward':
    case 'object.arrangeBackward':
    case 'object.arrangeBack': {
      const where = ARRANGE_WHERE[id]
      if (where === undefined) return
      runPlan(planArrange(editor.document, selectedIds(), where), `arrange: ${where}`)
      return
    }
    case 'view.zoomIn':
      documentStore.setViewport(zoomByStep(editor.viewport, 1, workspace.canvas))
      return
    case 'view.zoomOut':
      documentStore.setViewport(zoomByStep(editor.viewport, -1, workspace.canvas))
      return
    case 'view.fitArtboard':
      documentStore.setViewport(fitArtboard(editor.document.artboards[0], workspace.canvas))
      return
    case 'view.actualSize':
      documentStore.setViewport(actualSize(editor.viewport, workspace.canvas))
      return
    case 'window.togglePanel.layers':
    case 'window.togglePanel.properties':
    case 'window.togglePanel.appearance':
    case 'window.togglePanel.color': {
      const panel = (Object.keys(PANEL_ACTION_IDS) as PanelId[]).find((candidate) => PANEL_ACTION_IDS[candidate] === id)
      if (panel !== undefined) workspaceStore.togglePanel(panel)
      return
    }
    case 'help.about':
      workspaceStore.setAboutOpen(true)
      return
  }
}

