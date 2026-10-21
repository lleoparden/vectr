/**
 * Boolean path operations (Phase 5.4, issue #140).
 *
 * Skia's path ops are the same clipping engine the renderer draws with, so a union cannot disagree
 * with what is on screen. Inputs are flattened to polygons at the document's tolerance and the
 * result is read back as polygons: curves are sampled, and that is stated rather than hidden.
 *
 * L3: takes the CanvasKit instance as a parameter, so it can be exercised in a plain Node test.
 */

import type { CanvasKit, Path, PathOp } from 'canvaskit-wasm'

import type { Point } from '../geom/transform.ts'

export type BooleanMode = 'unite' | 'intersect' | 'subtract' | 'exclude'

/** A ring of scene-space points, open list (the closing edge is implicit). */
export type Polygon = Point[]

function pathFromPolygon(kit: CanvasKit, points: Polygon): Path | null {
  if (points.length < 3) return null
  const builder = new kit.PathBuilder()
  builder.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) builder.lineTo(point.x, point.y)
  builder.close()
  return builder.detach()
}

/** Symmetric difference, built from the two differences: CanvasKit's XOR is unreliable for this. */
function xorPaths(kit: CanvasKit, left: Path, right: Path): Path | null {
  const leftOnly = kit.Path.MakeFromOp(left, right, kit.PathOp.Difference)
  const rightOnly = kit.Path.MakeFromOp(right, left, kit.PathOp.Difference)
  if (leftOnly === null || rightOnly === null) {
    leftOnly?.delete()
    rightOnly?.delete()
    return null
  }
  const union = kit.Path.MakeFromOp(leftOnly, rightOnly, kit.PathOp.Union)
  leftOnly.delete()
  rightOnly.delete()
  return union
}

function opFor(kit: CanvasKit, mode: BooleanMode): PathOp {
  switch (mode) {
    case 'unite':
      return kit.PathOp.Union
    case 'intersect':
      return kit.PathOp.Intersect
    case 'subtract':
      return kit.PathOp.Difference
    case 'exclude':
      return kit.PathOp.XOR
  }
}

/** Reads a Skia path back as polygons, one per subpath. Curve verbs keep their end points. */
function polygonsFromPath(path: Path): Polygon[] {
  const commands = path.toCmds()
  const polygons: Polygon[] = []
  let current: Polygon = []
  let index = 0
  while (index < commands.length) {
    const verb = commands[index]
    index += 1
    const coords = (count: number): number[] => {
      const values = Array.from(commands.slice(index, index + count))
      index += count
      return values
    }
    if (verb === 0) {
      if (current.length >= 3) polygons.push(current)
      const [x, y] = coords(2)
      current = [{ x, y }]
    } else if (verb === 1) {
      const [x, y] = coords(2)
      current.push({ x, y })
    } else if (verb === 2) {
      // A quadratic: its end point (the third pair) continues the outline.
      const values = coords(4)
      current.push({ x: values[2], y: values[3] })
    } else if (verb === 3) {
      // A conic carries its control points plus a weight; keep the end point.
      const values = coords(5)
      current.push({ x: values[2], y: values[3] })
    } else if (verb === 4) {
      const values = coords(6)
      current.push({ x: values[4], y: values[5] })
    } else if (verb === 5) {
      if (current.length >= 3) polygons.push(current)
      current = []
    }
  }
  if (current.length >= 3) polygons.push(current)
  return polygons
}

/**
 * Applies a boolean across the polygons left to right. Unite and intersect are associative; subtract
 * removes every later polygon from the first; exclude toggles every polygon in turn.
 */
export function booleanPolygons(kit: CanvasKit, polygons: Polygon[], mode: BooleanMode): Polygon[] {
  const inputs = polygons.filter((polygon) => polygon.length >= 3)
  if (inputs.length < 2) return inputs.map((polygon) => polygon.map((point) => ({ ...point })))
  let accumulator = pathFromPolygon(kit, inputs[0])
  if (accumulator === null) return []
  try {
    for (const polygon of inputs.slice(1)) {
      const next = pathFromPolygon(kit, polygon)
      if (next === null || accumulator === null) continue
      const combined: Path | null =
        mode === 'exclude'
          ? xorPaths(kit, accumulator, next)
          : kit.Path.MakeFromOp(accumulator, next, opFor(kit, mode))
      next.delete()
      accumulator.delete()
      if (combined === null) {
        accumulator = null
        return []
      }
      accumulator = combined
    }
    return polygonsFromPath(accumulator)
  } finally {
    accumulator?.delete()
  }
}
