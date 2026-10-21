/**
 * Polygon measurements shared by path operations (Phase 5.4, issue #140).
 *
 * L2: shapes are flattened to polylines at an explicit tolerance, then measured. Booleans are built
 * on these primitives rather than on eyeballing a picture, so a result can be verified by area and
 * winding instead of by trust.
 */

import { distanceToPolyline, flattenPath, type PathAnchor, type PathPoint } from '../geom/path.ts'

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

/** The average of a polygon's vertices; for a convex face this is inside it. */
export function centroid(points: PathPoint[]): PathPoint {
  if (points.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const point of points) {
    x += point.x
    y += point.y
  }
  return { x: x / points.length, y: y / points.length }
}

/** True when a drag path comes within tolerance of the face: its vertices, edges, or centre. */
export function polygonTouchesPath(points: PathPoint[], path: PathPoint[], tolerance: number): boolean {
  if (points.length === 0 || path.length === 0) return false
  const centre = centroid(points)
  if (distanceToPolyline(path, false, centre) <= tolerance) return true
  for (const point of points) {
    if (distanceToPolyline(path, false, point) <= tolerance) return true
  }
  return false
}
