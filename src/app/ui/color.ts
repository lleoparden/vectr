/**
 * Colour helpers for the panel fields.
 *
 * Pure and tested: a colour the user types must either become a valid `#rrggbb` string the document
 * accepts or be refused, never silently mangled. Everything here works on the hex form the document
 * stores, so there is one colour representation in the product.
 */

export type Rgb = { r: number; g: number; b: number }

/** Accepts `#rgb`, `#rrggbb`, or either without the hash; returns `#rrggbb` or null. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.split('')
    return ('#' + r + r + g + g + b + b).toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return ('#' + trimmed).toLowerCase()
  return null
}

export function toRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex)
  if (normalized === null) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

/** True when text on this colour should be dark, so a swatch label stays readable. */
export function isLightColor(hex: string): boolean {
  const rgb = toRgb(hex)
  if (rgb === null) return false
  // Rec. 709 luma: green dominates perceived brightness, which is what makes this simple and right.
  return (rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722) / 255 > 0.55
}

/** The quick palette the panels offer, kept in one place so every colour control agrees. */
export const PANEL_SWATCHES = [
  '#000000',
  '#1e1e23',
  '#3c3c45',
  '#74747f',
  '#c9c9d4',
  '#ffffff',
  '#e2665c',
  '#e8a33d',
  '#f2d94e',
  '#2fbf9f',
  '#4f7cff',
  '#7c6cf5',
]
