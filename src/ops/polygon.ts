/**
 * Polygon measurements shared by path operations (Phase 5.4, issue #140).
 *
 * L2: shapes are flattened to polylines at an explicit tolerance, then measured. Booleans are built
 * on these primitives rather than on eyeballing a picture, so a result can be verified by area and
 * winding instead of by trust.
 */

import { flattenPath, type PathAnchor, type PathPoint } from '../geom/path.ts'

/** The signed area of a polygon via the shoelace formula; positive means counter-clockwise. */
export function signedArea(points: PathPoint[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/** The absolute area, which is what a boolean's scoreboard compares. */
export function area(points: PathPoint[]): number {
  return Math.abs(signedArea(points))
}

/** A closed path's outline as a polygon at the flattener's tolerance. */
export function polygonOf(anchors: PathAnchor[], tolerance?: number): PathPoint[] {
  return flattenPath(anchors, true, tolerance)
}

/**
 * The winding number of a polygon around a point: zero means outside. Works for self-intersecting
 * polygons too, unlike a simple ray test, which is why booleans measure winding rather than parity.
 */
export function windingNumber(points: PathPoint[], point: PathPoint): number {
  let winding = 0
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    if (a.y <= point.y) {
      if (b.y > point.y && cross(a, b, point) > 0) winding += 1
    } else if (b.y <= point.y && cross(a, b, point) < 0) {
      winding -= 1
    }
  }
  return winding
}

/** The z component of (b - a) × (point - a); positive means the point is left of the edge. */
function cross(a: PathPoint, b: PathPoint, point: PathPoint): number {
  return (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)
}

/** True when the point is inside the polygon by the nonzero rule. */
export function polygonContainsNonzero(points: PathPoint[], point: PathPoint): boolean {
  return windingNumber(points, point) !== 0
}
