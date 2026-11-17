/**
 * Resolve Missing Fonts dialog (Phase 6.8).
 *
 * Vectr ships one face (Inter), so documents authored with other families report them here. The dialog
 * lists the missing families and substitutes them with the bundled face in one undo entry; it never
 * silently rewrites typography without the user seeing which families are affected.
 */

import { useEffect, useRef } from 'react'

import { substituteMissingFonts } from '../actions.ts'
import { Button } from '../ui/components/Button.tsx'
import { missingFontFamilies } from '../../doc/missingFonts.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { workspaceStore } from '../../state/workspaceStore.ts'

export function MissingFontsDialog() {
  const workspace = useWorkspaceState()
  const editor = useEditorState()
  const open = workspace.missingFontsOpen
  const closeRef = useRef<HTMLButtonElement>(null)
  const missing = open ? missingFontFamilies(editor.document) : []

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        workspaceStore.setMissingFontsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-fonts-title"
        data-missing-fonts-dialog="open"
        className="w-[420px] rounded-ui border border-hairline bg-chrome-raised p-4 shadow-xl shadow-black/50"
      >
        <h2 id="missing-fonts-title" className="text-ui-sm font-semibold text-ink">
          Missing Fonts
        </h2>
        {missing.length === 0 ? (
          <p className="mt-3 text-ui-xs text-ink-muted">No missing fonts in this document.</p>
        ) : (
          <>
            <p className="mt-3 text-ui-xs leading-5 text-ink-muted">
              These families are not installed. Substituting them with <strong className="text-ink">Inter</strong> keeps
              the layout close, and the change is one undo entry.
            </p>
            <ul data-missing-fonts-list className="mt-3 max-h-40 space-y-1 overflow-auto text-ui-xs text-ink">
              {missing.map((family) => (
                <li key={family} className="rounded-ui border border-hairline px-2 py-1">
                  {family}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="quiet" size="md" onClick={() => workspaceStore.setMissingFontsOpen(false)}>
            Cancel
          </Button>
          {missing.length > 0 && (
            <Button
              ref={closeRef}
              variant="primary"
              size="md"
              data={{ 'data-missing-fonts-action': 'apply' }}
              onClick={() => substituteMissingFonts()}
            >
              Substitute with Inter
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
