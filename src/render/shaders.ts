/**
 * Skia shader colours.
 *
 * CanvasKit's `Color(hi, lo, hi, alpha)` returns three channels divided by 255 but leaves alpha as
 * 0-255, while shader APIs - `MakeLinearGradient`, `MakeRadialGradient` - expect four channels in
 * 0-1. Passing `Color()` straight into a gradient therefore painted every stop as white/clamped,
 * which is why a gradient used to make a shape look invisible on a white page (issue #156).
 *
 * This module turns a hex colour into the array those APIs actually want, and is pure so it can be
 * tested without a canvas.
 */

/** One hex colour as `[r, g, b, a]`, each in 0-1. */
export function shaderColor(hex: string): Float32Array {
  const value = hex.replace('#', '')
  const channel = (index: number): number => {
    const pair = value.slice(index * 2, index * 2 + 2)
    const parsed = Number.parseInt(pair, 16)
    return Number.isFinite(parsed) ? parsed / 255 : 0
  }
  // Document colours are opaque hex; alpha is full unless a caller passes four bytes.
  return new Float32Array([channel(0), channel(1), channel(2), 1])
}

/** A gradient's stop colours, in the order the shader wants them. */
export function shaderColors(hexes: string[]): Float32Array[] {
  return hexes.map(shaderColor)
}
