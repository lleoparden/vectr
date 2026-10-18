/**
 * The Zoom tool (issue #131).
 *
 * Illustrator's Z: click to zoom in about the click, Alt-click to zoom out, drag a rectangle to zoom
 * into that area. The viewport arithmetic lives in the host, so this machine only decides which of the
 * three gestures happened.
 */

import type { Point } from '../geom/transform.ts'
import { marqueeRect, type Tool, type ToolHost, type ToolModifiers, type ToolPoint } from './types.ts'

type State = { start: ToolPoint; dragged: boolean } | null

export function createZoomTool(cursor: string): Tool {
  let state: State = null

  return {
    id: 'zoom',
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint, _modifiers: ToolModifiers) {
      state = { start: point, dragged: false }
      host.setMarquee(null)
    },
    onPointerMove(host: ToolHost, point: ToolPoint, _modifiers: ToolModifiers) {
      if (state === null) return
      // Three screen pixels is a click; past that the user is framing an area.
      if (!state.dragged && Math.hypot(point.screen.x - state.start.screen.x, point.screen.y - state.start.screen.y) > 3) {
        state.dragged = true
      }
      if (state.dragged) host.setMarquee(marqueeRect(state.start.scene, point.scene))
    },
    onPointerUp(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      const gesture = state
      state = null
      if (gesture === null) return
      host.setMarquee(null)
      if (gesture.dragged) {
        host.zoomToBox(marqueeRect(gesture.start.scene, point.scene))
        return
      }
      host.zoomAt(point.screen, modifiers.alt ? 0.5 : 2)
    },
    cancel(host: ToolHost) {
      state = null
      host.setMarquee(null)
    },
  }
}
