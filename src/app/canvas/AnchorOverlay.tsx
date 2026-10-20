/**
 * Anchor overlay (Phase 5.3, issue #139).
 *
 * Shows a selected path's anchors and handles: square for a corner, circle for a smooth anchor, a
 * line with a small square at each end for the handles. Positions use the same local→scene maths
 * the hit test uses, so what is drawn is what the pointer can grab, including under rotation and
 * scale.
 */

import type { PathAnchor } from '../../geom/path.ts'
import { localToScene, type PathEditCapture } from '../../doc/pathEdit.ts'
import type { NodeId, Transform } from '../../doc/types.ts'
import { BRAND } from '../ui/brand.ts'

const ANCHOR_RADIUS = 4
const HANDLE_RADIUS = 3

export function AnchorOverlay({
  nodeId,
  anchors,
  width,
  height,
  transform,
  zoom,
  panX,
  panY,
  activeIndex = null,
}: {
  nodeId: NodeId
  anchors: PathAnchor[]
  width: number
  height: number
  transform: Transform
  zoom: number
  panX: number
  panY: number
  activeIndex?: number | null
}) {
  const capture: PathEditCapture = { nodeId, anchors, width, height, transform }
  const toScreen = (point: { x: number; y: number }) => {
    const scene = localToScene(point, capture)
    return { x: scene.x * zoom + panX, y: scene.y * zoom + panY }
  }

  return (
    <svg aria-hidden="true" data-anchor-overlay={nodeId} className="pointer-events-none absolute inset-0" width="100%" height="100%">
      {anchors.map((anchor, index) => {
        const point = toScreen({ x: anchor.x, y: anchor.y })
        const inPoint = toScreen({ x: anchor.x + anchor.inX, y: anchor.y + anchor.inY })
        const outPoint = toScreen({ x: anchor.x + anchor.outX, y: anchor.y + anchor.outY })
        return (
          <g key={`anchor-${index}`} data-anchor-index={index}>
            {anchor.smooth && (
              <>
                <line x1={inPoint.x} y1={inPoint.y} x2={outPoint.x} y2={outPoint.y} stroke={BRAND.roseLight} strokeWidth={0.75} opacity={0.8} />
                <rect x={inPoint.x - HANDLE_RADIUS} y={inPoint.y - HANDLE_RADIUS} width={HANDLE_RADIUS * 2} height={HANDLE_RADIUS * 2} fill={BRAND.charcoal} stroke={BRAND.roseLight} strokeWidth={1} />
                <rect x={outPoint.x - HANDLE_RADIUS} y={outPoint.y - HANDLE_RADIUS} width={HANDLE_RADIUS * 2} height={HANDLE_RADIUS * 2} fill={BRAND.charcoal} stroke={BRAND.roseLight} strokeWidth={1} />
              </>
            )}
            {anchor.smooth ? (
              <circle cx={point.x} cy={point.y} r={index === activeIndex ? ANCHOR_RADIUS + 1.5 : ANCHOR_RADIUS} fill={index === activeIndex ? BRAND.roseVale : BRAND.charcoal} stroke={BRAND.roseLight} strokeWidth={1.25} data-anchor-kind="smooth" />
            ) : (
              <rect
                x={point.x - ANCHOR_RADIUS}
                y={point.y - ANCHOR_RADIUS}
                width={ANCHOR_RADIUS * 2}
                height={ANCHOR_RADIUS * 2}
                fill={index === activeIndex ? BRAND.roseVale : BRAND.charcoal}
                stroke={BRAND.roseLight}
                strokeWidth={1.25}
                data-anchor-kind="corner"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
