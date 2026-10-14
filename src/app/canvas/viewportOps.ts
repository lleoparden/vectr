/**
 * Viewport math (issue #28).
 *
 * The wheel handler, the zoom tool-less menu commands, and Fit Artboard in Window
 * all need the same arithmetic, so it lives here as pure functions instead of
 * being repeated in the canvas component. Screen and scene relate as
 * `screen = scene * zoom + pan`, which is the mapping the renderer and the pointer
 * code already use.
 */

import type { Artboard } from '../../doc/types.ts'
import type { Viewport } from '../../state/documentStore.ts'
import { FIT_PADDING, ZOOM_MAX, ZOOM_MIN, ZOOM_STEPS } from '../ui/theme.ts'

export type Anchor = { x: number; y: number }
export type CanvasSize = { width: number; height: number }

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/** Zooms to `zoom` while keeping the scene point under `anchor` in place. */
export function zoomTo(viewport: Viewport, zoom: number, anchor: Anchor): Viewport {
  const next = clampZoom(zoom)
  if (next === viewport.zoom) return viewport
  const sceneX = (anchor.x - viewport.panX) / viewport.zoom
  const sceneY = (anchor.y - viewport.panY) / viewport.zoom
  return { zoom: next, panX: anchor.x - sceneX * next, panY: anchor.y - sceneY * next }
}

/** The wheel-zoom step: a multiplicative change around the pointer. */
export function zoomAtPoint(viewport: Viewport, anchor: Anchor, factor: number): Viewport {
  return zoomTo(viewport, viewport.zoom * factor, anchor)
}

/** The center of the canvas, used as the anchor when no pointer is involved. */
export function canvasCenter(canvas: CanvasSize): Anchor {
  return { x: canvas.width / 2, y: canvas.height / 2 }
}

/** The next standard zoom level above or below the current one. */
export function nextZoomStep(zoom: number, direction: 1 | -1): number {
  const epsilon = 1e-6
  if (direction === 1) {
    return ZOOM_STEPS.find((step) => step > zoom + epsilon) ?? ZOOM_MAX
  }
  const descending = [...ZOOM_STEPS].reverse()
  return descending.find((step) => step < zoom - epsilon) ?? ZOOM_MIN
}

/**
 * Zoom In / Zoom Out from the View menu and the keyboard. Without a known canvas
 * size the anchor is unavailable, so the zoom changes around the current center.
 */
export function zoomByStep(viewport: Viewport, direction: 1 | -1, canvas: CanvasSize): Viewport {
  const zoom = nextZoomStep(viewport.zoom, direction)
  if (canvas.width <= 0 || canvas.height <= 0) {
    return zoom === viewport.zoom ? viewport : { ...viewport, zoom }
  }
  return zoomTo(viewport, zoom, canvasCenter(canvas))
}

/** Actual Size (`Ctrl+1`): 100%, anchored so the view does not jump. */
export function actualSize(viewport: Viewport, canvas: CanvasSize): Viewport {
  if (canvas.width <= 0 || canvas.height <= 0) return { zoom: 1, panX: viewport.panX, panY: viewport.panY }
  return zoomTo(viewport, 1, canvasCenter(canvas))
}

/** Fit Artboard in Window (`Ctrl+0`): the whole artboard, centered, with margin. */
export function fitArtboard(artboard: Artboard, canvas: CanvasSize, padding = FIT_PADDING): Viewport {
  if (canvas.width <= 0 || canvas.height <= 0 || artboard.width <= 0 || artboard.height <= 0) {
    return { zoom: 1, panX: 0, panY: 0 }
  }
  const usableWidth = Math.max(1, canvas.width - padding * 2)
  const usableHeight = Math.max(1, canvas.height - padding * 2)
  const zoom = clampZoom(Math.min(usableWidth / artboard.width, usableHeight / artboard.height))
  return {
    zoom,
    panX: (canvas.width - artboard.width * zoom) / 2,
    panY: (canvas.height - artboard.height * zoom) / 2,
  }
}

/** Zoom percentage as the status bar shows it. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}
