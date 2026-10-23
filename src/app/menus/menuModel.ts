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
import { labelFor } from '../commands/registry.ts'

export type CommandItem = { kind: 'command'; id: EditorActionId; label: string }

/**
 * A command item whose label comes from the registry, so a menu cannot rename a command and the
 * palette, the menus, and the shortcut hints always agree (Phase 3.4).
 */
function command(id: EditorActionId): CommandItem {
  return { kind: 'command', id, label: labelFor(id) }
}

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
      command('file.new'),
      command('file.open'),
      { kind: 'separator' },
      command('file.save'),
      command('file.saveAs'),
      { kind: 'separator' },
      command('file.place'),
      command('file.placeLinked'),
      { kind: 'separator' },
      command('file.recover'),
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      command('edit.undo'),
      command('edit.redo'),
      { kind: 'separator' },
      command('edit.cut'),
      command('edit.copy'),
      command('edit.paste'),
      { kind: 'separator' },
      command('edit.clear'),
      { kind: 'separator' },
      command('edit.preferences'),
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
          command('object.arrangeFront'),
          command('object.arrangeForward'),
          command('object.arrangeBackward'),
          command('object.arrangeBack'),
        ],
      },
      {
        kind: 'submenu',
        label: 'Align',
        items: [
          command('object.alignLeft'),
          command('object.alignCenterH'),
          command('object.alignRight'),
          command('object.alignTop'),
          command('object.alignCenterV'),
          command('object.alignBottom'),
          command('object.distributeH'),
          command('object.distributeV'),
        ],
      },
      command('object.makeClip'),
      command('object.releaseClip'),
      command('object.isolate'),
      command('object.exitIsolation'),
      command('object.group'),
      command('object.ungroup'),
      { kind: 'separator' },
      command('object.lockSelection'),
      command('object.unlockAll'),
      { kind: 'separator' },
      command('object.hideSelection'),
      command('object.showAll'),
    ],
  },
  {
    id: 'type',
    label: 'Type',
    items: [
      command('type.alignLeft'),
      command('type.alignCenter'),
      command('type.alignRight'),
            command('text.thread'),
      { kind: 'separator' },
      command('type.sizeUp'),
      command('type.sizeDown'),
    ],
  },
  {
    id: 'select',
    label: 'Select',
    items: [
      command('select.all'),
      command('select.deselect'),
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      command('view.zoomIn'),
      command('view.zoomOut'),
      { kind: 'separator' },
      command('view.fitArtboard'),
      command('view.actualSize'),
      command('view.rulers'),
      command('view.grid'),
      command('view.guides'),
      command('view.clearGuides'),
      command('view.smartGuides'),
    ],
  },
  {
    id: 'window',
    label: 'Window',
    items: [
      command('window.togglePanel.layers'),
      command('window.togglePanel.properties'),
      command('window.togglePanel.align'),
      command('window.togglePanel.transform'),
      command('window.togglePanel.appearance'),
      command('window.togglePanel.color'),
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [command('help.about')],
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
