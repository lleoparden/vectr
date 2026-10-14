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
import { canRunAction, runEditorAction } from '../actions.ts'
import { chordFromEvent, matchShortcut } from './shortcuts.ts'
import { documentStore } from '../../state/documentStore.ts'

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
      if (isTypingTarget(event.target) || isMenuOrDialogTarget(event.target)) return
      // Escape cancels, as it does in Illustrator: menus and dialogs close themselves and
      // the pending rejection notice goes away. Deselect is Ctrl+Shift+A, not Escape.
      if (event.key === 'Escape') {
        documentStore.clearError()
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
