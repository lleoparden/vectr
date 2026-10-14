/**
 * Context menu (issue #20).
 *
 * Illustrator's right-click menus are a core part of how it feels, so the canvas and the
 * Layers panel both open one here. It is the same kind of menu as the menu bar — same items,
 * same greying rules, same action table — just opened at the pointer.
 */

import { useEffect, useRef, useState } from 'react'
import { ACTION_LABELS, canRunAction, runEditorAction, type EditorActionId } from '../actions.ts'
import { shortcutLabel } from '../menus/shortcuts.ts'
import { useEditorState } from '../../state/useEditorState.ts'

export type ContextMenuItem =
  | { kind: 'command'; id: EditorActionId }
  | { kind: 'separator' }
  | { kind: 'custom'; label: string; run: () => void; enabled?: boolean }

export type ContextMenuState = { x: number; y: number; items: ContextMenuItem[] } | null

const PANEL_CLASS =
  'fixed z-50 min-w-[220px] rounded-ui border border-hairline bg-chrome-raised py-1 shadow-lg shadow-black/40'
const ITEM_CLASS = 'flex w-full items-center justify-between gap-6 px-3 py-[3px] text-left text-ui-sm'

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const state = useEditorState()
  const [focusIndex, setFocusIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (menu === null) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('[role="menu"]') !== null) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [menu, onClose])

  useEffect(() => {
    if (menu === null) return
    itemRefs.current[focusIndex]?.focus()
  }, [menu, focusIndex])

  if (menu === null) return null

  const runnable = menu.items.filter((item) => item.kind !== 'separator')

  function enabledOf(item: ContextMenuItem): boolean {
    if (item.kind === 'command') return canRunAction(item.id, state)
    if (item.kind === 'custom') return item.enabled !== false
    return false
  }

  function runOf(item: ContextMenuItem) {
    if (!enabledOf(item)) return
    if (item.kind === 'command') runEditorAction(item.id)
    else if (item.kind === 'custom') item.run()
    onClose()
  }

  // Keep the panel inside the window, the way a native context menu does.
  const width = 240
  const height = Math.min(420, 16 + runnable.length * 24)
  const left = Math.max(4, Math.min(menu.x, window.innerWidth - width - 4))
  const top = Math.max(4, Math.min(menu.y, window.innerHeight - height - 4))

  return (
    <div role="menu" aria-label="Context menu" className={PANEL_CLASS} style={{ left, top }}>
      {menu.items.map((item, index) => {
        if (item.kind === 'separator') {
          return <div key={`separator-${index}`} role="separator" className="my-1 h-px bg-hairline" />
        }
        const enabled = enabledOf(item)
        const chord = item.kind === 'command' ? shortcutLabel(item.id) : null
        const label = item.kind === 'command' ? ACTION_LABELS[item.id] : item.label
        const slot = runnable.indexOf(item)
        return (
          <button
            key={item.kind === 'command' ? item.id : `custom-${item.label}`}
            ref={(element) => {
              itemRefs.current[slot] = element
            }}
            type="button"
            role="menuitem"
            aria-disabled={!enabled}
            tabIndex={slot === focusIndex ? 0 : -1}
            className={`${ITEM_CLASS} ${enabled ? 'text-ink hover:bg-accent-soft' : 'cursor-default text-ink-faint'}`}
            onClick={() => runOf(item)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setFocusIndex((current) => (current + 1) % runnable.length)
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setFocusIndex((current) => (current - 1 + runnable.length) % runnable.length)
                return
              }
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                runOf(item)
              }
            }}
          >
            <span>{label}</span>
            {chord !== null && <span className="text-ui-xs text-ink-faint">{chord}</span>}
          </button>
        )
      })}
    </div>
  )
}
