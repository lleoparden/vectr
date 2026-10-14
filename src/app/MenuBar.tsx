/**
 * Menu bar (issue #28).
 *
 * Illustrator's menu names, order, and command placement, with only the commands
 * Vectr actually has (see `menuModel.ts` for the omissions and why). It behaves like
 * a real menu bar: click or keyboard opens a menu, arrow keys walk it, Escape
 * closes it, and a command that cannot run right now is shown greyed the way
 * Illustrator shows it.
 *
 * Every item runs an action from `actions.ts`, so the menu cannot bypass the store's
 * validated command path.
 */

import { useEffect, useRef, useState } from 'react'
import { canRunAction, runEditorAction } from './actions.ts'
import { MENU_BAR, menuCommands, type MenuItem, type MenuSpec } from './menuModel.ts'
import { shortcutLabel } from './shortcuts.ts'
import { useEditorState } from '../state/useEditorState.ts'

type CommandItem = Extract<MenuItem, { kind: 'command' }>

const TITLE_CLASS =
  'rounded-ui px-2 py-[3px] text-ui-sm text-ink hover:bg-chrome-active aria-expanded:bg-chrome-active'

export function MenuBar() {
  const state = useEditorState()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const openMenu: MenuSpec | null = openIndex === null ? null : MENU_BAR[openIndex]

  useEffect(() => {
    if (openMenu === null) return
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenIndex(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openMenu])

  // Focus follows the keyboard, so arrow keys move the highlight like a real menu.
  useEffect(() => {
    if (openIndex === null) return
    itemRefs.current[focusIndex]?.focus()
  }, [openIndex, focusIndex])

  function firstEnabledIndex(menu: MenuSpec): number {
    const index = menuCommands(menu).findIndex((item) => canRunAction(item.id, state))
    return index === -1 ? 0 : index
  }

  function openAt(index: number, withKeyboard: boolean) {
    setOpenIndex(index)
    setFocusIndex(withKeyboard ? firstEnabledIndex(MENU_BAR[index]) : 0)
  }

  function closeTo(index: number) {
    setOpenIndex(null)
    barRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-title]')[index]?.focus()
  }

  function moveFocus(delta: number) {
    if (openMenu === null) return
    const count = menuCommands(openMenu).length
    if (count === 0) return
    setFocusIndex((current) => (current + delta + count) % count)
  }

  function run(item: CommandItem) {
    if (!canRunAction(item.id, state)) return
    runEditorAction(item.id)
    setOpenIndex(null)
  }

  function onTitleKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      openAt((index + 1) % MENU_BAR.length, true)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      openAt((index - 1 + MENU_BAR.length) % MENU_BAR.length, true)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAt(index, true)
      return
    }
    if (event.key === 'Escape') setOpenIndex(null)
  }

  function onItemKeyDown(event: React.KeyboardEvent, item: CommandItem) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeTo(openIndex ?? 0)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(-1)
      return
    }
    if (event.key === 'ArrowRight' && openIndex !== null) {
      event.preventDefault()
      openAt((openIndex + 1) % MENU_BAR.length, true)
      return
    }
    if (event.key === 'ArrowLeft' && openIndex !== null) {
      event.preventDefault()
      openAt((openIndex - 1 + MENU_BAR.length) % MENU_BAR.length, true)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      run(item)
    }
  }

  return (
    <div
      ref={barRef}
      role="menubar"
      aria-label="Main menu"
      className="relative z-30 flex h-[26px] shrink-0 items-center border-b border-hairline bg-chrome px-1"
    >
      {MENU_BAR.map((menu, index) => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            data-menu-title
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openIndex === index}
            className={TITLE_CLASS}
            onClick={() => (openIndex === index ? setOpenIndex(null) : openAt(index, false))}
            onPointerEnter={() => {
              if (openIndex !== null && openIndex !== index) openAt(index, false)
            }}
            onKeyDown={(event) => onTitleKeyDown(event, index)}
          >
            {menu.label}
          </button>
          {openIndex === index && (
            <div
              role="menu"
              aria-label={menu.label}
              className="absolute left-0 top-full z-40 mt-[2px] min-w-[236px] rounded-ui border border-hairline bg-chrome-raised py-1 shadow-lg shadow-black/40"
            >
              {menu.items.map((item, itemIndex) => {
                if (item.kind === 'separator') {
                  return <div key={`separator-${itemIndex}`} role="separator" className="my-1 h-px bg-hairline" />
                }
                const enabled = canRunAction(item.id, state)
                const chord = shortcutLabel(item.id)
                const order = menuCommands(menu).findIndex((candidate) => candidate.id === item.id)
                return (
                  <button
                    key={item.id}
                    ref={(element) => {
                      itemRefs.current[order] = element
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={order === focusIndex ? 0 : -1}
                    aria-disabled={!enabled}
                    title={enabled ? undefined : `${item.label} is not available right now`}
                    className={`flex w-full items-center justify-between gap-6 px-3 py-[3px] text-left text-ui-sm ${
                      enabled ? 'text-ink hover:bg-accent-soft' : 'cursor-default text-ink-faint'
                    }`}
                    onClick={() => run(item)}
                    onKeyDown={(event) => onItemKeyDown(event, item)}
                  >
                    <span>{item.label}</span>
                    {chord !== null && <span className="text-ui-xs text-ink-faint">{chord}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2 pr-1 text-ui-xs text-ink-faint">
        <span className="text-ink-muted">{state.document.name}</span>
        <span aria-hidden="true">·</span>
        <span>Vectr</span>
      </div>
    </div>
  )
}
