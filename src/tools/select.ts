/**
 * The Selection and Direct Selection tools (Phase 3.2).
 *
 * One machine, two depths: the black arrow stops at the top-level object, the white arrow reaches
 * the leaf. On empty canvas both start a marquee; on a hit both begin a move, so the gesture that
 * follows is the same code whichever arrow the user holds.
 */

import type { Point } from '../geom/shapeGeometry.ts'
import type { NodeId } from '../doc/types.ts'
import { draggedHandle, localToScene, movedAnchor, nearestAnchor, nearestHandle, sceneToLocal, type PathEditCapture } from '../doc/pathEdit.ts'
import type { PathAnchor } from '../geom/path.ts'
import { marqueeRect, type Tool, type ToolHost, type ToolModifiers, type ToolPoint } from './types.ts'

type State =
  | { kind: 'idle' }
  | { kind: 'marquee'; start: Point }
  | { kind: 'move'; start: Point }
  | { kind: 'rotate' }
  | { kind: 'anchorDrag'; capture: PathEditCapture; index: number; offset: Point }
  | { kind: 'handleDrag'; capture: PathEditCapture; index: number; handle: 'in' | 'out' }

export type SelectToolOptions = { id: string; deep: boolean; cursor: string }

export function createSelectTool({ id, deep, cursor }: SelectToolOptions): Tool {
  let state: State = { kind: 'idle' }

  return {
    id,
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers) {
      // The white arrow edits a path's anchors before it reaches for the object itself: a handle
      // first, then an anchor, then the ordinary selection behaviour (Phase 5.3, issue #139).
      if (deep) {
        const capture = host.pathEditCapture()
        if (capture !== null) {
          const tolerance = 6 / Math.max(host.zoomFactor(), 0.0001)
          const handle = nearestHandle(capture.anchors, point.scene, capture, tolerance)
          if (handle !== null) {
            host.beginPathDrag()
            state = { kind: 'handleDrag', capture, index: handle.index, handle: handle.handle }
            return
          }
          const anchor = nearestAnchor(capture.anchors, point.scene, capture, tolerance)
          if (anchor !== null) {
            const origin = capture.anchors[anchor.index]
            const local = sceneToLocal(point.scene, capture)
            host.beginPathDrag()
            host.setActiveAnchor(capture.nodeId, anchor.index)
            state = { kind: 'anchorDrag', capture, index: anchor.index, offset: { x: origin.x - local.x, y: origin.y - local.y } }
            return
          }
        }
      }
      // Just outside a corner, a drag rotates the selection - Illustrator's own rotation zone, so a
      // rotated object can be turned again without reaching for the Properties field (issue #120).
      if (host.rotationBegin(point.scene) !== null) {
        state = { kind: 'rotate' }
        return
      }
      const hit = host.hitTest(point.scene, deep)
      if (hit === null) {
        state = { kind: 'marquee', start: point.scene }
        host.setMarquee(marqueeRect(point.scene, point.scene))
        return
      }
      if (modifiers.shift || modifiers.meta || modifiers.ctrl) host.toggleSelection(hit)
      else if (!host.selection().includes(hit)) host.select(hit)
      // Illustrator's Alt-drag: the drag moves a duplicate and leaves the original where it was.
      if (modifiers.alt) host.duplicateSelection()
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
        return
      }
      if (state.kind === 'rotate') host.rotateBy(point.scene, modifiers.shift)
      if (state.kind === 'anchorDrag') {
        const drag = state
        const local = sceneToLocal(point.scene, drag.capture)
        const anchors = drag.capture.anchors.map((anchor, index) =>
          index === drag.index ? movedAnchor(anchor, { x: local.x + drag.offset.x, y: local.y + drag.offset.y }) : anchor,
        )
        host.setPathAnchors(drag.capture.nodeId, anchors)
        return
      }
      if (state.kind === 'handleDrag') {
        const drag = state
        const anchor = drag.capture.anchors[drag.index]
        const local = sceneToLocal(point.scene, drag.capture)
        const anchors = drag.capture.anchors.map((value, index) =>
          index === drag.index ? draggedHandle(anchor, drag.handle, local, !modifiers.alt) : value,
        )
        host.setPathAnchors(drag.capture.nodeId, anchors)
      }
    },

    onPointerUp(host: ToolHost, point: ToolPoint) {
      if (state.kind === 'marquee') {
        host.commitMarquee(marqueeRect(state.start, point.scene), deep)
        host.setMarquee(null)
      } else if (state.kind === 'move') {
        host.endMove()
      } else if (state.kind === 'rotate') {
        host.rotateEnd()
      } else if (state.kind === 'anchorDrag' || state.kind === 'handleDrag') {
        host.endPathDrag()
      }
      state = { kind: 'idle' }
    },

    cancel(host: ToolHost) {
      if (state.kind === 'move') host.cancelMove()
      if (state.kind === 'rotate') host.rotateCancel()
      if (state.kind === 'anchorDrag' || state.kind === 'handleDrag') host.cancelPathDrag()
      host.setMarquee(null)
      state = { kind: 'idle' }
    },
  }
}

export function nodeListContains(list: NodeId[], id: NodeId): boolean {
  return list.includes(id)
}
