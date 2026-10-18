/**
 * Crash-recovery dialog (owner spec: after a crash Vectr must say it closed in the wrong way and
 * bring the work back).
 *
 * It appears at launch only when the previous session ended without an orderly quit **and** a
 * recovery copy is waiting. Restoring reopens the document where it lived; Discard throws the copy
 * away; Escape closes the dialog and leaves the copy for the File menu, so the safe answer is never
 * the destructive one.
 */

import { useEffect, useRef } from 'react'
import { Button } from '../ui/components/Button.tsx'
import { Backdrop } from '../ui/components/Menu.tsx'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { dismissCrashPrompt, resolveCrashPrompt } from '../files/fileActions.ts'
import { crashRecoveryCopy } from '../files/recoveryPrompt.ts'

export function CrashRecoveryDialog() {
  const workspace = useWorkspaceState()
  const prompt = workspace.crashPrompt
  const restoreRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (prompt === null) return
    restoreRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        dismissCrashPrompt()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [prompt?.savedAt, prompt?.documentName])

  if (prompt === null) return null
  const copy = crashRecoveryCopy(prompt)

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="crash-recovery-title"
        aria-describedby="crash-recovery-body"
        data-crash-dialog="open"
        className="w-[420px] rounded-ui border border-hairline bg-chrome-raised p-4 shadow-xl shadow-black/50"
      >
        <h2 id="crash-recovery-title" className="text-ui-sm font-semibold text-ink">
          {copy.title}
        </h2>
        <p id="crash-recovery-body" className="mt-2 text-ui-xs leading-5 text-ink-muted">
          {copy.body}
        </p>
        <p className="mt-2 text-ui-xs leading-5 text-ink-faint">{copy.detail}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="dialog"
            size="md"
            data={{ 'data-crash-action': 'discard' }}
            onClick={() => void resolveCrashPrompt('discard')}
          >
            {copy.discard}
          </Button>
          <Button
            ref={restoreRef}
            variant="primary"
            size="md"
            data={{ 'data-crash-action': 'restore' }}
            onClick={() => void resolveCrashPrompt('restore')}
          >
            {copy.restore}
          </Button>
        </div>
        <p className="mt-3 text-ui-xs text-ink-faint">Escape keeps the copy; it stays under File ▸ Recover Unsaved Work.</p>
      </div>
      <Backdrop onClick={() => dismissCrashPrompt()} />
    </div>
  )
}
