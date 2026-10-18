/**
 * The shape tools (Phase 3.3).
 *
 * One machine for all five: the tool id decides which shape the drag creates, Shift is read on
 * every move so holding or releasing it updates the preview live, and the canvas turns the drag
 * into an object on release.
 */

import type { Point } from '../geom/shapeGeometry.ts'
import type { ShapeKind } from '../doc/document.ts'
import type { Tool, ToolHost, ToolModifiers, ToolPoint } from './types.ts'

export function createShapeTool(toolId: string, cursor: string): Tool {
  let start: Point | null = null

  return {
    id: toolId,
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      start = point.scene
      host.setShapePreview({ kind: kindFor(toolId), start: point.scene, current: point.scene, shift: modifiers.shift })
    },
    onPointerMove(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      if (start === null) return
      host.setShapePreview({ kind: kindFor(toolId), start, current: point.scene, shift: modifiers.shift })
    },
    onPointerUp(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      if (start !== null) host.commitShape(toolId, start, point.scene, modifiers.shift)
      host.setShapePreview(null)
      start = null
    },
    cancel(host: ToolHost) {
      host.setShapePreview(null)
      start = null
    },
  }
}

/** The shape a tool id draws. The ids are the document's own shape kinds. */
function kindFor(toolId: string): ShapeKind {
  switch (toolId) {
    case 'roundedRect':
    case 'ellipse':
    case 'line':
    case 'polygon':
    case 'star':
    case 'arc':
      return toolId
    default:
      return 'rect'
  }
}
