/**
 * Menu bar (issue #28, submenus added with issue #20).
 *
 * Illustrator's menu names, order, and command placement, with only the commands Vectr
 * actually has (see `menuModel.ts` for the omissions and why). It behaves like a real menu
 * bar: click, Alt mnemonic, or keyboard opens a menu, arrow keys walk it, Escape closes it, a
 * submenu opens on hover or ArrowRight (Object > Arrange), and a command that cannot run right
 * now is greyed the way Illustrator shows it.
 *
 * Every item runs an action from `actions.ts`, so the menu cannot bypass the store's validated
 * command path.
 */

import { useEffect, useRef, useState } from 'react'
import { canRunAction, runEditorAction } from './actions.ts'
import { MENU_BAR, menuForMnemonic, type CommandItem, type MenuItem, type MenuSpec } from './menuModel.ts'
import { shortcutLabel } from './shortcuts.ts'
import { useEditorState } from '../state/useEditorState.ts'

type Interactive = CommandItem | Extract<MenuItem, { kind: 'submenu' }>

const TITLE_CLASS =
  'rounded-ui px-2 py-[3px] text-ui-sm text-ink hover:bg-chrome-active aria-expanded:bg-chrome-active'
const ITEM_CLASS = 'flex w-full items-center justify-between gap-6 px-3 py-[3px] text-left text-ui-sm'
const PANEL_CLASS = 'absolute z-40 rounded-ui border border-hairline bg-chrome-raised py-1 shadow-lg shadow-black/40'

function isInteractive(item: MenuItem): item is Interactive {
  return item.kind === 'command' || item.kind === 'submenu'
}

function interactiveItems(menu: MenuSpec): Interactive[] {
  return menu.items.filter(isInteractive)
}

