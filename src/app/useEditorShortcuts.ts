/**
 * Keyboard shortcuts (issue #18).
 *
 * Shortcuts are a thin layer over the command path: they dispatch the same
 * commands the toolbar does, so behavior cannot diverge. Text fields are skipped so
 * a future text editor (#16) can own the keyboard while it has focus.
 */

import { useEffect } from 'react'
import { documentStore } from '../state/documentStore.ts'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const state = documentStore.getState()
      const accel = event.ctrlKey || event.metaKey

      if (accel && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) documentStore.redo()
        else documentStore.undo()
        return
      }
      if (accel && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        documentStore.selectAll()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selection.length === 0) return
        event.preventDefault()
        documentStore.dispatch({ type: 'removeNodes', nodeIds: state.selection }, 'delete')
        documentStore.clearSelection()
        return
      }
      if (event.key === 'Escape') {
        documentStore.clearSelection()
        documentStore.clearError()
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'v') documentStore.setTool('select')
      if (key === 'r') documentStore.setTool('rect')
      if (key === 'e') documentStore.setTool('ellipse')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
