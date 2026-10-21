/**
 * Stroke outlines (Phase 5.6, issue #142).
 *
 * A stroke is a width; an outline is a shape. This turns an **open** polyline plus a width into the
 * closed polygon that stroke would cover, with flat caps: offset the polyline to both sides and join
 * the two rails. Curves are flattened first by the caller; closed paths need a hole (a compound
 * path), which is not built yet, so this refuses them rather than filling the wrong region.
 */

import { flattenPath, type PathAnchor, type PathPoint } from './path.ts'

/** The unit normal of a segment, rotated 90 degrees. */
function normal(a: PathPoint, b: PathPoint): PathPoint {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { x: 0, y: 0 }
  return { x: -dy / length, y: dx / length }
}

/** Offset a closed ring by `distance`, using each vertex's two neighbours. */
export function offsetRing(points: PathPoint[], distance: number): PathPoint[] {
  // Positive distance grows the ring whatever the winding: the sign follows the contour's area.
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  const oriented = area >= 0 ? -distance : distance
  return offsetRingRaw(points, oriented)
}

function offsetRingRaw(points: PathPoint[], distance: number): PathPoint[] {
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    const next = points[(index + 1) % points.length]
    const before = normal(previous, point)
    const after = normal(point, next)
    let nx = before.x + after.x
    let ny = before.y + after.y
    const length = Math.hypot(nx, ny)
    if (length === 0) {
      nx = after.x
      ny = after.y
    } else {
      nx /= length
      ny /= length
      const scale = 1 / Math.max(0.35, before.x * nx + before.y * ny)
      nx *= scale
      ny *= scale
    }
    return { x: point.x + nx * distance, y: point.y + ny * distance }
  })
}

/**
 * The ring a stroke of `width` covers around a **closed** contour: an outer contour and an inner
 * one, which a compound path draws with the even-odd rule. Flat joins are not modelled; the miter
 * scale is the same one the open outline uses.
 */
export function strokeRing(points: PathPoint[], width: number): { outer: PathPoint[]; inner: PathPoint[] } | null {
  if (points.length < 3 || !(width > 0)) return null
  const clean: PathPoint[] = []
  for (const point of points) {
    const last = clean[clean.length - 1]
    if (last === undefined || Math.hypot(point.x - last.x, point.y - last.y) > 1e-9) clean.push(point)
  }
  if (clean.length < 3) return null
  const half = width / 2
  const first = offsetRing(clean, half)
  const second = offsetRing(clean, -half)
  // The sign of the offset depends on the contour's winding; the larger contour is the outside.
  return outlineArea(first) >= outlineArea(second) ? { outer: first, inner: second } : { outer: second, inner: first }
}

/** Offset one open polyline by `distance` along its left-hand normals. */
export function offsetSide(points: PathPoint[], distance: number): PathPoint[] {
  return points.map((point, index) => {
    const before = index === 0 ? null : normal(points[index - 1], point)
    const after = index === points.length - 1 ? null : normal(point, points[index + 1])
    let nx = 0
    let ny = 0
    if (before === null && after !== null) {
      nx = after.x
      ny = after.y
    } else if (after === null && before !== null) {
      nx = before.x
      ny = before.y
    } else if (before !== null && after !== null) {
      nx = before.x + after.x
      ny = before.y + after.y
      const length = Math.hypot(nx, ny)
      if (length === 0) {
        nx = after.x
        ny = after.y
      } else {
        nx /= length
        ny /= length
        // Keep the offset distance right at a corner instead of shrinking it.
        const scale = 1 / Math.max(0.35, before.x * nx + before.y * ny)
        nx *= scale
        ny *= scale
      }
    }
    return { x: point.x + nx * distance, y: point.y + ny * distance }
  })
}

/**
 * The closed outline a stroke of `width` covers around an open polyline. Flat caps, as the document's
 * default stroke cap is butt; round and square caps are not modelled here.
 */
