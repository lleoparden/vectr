/**
 * Panel flyout menu (UI conformance pass after issue #28).
 *
 * Illustrator puts a flyout control at the top right of a panel group: the commands that
 * act on the panel's content, without leaving the panel. This is that control, wired to the
 * shared action table so its commands are the same ones the Object menu runs.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/components/Button.tsx'
import { MenuItem as MenuRow, MenuSurface } from '../ui/components/Menu.tsx'
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
      <Button
        variant="icon"
        label={`${label} panel menu`}
        icon={<IconFlyout size={12} />}
        onClick={() => setOpen((visible) => !visible)}
      />
      {open && (
        <MenuSurface label={`${label} panel menu`} className="right-0 top-full mt-[2px] min-w-[196px]">
          {items.map((id) => {
            const enabled = canRunAction(id, state)
            const chord = shortcutLabel(id)
            return (
              <MenuRow
                key={id}
                label={ACTION_LABELS[id]}
                chord={chord}
                disabled={!enabled}
                onSelect={() => {
                  if (!enabled) return
                  runEditorAction(id)
                  setOpen(false)
                }}
              />
            )
          })}
        </MenuSurface>
      )}
    </div>
  )
}
