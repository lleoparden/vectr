/**
 * The tool palette's three controls (issue #133).
 *
 * A slot is a square icon button with an active state and an optional flyout corner; a member row is the entry
 * inside that flyout. They differ from Button in shape and in the role they expose, so they are their own small
 * component rather than a variant that would leak into every other button.
 */

import type { ReactNode, ComponentType } from 'react'

export function ToolSlot({
  icon: Icon,
  label,
  active,
  size,
  slotId,
  onClick,
  onContextMenu,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  active: boolean
  size: number
  slotId: string
  onClick: () => void
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      data-tool-slot={slotId}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      data-ui-tool-slot
      className={`flex items-center justify-center rounded-ui ${
        active ? 'bg-accent text-ink shadow-[0_1px_5px_rgba(169,74,74,0.38)]' : 'text-ink-muted hover:bg-chrome-hover hover:text-ink'
      }`}
      style={{ width: size, height: size }}
    >
      <Icon size={16} />
    </button>
  )
}

export function ToolFlyoutCorner({
  label,
  open,
  slotId,
  onClick,
}: {
  label: string
  open: boolean
  slotId: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      data-tool-flyout={slotId}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute bottom-0 right-0 flex h-[10px] w-[10px] items-end justify-end pr-[1px] text-ink-muted hover:text-ink"
    >
      <span aria-hidden="true" className="block h-0 w-0 border-b-[4px] border-l-[4px] border-b-current border-l-transparent" />
    </button>
  )
}

export function ToolMemberRow({
  icon: Icon,
  label,
  chord,
  checked,
  toolId,
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  chord: string | null
  checked: boolean
  toolId: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      data-tool-member={toolId}
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 px-2 py-[3px] text-left text-ui-xs text-ink hover:bg-accent-soft"
    >
      <span className="flex items-center gap-2">
        <Icon size={14} />
        {label}
      </span>
      {chord !== null && <span className="text-ui-xs text-ink-faint">{chord}</span>}
    </button>
  )
}
