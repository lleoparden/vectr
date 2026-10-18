/**
 * Keyboard map (issue #28).
 *
 * Keys follow Illustrator's defaults wherever Vectr has the equivalent command, so
 * muscle memory carries over: V/A for the selection tools, M for the rectangle
 * tool, L for the ellipse, Ctrl+Z / Ctrl+Shift+Z for undo and redo, Ctrl+A /
 * Ctrl+Shift+A for select all and deselect, Ctrl+2 / Ctrl+3 for lock and hide, and
 * Ctrl+0 / Ctrl+1 for Fit Artboard in Window and Actual Size. Entries marked
 * `illustratorDefault: false` are Vectr additions and are listed as divergences in
 * `docs/DECISIONS.md`.
 *
 * The table is data, not a switch statement, because the tool palette tooltips and
 * the menus print the same chords and a test asserts the whole map is consistent.
 */

import type { EditorActionId } from '../actions.ts'

export type KeyChord = {
  /** Lower-case `KeyboardEvent.key`, with two accepted spellings: `delete`/`backspace`. */
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export type ShortcutSpec = {
  id: EditorActionId
  chord: KeyChord
  /** True when this is Illustrator's own default for the command. */
  illustratorDefault: boolean
  /** Why a divergence exists; required when `illustratorDefault` is false. */
  note?: string
}

export const SHORTCUTS: readonly ShortcutSpec[] = [
  // Tools (Illustrator: V = Selection, A = Direct Selection, Q = Lasso, M = Rectangle, L = Ellipse,
  // T = Type).
  { id: 'tool.select', chord: { key: 'v' }, illustratorDefault: true },
  { id: 'tool.directSelect', chord: { key: 'a' }, illustratorDefault: true },
  { id: 'tool.lasso', chord: { key: 'q' }, illustratorDefault: true },
  { id: 'tool.rect', chord: { key: 'm' }, illustratorDefault: true },
  { id: 'tool.roundedRect', chord: { key: 'j' }, illustratorDefault: false, note: 'Illustrator has no key for the rounded rectangle tool, which Vectr does' },
  { id: 'tool.ellipse', chord: { key: 'l' }, illustratorDefault: true },
  // Illustrator's Line Segment tool. Polygon, Star, and Arc have no Illustrator defaults, so
  // Vectr deliberately does not invent keys that would collide with a real Illustrator habit.
  { id: 'tool.line', chord: { key: '\\' }, illustratorDefault: true },
  { id: 'tool.text', chord: { key: 't' }, illustratorDefault: true },
  // Shift+O is Illustrator's own chord for the Artboard tool.
  { id: 'tool.artboard', chord: { key: 'o', shift: true }, illustratorDefault: true },

  // File (Illustrator's document chords, then Place).
  { id: 'file.new', chord: { key: 'n', ctrl: true }, illustratorDefault: true },
  { id: 'file.open', chord: { key: 'o', ctrl: true }, illustratorDefault: true },
  { id: 'file.save', chord: { key: 's', ctrl: true }, illustratorDefault: true },
  { id: 'file.saveAs', chord: { key: 's', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'file.place', chord: { key: 'p', ctrl: true, shift: true }, illustratorDefault: true },

  // Type (Illustrator's size and alignment chords).
  { id: 'type.sizeUp', chord: { key: '>', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.sizeDown', chord: { key: '<', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.alignLeft', chord: { key: 'l', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.alignCenter', chord: { key: 'c', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.alignRight', chord: { key: 'r', ctrl: true, shift: true }, illustratorDefault: true },

  // Edit.
  // Edit (Illustrator's Preferences chord on Windows is Ctrl+K).
  { id: 'edit.preferences', chord: { key: 'k', ctrl: true }, illustratorDefault: true },
  { id: 'edit.undo', chord: { key: 'z', ctrl: true }, illustratorDefault: true },
  { id: 'edit.redo', chord: { key: 'z', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'edit.cut', chord: { key: 'x', ctrl: true }, illustratorDefault: true },
  { id: 'edit.copy', chord: { key: 'c', ctrl: true }, illustratorDefault: true },
  { id: 'edit.paste', chord: { key: 'v', ctrl: true }, illustratorDefault: true },
  { id: 'edit.clear', chord: { key: 'delete' }, illustratorDefault: true },
  { id: 'edit.clear', chord: { key: 'backspace' }, illustratorDefault: false, note: 'Extra binding for keyboards without a Delete key.' },

  // Select.
  { id: 'select.all', chord: { key: 'a', ctrl: true }, illustratorDefault: true },
  { id: 'select.deselect', chord: { key: 'a', ctrl: true, shift: true }, illustratorDefault: true },

  // Object.
  { id: 'object.group', chord: { key: 'g', ctrl: true }, illustratorDefault: true },
  { id: 'object.ungroup', chord: { key: 'g', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'object.arrangeFront', chord: { key: ']', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'object.arrangeForward', chord: { key: ']', ctrl: true }, illustratorDefault: true },
  { id: 'object.arrangeBackward', chord: { key: '[', ctrl: true }, illustratorDefault: true },
  { id: 'object.arrangeBack', chord: { key: '[', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'object.hideSelection', chord: { key: '3', ctrl: true }, illustratorDefault: true },
  { id: 'object.showAll', chord: { key: '3', ctrl: true, alt: true }, illustratorDefault: true },
  { id: 'object.lockSelection', chord: { key: '2', ctrl: true }, illustratorDefault: true },
  { id: 'object.unlockAll', chord: { key: '2', ctrl: true, alt: true }, illustratorDefault: true },

  // View.
  { id: 'view.zoomIn', chord: { key: '=', ctrl: true }, illustratorDefault: true },
  { id: 'view.zoomIn', chord: { key: '+', ctrl: true }, illustratorDefault: true },
  { id: 'view.zoomOut', chord: { key: '-', ctrl: true }, illustratorDefault: true },
  { id: 'view.fitArtboard', chord: { key: '0', ctrl: true }, illustratorDefault: true },
  { id: 'view.actualSize', chord: { key: '1', ctrl: true }, illustratorDefault: true },
  { id: 'view.smartGuides', chord: { key: 'u', ctrl: true }, illustratorDefault: true },

  // Window: Illustrator's panel shortcuts.
  { id: 'window.togglePanel.layers', chord: { key: 'f7' }, illustratorDefault: true },
  { id: 'window.togglePanel.color', chord: { key: 'f6' }, illustratorDefault: true },
  { id: 'window.togglePanel.appearance', chord: { key: 'f6', shift: true }, illustratorDefault: true },
]

function chordKey(chord: KeyChord): string {
  return `${chord.ctrl === true ? 'ctrl+' : ''}${chord.shift === true ? 'shift+' : ''}${chord.alt === true ? 'alt+' : ''}${chord.key}`
}

/** Printable form, in the order Illustrator's own menus use. */
export function chordLabel(chord: KeyChord): string {
  const parts: string[] = []
  if (chord.ctrl === true) parts.push('Ctrl')
  if (chord.shift === true) parts.push('Shift')
  if (chord.alt === true) parts.push('Alt')
  const name =
    chord.key === 'escape'
      ? 'Esc'
      : chord.key === 'delete'
        ? 'Del'
        : chord.key === 'backspace'
          ? 'Backspace'
          : chord.key.length === 1
            ? chord.key.toUpperCase()
            : chord.key.toUpperCase()
  parts.push(name)
  return parts.join('+')
}

/**
 * Normalizes a keyboard event into a chord; modifiers that are absent stay absent.
 *
 * Brackets are folded to their unshifted spelling because a browser reports `}` and `{` while
 * Shift is held, and Illustrator's own chords are written Ctrl+Shift+].
 */
const SHIFTED_KEYS: Record<string, string> = { '}': ']', '{': '[', '+': '=', _: '-' }

export function chordFromEvent(event: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}): KeyChord {
  const raw = event.key.toLowerCase()
  const chord: KeyChord = { key: SHIFTED_KEYS[raw] ?? raw }
  if (event.ctrlKey === true || event.metaKey === true) chord.ctrl = true
  if (event.shiftKey === true) chord.shift = true
  if (event.altKey === true) chord.alt = true
  return chord
}

/** Returns the action bound to a chord, or null when the key is unbound. */
export function matchShortcut(chord: KeyChord, map: readonly ShortcutSpec[] = SHORTCUTS): EditorActionId | null {
  const wanted = chordKey(chord)
  for (const spec of map) {
    if (chordKey(spec.chord) === wanted) return spec.id
  }
  return null
}

/** The chord a menu item or tooltip prints for an action. */
export function shortcutFor(id: EditorActionId, map: readonly ShortcutSpec[] = SHORTCUTS): ShortcutSpec | null {
  return map.find((spec) => spec.id === id) ?? null
}

export function shortcutLabel(id: EditorActionId, map: readonly ShortcutSpec[] = SHORTCUTS): string | null {
  const spec = shortcutFor(id, map)
  return spec === null ? null : chordLabel(spec.chord)
}

/** Exposed for the consistency test; two actions may not share one chord. */
export function chordKeys(map: readonly ShortcutSpec[] = SHORTCUTS): string[] {
  return map.map((spec) => chordKey(spec.chord))
}
