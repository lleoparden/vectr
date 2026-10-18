/**
 * The one list-row button (issue #133).
 *
 * A layer name and a named swatch are the same idea: a full-width, left-aligned row with a name and optional
 * trailing detail. One component, so the two cannot drift apart.
 */

import type { ReactNode } from 'react'

export type ListItemProps = {
  label: string
  title?: string
  active?: boolean
  height?: number
  data?: Record<string, string | undefined>
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onDoubleClick?: () => void
  children: ReactNode
  className?: string
}

export function ListItem({
  label,
  title,
  active = false,
  height,
  data,
  onPointerDown,
  onClick,
  onDoubleClick,
  children,
  className = '',
}: ListItemProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      style={height === undefined ? undefined : { height }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-ui-list-item
      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-ui px-1 text-left text-ui-xs transition-colors ${
        active ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-chrome-hover hover:text-ink'
      } ${className}`}
      {...(data ?? {})}
    >
      {children}
    </button>
  )
}
