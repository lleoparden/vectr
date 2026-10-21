/**
 * Offset Path dialog (Phase 5.6, issue #142).
 *
 * Illustrator's Offset Path asks for a distance; the editor already had the command, so this is the
 * prompt it was missing. Escape cancels, Apply runs the one-undo copy, and the field keeps its own
 * draft so a half-typed distance is not clamped mid-keystroke.
 */

import { useEffect, useRef, useState } from 'react'

import { applyOffsetPath } from '../actions.ts'
import { Button } from '../ui/components/Button.tsx'
import { NumberField } from '../ui/components/fields.tsx'
import { workspaceStore } from '../../state/workspaceStore.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'

export function OffsetPathDialog() {
  const workspace = useWorkspaceState()
  const open = workspace.offsetDialogOpen
  const [draft, setDraft] = useState('10')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(String(workspace.offsetDistance))
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        workspaceStore.setOffsetDialogOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  if (!open) return null

  const apply = () => {
    const distance = Number(draft)
    if (Number.isFinite(distance) && distance !== 0) applyOffsetPath(distance)
    else workspaceStore.setOffsetDialogOpen(false)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offset-title"
        data-offset-dialog="open"
        className="w-[360px] rounded-ui border border-hairline bg-chrome-raised p-4 shadow-xl shadow-black/50"
      >
        <h2 id="offset-title" className="text-ui-sm font-semibold text-ink">
          Offset Path
        </h2>
        <label className="mt-4 flex items-center gap-2 text-ui-xs text-ink">
          Offset
          <NumberField
            inline
            label="Offset distance"
            min={-1000}
            max={1000}
            value={Number(draft)}
            onChange={(distance) => setDraft(String(distance))}
          />
          units
        </label>
        <p className="mt-3 text-ui-xs leading-5 text-ink-muted">
          A copy of each selected outline is created at this distance and the original is kept. Positive grows a
          closed contour; negative insets it.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="quiet" size="md" onClick={() => workspaceStore.setOffsetDialogOpen(false)}>
            Cancel
          </Button>
          <Button ref={closeRef} variant="primary" size="md" data={{ 'data-offset-action': 'apply' }} onClick={apply}>
            Offset
          </Button>
        </div>
      </div>
    </div>
  )
}
