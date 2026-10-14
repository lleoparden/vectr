/**
 * Active renderer registry (issue #18).
 *
 * The canvas owns the renderer; the smoke run and later performance work need to
 * ask it for timings without threading it through React context. One renderer
 * exists per window, so a single slot is enough and it is cleared on dispose.
 */

import type { EditorRenderer } from './EditorRenderer.ts'

let active: EditorRenderer | null = null

export function setActiveRenderer(renderer: EditorRenderer | null) {
  active = renderer
}

export function getActiveRenderer(): EditorRenderer | null {
  return active
}
