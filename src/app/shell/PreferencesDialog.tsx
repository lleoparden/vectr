/**
 * Preferences dialog (owner spec: "the user can change the interval on the settings").
 *
 * Illustrator puts "Automatically Save Recovery Data Every: N minutes" in Preferences, so this
 * does too. The values live in `settingsStore`, which persists them; this dialog only renders and
 * clamps them. It states the two rules plainly rather than leaving them to be discovered: autosave
 * only touches a document that has been saved, and a crash copy is offered at the next launch.
 */

import { useEffect, useRef, useState } from 'react'
import { workspaceStore } from '../../state/workspaceStore.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { settingsStore, useSettings } from '../../state/useSettings.ts'
import { MAX_AUTOSAVE_INTERVAL_MINUTES, MIN_AUTOSAVE_INTERVAL_MINUTES } from '../files/autosavePolicy.ts'
import { recoveryStatusText } from '../files/recoveryPrompt.ts'

export function PreferencesDialog() {
  const workspace = useWorkspaceState()
  const settings = useSettings()
  const editor = useEditorState()
  const closeRef = useRef<HTMLButtonElement>(null)
  // The field keeps its own draft so a half-typed number is not clamped mid-keystroke.
  const [draft, setDraft] = useState(String(settings.autosaveIntervalMinutes))
  const open = workspace.preferencesOpen

  useEffect(() => {
    if (!open) return
    setDraft(String(settings.autosaveIntervalMinutes))
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        workspaceStore.setPreferencesOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  if (!open) return null

  const applyDraft = () => {
    settingsStore.setAutosaveIntervalMinutes(Number(draft))
    setDraft(String(settingsStore.getState().autosaveIntervalMinutes))
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        data-preferences-dialog="open"
        className="w-[440px] rounded-ui border border-hairline bg-chrome-raised p-4 shadow-xl shadow-black/50"
      >
        <h2 id="preferences-title" className="text-ui-sm font-semibold text-ink">
          Preferences
        </h2>

        <label className="mt-4 flex items-center gap-2 text-ui-xs text-ink">
          <input
            type="checkbox"
            checked={settings.autosaveEnabled}
            onChange={(event) => settingsStore.setAutosaveEnabled(event.currentTarget.checked)}
          />
          Automatically save recovery data
        </label>

        <label className="mt-3 flex items-center gap-2 text-ui-xs text-ink">
          Every
          <input
            type="number"
            aria-label="Autosave interval in minutes"
            min={MIN_AUTOSAVE_INTERVAL_MINUTES}
            max={MAX_AUTOSAVE_INTERVAL_MINUTES}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={applyDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyDraft()
            }}
            className="w-16 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
          />
          minutes
          <span className="text-ink-faint">
            ({MIN_AUTOSAVE_INTERVAL_MINUTES}–{MAX_AUTOSAVE_INTERVAL_MINUTES})
          </span>
        </label>

        <ul className="mt-4 space-y-1 text-ui-xs leading-5 text-ink-muted">
          <li>Autosave covers documents that have already been saved to a file, so Save stays yours to press.</li>
          <li>The copy is written to Vectr's own folder, never inside your project.</li>
          <li>If Vectr does not shut down cleanly, the next launch offers that copy back.</li>
        </ul>

        <p data-recovery-status className="mt-3 text-ui-xs text-ink-faint">
          {recoveryStatusText(editor.recovery.savedAt)}
          {editor.filePath === null ? ' This document has no file yet, so it is not autosaved.' : ''}
        </p>

        <div className="mt-4 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            data-preferences-action="done"
            className="rounded-ui bg-accent px-3 py-1 text-ui-xs text-white hover:opacity-90"
            onClick={() => workspaceStore.setPreferencesOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
