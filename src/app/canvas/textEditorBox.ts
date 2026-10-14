/**
 * In-place text editor sizing (owner report: the box that appears when you first click with the
 * Type tool is too small — nothing fits in it).
 *
 * The editor must be as big as the text is *now*, not as big as the text was when the object was
 * last committed, and it must be big enough to click into before a single character exists. The
 * measurement itself comes from the same function the commit uses, so the editor and the drawn box
 * agree; this module only applies the minimums and the border compensation.
 *
 * Pure and unit-tested, like the rest of the canvas math.
 */

export type BoxSize = { width: number; height: number }

/** The narrowest editor that is still comfortable to click into and type in. */
export const MIN_EDITOR_WIDTH = 32

/**
 * The editor's border sits inside its box (border-box), so the content area has to be the measured
 * size plus one pixel per side for the text to line up with what the canvas draws.
 */
export const EDITOR_BORDER = 2

/** Screen-space size for the editor, given the measured size of the text it currently holds. */
export function editorSizeFor(measured: BoxSize, lineHeight: number): BoxSize {
  const width = Math.max(measured.width, MIN_EDITOR_WIDTH)
  const height = Math.max(measured.height, lineHeight)
  return {
    width: Math.max(1, Math.round(width)) + EDITOR_BORDER,
    height: Math.max(1, Math.round(height)) + EDITOR_BORDER,
  }
}