export function strokeOutline(points: PathPoint[], width: number): PathPoint[] {
  if (points.length < 2 || !(width > 0)) return []
  // Drop duplicate neighbours: they make the normal of a zero-length segment meaningless.
  const clean: PathPoint[] = []
  for (const point of points) {
    const last = clean[clean.length - 1]
    if (last === undefined || Math.hypot(point.x - last.x, point.y - last.y) > 1e-9) clean.push(point)
  }
  if (clean.length < 2) return []
  const half = width / 2
  const left = offsetSide(clean, half)
  const right = offsetSide(clean, -half)
  return [...left, ...right.reverse()]
}

/** The area a stroke outline covers is close to length × width for a thin stroke on a gentle path. */
export function outlineArea(points: PathPoint[]): number {
  let sum = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum / 2)
}

/** Per-point half widths from anchor multipliers, sampled along the flattened path. */
export function flattenedWithWidths(
  anchors: PathAnchor[],
  closed: boolean,
  multipliers: number[],
  width: number,
): { points: PathPoint[]; halfWidths: number[] } {
  const points: PathPoint[] = []
  const halfWidths: number[] = []
  const count = anchors.length
  const multiplierAt = (index: number): number => multipliers[index] ?? 1
  const segments = closed ? count : Math.max(0, count - 1)
  for (let index = 0; index < segments; index += 1) {
    const from = anchors[index]
    const to = anchors[(index + 1) % count]
    const samples = flattenPath([from, to], false)
    const fromWidth = (width * multiplierAt(index)) / 2
    const toWidth = (width * multiplierAt((index + 1) % count)) / 2
    const skipFirst = index > 0
    const start = skipFirst ? 1 : 0
    for (let sample = start; sample < samples.length; sample += 1) {
      const fraction = samples.length <= 1 ? 0 : sample / (samples.length - 1)
      points.push(samples[sample])
      halfWidths.push(fromWidth + (toWidth - fromWidth) * fraction)
    }
  }
  return { points, halfWidths }
}

/** Normal at a point, from the direction of its neighbours. Endpoints use their one segment. */
function profileNormal(points: PathPoint[], index: number, closed: boolean): PathPoint {
  const count = points.length
  const hasBefore = closed || index > 0
  const hasAfter = closed || index < count - 1
  const before = hasBefore ? normal(points[(index - 1 + count) % count], points[index]) : null
  const after = hasAfter ? normal(points[index], points[(index + 1) % count]) : null
  if (before === null && after !== null) return after
  if (after === null && before !== null) return before
  if (before === null || after === null) return { x: 0, y: 0 }
  let nx = before.x + after.x
  let ny = before.y + after.y
  const length = Math.hypot(nx, ny)
  if (length === 0) return after
  nx /= length
  ny /= length
  const scale = 1 / Math.max(0.35, before.x * nx + before.y * ny)
  return { x: nx * scale, y: ny * scale }
}

/** A variable-width open stroke: the outline rails at each point's own half width. */
export function variableOutline(points: PathPoint[], halfWidths: number[]): PathPoint[] {
  if (points.length < 2) return []
  const left: PathPoint[] = []
  const right: PathPoint[] = []
  for (let index = 0; index < points.length; index += 1) {
    const unit = profileNormal(points, index, false)
    left.push({ x: points[index].x + unit.x * halfWidths[index], y: points[index].y + unit.y * halfWidths[index] })
    right.push({ x: points[index].x - unit.x * halfWidths[index], y: points[index].y - unit.y * halfWidths[index] })
  }
  return [...left, ...right.reverse()]
}

/** A variable-width closed stroke: outer and inner rings, drawn even-odd like a compound. */
export function variableRing(points: PathPoint[], halfWidths: number[]): { outer: PathPoint[]; inner: PathPoint[] } | null {
  if (points.length < 3) return null
  const outer: PathPoint[] = []
  const inner: PathPoint[] = []
  for (let index = 0; index < points.length; index += 1) {
    const unit = profileNormal(points, index, true)
    outer.push({ x: points[index].x + unit.x * halfWidths[index], y: points[index].y + unit.y * halfWidths[index] })
    inner.push({ x: points[index].x - unit.x * halfWidths[index], y: points[index].y - unit.y * halfWidths[index] })
  }
  return outlineArea(outer) >= outlineArea(inner) ? { outer, inner } : { outer: inner, inner: outer }
}
