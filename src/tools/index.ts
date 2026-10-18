/**
 * The tool registry (Phase 3.2).
 *
 * Only the tools that are state machines live here today; the lasso, the shape tools, and Type
 * follow in Phase 3.3. The registry is keyed by the tool ids the palette and the shortcuts use.
 */

import { createHandTool } from './hand.ts'
import { createSelectTool } from './select.ts'
import type { Tool } from './types.ts'

/** Cursors, chosen to read like Illustrator's without copying its artwork. */
export const TOOL_CURSORS = {
  select: 'default',
  directSelect: 'default',
  hand: 'grab',
} as const

export type StateMachineToolId = keyof typeof TOOL_CURSORS

export function createToolStateMachines(): Record<StateMachineToolId, Tool> {
  return {
    select: createSelectTool({ id: 'select', deep: false, cursor: TOOL_CURSORS.select }),
    directSelect: createSelectTool({ id: 'directSelect', deep: true, cursor: TOOL_CURSORS.directSelect }),
    hand: createHandTool(TOOL_CURSORS.hand),
  }
}

/** True when the active tool is one of the state machines, so the canvas can route to it. */
export function isStateMachineTool(tool: string): tool is StateMachineToolId {
  return tool === 'select' || tool === 'directSelect' || tool === 'hand'
}
