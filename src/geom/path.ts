/**
 * Bézier path geometry (Phase 5.1, issue #137).
 *
 * A path is a list of anchors; each anchor carries its point and two handle offsets **relative to
 * that point**, so translating an anchor moves its handles with it. A segment between two anchors
 * is a cubic with control points `a + a.out` and `b + b.in`; a closed path adds one segment from the
 * last anchor back to the first.
 *
 * L0: no document, renderer, or DOM knowledge. The flattener has an explicit tolerance so hit
 * testing, bounds, and tests all agree on how closely a polyline approximates the curve.
 */

export type PathAnchor = {
  /** Anchor point, in the node's local box coordinates. */
  x: number
  y: number
  /** Incoming handle, relative to the anchor. */
  inX: number
  inY: number
  /** Outgoing handle, relative to the anchor. */
  outX: number
  outY: number
  /** A smooth anchor's handles are mirrored; the pen tool sets this when dragging (5.2). */
  smooth: boolean
}

export type PathPoint = { x: number; y: number }

/** The default tolerance, in local units: a quarter of a unit is half a pixel at 200%. */
export const FLATTEN_TOLERANCE = 0.25

/** A corner anchor: no handles. */
export function cornerAnchor(x: number, y: number): PathAnchor {
  return { x, y, inX: 0, inY: 0, outX: 0, outY: 0, smooth: false }
}

/** A point on the cubic between two anchors, `t` in 0..1. */
export function cubicPoint(from: PathAnchor, to: PathAnchor, t: number): PathPoint {
  const x = cubicAt(from.x, from.x + from.outX, to.x + to.inX, to.x, t)
  const y = cubicAt(from.y, from.y + from.outY, to.y + to.inY, to.y, t)
  return { x, y }
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/** The number of segments in a path: one per anchor pair, plus a closing segment when closed. */
export function segmentCount(anchors: PathAnchor[], closed: boolean): number {
  if (anchors.length < 2) return 0
  return closed ? anchors.length : anchors.length - 1
}

/** The two anchors and control points of segment `index`. */
export function segmentAt(anchors: PathAnchor[], closed: boolean, index: number): { from: PathAnchor; to: PathAnchor } | null {
  const count = segmentCount(anchors, closed)
  if (index < 0 || index >= count) return null
  return { from: anchors[index], to: anchors[(index + 1) % anchors.length] }
}

/** How far the control points stray from the chord; small enough means the chord is the curve. */
function flatEnough(from: PathAnchor, to: PathAnchor, tolerance: number): boolean {
  const c1 = { x: from.x + from.outX, y: from.y + from.outY }
  const c2 = { x: to.x + to.inX, y: to.y + to.inY }
  return distanceToLine(c1, from, to) <= tolerance && distanceToLine(c2, from, to) <= tolerance
}

function distanceToLine(point: PathPoint, a: PathAnchor, b: PathAnchor): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / length
}

/**
 * The curve as a polyline, within `tolerance` of the true curve. Adaptive: a segment splits at its
 * midpoint until both halves are flat enough, so a nearly straight segment costs one line.
 */
export function flattenPath(anchors: PathAnchor[], closed: boolean, tolerance = FLATTEN_TOLERANCE): PathPoint[] {
  if (anchors.length === 0) return []
  if (anchors.length === 1) return [{ x: anchors[0].x, y: anchors[0].y }]
  const points: PathPoint[] = [{ x: anchors[0].x, y: anchors[0].y }]
  const count = segmentCount(anchors, closed)
  for (let index = 0; index < count; index += 1) {
    const segment = segmentAt(anchors, closed, index)
    if (segment === null) break
    flattenSegment(segment.from, segment.to, tolerance, points, 0)
  }
  return points
}

/** Recursively subdivides one cubic; pushes the end point of each flat piece. */
function flattenSegment(from: PathAnchor, to: PathAnchor, tolerance: number, points: PathPoint[], depth: number): void {
  if (depth >= 16 || flatEnough(from, to, tolerance)) {
    points.push({ x: to.x, y: to.y })
    return
  }
  const split = splitCubic(from, to)
  flattenSegment(split.left, split.middle, tolerance, points, depth + 1)
  flattenSegment(split.middle, split.right, tolerance, points, depth + 1)
}

/**
 * De Casteljau at t = 0.5. Returns the left sub-curve's start anchor with its out-handle adjusted,
 * the middle anchor carrying both halves' handles, and the right sub-curve's end anchor with its
 * in-handle adjusted - so the two halves reproduce the original curve.
 */
function splitCubic(from: PathAnchor, to: PathAnchor): { left: PathAnchor; middle: PathAnchor; right: PathAnchor } {
  const c1 = { x: from.x + from.outX, y: from.y + from.outY }
  const c2 = { x: to.x + to.inX, y: to.y + to.inY }
  const p01 = midpoint(from, c1)
  const p12 = midpoint(c1, c2)
  const p23 = midpoint(c2, to)
  const a = midpoint(p01, p12)
  const b = midpoint(p12, p23)
  const middle = midpoint(a, b)
  return {
    left: { ...from, outX: p01.x - from.x, outY: p01.y - from.y },
    middle: {
      x: middle.x,
      y: middle.y,
      inX: a.x - middle.x,
      inY: a.y - middle.y,
      outX: b.x - middle.x,
      outY: b.y - middle.y,
      smooth: false,
    },
    right: { ...to, inX: p23.x - to.x, inY: p23.y - to.y },
  }
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** The axis-aligned box around a path's flattened points. */
export function pathBounds(anchors: PathAnchor[], closed: boolean, tolerance = FLATTEN_TOLERANCE): { x: number; y: number; width: number; height: number } {
  const points = flattenPath(anchors, closed, tolerance)
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Distance from a point to a polyline, honouring whether the path closes. */
export function distanceToPolyline(points: PathPoint[], closed: boolean, point: PathPoint): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y)
  let best = Number.POSITIVE_INFINITY
  const count = closed ? points.length : points.length - 1
  for (let index = 0; index < count; index += 1) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    best = Math.min(best, distanceToSegment(point, a, b))
  }
  return best
}

function distanceToSegment(point: PathPoint, a: PathPoint, b: PathPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

/**
 * De Casteljau at an arbitrary t, as offsets the document can store: the left anchor's new
 * out-handle, the middle anchor (point plus both handles), and the right anchor's new in-handle.
 */
export function splitCubicAt(from: PathAnchor, to: PathAnchor, t: number): { leftOut: { x: number; y: number }; middle: PathAnchor; rightIn: { x: number; y: number } } {
  const p0 = { x: from.x, y: from.y }
  const p1 = { x: from.x + from.outX, y: from.y + from.outY }
  const p2 = { x: to.x + to.inX, y: to.y + to.inY }
  const p3 = { x: to.x, y: to.y }
  const q0 = lerp(p0, p1, t)
  const q1 = lerp(p1, p2, t)
  const q2 = lerp(p2, p3, t)
  const r0 = lerp(q0, q1, t)
  const r1 = lerp(q1, q2, t)
  const s = lerp(r0, r1, t)
  return {
    leftOut: { x: q0.x - p0.x, y: q0.y - p0.y },
    middle: { x: s.x, y: s.y, inX: r0.x - s.x, inY: r0.y - s.y, outX: r1.x - s.x, outY: r1.y - s.y, smooth: true },
    rightIn: { x: q2.x - p3.x, y: q2.y - p3.y },
  }
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}
