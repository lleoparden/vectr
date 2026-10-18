/**
 * Panel field primitives (UI pass).
 *
 * One set of controls for every panel, so a number, a colour, and a menu all have the same height,
 * radius, focus ring, and label alignment. Two rules they all follow:
 *
 * 1. **Live.** Edits reach the document on every keystroke, slider move, or wheel turn — the panel
 *    never waits for a blur to look right.
 * 2. **One undo entry per session.** Focusing a field opens a transaction and blurring closes it, so
 *    dragging a colour wheel across a hundred values is still a single step to undo.
 *
 * They are deliberately small and unopinionated: the panel owns layout, the field owns behaviour.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { isLightColor, normalizeHex, PANEL_SWATCHES } from '../../geom/color.ts'
import { beginLiveEdit, endLiveEdit, markLiveChanged } from './liveEdit.ts'

const FIELD =
  'h-6 w-full min-w-0 rounded-ui border border-hairline bg-chrome-sunken px-1.5 text-ui-xs text-ink ' +
  'outline-none transition-colors focus:border-accent focus:bg-chrome-active ' +
  'hover:border-chrome-active disabled:opacity-40'

const LABEL = 'w-14 shrink-0 truncate text-ui-xs text-ink-faint'

/** A titled block of fields, which is how Illustrator groups Appearance/Transform values. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-b border-hairline/60 py-1.5 last:border-b-0">
      <h3 className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">{title}</h3>
      <div className="flex min-w-0 flex-col gap-1 px-2">{children}</div>
    </section>
  )
}

/** One label/control row; the label column is fixed so the controls line up down the panel. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className={LABEL}>{label}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1">{children}</span>
    </label>
  )
}

/** A plain read-only value row, for things the document does not let you edit yet. */
export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={LABEL}>{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-ui-xs text-ink-muted">{value}</span>
    </div>
  )
}

type NumberFieldProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

/** A number that edits as you type, guarded against non-finite input. */
export function NumberField({ label, value, min, max, step = 1, suffix, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(round(value)))
  const focused = useRef(false)

  // While the field is not focused it follows the document, so an undo or a nudge updates it.
  useEffect(() => {
    if (!focused.current) setDraft(String(round(value)))
  }, [value])

  return (
    <Field label={label}>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft}
        className={`${FIELD} text-right tabular-nums`}
        onFocus={() => {
          focused.current = true
          beginLiveEdit(label)
        }}
        onBlur={() => {
          focused.current = false
          endLiveEdit()
          setDraft(String(round(value)))
        }}
        onChange={(event) => {
          const next = event.currentTarget.value
          setDraft(next)
          if (next.trim() === '') return
          const parsed = Number(next)
          if (!Number.isFinite(parsed)) return
          markLiveChanged()
          onChange(parsed)
        }}
      />
      {suffix !== undefined && <span className="shrink-0 text-ui-xs text-ink-faint">{suffix}</span>}
    </Field>
  )
}

/** A 0–100 slider with a numeric readout, for opacity — dragging should be live by nature. */
export function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (percent: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={100}
        step={1}
        defaultValue={Math.round(value * 100)}
        className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-chrome-active accent-[var(--color-accent)]"
        onFocus={() => beginLiveEdit(label)}
        onBlur={() => endLiveEdit()}
        onChange={(event) => {
          markLiveChanged()
          onChange(Number(event.currentTarget.value))
        }}
      />
      <span className="w-8 shrink-0 text-right text-ui-xs tabular-nums text-ink-muted">{Math.round(value * 100)}%</span>
    </Field>
  )
}

/** A select that applies on change; menus do not need a transaction. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value}
        className={`${FIELD} cursor-pointer`}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option[0].toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** A text field that applies as you type (dash patterns, names). */
export function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        defaultValue={value}
        className={FIELD}
        onFocus={() => beginLiveEdit(label)}
        onBlur={() => endLiveEdit()}
        onChange={(event) => {
          markLiveChanged()
          onChange(event.currentTarget.value)
        }}
      />
    </Field>
  )
}

/** Recently picked colours, shared by every colour field in the session. */
const recent: string[] = []

function remember(color: string) {
  const index = recent.indexOf(color)
  if (index >= 0) recent.splice(index, 1)
  recent.unshift(color)
  recent.length = Math.min(recent.length, 8)
}

export type ColorFieldProps = {
  label: string
  value: string
  onChange: (color: string) => void
  /** Extra colours offered first, for example the document's own colours. */
  suggestions?: string[]
}

