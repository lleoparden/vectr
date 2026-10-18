/**
 * Artboard tool geometry (Artboard tool, issue #67 follow-up).
 *
 * Pure arithmetic for dragging a new page and for resizing the active one, so the canvas gesture and
 * the tests share one rule. Pages are laid out automatically (the first at the origin, the rest left
 * to right), so a page has no stored position: it can grow to the right and downward, never left or
 * upward, and dragging never moves a page.
 */

export type ArtboardRect = { x: number; y: number; width: number; height: number }

/** A page smaller than this is a click, not a drag, and is ignored. */
export const MIN_ARTBOARD_SIZE = 16

/** The dragged rectangle as a page: positive size, and at least the minimum in both axes. */
export function artboardFromDrag(start: { x: number; y: number }, end: { x: number; y: number }): ArtboardRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    x,
    y,
    width: Math.max(MIN_ARTBOARD_SIZE, Math.abs(end.x - start.x)),
    height: Math.max(MIN_ARTBOARD_SIZE, Math.abs(end.y - start.y)),
  }
}

/** The edges a page can be resized from, because its origin cannot move. */
export type ResizeEdge = 'e' | 's' | 'se'

/** New size for a page being resized from one of its growable edges. */
export function resizedPage(
  edge: ResizeEdge,
  start: { width: number; height: number },
  delta: { x: number; y: number },
): { width: number; height: number } {
  const width = edge === 's' ? start.width : Math.max(MIN_ARTBOARD_SIZE, Math.round(start.width + delta.x))
  const height = edge === 'e' ? start.height : Math.max(MIN_ARTBOARD_SIZE, Math.round(start.height + delta.y))
  return { width, height }
}

/** True when a drag is big enough to become a page. */
export function dragIsAPage(rect: ArtboardRect): boolean {
  return rect.width > MIN_ARTBOARD_SIZE || rect.height > MIN_ARTBOARD_SIZE
}
