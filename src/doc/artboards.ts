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

/**
 * Common sheet sizes, in the units the document uses (pixels at 72 dpi, which is what a screen
 * design needs). Illustrator offers a much longer list tied to print; these are the sizes people
 * actually start a web or social document at, and the list is data so it can grow without UI work.
 */
export type ArtboardPreset = { name: string; width: number; height: number }

export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { name: 'Default 1200 × 800', width: 1200, height: 800 },
  { name: 'HD 1920 × 1080', width: 1920, height: 1080 },
  { name: 'Square 1080 × 1080', width: 1080, height: 1080 },
  { name: 'Story 1080 × 1920', width: 1080, height: 1920 },
  { name: 'Portrait 1080 × 1350', width: 1080, height: 1350 },
  { name: 'A4 at 300 dpi', width: 2480, height: 3508 },
  { name: 'Letter at 300 dpi', width: 2550, height: 3300 },
]

/** The preset a size matches exactly, or "Custom" when the user has typed their own. */
export function presetFor(width: number, height: number): string {
  const found = ARTBOARD_PRESETS.find((preset) => preset.width === width && preset.height === height)
  return found === undefined ? 'Custom' : found.name
}

/** The preset with this name, for the size menu. */
export function presetByName(name: string): ArtboardPreset | null {
  return ARTBOARD_PRESETS.find((preset) => preset.name === name) ?? null
}

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
