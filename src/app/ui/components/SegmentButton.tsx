/**
 * The one segmented-control button (issue #133).
 *
 * The options bar switches, toggles, and standalone actions all rendered the same bordered chip; this is that
 * chip, with its active state as a parameter.
 */

import type { ReactNode } from 'react'

export function SegmentButton({
  children,
  active = false,
  label,
  title,
  disabled = false,
  onClick,
  className = '',
}: {
  children: ReactNode
  active?: boolean
  label?: string
  title?: string
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      data-ui-segment
      className={`h-6 rounded-ui border px-2 text-ui-xs transition-colors disabled:opacity-40 ${
        active
          ? 'border-accent bg-accent text-accent-ink hover:bg-accent-deep'
          : 'border-hairline bg-chrome text-ink-muted hover:bg-chrome-active'
      } ${className}`}
    >
      {children}
    </button>
  )
}
