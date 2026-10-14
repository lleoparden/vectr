/**
 * Context-menu contents (issue #20).
 *
 * Both the canvas and the Layers panel offer the object commands Illustrator offers on a
 * right-click, in Illustrator's grouping and order, so the two menus cannot drift apart.
 */

import { isLocked } from '../doc/commands.ts'
import { documentStore } from '../state/documentStore.ts'
import type { ContextMenuItem } from './ContextMenu.tsx'

/** Rearrange, group, hide, lock, and delete — the canvas right-click menu. */
export function objectContextItems(): ContextMenuItem[] {
  return [
    { kind: 'command', id: 'object.arrangeFront' },
    { kind: 'command', id: 'object.arrangeForward' },
    { kind: 'command', id: 'object.arrangeBackward' },
    { kind: 'command', id: 'object.arrangeBack' },
    { kind: 'separator' },
    { kind: 'command', id: 'object.group' },
    { kind: 'command', id: 'object.ungroup' },
    { kind: 'separator' },
    {
      kind: 'custom',
      label: 'Delete',
      enabled: documentStore.getState().selection.length > 0,
      run: () => {
        // A locked layer cannot be deleted, so the delete skips locked nodes rather than
        // failing the whole command (Illustrator refuses the whole delete instead).
        const document = documentStore.getState().document
        const removable = documentStore.getState().selection.filter((id) => !isLocked(document, id))
        if (removable.length === 0) return
        documentStore.dispatch({ type: 'removeNodes', nodeIds: removable }, 'delete')
        documentStore.clearSelection()
      },
    },
    { kind: 'separator' },
    { kind: 'command', id: 'object.hideSelection' },
    { kind: 'command', id: 'object.showAll' },
    { kind: 'command', id: 'object.lockSelection' },
    { kind: 'command', id: 'object.unlockAll' },
  ]
}

/** Canvas-only additions: selection commands Illustrator keeps in Select. */
export function canvasContextItems(): ContextMenuItem[] {
  return [
    { kind: 'command', id: 'select.all' },
    { kind: 'command', id: 'select.deselect' },
    { kind: 'separator' },
    ...objectContextItems(),
  ]
}

/** A Layers-panel row: rename first, the way Illustrator's layer menu starts. */
export function layerRowContextItems(onRename: () => void): ContextMenuItem[] {
  return [
    {
      kind: 'custom',
      label: 'Rename Layer',
      enabled: documentStore.getState().selection.length === 1,
      run: onRename,
    },
    { kind: 'separator' },
    ...objectContextItems(),
  ]
}
