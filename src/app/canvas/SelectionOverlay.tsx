/**
 * Selection bounding box and scale handles (Phase 2.2, issue #65).
 *
 * Illustrator's eight-handle box, drawn in screen space over the canvas. The component is
 * presentational: it converts pointer positions to scene points and reports them, and the canvas
 * owner runs the transform through the document command path. A group's box is the union of its
 * leaves, which is what `unionBounds` returns for every selection id.
 */

import { handlePoints, type HandleId, type Rect } from '../../geom/transform.ts'

export type SelectionOverlayProps = {
  /** The selection's world box. */
  box: Rect
  zoom: number
  panX: number
  panY: number
  /** Scene point for a pointer event, computed by the canvas so the two agree on one viewport. */
  toScene: (event: { clientX: number; clientY: number }) => { x: number; y: number }
  onScaleStart: (handle: HandleId) => void
  onScaleMove: (handle: HandleId, point: { x: number; y: number }, modifiers: { constrain: boolean; fromCenter: boolean }) => void
  onScaleEnd: () => void
  /** Degrees; the frame turns about its centre so it can sit on a rotated object (issue #120). */
  rotation: number
}

const HANDLE_SIZE = 7
const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const CURSORS: Record<HandleId, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
}

export function SelectionOverlay(props: SelectionOverlayProps) {
  const { box, zoom, panX, panY, toScene, rotation } = props
  const left = box.x * zoom + panX
  const top = box.y * zoom + panY
  const width = Math.max(1, box.width * zoom)
  const height = Math.max(1, box.height * zoom)
  const points = handlePoints(box)

  // The whole frame is one rotated layer: border and handles turn together, about the box centre.
  const centreX = (box.x + box.width / 2) * zoom + panX
  const centreY = (box.y + box.height / 2) * zoom + panY
  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-selection-box
      data-selection-rotation={Math.round(rotation)}
      style={rotation === 0 ? undefined : { transform: `rotate(${rotation}deg)`, transformOrigin: `${centreX}px ${centreY}px` }}
    >
      <div
        className="absolute border border-accent/80"
        style={{ left, top, width, height }}
        aria-hidden="true"
      />
      {HANDLES.map((handle) => {
        const point = points[handle]
        const screenX = point.x * zoom + panX
        const screenY = point.y * zoom + panY
        return (
          <div
            key={handle}
            role="button"
            tabIndex={-1}
            aria-label={`Scale handle ${handle}`}
            data-handle={handle}
            className="pointer-events-auto absolute rounded-[1px] border border-accent bg-chrome-panel"
            style={{
              left: screenX - HANDLE_SIZE / 2,
              top: screenY - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              cursor: CURSORS[handle],
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              props.onScaleStart(handle)
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
              props.onScaleMove(handle, toScene(event), {
                constrain: event.shiftKey,
                fromCenter: event.altKey,
              })
            }}
            onPointerUp={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
              event.currentTarget.releasePointerCapture(event.pointerId)
              props.onScaleEnd()
            }}
            onPointerCancel={() => props.onScaleEnd()}
          />
        )
      })}
    </div>
  )
}
