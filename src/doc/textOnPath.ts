/**
 * Text on a path (Phase 6.3).
 *
 * Pure layout over a flattened polyline: the caller supplies the path points and a per-character
 * measure, and gets one placement per glyph with its tangent angle. Centring is the default, which
 * is what Illustrator does when you click a path with the Type tool.
 */

export type PathGlyph = { character: string; x: number; y: number; angle: number; advance: number }

type Point = { x: number; y: number }

function segmentLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Point and tangent angle at a distance along the polyline; null when the path cannot hold it. */
function pointAt(points: Point[], distance: number, closed: boolean): { point: Point; angle: number } | null {
  const count = points.length
  if (count < 2) return null
  let remaining = distance
  const segments = closed ? count : count - 1
  for (let index = 0; index < segments; index += 1) {
    const from = points[index]
    const to = points[(index + 1) % count]
    const length = segmentLength(from, to)
    if (length === 0) continue
    if (remaining <= length) {
      const t = remaining / length
      return {
        point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
        angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
      }
    }
    remaining -= length
  }
  return null
}

export function pathLength(points: Point[], closed: boolean): number {
  const count = points.length
  if (count < 2) return 0
  let total = 0
  const segments = closed ? count : count - 1
  for (let index = 0; index < segments; index += 1) {
    total += segmentLength(points[index], points[(index + 1) % count])
  }
  return total
}

export function layoutTextOnPath(
  text: string,
  points: Point[],
  closed: boolean,
  measure: (character: string) => number,
): PathGlyph[] {
  const content = text.replace(/\n/gu, '')
  const total = pathLength(points, closed)
  if (content.length === 0 || total <= 0) return []
  const advances = Array.from(content, (character) => Math.max(0.01, measure(character)))
  const textWidth = advances.reduce((sum, advance) => sum + advance, 0)
  const start = (total - textWidth) / 2
  const glyphs: PathGlyph[] = []
  let distance = start
  for (let index = 0; index < content.length; index += 1) {
    const advance = advances[index]
    const centre = distance + advance / 2
    let placementDistance = centre
    if (placementDistance < 0) {
      if (!closed) break
      placementDistance = ((placementDistance % total) + total) % total
    }
    if (placementDistance > total) {
      if (!closed) break
      placementDistance %= total
    }
    const placement = pointAt(points, placementDistance, closed)
    if (placement === null) break
    glyphs.push({ character: content[index], x: placement.point.x, y: placement.point.y, angle: placement.angle, advance })
    distance += advance
  }
  return glyphs
}
