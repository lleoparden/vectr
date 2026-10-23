/**
 * The Type tool (Phase 3.3, area text in 6.2).
 *
 * A click places a point-text object and opens its editor; a drag draws an area frame and opens the
 * same editor inside it. Illustrator's Type tool does both, and the drag preview uses the marquee so
 * the frame is visible before release.
 */

import type { Tool, ToolHost, ToolPoint } from './types.ts'

const AREA_MIN_SIZE = 6

function rectBetween(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function createTypeTool(cursor: string): Tool {
  let start: { x: number; y: number } | null = null

  return {
    id: 'text',
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint) {
      start = { ...point.scene }
      host.setMarquee(null)
    },
    onPointerMove(host: ToolHost, point: ToolPoint) {
      if (start === null) return
      const rect = rectBetween(start, point.scene)
      host.setMarquee(rect.width >= AREA_MIN_SIZE || rect.height >= AREA_MIN_SIZE ? rect : null)
    },
    onPointerUp(host: ToolHost, point: ToolPoint) {
      if (start === null) return
      const rect = rectBetween(start, point.scene)
      const origin = start
      start = null
      host.setMarquee(null)
      if (rect.width >= AREA_MIN_SIZE && rect.height >= AREA_MIN_SIZE) host.placeAreaText(rect)
      else host.placeText(origin)
    },
    cancel(host: ToolHost) {
      start = null
      host.setMarquee(null)
    },
  }
}
