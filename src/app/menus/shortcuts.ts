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

import type { EditorActionId, KeyChord, ShortcutSpec } from '../commands/registry.ts'
import { SHORTCUTS } from '../commands/registry.ts'

// The chord table lives in the command registry (Phase 3.4); this module is the key handling.
export { SHORTCUTS }
export type { KeyChord, ShortcutSpec }

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
