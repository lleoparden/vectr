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
import type { LayerNode, NodeId } from '../doc/types.ts'
import { documentStore, type EditorState } from '../state/documentStore.ts'
import { workspaceStore, type PanelId } from '../state/workspaceStore.ts'
import { actualSize, canvasCenter, fitArtboard, zoomByStep } from './viewportOps.ts'

export const ACTION_IDS = [
  'tool.select',
  'tool.rect',
  'tool.ellipse',
  'edit.undo',
  'edit.redo',
  'edit.clear',
  'select.all',
  'select.deselect',
  'object.hideSelection',
  'object.showAll',
  'object.lockSelection',
  'object.unlockAll',
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
  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'edit.clear': 'Clear',
  'select.all': 'All',
  'select.deselect': 'Deselect',
  'object.hideSelection': 'Hide Selection',
  'object.showAll': 'Show All',
  'object.lockSelection': 'Lock Selection',
  'object.unlockAll': 'Unlock All',
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

