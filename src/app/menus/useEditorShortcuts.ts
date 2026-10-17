/**
 * Keyboard shortcuts (issue #18, table-driven since issue #28).
 *
 * The keys are Illustrator's own defaults wherever Vectr has the equivalent command,
 * and the table lives in `shortcuts.ts` so the menus and the tool palette print the
 * same chords. Every chord runs an action from `actions.ts`, which means the keyboard
 * cannot reach the document except through the validated command path. Text fields
 * are skipped so a future text editor (#16) can own the keyboard while it has focus,
 * and keys pressed inside an open menu or dialog are left to that surface.
 */

import { useEffect } from 'react'
import { canRunAction, nudgeSelection, runEditorAction } from '../actions.ts'
import { chordFromEvent, matchShortcut } from './shortcuts.ts'
import { documentStore } from '../../state/documentStore.ts'

/** Illustrator's nudge steps: one scene unit, or ten with Shift held. */
const NUDGE_STEP = 1
const NUDGE_STEP_BIG = 10

/** Arrow keys are transforms rather than menu commands, so they live beside the chord table. */
const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** True while a menu or a modal dialog owns the keyboard. */
function isMenuOrDialogTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('[role="menu"], [role="menubar"], [role="dialog"]') !== null
}

export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A surface that already handled the key owns it: the Layers panel uses the arrows to
      // navigate and marks them handled, and this must not also nudge the selection.
      if (event.defaultPrevented) return
      if (isTypingTarget(event.target) || isMenuOrDialogTarget(event.target)) return
      // Escape cancels, as it does in Illustrator: menus and dialogs close themselves and
      // the pending rejection notice goes away. Deselect is Ctrl+Shift+A, not Escape.
      if (event.key === 'Escape') {
        documentStore.clearError()
        return
      }
      // Arrow keys nudge the selection (issue #65). Illustrator's arrows work in every tool, so
      // they are not part of the chord table; the move still goes through `setTransform`.
      const arrow = ARROWS[event.key.toLowerCase()]
      if (arrow !== undefined && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (documentStore.getState().selection.length === 0) return
        event.preventDefault()
        const step = event.shiftKey ? NUDGE_STEP_BIG : NUDGE_STEP
        nudgeSelection(arrow[0] * step, arrow[1] * step)
        return
      }
      const action = matchShortcut(chordFromEvent(event))
      if (action === null) return
      // A chord that cannot run right now (undo with an empty history) does nothing,
      // which is what Illustrator does too.
      if (!canRunAction(action, documentStore.getState())) return
      event.preventDefault()
      runEditorAction(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