/**
 * A colour control with the options a colour needs: the platform wheel, a hex field, a fixed palette,
 * and the colours used most recently. The swatch is the trigger; everything else is in the popover so
 * the panel stays narrow and never scrolls sideways.
 */
export function ColorField({ label, value, onChange, suggestions = [] }: ColorFieldProps) {
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const palette = [...new Set([...suggestions, ...recent, ...PANEL_SWATCHES])]

  useEffect(() => setHexDraft(value), [value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
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

  const commit = (color: string | null) => {
    if (color === null) return
    remember(color)
    markLiveChanged()
    onChange(color)
  }

  return (
    <Field label={label}>
      <div ref={rootRef} className="relative min-w-0 flex-1">
        <button
          type="button"
          aria-label={`${label}: ${value}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-color-trigger={label}
          className="flex h-6 w-full min-w-0 items-center gap-1.5 rounded-ui border border-hairline bg-chrome-sunken px-1 text-left text-ui-xs text-ink hover:border-chrome-active focus:border-accent focus:outline-none"
          onFocus={() => beginLiveEdit(label)}
          onClick={() => setOpen((current) => !current)}
          onBlur={() => {
            if (!open) endLiveEdit()
          }}
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 rounded-[2px] border border-black/40"
            style={{ background: value }}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-tight">{value}</span>
        </button>
        {open && (
          <div
            role="dialog"
            aria-label={`${label} colour`}
            data-color-panel={label}
            className="absolute right-0 top-7 z-50 w-56 rounded-ui-lg border border-hairline bg-chrome-raised p-2 shadow-xl shadow-black/50"
          >
            <input
              type="color"
              id={id}
              aria-label={`${label} wheel`}
              value={normalizeHex(value) ?? '#000000'}
              className="h-9 w-full cursor-pointer rounded-ui border border-hairline bg-transparent p-0"
              onChange={(event) => commit(normalizeHex(event.currentTarget.value))}
            />
            <div className="mt-2 flex items-center gap-1">
              <span className="text-ui-xs text-ink-faint">Hex</span>
              <input
                type="text"
                aria-label={`${label} hex`}
                value={hexDraft}
                spellCheck={false}
                className={`${FIELD} font-mono text-[10px] uppercase`}
                onChange={(event) => {
                  setHexDraft(event.currentTarget.value)
                  commit(normalizeHex(event.currentTarget.value))
                }}
              />
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1" role="group" aria-label={`${label} swatches`}>
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${label} ${color}`}
                  title={color}
                  className="h-5 w-full rounded-[2px] border border-black/40 outline-none hover:ring-1 hover:ring-accent focus:ring-2 focus:ring-accent"
                  style={{ background: color }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(color)}
                >
                  <span className={isLightColor(color) ? 'text-black text-[8px]' : 'text-white text-[8px]'}>
                    {color.toLowerCase() === value.toLowerCase() ? '✓' : ''}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-ui border border-hairline px-2 py-1 text-ui-xs text-ink-muted hover:bg-chrome-hover hover:text-ink"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Field>
  )
}

/** A switch with a label and an explanation, for toggles like the gradient fill. */
export function ToggleField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center gap-2">
      <span className="relative inline-flex h-4 w-7 shrink-0 items-center">
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          className="peer sr-only"
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-chrome-active transition-colors peer-checked:bg-accent peer-focus-visible:ring-1 peer-focus-visible:ring-accent" />
        <span className="absolute left-0.5 h-3 w-3 rounded-full bg-ink-muted transition-transform peer-checked:translate-x-3 peer-checked:bg-white" />
      </span>
      <span className="min-w-0 flex-1 truncate text-ui-xs text-ink-muted">{label}</span>
      {hint !== undefined && <span className="shrink-0 text-[10px] text-ink-faint">{hint}</span>}
    </label>
  )
}

/** A primary/secondary button row for the panel's actions. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
}

export function PanelButton({
  children,
  onClick,
  disabled,
  tone = 'quiet',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'quiet' | 'accent'
  /** The accessible name; panel buttons carry icon-like short text, so the name is explicit. */
  'aria-label'?: string
}) {
  const base = 'min-w-0 rounded-ui border px-2 py-1 text-ui-xs transition-colors disabled:opacity-40'
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={
        tone === 'accent'
          ? `${base} border-accent bg-accent text-white hover:brightness-110 disabled:hover:brightness-100`
          : `${base} border-hairline text-ink-muted hover:bg-chrome-hover hover:text-ink`
      }
    >
      {children}
    </button>
  )
}

function round(value: number): number {
  return Number.isInteger(value) ? value : Math.round(value * 100) / 100
}
