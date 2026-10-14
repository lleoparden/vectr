/**
 * Shape drag math (owner request after Phase 1: the ellipse preview showed a rectangle, and
 * Shift did not constrain a drag to a square or a circle).
 *
 * Pure: a start point, the pointer, the shape kind, and whether Shift is held go in; the box the
 * shape will occupy — and, for a line, which way it runs — comes out. The same box feeds the
 * preview and the created node, so the two cannot disagree. `tests/shapes.test.ts` covers it.
 */

import type { ShapeKind } from '../../doc/document.ts'
import type { Point } from '../../doc/hitTest.ts'

export type DragBox = { x: number; y: number; width: number; height: number }

/** Kinds that are inscribed in a square when Shift is held, as in Illustrator. */
const SQUARE_WHEN_CONSTRAINED: ShapeKind[] = ['rect', 'roundedRect', 'polygon', 'star']

/** Snaps a direction to the nearest 45° step, which is what Shift does to a line. */
export function snapTo45(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return end
  const step = Math.PI / 4
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
}

/**
 * Where the drag effectively ends. Shift makes a square or a circle (using the larger of the two
 * distances, as Illustrator does) and snaps a line to 45°.
 */
export function constrainEnd(start: Point, current: Point, kind: ShapeKind, shift: boolean): Point {
  if (!shift) return current
  if (kind === 'line') return snapTo45(start, current)
  const dx = current.x - start.x
  const dy = current.y - start.y
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: start.x + Math.sign(dx === 0 ? 1 : dx) * size,
    y: start.y + Math.sign(dy === 0 ? 1 : dy) * size,
  }
}

/**
 * The shape's box from two points, always with a positive size. A line clamps its degenerate axis
 * to 1 so a horizontal or vertical segment is still a valid node.
 */
export function boxFor(start: Point, end: Point, kind: ShapeKind): DragBox {
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: kind === 'line' ? Math.max(1, width) : width,
    height: kind === 'line' ? Math.max(1, height) : height,
  }
}

/** Which corner a line's segment starts at, given the direction the drag went. */
export function lineFrom(start: Point, end: Point): 'top-left' | 'top-right' {
  const sameDirection = (end.x - start.x) * (end.y - start.y) >= 0
  return sameDirection ? 'top-left' : 'top-right'
}

/** Whether a drag is long enough to create a shape. A line may be flat; a box may not. */
export function dragIsBigEnough(start: Point, end: Point, kind: ShapeKind, minimum: number): boolean {
  if (kind === 'line') return Math.hypot(end.x - start.x, end.y - start.y) >= minimum
  return Math.abs(end.x - start.x) >= minimum && Math.abs(end.y - start.y) >= minimum
}

/** True when Shift constrains this kind to equal width and height. */
export function constrainsToSquare(kind: ShapeKind): boolean {
  return SQUARE_WHEN_CONSTRAINED.includes(kind) || kind === 'ellipse' || kind === 'arc'
}
