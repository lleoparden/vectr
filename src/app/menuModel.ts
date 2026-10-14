/**
 * Menu bar model (issue #28).
 *
 * The menu names, their order, and where each command lives follow Illustrator, so
 * an Illustrator user reaches for the right menu without reading. Only commands
 * Vectr actually has appear: per the UI direction a menu that would be empty or a
 * permanently disabled placeholder is omitted instead, and every omission is
 * recorded in `OMITTED_MENUS` here and in the divergence list in
 * `docs/DECISIONS.md`.
 */

import type { EditorActionId } from './actions.ts'

export type MenuItem =
  | { kind: 'command'; id: EditorActionId; label: string }
  | { kind: 'separator' }

export type MenuSpec = {
  id: string
  label: string
  items: MenuItem[]
}

export const MENU_BAR: MenuSpec[] = [
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { kind: 'command', id: 'edit.undo', label: 'Undo' },
      { kind: 'command', id: 'edit.redo', label: 'Redo' },
      { kind: 'separator' },
      { kind: 'command', id: 'edit.clear', label: 'Clear' },
    ],
  },
  {
    id: 'object',
    label: 'Object',
    items: [
      { kind: 'command', id: 'object.hideSelection', label: 'Hide Selection' },
      { kind: 'command', id: 'object.showAll', label: 'Show All' },
      { kind: 'separator' },
      { kind: 'command', id: 'object.lockSelection', label: 'Lock Selection' },
      { kind: 'command', id: 'object.unlockAll', label: 'Unlock All' },
    ],
  },
  {
    id: 'select',
    label: 'Select',
    items: [
      { kind: 'command', id: 'select.all', label: 'All' },
      { kind: 'command', id: 'select.deselect', label: 'Deselect' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { kind: 'command', id: 'view.zoomIn', label: 'Zoom In' },
      { kind: 'command', id: 'view.zoomOut', label: 'Zoom Out' },
      { kind: 'separator' },
      { kind: 'command', id: 'view.fitArtboard', label: 'Fit Artboard in Window' },
      { kind: 'command', id: 'view.actualSize', label: 'Actual Size' },
    ],
  },
  {
    id: 'window',
    label: 'Window',
    items: [
      { kind: 'command', id: 'window.togglePanel.layers', label: 'Layers' },
      { kind: 'command', id: 'window.togglePanel.properties', label: 'Properties' },
      { kind: 'command', id: 'window.togglePanel.appearance', label: 'Appearance' },
      { kind: 'command', id: 'window.togglePanel.color', label: 'Color' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [{ kind: 'command', id: 'help.about', label: 'About Vectr' }],
  },
]

export type OmittedMenu = { label: string; reason: string }

/** Menus Illustrator has that Vectr does not show yet, and why. */
export const OMITTED_MENUS: OmittedMenu[] = [
  {
    label: 'File',
    reason:
      'New, Open, and Save are issue #19; Export React belongs to the compiler phase. The UI direction says an empty menu or a disabled placeholder is worse than an honest omission.',
  },
  {
    label: 'Type',
    reason: 'Text does not exist yet (issue #16).',
  },
  {
    label: 'Effect',
    reason: 'Vectr has no effects, appearances, or raster effects, and no plan for them before Phase 3.',
  },
]

/** Menu items in flat order, so keyboard traversal can walk one list. */
export function menuCommands(menu: MenuSpec): Array<Extract<MenuItem, { kind: 'command' }>> {
  return menu.items.filter((item): item is Extract<MenuItem, { kind: 'command' }> => item.kind === 'command')
}

/**
 * The menu's Alt-key mnemonic, taken from its first letter the way Illustrator's Windows
 * menu bar does it (Alt+E opens Edit). Every menu label starts with a distinct letter, and
 * a test asserts that, so Alt+letter can never be ambiguous.
 */
export function menuMnemonic(menu: MenuSpec): string {
  return menu.label.slice(0, 1).toLowerCase()
}

/** The menu a mnemonic opens, or null when the letter belongs to no menu. */
export function menuForMnemonic(letter: string, menus: MenuSpec[] = MENU_BAR): number {
  const wanted = letter.toLowerCase()
  return menus.findIndex((menu) => menuMnemonic(menu) === wanted)
}

/** A separator cannot come first, last, or sit next to another separator. */
export function separatorsAreSane(menu: MenuSpec): boolean {
  const items = menu.items
  if (items.length === 0) return false
  if (items[0].kind === 'separator' || items[items.length - 1].kind === 'separator') return false
  for (let index = 1; index < items.length; index += 1) {
    if (items[index].kind === 'separator' && items[index - 1].kind === 'separator') return false
  }
  return true
}
