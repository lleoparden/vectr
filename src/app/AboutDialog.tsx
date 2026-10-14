/**
 * About dialog (issue #28).
 *
 * Illustrator has Help > About; this is Vectr's, and it also states the UI
 * direction honestly: the workspace follows Illustrator, the artwork and icons are
 * Vectr's own.
 */

import { useEffect, useRef } from 'react'
import { workspaceStore } from '../state/workspaceStore.ts'
import { useWorkspaceState } from '../state/useWorkspaceState.ts'

export function AboutDialog() {
  const workspace = useWorkspaceState()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!workspace.aboutOpen) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        workspaceStore.setAboutOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [workspace.aboutOpen])

  if (!workspace.aboutOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="w-[420px] rounded-ui-lg border border-hairline bg-chrome-raised p-4 shadow-xl shadow-black/50"
      >
        <h2 id="about-title" className="text-ui-md font-medium text-ink">
          Vectr
        </h2>
        <p className="pt-2 text-ui-xs text-ink-muted">
          A desktop visual design tool whose layer tree exports as readable React components with Tailwind.
        </p>
        <p className="pt-2 text-ui-xs text-ink-faint">
          The workspace follows Illustrator on purpose, so the tools, panels, and shortcuts are where you expect
          them. The icons, type, colors, and copy are Vectr&apos;s own.
        </p>
        <p className="pt-2 text-ui-xs text-ink-faint">
          Document format v1 · nothing is saved to disk yet (issue #19).
        </p>
        <div className="flex justify-end pt-3">
          <button
            ref={closeRef}
            type="button"
            className="rounded-ui border border-hairline bg-chrome px-3 py-1 text-ui-xs text-ink hover:bg-chrome-active"
            onClick={() => workspaceStore.setAboutOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
