/**
 * The scale gesture (Phase 4.1).
 *
 * A handle drag scales the selection about its opposite corner. The starting box and every original
 * transform are captured once, so each move computes absolute values from where the gesture began
 * rather than compounding - the same rule the drag-move gesture uses.
 *
 * The handles themselves are still drawn by the canvas overlay, which is why this tool exposes
 * `startHandle` / `moveHandle` / `endHandle` beside the pointer contract: the overlay is the input
 * surface today, and Phase 4.3-4.4 may move the handles onto the canvas. The gesture, the state, and
 * the math are here either way.
 */

import type { HandleId, Point } from '../geom/transform.ts'
import { anchoredEdge, rotatePoint, scaleFactors } from '../geom/transform.ts'
import type { NodeId, Transform } from '../doc/types.ts'
import type { ScaleCapture, Tool, ToolHost, ToolPoint } from './types.ts'

export type ScaleModifiers = { constrain: boolean; fromCenter: boolean }

type State = { handle: HandleId; capture: ScaleCapture } | null

export type ScaleTool = Tool & {
  startHandle(host: ToolHost, handle: HandleId): void
  moveHandle(host: ToolHost, point: Point, modifiers: ScaleModifiers): void
  endHandle(host: ToolHost): void
  cancelHandle(host: ToolHost): void
  /** True while a handle drag is in flight, so the overlay can style the active handle. */
  isDragging(): boolean
}

export function createScaleTool(cursor: string): ScaleTool {
  let state: State = null

  return {
    id: 'transform',
    cursor,
    // The handle drag is the only input this tool takes today; the pointer contract stays unused.
    onPointerDown() {},
    onPointerMove() {},
    onPointerUp() {},
    cancel(host: ToolHost) {
      if (state === null) return
      state = null
      host.scaleCancel()
    },
    startHandle(host: ToolHost, handle: HandleId) {
      const captured = host.scaleBegin()
      if (captured === null) return
      state = { handle, capture: captured }
    },
    moveHandle(host: ToolHost, point: Point, modifiers: ScaleModifiers) {
      if (state === null) return
      const { box, rotation, centre, nodes } = state.capture
      // The pointer is brought into the frame's own axes, so a rotated selection scales along its own
      // sides rather than along the world axes (issue #120).
      const inFrame = rotatePoint(point, centre, -rotation)
      const factors = scaleFactors(state.handle, box, inFrame, modifiers)
      const anchor = anchoredEdge(state.handle, box)
      for (const node of nodes) {
        const original = node.transform
        const centreNow = {
          x: original.x + (node.width * Math.abs(original.scaleX)) / 2,
          y: original.y + (node.height * Math.abs(original.scaleY)) / 2,
        }
        const centreFrame = rotatePoint(centreNow, centre, -rotation)
        const scaledFrame = {
          x: anchor.x + (centreFrame.x - anchor.x) * factors.sx,
          y: anchor.y + (centreFrame.y - anchor.y) * factors.sy,
        }
        const centreNext = rotatePoint(scaledFrame, centre, rotation)
        const scaleX = original.scaleX * factors.sx
        const scaleY = original.scaleY * factors.sy
        host.setNodeTransform(node.id, {
          ...original,
          scaleX,
          scaleY,
          x: centreNext.x - (node.width * Math.abs(scaleX)) / 2,
          y: centreNext.y - (node.height * Math.abs(scaleY)) / 2,
        })
      }
    },
    endHandle(host: ToolHost) {
      if (state === null) return
      state = null
      host.scaleEnd()
    },
    cancelHandle(host: ToolHost) {
      if (state === null) return
      state = null
      host.scaleCancel()
    },
    isDragging() {
      return state !== null
    },
  }
}
