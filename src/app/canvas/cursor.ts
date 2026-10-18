/**
 * The canvas cursor per tool (Phase 4.3).
 *
 * Illustrator's arrow set is the visible half of "which tool am I holding": the shape and lasso tools
 * draw with a crosshair, Type with an I-beam, the Hand with a grab. Kept as data so the packaged run
 * can assert the mapping rather than describing it in prose.
 */

export type CanvasCursor =
  | 'default'
  | 'crosshair'
  | 'text'
  | 'grab'
  | 'grabbing'
  | 'move'

/** The cursor a tool shows over empty canvas. */
export function cursorForTool(tool: string): CanvasCursor {
  switch (tool) {
    case 'hand':
      return 'grab'
    case 'lasso':
    case 'rect':
    case 'roundedRect':
    case 'ellipse':
    case 'polygon':
    case 'star':
    case 'line':
    case 'arc':
      return 'crosshair'
    case 'text':
      return 'text'
    default:
      return 'default'
  }
}

/** The cursor during an in-flight gesture; the tool's own cursor when nothing is moving. */
export function cursorWhileDragging(tool: string, dragging: 'move' | 'marquee' | 'pan' | null): CanvasCursor {
  if (dragging === 'pan') return 'grabbing'
  if (dragging === 'move') return 'move'
  if (dragging === 'marquee') return 'crosshair'
  return cursorForTool(tool)
}
