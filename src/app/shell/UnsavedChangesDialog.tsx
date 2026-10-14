/**
 * Unsaved-changes dialog (UI enhancement after Phase 1).
 *
 * Replaces the operating system's message box so the warning is Vectr's own surface, in Vectr's
 * chrome, with Vectr's copy. It is a real modal: `aria-modal`, a labelled title, focus moved to
 * the primary action, Escape cancels, and the buttons disable while an async save is in flight.
 */

import { useEffect, useRef, useState } from 'react'
import { workspaceStore } from '../../state/workspaceStore.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { resolveUnsavedPrompt } from '../files/fileActions.ts'
import { unsavedCopy } from '../files/unsavedPrompt.ts'

export function UnsavedChangesDialog() {
  const workspace = useWorkspaceState()
  const prompt = workspace.pendingPrompt
  const saveRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (prompt === null) return
    setBusy(false)
    saveRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        void choose('cancel')
      }
      // Keep focus inside the dialog: Tab cycles between the three buttons.
      if (event.key === 'Tab') {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>('[data-unsaved-action]'),
        ).filter((button) => !button.disabled)
        if (buttons.length === 0) return
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length
        event.preventDefault()
        buttons[next].focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
    // `choose` is stable for the life of one prompt; re-registering per prompt is intended.
  }, [prompt?.kind, prompt?.documentName])

  if (prompt === null) return null
  const copy = unsavedCopy(prompt.kind, prompt.documentName)

  async function choose(choice: 'confirm' | 'discard' | 'cancel') {
    if (busy) return
    setBusy(choice === 'confirm')
    workspaceStore.setPromptBusy(choice === 'confirm')
    await resolveUnsavedPrompt(choice)
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-detail"
        className="w-[440px] rounded-ui-lg border border-hairline bg-chrome-raised p-4 shadow-xl shadow-black/50"
      >
        <h2 id="unsaved-title" className="text-ui-md font-medium text-ink">
          {copy.title}
        </h2>
        <p className="pt-2 text-ui-xs text-ink-muted">{copy.message}</p>
        <p id="unsaved-detail" className="pt-2 text-ui-xs text-ink-faint">
          {copy.detail}
        </p>
        <div className="flex items-center justify-end gap-2 pt-4">
          <button
            type="button"
            data-unsaved-action="cancel"
            disabled={busy}
            className="rounded-ui border border-hairline bg-chrome px-3 py-1 text-ui-xs text-ink hover:bg-chrome-active disabled:opacity-50"
            onClick={() => void choose('cancel')}
          >
            {copy.cancelLabel}
          </button>
          <button
            type="button"
            data-unsaved-action="discard"
            disabled={busy}
            className="rounded-ui border border-hairline bg-chrome px-3 py-1 text-ui-xs text-ink hover:bg-chrome-active disabled:opacity-50"
            onClick={() => void choose('discard')}
          >
            {copy.discardLabel}
          </button>
          <button
            ref={saveRef}
            type="button"
            data-unsaved-action="confirm"
            disabled={busy}
            className="rounded-ui border border-accent bg-accent px-3 py-1 text-ui-xs text-accent-ink hover:bg-accent-soft disabled:opacity-50"
            onClick={() => void choose('confirm')}
          >
            {busy ? 'Saving…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
