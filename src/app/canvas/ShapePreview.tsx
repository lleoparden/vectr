/**
 * Shape drag preview (owner report: dragging an ellipse previewed a rectangle).
 *
 * The preview is built from `shapeGeometry` — the same functions that produce the Skia path the
 * renderer draws — so what you drag is what you get. That is the same rule the layer thumbnails
 * follow: one source for the picture, never a second drawing path.
 */

import type { ShapeParams } from '../../doc/document.ts'
import { clampCornerRadius, lineEndpoints, outlinePoints } from '../../doc/shapeGeometry.ts'
import type { Point } from '../../doc/hitTest.ts'
import type { ShapeKind } from '../../doc/document.ts'
import { boxFor, constrainEnd, lineFrom as lineFromCorner } from './shapeDrag.ts'

export type ShapePreviewState = { kind: ShapeKind; start: Point; current: Point; shift: boolean }

const STROKE = '#a78bfa'
const FILL = 'rgba(167, 139, 250, 0.14)'

export function ShapePreview({
  preview,
  params,
  zoom,
  panX,
  panY,
}: {
  preview: ShapePreviewState
  params: ShapeParams
  zoom: number
  panX: number
  panY: number
}) {
  const end = constrainEnd(preview.start, preview.current, preview.kind, preview.shift)
  const box = boxFor(preview.start, end, preview.kind)
  const from = lineFromCorner(preview.start, end)
  const left = box.x * zoom + panX
  const top = box.y * zoom + panY
  const width = Math.max(box.width * zoom, 0.5)
  const height = Math.max(box.height * zoom, 0.5)
  const common = { stroke: STROKE, fill: FILL, strokeWidth: 1 }

  const path = () => {
    const points = outlinePoints({
      kind: preview.kind,
      width: box.width,
      height: box.height,
      sides: params.sides,
      points: params.points,
      innerRadius: params.innerRadius,
      startAngle: params.startAngle,
      sweepAngle: params.sweepAngle,
      pie: params.pie,
      lineFrom: from,
    })
    if (points === null) return null
    return points.map((point) => `${left + point.x * zoom},${top + point.y * zoom}`).join(' ')
  }

  return (
    <svg
      aria-hidden="true"
      data-shape-preview={preview.kind}
      className="pointer-events-none absolute inset-0"
      width="100%"
      height="100%"
    >
      {preview.kind === 'rect' || preview.kind === 'roundedRect' ? (
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          rx={clampCornerRadius(box.width, box.height, preview.kind === 'roundedRect' ? params.cornerRadius : 0) * zoom}
          {...common}
        />
      ) : preview.kind === 'ellipse' ? (
        <ellipse cx={left + width / 2} cy={top + height / 2} rx={width / 2} ry={height / 2} {...common} />
      ) : preview.kind === 'line' ? (
        <LinePreview
          box={box}
          from={from}
          left={left}
          top={top}
          zoom={zoom}
          strokeWidth={params.strokeWidth}
        />
      ) : (
        <polygon points={path() ?? ''} {...common} />
      )}
    </svg>
  )
}

function LinePreview({
  box,
  from,
  left,
  top,
  zoom,
  strokeWidth,
}: {
  box: { width: number; height: number }
  from: 'top-left' | 'top-right'
  left: number
  top: number
  zoom: number
  strokeWidth: number
}) {
  const [start, end] = lineEndpoints(box, from)
  return (
    <line
      x1={left + start.x * zoom}
      y1={top + start.y * zoom}
      x2={left + end.x * zoom}
      y2={top + end.y * zoom}
      stroke={STROKE}
      strokeWidth={Math.max(1, strokeWidth * zoom)}
    />
  )
}
