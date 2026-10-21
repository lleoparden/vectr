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
import { type PathAnchor } from '../geom/path.ts'

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

/**
 * Divide: every polygon is split against the ones before it, leaving non-overlapping faces. The
 * pairwise engine does the work; a face smaller than a hundredth of a square unit is dropped so
 * numerical slivers do not become layers.
 */
export function dividePolygons(kit: CanvasKit, polygons: Polygon[]): Polygon[] {
  const inputs = polygons.filter((polygon) => polygon.length >= 3)
  const faces: Polygon[] = []
  let leftovers: Polygon[] = []
  for (const polygon of inputs) {
    let pieces: Polygon[] = [polygon.map((point) => ({ ...point }))]
    const nextLeftovers: Polygon[] = []
    for (const existing of leftovers) {
      const nextPieces: Polygon[] = []
      for (const piece of pieces) {
        for (const part of booleanPolygons(kit, [piece, existing], 'intersect')) {
          if (area(part) > 0.01) faces.push(part)
        }
        for (const part of booleanPolygons(kit, [piece, existing], 'subtract')) {
          if (area(part) > 0.01) nextPieces.push(part)
        }
      }
      pieces = nextPieces
      // The existing face loses the part the new polygon covers.
      for (const part of booleanPolygons(kit, [existing, polygon], 'subtract')) {
        if (area(part) > 0.01) nextLeftovers.push(part)
      }
    }
    leftovers = [...nextLeftovers, ...pieces]
  }
  return [...faces, ...leftovers]
}

/** The polygon area, local to this module to keep the divide honest about slivers. */
function area(polygon: Polygon): number {
  let sum = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]
    const b = polygon[(index + 1) % polygon.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum / 2)
}

/** Reads a Skia path back as anchor lists, preserving lines, quadratics, and cubics. */
export function anchorsFromPath(path: Path): PathAnchor[][] {
  const commands = path.toCmds()
  const result: PathAnchor[][] = []
  let current: PathAnchor[] = []
  let index = 0
  const read = (count: number): number[] => {
    const values = Array.from(commands.slice(index, index + count))
    index += count
    return values
  }
  const push = (anchor: PathAnchor): void => {
    current.push(anchor)
  }
  while (index < commands.length) {
    const verb = commands[index]
    index += 1
    if (verb === 0) {
      if (current.length >= 2) result.push(current)
      const [x, y] = read(2)
      current = [{ x, y, inX: 0, inY: 0, outX: 0, outY: 0, smooth: false }]
    } else if (verb === 1) {
      const [x, y] = read(2)
      push({ x, y, inX: 0, inY: 0, outX: 0, outY: 0, smooth: false })
    } else if (verb === 2) {
      const [qx, qy, x, y] = read(4)
      const from = current[current.length - 1]
      if (from !== undefined) {
        from.outX = (2 / 3) * (qx - from.x)
        from.outY = (2 / 3) * (qy - from.y)
      }
      push({ x, y, inX: (2 / 3) * (qx - x), inY: (2 / 3) * (qy - y), outX: 0, outY: 0, smooth: true })
    } else if (verb === 3) {
      const [cx, cy, x, y] = read(5)
      // A conic has no exact cubic form; its endpoint is kept and the handles approximate it.
      const from = current[current.length - 1]
      if (from !== undefined) {
        from.outX = (2 / 3) * (cx - from.x)
        from.outY = (2 / 3) * (cy - from.y)
      }
      push({ x, y, inX: (2 / 3) * (cx - x), inY: (2 / 3) * (cy - y), outX: 0, outY: 0, smooth: true })
    } else if (verb === 4) {
      const [c1x, c1y, c2x, c2y, x, y] = read(6)
      const from = current[current.length - 1]
      if (from !== undefined) {
        from.outX = c1x - from.x
        from.outY = c1y - from.y
      }
      push({ x, y, inX: c2x - x, inY: c2y - y, outX: 0, outY: 0, smooth: true })
    } else if (verb === 5) {
      if (current.length >= 2) result.push(current)
      current = []
    }
  }
  if (current.length >= 2) result.push(current)
  return result
}

/** Boolean of already-built paths, returning anchor lists that keep their curves. */
export function booleanPaths(kit: CanvasKit, paths: Path[], mode: BooleanMode): PathAnchor[][] {
  if (paths.length < 2) return paths.flatMap((path) => anchorsFromPath(path))
  let accumulator: Path | null = null
  try {
    for (let index = 1; index < paths.length; index += 1) {
      const left: Path = accumulator ?? paths[0]
      const combined: Path | null =
        mode === 'exclude'
          ? xorPaths(kit, left, paths[index])
          : kit.Path.MakeFromOp(left, paths[index], opFor(kit, mode))
      if (accumulator !== null) accumulator.delete()
      if (combined === null) {
        accumulator = null
        return []
      }
      accumulator = combined
    }
    return accumulator === null ? [] : anchorsFromPath(accumulator)
  } finally {
    accumulator?.delete()
  }
}
