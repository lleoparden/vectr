/**
 * Shape geometry (owner request after Phase 1: the drag preview showed a rectangle for an
 * ellipse, and line/polygon/star/arc/rounded corners were missing).
 *
 * One place computes the outline of every shape kind, in the node's own box coordinates
 * (`0,0` → `width,height`, y down). The renderer turns these points into a Skia path and the
 * canvas turns the same points into the drag preview, so the preview cannot disagree with what
 * gets drawn — the lesson from the layer thumbnails, applied to the tool overlays.
 *
 * Angles are degrees measured **counterclockwise from the +x axis**, the way Illustrator's arc
 * tool labels them; the y flip happens here so callers never think about it.
 */

export type Point = { x: number; y: number }

/** Box geometry every shape kind shares. */
export type ShapeBox = { width: number; height: number }

/** Illustrator clamps a rounded corner to half the shorter side; beyond that the shape degenerates. */
export function clampCornerRadius(width: number, height: number, requested: number): number {
  if (!Number.isFinite(requested) || requested <= 0) return 0
  return Math.min(requested, Math.min(Math.abs(width), Math.abs(height)) / 2)
}

/** The two ends of a line segment across the node's box. */
export function lineEndpoints(
  box: ShapeBox,
  from: 'top-left' | 'top-right' = 'top-left',
): [Point, Point] {
  return from === 'top-left'
    ? [
        { x: 0, y: 0 },
        { x: box.width, y: box.height },
      ]
    : [
        { x: box.width, y: 0 },
        { x: 0, y: box.height },
      ]
}

/**
 * Samples an elliptical arc. `startAngle` and `sweepAngle` are degrees, counterclockwise from +x;
 * a negative sweep runs clockwise. Sampling rather than a Skia arc call keeps one geometry source
 * for the canvas and the preview, and keeps the point count bounded.
 */
export function arcPoints(
  box: ShapeBox,
  startAngle: number,
  sweepAngle: number,
  maxSegments = 96,
): Point[] {
  const rx = box.width / 2
  const ry = box.height / 2
  const sweep = Math.max(-360, Math.min(360, sweepAngle))
  const segments = Math.max(1, Math.min(maxSegments, Math.ceil(Math.abs(sweep) / 3)))
  const points: Point[] = []
  for (let index = 0; index <= segments; index += 1) {
    const degrees = startAngle + (sweep * index) / segments
    const radians = (degrees * Math.PI) / 180
    points.push({ x: rx + rx * Math.cos(radians), y: ry - ry * Math.sin(radians) })
  }
  return points
}

/** Centre of a shape's box, which a pie slice closes through. */
export function boxCentre(box: ShapeBox): Point {
  return { x: box.width / 2, y: box.height / 2 }
}

/**
 * The outline of any shape kind whose geometry can be expressed as points, or `null` for the kinds
 * that have their own primitive (rect, rounded rect, ellipse). Both the renderer and the preview
 * use this, which is what keeps the drag outline honest.
 */
export function outlinePoints(shape: {
  kind: string
  width: number
  height: number
  sides?: number
  points?: number
  innerRadius?: number
  startAngle?: number
  sweepAngle?: number
  lineFrom?: 'top-left' | 'top-right'
  pie?: boolean
}): Point[] | null {
  const box = { width: shape.width, height: shape.height }
  switch (shape.kind) {
    case 'line':
      return lineEndpoints(box, shape.lineFrom ?? 'top-left')
    case 'polygon':
      return polygonPoints(box, shape.sides ?? 6)
    case 'star':
      return starPoints(box, shape.points ?? 5, shape.innerRadius ?? 0.5)
    case 'arc': {
      const points = arcPoints(box, shape.startAngle ?? 0, shape.sweepAngle ?? 90)
      if (shape.pie === true) return [...points, boxCentre(box)]
      return points
    }
    default:
      return null
  }
}

/** Regular polygon inscribed in the box, first vertex at the top, like Illustrator's polygon. */
export function polygonPoints(box: ShapeBox, sides: number): Point[] {
  const count = Math.max(3, Math.min(60, Math.round(sides)))
  const cx = box.width / 2
  const cy = box.height / 2
  const points: Point[] = []
  for (let index = 0; index < count; index += 1) {
    const angle = (-90 + (index * 360) / count) * (Math.PI / 180)
    points.push({ x: cx + cx * Math.cos(angle), y: cy + cy * Math.sin(angle) })
  }
  return points
}

/** Star with `points` tips, alternating between the box edge and `innerRadius` of it. */
export function starPoints(box: ShapeBox, points: number, innerRadius: number): Point[] {
  const tips = Math.max(3, Math.min(60, Math.round(points)))
  const ratio = Math.max(0.05, Math.min(0.95, innerRadius))
  const cx = box.width / 2
  const cy = box.height / 2
  const result: Point[] = []
  for (let index = 0; index < tips * 2; index += 1) {
    const angle = (-90 + (index * 180) / tips) * (Math.PI / 180)
    const factor = index % 2 === 0 ? 1 : ratio
    result.push({ x: cx + cx * factor * Math.cos(angle), y: cy + cy * factor * Math.sin(angle) })
  }
  return result
}

/**
 * The outline of any leaf as a closed polygon, for vector clipping (issue #71).
 *
 * Curves are sampled (an ellipse at 64 points, a rounded corner at 4), which is the same trade the
 * arc tool already makes, and it keeps clipping to one code path the renderer, the hit test, and the
 * tests can all share. Text and images clip to their box: Vectr has no glyph or alpha silhouette to
 * clip by, and a box is what the user sees selected.
 */
export function clipPolygon(shape: {
  kind: string
  width: number
  height: number
  cornerRadius?: number
  sides?: number
  points?: number
  innerRadius?: number
  startAngle?: number
  sweepAngle?: number
  lineFrom?: 'top-left' | 'top-right'
  pie?: boolean
}): Point[] {
  const box = { width: shape.width, height: shape.height }
  if (shape.kind === 'ellipse') {
    const points: Point[] = []
    const rx = shape.width / 2
    const ry = shape.height / 2
    for (let index = 0; index < 64; index += 1) {
      const angle = (index * 2 * Math.PI) / 64
      points.push({ x: rx + rx * Math.cos(angle), y: ry + ry * Math.sin(angle) })
    }
    return points
  }
  if (shape.kind === 'rect' || shape.kind === 'text' || shape.kind === 'image') {
    const radius = shape.kind === 'rect' ? clampCornerRadius(shape.width, shape.height, shape.cornerRadius ?? 0) : 0
    if (radius <= 0) {
      return [
        { x: 0, y: 0 },
        { x: box.width, y: 0 },
        { x: box.width, y: box.height },
        { x: 0, y: box.height },
      ]
    }
    const points: Point[] = []
    const corner = (cx: number, cy: number, start: number) => {
      for (let step = 0; step <= 4; step += 1) {
        const angle = ((start + (90 * step) / 4) * Math.PI) / 180
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
      }
    }
    corner(radius, radius, 180)
    corner(box.width - radius, radius, 270)
    corner(box.width - radius, box.height - radius, 0)
    corner(radius, box.height - radius, 90)
    return points
  }
  return outlinePoints(shape) ?? [
    { x: 0, y: 0 },
    { x: box.width, y: 0 },
    { x: box.width, y: box.height },
    { x: 0, y: box.height },
  ]
}
