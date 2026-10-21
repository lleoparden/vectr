/**
 * The tool registry (Phase 3.2-3.3).
 *
 * Every tool the palette offers is a state machine; the canvas routes pointer input by tool id.
 */

import { createHandTool } from './hand.ts'
import { createLassoTool } from './lasso.ts'
import { createPenTool } from './pen.ts'
import { createSelectTool } from './select.ts'
import { createShapeBuilderTool } from './shapeBuilder.ts'
import { createShapeTool } from './shapes.ts'
import { createTypeTool } from './type.ts'
import { createZoomTool } from './zoom.ts'
import type { Tool } from './types.ts'

/** Cursors, chosen to read like Illustrator's without copying its artwork. */
export const TOOL_CURSORS = {
  select: 'default',
  directSelect: 'default',
  hand: 'grab',
  lasso: 'crosshair',
  pen: 'crosshair',
  shapeBuilder: 'crosshair',
  rect: 'crosshair',
  roundedRect: 'crosshair',
  arc: 'crosshair',
  ellipse: 'crosshair',
  polygon: 'crosshair',
  star: 'crosshair',
  line: 'crosshair',
  text: 'text',
  zoom: 'zoom-in',
} as const

export type StateMachineToolId = keyof typeof TOOL_CURSORS

export function createToolStateMachines(): Record<StateMachineToolId, Tool> {
  return {
    select: createSelectTool({ id: 'select', deep: false, cursor: TOOL_CURSORS.select }),
    directSelect: createSelectTool({ id: 'directSelect', deep: true, cursor: TOOL_CURSORS.directSelect }),
    hand: createHandTool(TOOL_CURSORS.hand),
    lasso: createLassoTool({ cursor: TOOL_CURSORS.lasso }),
    pen: createPenTool(TOOL_CURSORS.pen),
    shapeBuilder: createShapeBuilderTool(TOOL_CURSORS.shapeBuilder),
    rect: createShapeTool('rect', TOOL_CURSORS.rect),
    roundedRect: createShapeTool('roundedRect', TOOL_CURSORS.roundedRect),
    arc: createShapeTool('arc', TOOL_CURSORS.arc),
    ellipse: createShapeTool('ellipse', TOOL_CURSORS.ellipse),
    polygon: createShapeTool('polygon', TOOL_CURSORS.polygon),
    star: createShapeTool('star', TOOL_CURSORS.star),
    line: createShapeTool('line', TOOL_CURSORS.line),
    text: createTypeTool(TOOL_CURSORS.text),
    zoom: createZoomTool(TOOL_CURSORS.zoom),
  }
}

/** True when the id names one of the state machines, so the canvas can route to it. */
export function isStateMachineTool(tool: string): tool is StateMachineToolId {
  return Object.prototype.hasOwnProperty.call(TOOL_CURSORS, tool)
}
