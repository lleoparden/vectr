/**
 * The one menu kit (issue #133).
 *
 * A menu surface, an item, a title, and a separator. The menu bar, the panel flyouts, and the canvas context
 * menu were three spellings of the same rows; the keyboard navigation and refs are passed through as props so the
 * behaviour of each stays exactly where it was.
 */

import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react'

const SURFACE = 'absolute z-40 rounded-ui border border-hairline bg-chrome-raised py-1 shadow-lg shadow-black/40'
const ITEM = 'flex w-full items-center justify-between gap-4 px-3 py-[3px] text-left text-ui-xs'
const TITLE = 'px-2 py-[3px] text-ui-xs hover:bg-chrome-hover aria-expanded:bg-chrome-active'

export function MenuSurface({
  label,
  className = '',
  style,
  children,
}: {
  label: string
  className?: string
  style?: React.CSSProperties
  children: ReactNode
}) {
  return (
    <div role="menu" aria-label={label} className={`${SURFACE} ${className}`} style={style}>
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-hairline" />
}

export type MenuItemProps = {
  label: string
  /** The chord printed on the right, when the item has one. */
  chord?: string | null
  disabled?: boolean
  hasPopup?: boolean
  expanded?: boolean
  title?: string
  /** A submenu arrow (or anything else) instead of a chord. */
  trailing?: ReactNode
  itemRef?: Ref<HTMLButtonElement>
  tabIndex?: number
  onSelect?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  onPointerEnter?: () => void
  className?: string
}

export function MenuItem({
  label,
  chord,
  disabled = false,
  hasPopup,
  expanded,
  title,
  trailing,
  itemRef,
  tabIndex,
  onSelect,
  onKeyDown,
  onPointerEnter,
  className = '',
}: MenuItemProps) {
  return (
    <button
      ref={itemRef}
      type="button"
      role="menuitem"
      aria-disabled={disabled}
      aria-haspopup={hasPopup === true ? 'true' : undefined}
      aria-expanded={hasPopup === true ? expanded : undefined}
      title={title}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onPointerEnter={onPointerEnter}
      data-menu-item
      className={`${ITEM} ${disabled ? 'cursor-default text-ink-faint' : 'text-ink hover:bg-accent-soft active:bg-accent-deep'} ${className}`}
    >
      <span>{label}</span>
      {trailing ?? (chord !== null && chord !== undefined ? <span className="text-ui-xs text-ink-faint">{chord}</span> : null)}
    </button>
  )
}

export function MenuTitle({
  label,
  open,
  onClick,
  onPointerEnter,
  onKeyDown,
}: {
  label: string
  open: boolean
  onClick: () => void
  onPointerEnter: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      data-menu-title
      role="menuitem"
      aria-haspopup="true"
      aria-expanded={open}
      className={TITLE}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onKeyDown={onKeyDown}
    >
      {/* The mnemonic letter is underlined, the way Illustrator marks Alt access keys. */}
      <span className="underline decoration-1 underline-offset-2">{label.slice(0, 1)}</span>
      {label.slice(1)}
    </button>
  )
}

/** A full-screen click-away surface: a dialog's dismiss area, not a button-shaped control. */
export function Backdrop({ onClick, label = 'Dismiss' }: { onClick: (event: MouseEvent<HTMLButtonElement>) => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      className="absolute inset-0 -z-10 cursor-default"
      onClick={onClick}
      data-ui-backdrop
    />
  )
}
