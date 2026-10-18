/**
 * The one button (issue #133).
 *
 * Panels, dialogs, and the layers foot all needed a button and each spelled its own classes; this is the
 * component they share. Differences are parameters: a variant, a size, an optional icon, a pressed state.
 * An icon-only button must carry a label, because an icon is not an accessible name.
 */

import type { ReactNode, Ref } from 'react'

export type ButtonVariant = 'panel' | 'primary' | 'quiet' | 'danger' | 'icon' | 'dialog'
export type ButtonSize = 'xs' | 'sm' | 'md'

const BASE = 'flex min-w-0 items-center justify-center gap-1 rounded-ui transition-colors disabled:opacity-40'

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-ui-xs',
  sm: 'h-7 px-2.5 text-ui-xs',
  md: 'h-7 px-3 text-ui-xs',
}

function variantClass(variant: ButtonVariant, tone: 'quiet' | 'accent', active: boolean): string {
  switch (variant) {
    case 'primary':
      return 'border border-accent bg-accent text-accent-ink hover:bg-accent-soft disabled:hover:brightness-100'
    case 'danger':
      return 'border border-transparent text-ink-muted hover:bg-chrome-hover hover:text-danger'
    case 'icon':
      return 'h-5 w-5 shrink-0 text-ink-muted hover:bg-chrome-active hover:text-ink'
    case 'dialog':
      return 'border border-hairline bg-chrome text-ink hover:bg-chrome-active'
    case 'quiet':
      return 'border border-transparent text-ink-muted hover:bg-chrome-hover hover:text-ink'
    case 'panel':
    default:
      return tone === 'accent'
        ? 'border border-accent bg-accent text-white hover:brightness-110 disabled:hover:brightness-100'
        : `border border-hairline text-ink-muted hover:bg-chrome-hover hover:text-ink${active ? ' bg-chrome-active text-ink' : ''}`
  }
}

export type ButtonProps = {
  children?: ReactNode
  /** The accessible name. Required for icon-only buttons; used as the tooltip too. */
  label?: string
  title?: string
  variant?: ButtonVariant
  size?: ButtonSize
  tone?: 'quiet' | 'accent'
  /** Draws the button in its on state and sets aria-pressed. */
  active?: boolean
  disabled?: boolean
  icon?: ReactNode
  /** Row-style layout for list rows: centred by default, or spread for a name and a value. */
  align?: 'center' | 'between' | 'start'
  /** Fills the row, for list rows. */
  block?: boolean
  onClick?: () => void
  /** Extra layout only - never a full visual restyle. */
  className?: string
  /** Data attributes the surrounding test or automation reads; passed through verbatim. */
  data?: Record<string, string | undefined>
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  children,
  label,
  title,
  variant = 'panel',
  size = 'xs',
  tone = 'quiet',
  active = false,
  disabled = false,
  icon,
  align = 'center',
  block = false,
  onClick,
  className = '',
  data,
  ref,
}: ButtonProps) {
  const alignment = align === 'between' ? 'justify-between' : align === 'start' ? 'justify-start' : 'justify-center'
  const classes = [
    BASE.replace('justify-center', alignment),
    variant === 'icon' ? '' : SIZES[size],
    variantClass(variant, tone, active),
    block ? 'w-full' : '',
    className,
  ]
    .filter((part) => part.length > 0)
    .join(' ')
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={variant === 'icon' && active ? true : undefined}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={classes}
      data-ui-button={variant}
      {...(data ?? {})}
    >
      {icon}
      {children}
    </button>
  )
}
