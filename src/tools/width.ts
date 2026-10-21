/**
 * Width tool (Phase 5.5, issue #141).
 *
 * Illustrator's Width tool drags a stroke wider or narrower at a point. Vectr's version edits the
 * nearest anchor's multiplier: press on a stroked path, drag away from it to widen, toward it to
 * narrow, and the whole drag is one undo entry through the host's transaction.
 */

import type { NodeId } from '../doc/types.ts'
import type { Point } from '../geom/transform.ts'
import type { Tool, ToolHost, ToolPoint } from './types.ts'

const MIN_MULTIPLIER = 0.05
const MAX_MULTIPLIER = 4

export function createWidthTool(cursor: string): Tool {
  let nodeId: NodeId | null = null
  let points: Point[] = []
  let profile: number[] = []
  let width = 0

  const reset = (): void => {
    nodeId = null
    points = []
    profile = []
    width = 0
  }

  return {
    id: 'width',
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint): void {
      const capture = host.widthBegin(point.scene)
      if (capture === null) return
      nodeId = capture.nodeId
      points = capture.points
      profile = [...capture.profile]
      width = capture.width
    },
    onPointerMove(host: ToolHost, point: ToolPoint): void {
      if (nodeId === null || points.length === 0 || width <= 0) return
      // The nearest anchor takes the edit; the drag distance from that anchor sets the multiplier.
      let nearest = 0
      let nearestDistance = Infinity
      for (let index = 0; index < points.length; index += 1) {
        const distance = Math.hypot(points[index].x - point.scene.x, points[index].y - point.scene.y)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearest = index
        }
      }
      const next = [...profile]
      next[nearest] = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, (2 * nearestDistance) / width))
      profile = next
      host.widthApply(nodeId, next)
    },
    onPointerUp(host: ToolHost): void {
      if (nodeId === null) return
      reset()
      host.widthEnd()
    },
    cancel(host: ToolHost): void {
      if (nodeId === null) return
      reset()
      host.widthCancel()
    },
  }
}
