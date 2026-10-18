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

import type { EditorActionId } from '../actions.ts'

export type CommandItem = { kind: 'command'; id: EditorActionId; label: string }

export type MenuItem =
  | CommandItem
  | { kind: 'separator' }
  /** Illustrator's menus nest (Object > Arrange); this is one level of that. */
  | { kind: 'submenu'; label: string; items: CommandItem[] }

export type MenuSpec = {
  id: string
  label: string
  items: MenuItem[]
}

export const MENU_BAR: MenuSpec[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { kind: 'command', id: 'file.new', label: 'New' },
      { kind: 'command', id: 'file.open', label: 'Open…' },
      { kind: 'separator' },
      { kind: 'command', id: 'file.save', label: 'Save' },
      { kind: 'command', id: 'file.saveAs', label: 'Save As…' },
      { kind: 'separator' },
      { kind: 'command', id: 'file.place', label: 'Place…' },
      { kind: 'command', id: 'file.placeLinked', label: 'Place Linked…' },
      { kind: 'separator' },
      { kind: 'command', id: 'file.recover', label: 'Recover Unsaved Work' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { kind: 'command', id: 'edit.undo', label: 'Undo' },
      { kind: 'command', id: 'edit.redo', label: 'Redo' },
      { kind: 'separator' },
      { kind: 'command', id: 'edit.cut', label: 'Cut' },
      { kind: 'command', id: 'edit.copy', label: 'Copy' },
      { kind: 'command', id: 'edit.paste', label: 'Paste' },
      { kind: 'separator' },
      { kind: 'command', id: 'edit.clear', label: 'Clear' },
      { kind: 'separator' },
      { kind: 'command', id: 'edit.preferences', label: 'Preferences…' },
    ],
  },
  {
    id: 'object',
    label: 'Object',
    items: [
      {
        kind: 'submenu',
        label: 'Arrange',
        items: [
          { kind: 'command', id: 'object.arrangeFront', label: 'Bring to Front' },
          { kind: 'command', id: 'object.arrangeForward', label: 'Bring Forward' },
          { kind: 'command', id: 'object.arrangeBackward', label: 'Send Backward' },
          { kind: 'command', id: 'object.arrangeBack', label: 'Send to Back' },
        ],
      },
      {
        kind: 'submenu',
        label: 'Align',
        items: [
          { kind: 'command', id: 'object.alignLeft', label: 'Horizontal Align Left' },
          { kind: 'command', id: 'object.alignCenterH', label: 'Horizontal Align Center' },
          { kind: 'command', id: 'object.alignRight', label: 'Horizontal Align Right' },
          { kind: 'command', id: 'object.alignTop', label: 'Vertical Align Top' },
          { kind: 'command', id: 'object.alignCenterV', label: 'Vertical Align Center' },
          { kind: 'command', id: 'object.alignBottom', label: 'Vertical Align Bottom' },
          { kind: 'command', id: 'object.distributeH', label: 'Distribute Horizontal Centers' },
          { kind: 'command', id: 'object.distributeV', label: 'Distribute Vertical Centers' },
        ],
      },
      { kind: 'command', id: 'object.makeClip', label: 'Make Clipping Mask' },
      { kind: 'command', id: 'object.releaseClip', label: 'Release Clipping Mask' },
      { kind: 'command', id: 'object.isolate', label: 'Isolate Selection' },
      { kind: 'command', id: 'object.exitIsolation', label: 'Exit Isolation Mode' },
      { kind: 'command', id: 'object.group', label: 'Group' },
      { kind: 'command', id: 'object.ungroup', label: 'Ungroup' },
      { kind: 'separator' },
      { kind: 'command', id: 'object.lockSelection', label: 'Lock Selection' },
      { kind: 'command', id: 'object.unlockAll', label: 'Unlock All' },
      { kind: 'separator' },
      { kind: 'command', id: 'object.hideSelection', label: 'Hide Selection' },
      { kind: 'command', id: 'object.showAll', label: 'Show All' },
    ],
  },
  {
    id: 'type',
    label: 'Type',
    items: [
      { kind: 'command', id: 'type.alignLeft', label: 'Horizontal Align Left' },
      { kind: 'command', id: 'type.alignCenter', label: 'Horizontal Align Center' },
      { kind: 'command', id: 'type.alignRight', label: 'Horizontal Align Right' },
      { kind: 'separator' },
      { kind: 'command', id: 'type.sizeUp', label: 'Increase Size' },
      { kind: 'command', id: 'type.sizeDown', label: 'Decrease Size' },
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
      { kind: 'command', id: 'view.rulers', label: 'Rulers' },
      { kind: 'command', id: 'view.grid', label: 'Grid' },
      { kind: 'command', id: 'view.guides', label: 'Guides' },
      { kind: 'command', id: 'view.clearGuides', label: 'Clear Guides' },
      { kind: 'command', id: 'view.smartGuides', label: 'Smart Guides' },
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
    label: 'Effect',
    reason: 'Vectr has no effects, appearances, or raster effects, and no plan for them before Phase 3.',
  },
]

/** Menu items in flat order, so keyboard traversal can walk one list. Submenus are separate. */
export function menuCommands(menu: MenuSpec): CommandItem[] {
  return menu.items.filter((item): item is CommandItem => item.kind === 'command')
}

/** Every action a menu can run, including the ones inside its submenus. */
export function menuActionIds(menu: MenuSpec): EditorActionId[] {
  const ids: EditorActionId[] = []
  for (const item of menu.items) {
    if (item.kind === 'command') ids.push(item.id)
    else if (item.kind === 'submenu') ids.push(...item.items.map((child) => child.id))
  }
  return ids
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
