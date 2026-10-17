/**
 * Artboard geometry (Phase 2.4, issue #67).
 *
 * Artboards are document data; their *positions* are derived, not stored: the first sits at the
 * origin and the rest are laid out left to right with a fixed gap, so scene coordinates stay
 * absolute and a node never means something different on a different page (see
 * `docs/DECISIONS.md`, the artboard contract). One function computes the layout, so the renderer,
 * Fit Artboard, the status bar, and new-object placement cannot disagree about where a page is.
 */

import type { Document } from './types.ts'

/** Space between artboards on the pasteboard, in scene units. */
export const ARTBOARD_GAP = 80

export type ArtboardRect = { id: string; name: string; x: number; y: number; width: number; height: number }

/** Every artboard with its derived scene rectangle, in document order. */
export function artboardRects(document: Document): ArtboardRect[] {
  const rects: ArtboardRect[] = []
  let x = 0
  for (const artboard of document.artboards) {
    rects.push({ id: artboard.id, name: artboard.name, x, y: 0, width: artboard.width, height: artboard.height })
    x += artboard.width + ARTBOARD_GAP
  }
  return rects
}

/** The rectangle of one artboard, or null when the id names nothing. */
export function artboardRect(document: Document, artboardId: string | null): ArtboardRect | null {
  const rects = artboardRects(document)
  if (rects.length === 0) return null
  return rects.find((rect) => rect.id === artboardId) ?? rects[0]
}

/** The artboard a scene point falls on, or null when it is on the pasteboard between pages. */
export function artboardAtPoint(document: Document, point: { x: number; y: number }): ArtboardRect | null {
  for (const rect of artboardRects(document)) {
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return rect
  }
  return null
}
