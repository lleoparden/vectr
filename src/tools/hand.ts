/**
 * The Hand tool (Phase 3.2).
 *
 * Panning is measured in screen pixels: the scene moves under the pointer as the view moves, so a
 * scene-space delta would feed back on itself. The machine reads the pan it started from and sets
 * an absolute one.
 */

import type { Tool, ToolHost, ToolPoint } from './types.ts'

export function createHandTool(cursor: string): Tool {
  let origin: { screenX: number; screenY: number; panX: number; panY: number } | null = null

  return {
    id: 'hand',
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint) {
      const viewport = host.viewport()
      origin = { screenX: point.screen.x, screenY: point.screen.y, panX: viewport.panX, panY: viewport.panY }
    },
    onPointerMove(host: ToolHost, point: ToolPoint) {
      if (origin === null) return
      host.panTo(origin.panX + (point.screen.x - origin.screenX), origin.panY + (point.screen.y - origin.screenY))
    },
    onPointerUp() {
      origin = null
    },
    cancel() {
      origin = null
    },
  }
}
