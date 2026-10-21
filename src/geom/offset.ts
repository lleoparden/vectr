/**
 * Stroke outlines (Phase 5.6, issue #142).
 *
 * A stroke is a width; an outline is a shape. This turns an **open** polyline plus a width into the
 * closed polygon that stroke would cover, with flat caps: offset the polyline to both sides and join
 * the two rails. Curves are flattened first by the caller; closed paths need a hole (a compound
 * path), which is not built yet, so this refuses them rather than filling the wrong region.
 */

import type { PathPoint } from './path.ts'

/** The unit normal of a segment, rotated 90 degrees. */
function normal(a: PathPoint, b: PathPoint): PathPoint {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { x: 0, y: 0 }
  return { x: -dy / length, y: dx / length }
}

/** Offset a closed ring by `distance`, using each vertex's two neighbours. */
function offsetRing(points: PathPoint[], distance: number): PathPoint[] {
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
function offsetSide(points: PathPoint[], distance: number): PathPoint[] {
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
