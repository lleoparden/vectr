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

/** One outer contour with the contours that are holes inside it. */
export type NestedContours = { outer: PathPoint[]; holes: PathPoint[][] }

/**
 * Groups boolean-result polygons into outer contours and holes: a contour whose first vertex lies
 * inside another, larger contour becomes a hole of the smallest such container. Splitting a ring
 * into two filled paths would paint the hole, which is the bug this prevents.
 */
export function nestPolygons(polygons: PathPoint[][]): NestedContours[] {
  const sorted = polygons
    .filter((polygon) => polygon.length >= 3)
    .map((polygon) => ({ polygon, size: Math.abs(signedArea(polygon)) }))
    .sort((left, right) => right.size - left.size)
  const result: NestedContours[] = []
  for (const entry of sorted) {
    const probe = centroid(entry.polygon)
    let parent: NestedContours | null = null
    let parentSize = Infinity
    for (const candidate of result) {
      const candidateSize = Math.abs(signedArea(candidate.outer))
      if (candidateSize < parentSize && polygonContainsNonzero(candidate.outer, probe)) {
        parent = candidate
        parentSize = candidateSize
      }
    }
    if (parent === null) result.push({ outer: entry.polygon, holes: [] })
    else parent.holes.push(entry.polygon)
  }
  return result
}

/** The same nesting decision, as indices, so a caller can keep each contour's anchors and handles. */
export function nestPolygonIndices(polygons: PathPoint[][]): Array<{ outer: number; holes: number[] }> {
  const order = polygons
    .map((polygon, index) => ({ index, polygon, size: Math.abs(signedArea(polygon)) }))
    .filter((entry) => entry.polygon.length >= 3)
    .sort((left, right) => right.size - left.size)
  const groups: Array<{ outer: number; holes: number[] }> = []
  for (const entry of order) {
    const probe = entry.polygon[0]
    let parent: { outer: number; holes: number[] } | null = null
    let parentSize = Infinity
    for (const candidate of groups) {
      const candidateSize = Math.abs(signedArea(polygons[candidate.outer]))
      if (candidateSize < parentSize && polygonContainsNonzero(polygons[candidate.outer], probe)) {
        parent = candidate
        parentSize = candidateSize
      }
    }
    if (parent === null) groups.push({ outer: entry.index, holes: [] })
    else parent.holes.push(entry.index)
  }
  return groups
}
