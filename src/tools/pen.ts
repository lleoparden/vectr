/**
 * The Pen tool (Phase 5.2, issue #138).
 *
 * A state machine over a draft path: a click adds a corner anchor, a press-and-drag adds a smooth
 * anchor whose handles mirror the drag, clicking the first anchor closes the path, Enter finishes
 * it open, and Escape throws the draft away. Nothing is written to the document until the path is
 * finished, so the whole curve is one undo entry and an abandoned draft leaves no trace.
 *
 * The draft is kept in scene coordinates; the host normalises it into a node and draws the preview
 * with the same geometry the renderer will use.
 */

import { cornerAnchor, type PathAnchor } from '../geom/path.ts'
import type { Point } from '../geom/transform.ts'
import type { Tool, ToolHost, ToolModifiers, ToolPoint } from './types.ts'

/** How close a click must land to the first anchor to close the path, in scene units. */
export const PEN_CLOSE_DISTANCE = 8

/** Handles mirror so a dragged anchor is smooth, the way Illustrator's Pen behaves. */
function smoothAnchorAt(anchor: PathAnchor, point: Point): PathAnchor {
  const outX = point.x - anchor.x
  const outY = point.y - anchor.y
  return { ...anchor, inX: -outX, inY: -outY, outX, outY, smooth: outX !== 0 || outY !== 0 }
}

export function createPenTool(cursor: string): Tool {
  let draft: PathAnchor[] | null = null
  let dragging = false

  const reset = (host: ToolHost): void => {
    draft = null
    dragging = false
    host.setPenDraft(null)
  }

  const finishPath = (host: ToolHost, closed: boolean): void => {
    if (draft === null || draft.length < 2) {
      reset(host)
      return
    }
    host.commitPenPath(draft, closed)
    reset(host)
  }

  const preview = (host: ToolHost, cursorPoint: Point | null): void => {
    if (draft === null) {
      host.setPenDraft(null)
      return
    }
    host.setPenDraft({ anchors: draft, cursor: cursorPoint })
  }

  return {
    id: 'pen',
    cursor,

    onPointerDown(host: ToolHost, point: ToolPoint): void {
      const scene = point.scene
      if (draft !== null && draft.length >= 3) {
        const first = draft[0]
        if (Math.hypot(scene.x - first.x, scene.y - first.y) <= PEN_CLOSE_DISTANCE) {
          finishPath(host, true)
          return
        }
      }
      draft = [...(draft ?? []), cornerAnchor(scene.x, scene.y)]
      dragging = true
      preview(host, scene)
    },

    onPointerMove(host: ToolHost, point: ToolPoint): void {
      if (draft === null) return
      if (dragging && draft.length > 0) {
        const last = draft[draft.length - 1]
        draft = [...draft.slice(0, -1), smoothAnchorAt(last, point.scene)]
      }
      preview(host, point.scene)
    },

    onPointerUp(): void {
      dragging = false
    },

    cancel(host: ToolHost): void {
      reset(host)
    },

    finish(host: ToolHost): void {
      finishPath(host, false)
    },
  }
}

/** Kept for the tool tests: a draft with mirrored handles for a dragged anchor. */
export function dragHandles(anchor: PathAnchor, point: Point): PathAnchor {
  return smoothAnchorAt(anchor, point)
}

/** A test seam: the tool id and the close radius are part of its contract. */
export const PEN_TOOL_ID = 'pen'
export function isPenTool(tool: { id: string }): boolean {
  return tool.id === PEN_TOOL_ID
}
