/**
 * The Lasso tool (Phase 3.3).
 *
 * It collects a freehand path and decides nothing until release: what the loop encloses is the
 * document's question, not the tool's.
 */

import type { Point } from '../geom/shapeGeometry.ts'
import type { Tool, ToolHost, ToolModifiers, ToolPoint } from './types.ts'

export function createLassoTool(options: { cursor: string; maxPoints?: number }): Tool {
  const maxPoints = options.maxPoints ?? 2000
  let points: Point[] | null = null

  return {
    id: 'lasso',
    cursor: options.cursor,
    onPointerDown(host: ToolHost, point: ToolPoint) {
      points = [point.scene]
      host.setLasso(points)
    },
    onPointerMove(host: ToolHost, point: ToolPoint) {
      if (points === null) return
      if (points.length >= maxPoints) return
      points = [...points, point.scene]
      host.setLasso(points)
    },
    onPointerUp(host: ToolHost, _point: ToolPoint, modifiers: ToolModifiers) {
      if (points === null) return
      host.commitLasso(points, modifiers)
      host.setLasso(null)
      points = null
    },
    cancel(host: ToolHost) {
      host.setLasso(null)
      points = null
    },
  }
}
