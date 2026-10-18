/**
 * The Selection and Direct Selection tools (Phase 3.2).
 *
 * One machine, two depths: the black arrow stops at the top-level object, the white arrow reaches
 * the leaf. On empty canvas both start a marquee; on a hit both begin a move, so the gesture that
 * follows is the same code whichever arrow the user holds.
 */

import type { Point } from '../geom/shapeGeometry.ts'
import type { NodeId } from '../doc/types.ts'
import { marqueeRect, type Tool, type ToolHost, type ToolModifiers, type ToolPoint } from './types.ts'

type State =
  | { kind: 'idle' }
  | { kind: 'marquee'; start: Point }
  | { kind: 'move'; start: Point }

export type SelectToolOptions = { id: string; deep: boolean; cursor: string }

export function createSelectTool({ id, deep, cursor }: SelectToolOptions): Tool {
  let state: State = { kind: 'idle' }

  return {
    id,
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      const hit = host.hitTest(point.scene, deep)
      if (hit === null) {
        state = { kind: 'marquee', start: point.scene }
        host.setMarquee(marqueeRect(point.scene, point.scene))
        return
      }
      if (modifiers.shift || modifiers.meta || modifiers.ctrl) host.toggleSelection(hit)
      else if (!host.selection().includes(hit)) host.select(hit)
      host.beginMove()
      state = { kind: 'move', start: point.scene }
    },

    onPointerMove(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      if (state.kind === 'marquee') {
        host.setMarquee(marqueeRect(state.start, point.scene))
        return
      }
      if (state.kind === 'move') {
        host.moveBy(point.scene.x - state.start.x, point.scene.y - state.start.y, modifiers.shift)
      }
    },

    onPointerUp(host: ToolHost, point: ToolPoint) {
      if (state.kind === 'marquee') {
        host.commitMarquee(marqueeRect(state.start, point.scene), deep)
        host.setMarquee(null)
      } else if (state.kind === 'move') {
        host.endMove()
      }
      state = { kind: 'idle' }
    },

    cancel(host: ToolHost) {
      if (state.kind === 'move') host.cancelMove()
      host.setMarquee(null)
      state = { kind: 'idle' }
    },
  }
}

export function nodeListContains(list: NodeId[], id: NodeId): boolean {
  return list.includes(id)
}
