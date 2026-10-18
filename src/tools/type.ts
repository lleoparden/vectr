/**
 * The Type tool (Phase 3.3).
 *
 * A click places a text object and opens its editor - which is what Illustrator's Type tool does.
 * The canvas keeps the pointer from moving focus, because a real mouse-down would blur the editor
 * it is about to open.
 */

import type { Tool, ToolHost, ToolPoint } from './types.ts'

export function createTypeTool(cursor: string): Tool {
  return {
    id: 'text',
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint) {
      host.placeText(point.scene)
    },
    onPointerMove() {},
    onPointerUp() {},
    cancel() {},
  }
}
