/**
 * The pen's draft preview (Phase 5.2, issue #138).
 *
 * Draws the anchors already placed, each smooth anchor's handles, and a rubber band from the last
 * anchor to the pointer. The curve is emitted with the same cubic segments the renderer records, so
 * the preview cannot show a different curve from the one committed.
 */

import type { PenDraft } from '../../tools/types.ts'
import { BRAND } from '../ui/brand.ts'

const ANCHOR_SIZE = 7
const HANDLE_SIZE = 5

export function PathPreview({
  draft,
  zoom,
  panX,
  panY,
}: {
  draft: PenDraft
  zoom: number
  panX: number
  panY: number
}) {
  const anchors = draft.anchors
  if (anchors.length === 0) return null
  const toScreen = (x: number, y: number) => ({ x: x * zoom + panX, y: y * zoom + panY })
  const first = toScreen(anchors[0].x, anchors[0].y)

  // One cubic per anchor pair, plus a rubber band from the last anchor to the cursor.
  let path = `M ${first.x} ${first.y}`
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const a = anchors[index]
    const b = anchors[index + 1]
    const c1 = toScreen(a.x + a.outX, a.y + a.outY)
    const c2 = toScreen(b.x + b.inX, b.y + b.inY)
    const end = toScreen(b.x, b.y)
    path += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`
  }
  if (draft.cursor !== null && anchors.length >= 1) {
    const last = anchors[anchors.length - 1]
    const c1 = toScreen(last.x + last.outX, last.y + last.outY)
    const end = toScreen(draft.cursor.x, draft.cursor.y)
    path += ` C ${c1.x} ${c1.y} ${end.x} ${end.y} ${end.x} ${end.y}`
  }

  return (
    <svg
      aria-hidden="true"
      data-pen-preview="draft"
      className="pointer-events-none absolute inset-0"
      width="100%"
      height="100%"
    >
      <path d={path} fill="none" stroke={BRAND.roseLight} strokeWidth={1.25} />
      {draft.cursor !== null && (
        <circle cx={toScreen(draft.cursor.x, draft.cursor.y).x} cy={toScreen(draft.cursor.x, draft.cursor.y).y} r={3} fill={BRAND.roseLight} />
      )}
      {anchors.map((anchor, index) => {
        const point = toScreen(anchor.x, anchor.y)
        const inPoint = toScreen(anchor.x + anchor.inX, anchor.y + anchor.inY)
        const outPoint = toScreen(anchor.x + anchor.outX, anchor.y + anchor.outY)
        return (
          <g key={`anchor-${index}`}>
            {anchor.smooth && (
              <>
                <line x1={inPoint.x} y1={inPoint.y} x2={outPoint.x} y2={outPoint.y} stroke={BRAND.roseLight} strokeWidth={0.75} opacity={0.7} />
                <rect x={inPoint.x - HANDLE_SIZE / 2} y={inPoint.y - HANDLE_SIZE / 2} width={HANDLE_SIZE} height={HANDLE_SIZE} fill={BRAND.charcoal} stroke={BRAND.roseLight} strokeWidth={1} />
                <rect x={outPoint.x - HANDLE_SIZE / 2} y={outPoint.y - HANDLE_SIZE / 2} width={HANDLE_SIZE} height={HANDLE_SIZE} fill={BRAND.charcoal} stroke={BRAND.roseLight} strokeWidth={1} />
              </>
            )}
            <rect
              x={point.x - ANCHOR_SIZE / 2}
              y={point.y - ANCHOR_SIZE / 2}
              width={ANCHOR_SIZE}
              height={ANCHOR_SIZE}
              fill={index === 0 ? BRAND.roseVale : BRAND.charcoal}
              stroke={BRAND.roseLight}
              strokeWidth={1}
              data-pen-anchor={index}
            />
          </g>
        )
      })}
    </svg>
  )
}
