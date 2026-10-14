/**
 * Panel flyout menu (UI conformance pass after issue #28).
 *
 * Illustrator puts a flyout control at the top right of a panel group: the commands that
 * act on the panel's content, without leaving the panel. This is that control, wired to the
 * shared action table so its commands are the same ones the Object menu runs.
 */

import { useEffect, useRef, useState } from 'react'
import { ACTION_LABELS, canRunAction, runEditorAction, type EditorActionId } from '../actions.ts'
import { IconFlyout } from '../ui/icons.tsx'
import { shortcutLabel } from '../menus/shortcuts.ts'
import { useEditorState } from '../../state/useEditorState.ts'

export function PanelFlyout({ label, items }: { label: string; items: EditorActionId[] }) {
  const state = useEditorState()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} panel menu`}
        title={`${label} panel menu`}
        className="px-1 text-ink-faint hover:text-ink"
        onClick={() => setOpen((visible) => !visible)}
      >
        <IconFlyout size={12} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`${label} panel menu`}
          className="absolute right-0 top-full z-40 mt-[2px] min-w-[196px] rounded-ui border border-hairline bg-chrome-raised py-1 shadow-lg shadow-black/40"
        >
          {items.map((id) => {
            const enabled = canRunAction(id, state)
            const chord = shortcutLabel(id)
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                aria-disabled={!enabled}
                className={`flex w-full items-center justify-between gap-4 px-3 py-[3px] text-left text-ui-xs ${
                  enabled ? 'text-ink hover:bg-accent-soft' : 'cursor-default text-ink-faint'
                }`}
                onClick={() => {
                  if (!enabled) return
                  runEditorAction(id)
                  setOpen(false)
                }}
              >
                <span>{ACTION_LABELS[id]}</span>
                {chord !== null && <span className="text-ink-faint">{chord}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
