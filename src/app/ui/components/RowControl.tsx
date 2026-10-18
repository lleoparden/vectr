/**
 * The one row-sized icon control (issue #133).
 *
 * The Layers panel had four spellings of the same button - locate, disclosure, hide, lock - differing only in
 * which state attribute they expose. They are one component with parameters.
 */

import type { ReactNode } from 'react'

export type RowControlProps = {
  label: string
  title?: string
  icon: ReactNode
  width: number
  height: number
  /** A toggle: sets aria-pressed. */
  pressed?: boolean
  /** A disclosure: sets aria-expanded. */
  expanded?: boolean
  /** Draws the control in the accent colour, for the locate pointer. */
  accent?: boolean
  className?: string
  data?: Record<string, string | undefined>
  onClick: () => void
}

export function RowControl({
  label,
  title,
  icon,
  width,
  height,
  pressed,
  expanded,
  accent = false,
  className = '',
  data,
  onClick,
}: RowControlProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      style={{ width, height }}
      onClick={onClick}
      data-ui-row-control
      className={`flex shrink-0 items-center justify-center rounded-ui transition-colors hover:text-ink ${
        accent ? 'text-accent' : 'text-ink-faint'
      } ${className}`}
      {...(data ?? {})}
    >
      {icon}
    </button>
  )
}