export function MenuBar() {
  const state = useEditorState()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null)
  const [childFocus, setChildFocus] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const childRefs = useRef<Array<HTMLButtonElement | null>>([])

  const openMenu: MenuSpec | null = openIndex === null ? null : MENU_BAR[openIndex]

  useEffect(() => {
    if (openMenu === null) return
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) {
        setOpenIndex(null)
        setOpenSubmenu(null)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openMenu])

  useEffect(() => {
    if (openIndex === null) return
    itemRefs.current[focusIndex]?.focus()
  }, [openIndex, focusIndex])

  useEffect(() => {
    if (openSubmenu === null) return
    childRefs.current[childFocus]?.focus()
  }, [openSubmenu, childFocus])

  // Illustrator's Windows behavior: Alt+letter opens the matching menu by mnemonic.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key.length !== 1) return
      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
        if (target.closest('[role="dialog"]') !== null) return
      }
      const index = menuForMnemonic(event.key)
      if (index === -1) return
      event.preventDefault()
      setOpenIndex(index)
      setFocusIndex(0)
      setOpenSubmenu(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function firstEnabledIndex(menu: MenuSpec): number {
    const index = interactiveItems(menu).findIndex((item) =>
      item.kind === 'command' ? canRunAction(item.id, state) : true,
    )
    return index === -1 ? 0 : index
  }

  function openAt(index: number, withKeyboard: boolean) {
    setOpenIndex(index)
    setOpenSubmenu(null)
    setFocusIndex(withKeyboard ? firstEnabledIndex(MENU_BAR[index]) : 0)
  }

  function closeAll(index?: number) {
    setOpenIndex(null)
    setOpenSubmenu(null)
    if (index !== undefined) barRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-title]')[index]?.focus()
  }

  function moveFocus(delta: number) {
    if (openMenu === null) return
    const count = interactiveItems(openMenu).length
    if (count === 0) return
    setOpenSubmenu(null)
    setFocusIndex((current) => (current + delta + count) % count)
  }

  function run(item: CommandItem) {
    if (!canRunAction(item.id, state)) return
    runEditorAction(item.id)
    closeAll()
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
    if (event.key === 'Escape') closeAll()
  }

  function onItemKeyDown(event: React.KeyboardEvent, item: Interactive, slot: number) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAll(openIndex ?? 0)
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
    if (event.key === 'ArrowRight' && item.kind === 'submenu') {
      event.preventDefault()
      setOpenSubmenu(slot)
      setChildFocus(0)
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
    if (item.kind === 'command' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      run(item)
    }
  }

  function onChildKeyDown(event: React.KeyboardEvent, item: CommandItem, count: number) {
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault()
      setOpenSubmenu(null)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setChildFocus((current) => (current + 1) % count)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setChildFocus((current) => (current - 1 + count) % count)
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
      {MENU_BAR.map((menu, index) => {
        let slot = -1
        return (
          <div key={menu.id} className="relative">
            <button
              type="button"
              data-menu-title
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openIndex === index}
              className={TITLE_CLASS}
              onClick={() => (openIndex === index ? closeAll() : openAt(index, false))}
              onPointerEnter={() => {
                if (openIndex !== null && openIndex !== index) openAt(index, false)
              }}
              onKeyDown={(event) => onTitleKeyDown(event, index)}
            >
              {/* The mnemonic letter is underlined, the way Illustrator marks Alt access keys. */}
              <span className="underline decoration-1 underline-offset-2">{menu.label.slice(0, 1)}</span>
              {menu.label.slice(1)}
            </button>
            {openIndex === index && (
              <div
                role="menu"
                aria-label={menu.label}
                className={`${PANEL_CLASS} left-0 top-full mt-[2px] min-w-[236px]`}
              >
                {menu.items.map((item, itemIndex) => {
                  if (item.kind === 'separator') {
                    return <div key={`separator-${itemIndex}`} role="separator" className="my-1 h-px bg-hairline" />
                  }
                  slot += 1
                  const mySlot = slot
                  if (item.kind === 'submenu') {
                    const children = item.items
                    return (
                      <div
                        key={`submenu-${item.label}`}
                        className="relative"
                        onPointerEnter={() => {
                          setOpenSubmenu(mySlot)
                          setChildFocus(0)
                        }}
                      >
                        <button
                          ref={(element) => {
                            itemRefs.current[mySlot] = element
                          }}
                          type="button"
                          role="menuitem"
                          aria-haspopup="true"
                          aria-expanded={openSubmenu === mySlot}
                          tabIndex={mySlot === focusIndex ? 0 : -1}
                          className={`${ITEM_CLASS} text-ink hover:bg-accent-soft`}
                          onClick={() => {
                            setOpenSubmenu(mySlot)
                            setChildFocus(0)
                          }}
                          onKeyDown={(event) => onItemKeyDown(event, item, mySlot)}
                        >
                          <span>{item.label}</span>
                          <span aria-hidden="true" className="text-ink-faint">
                            ▸
                          </span>
                        </button>
                        {openSubmenu === mySlot && (
                          <div
                            role="menu"
                            aria-label={item.label}
                            className={`${PANEL_CLASS} left-full top-0 -mt-1 ml-[2px] min-w-[212px]`}
                          >
                            {children.map((child, childIndex) => {
                              const enabled = canRunAction(child.id, state)
                              const chord = shortcutLabel(child.id)
                              return (
                                <button
                                  key={child.id}
                                  ref={(element) => {
                                    childRefs.current[childIndex] = element
                                  }}
                                  type="button"
                                  role="menuitem"
                                  aria-disabled={!enabled}
                                  tabIndex={childIndex === childFocus ? 0 : -1}
                                  className={`${ITEM_CLASS} ${
                                    enabled ? 'text-ink hover:bg-accent-soft' : 'cursor-default text-ink-faint'
                                  }`}
                                  onClick={() => run(child)}
                                  onKeyDown={(event) => onChildKeyDown(event, child, children.length)}
                                >
                                  <span>{child.label}</span>
                                  {chord !== null && <span className="text-ui-xs text-ink-faint">{chord}</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }
                  const enabled = canRunAction(item.id, state)
                  const chord = shortcutLabel(item.id)
                  return (
                    <button
                      key={item.id}
                      ref={(element) => {
                        itemRefs.current[mySlot] = element
                      }}
                      type="button"
                      role="menuitem"
                      aria-disabled={!enabled}
                      title={enabled ? undefined : `${item.label} is not available right now`}
                      tabIndex={mySlot === focusIndex ? 0 : -1}
                      className={`${ITEM_CLASS} ${
                        enabled ? 'text-ink hover:bg-accent-soft' : 'cursor-default text-ink-faint'
                      }`}
                      onClick={() => run(item)}
                      onKeyDown={(event) => onItemKeyDown(event, item, mySlot)}
                    >
                      <span>{item.label}</span>
                      {chord !== null && <span className="text-ui-xs text-ink-faint">{chord}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div className="ml-auto flex items-center gap-2 pr-1 text-ui-xs text-ink-faint">
        <span className="text-ink-muted">{state.document.name}</span>
        <span aria-hidden="true">·</span>
        <span>Vectr</span>
      </div>
    </div>
  )
}
