/**
 * The one colour tile (issue #133).
 *
 * The Color panel's palette and the colour popover's swatches were the same control written twice: a
 * colour-filled button with an optional selected ring and tick.
 */

import { isLightColor } from '../../../geom/color.ts'

export function SwatchTile({
  color,
  label,
  title,
  selected = false,
  size = 'md',
  onPick,
}: {
  color: string
  label: string
  title?: string
  selected?: boolean
  size?: 'sm' | 'md'
  onPick: () => void
}) {
  const light = isLightColor(color)
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? color}
      aria-pressed={selected}
      onClick={onPick}
      data-ui-swatch-tile
      className={`relative flex ${size === 'sm' ? 'h-5' : 'h-6'} w-full items-center justify-center rounded-ui border text-[9px] transition-transform hover:scale-[1.06] ${
        selected ? 'border-accent ring-1 ring-accent' : 'border-black/40 hover:border-accent/70'
      }`}
      style={{ background: color }}
    >
      {selected && <span className={light ? 'text-black' : 'text-white'}>✓</span>}
    </button>
  )
}
