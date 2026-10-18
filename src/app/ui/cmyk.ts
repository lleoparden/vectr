/**
 * CMYK and RGB conversion for named swatches (issue #69).
 *
 * Deliberately a plain arithmetic conversion, **not** a colour-managed one: there is no ICC profile
 * in the product yet, so pretending to match a press would be a bigger lie than saying so. The CMYK
 * values a person enters are stored exactly as entered; the RGB here is what the renderer and the
 * exported code use to show the ink.
 */

import type { Cmyk } from '../../doc/types.ts'

/** CMYK percentages (0–100) to a `#rrggbb` string. */
export function cmykToHex(cmyk: Cmyk): string {
  const toRgb = (value: number, ink: number) => Math.round(255 * (1 - value / 100) * (1 - ink / 100))
  const hex = (value: number) => value.toString(16).padStart(2, '0')
  return '#' + hex(toRgb(cmyk.c, cmyk.k)) + hex(toRgb(cmyk.m, cmyk.k)) + hex(toRgb(cmyk.y, cmyk.k))
}

/** The CMYK values that reproduce a hex colour in that same plain arithmetic. */
export function hexToCmyk(hex: string): Cmyk | null {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null
  if (normalized === null) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const k = 1 - Math.max(r, g, b)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const component = (value: number) => Math.round(((1 - value - k) / (1 - k)) * 100)
  return { c: component(r), m: component(g), y: component(b), k: Math.round(k * 100) }
}
