import type { Transform } from '../doc/types.ts'
/**
 * Transform planning (Phase 2.2, issue #65).
 *
 * Pure arithmetic for a selection's bounding box and its eight scale handles. Nothing here mutates
 * a document: the caller dispatches the existing `setTransform` command with the numbers these
 * functions return, so a pointer scale is still one transaction and one undo entry, and there is
 * no second geometry model. The box comes from `worldBounds`, the same composition the hit test and
 * the renderer use.
 *
 * Coordinates are world (scene) units. `scaledTransform` assumes the node's ancestors are
 * unscaled, which is true today: nothing sets a scale on a group yet. A node inside a scaled group
 * would scale in its own local units, a limit recorded in `docs/DECISIONS.md`.
 */


export type Rect = { x: number; y: number; width: number; height: number }
export type Point = { x: number; y: number }

/** The eight handles Illustrator's bounding box shows, by compass name. */
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** The smallest factor a drag may produce, so a shape cannot be collapsed to nothing by accident. */
export const MIN_SCALE = 0.01

export function handlePoints(box: Rect): Record<HandleId, Point> {
  const left = box.x
  const right = box.x + box.width
  const top = box.y
  const bottom = box.y + box.height
  const midX = left + box.width / 2
  const midY = top + box.height / 2
  return {
    nw: { x: left, y: top },
    n: { x: midX, y: top },
    ne: { x: right, y: top },
    e: { x: right, y: midY },
    se: { x: right, y: bottom },
    s: { x: midX, y: bottom },
    sw: { x: left, y: bottom },
    w: { x: left, y: midY },
  }
}

/** The corner a handle scales about: the opposite corner, or the opposite edge midpoint. */
export function anchoredEdge(handle: HandleId, box: Rect): Point {
  const points = handlePoints(box)
  const opposite: Record<HandleId, HandleId> = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' }
  return points[opposite[handle]]
}

export type ScaleOptions = {
  /** Shift: both axes take the dominant factor, so the selection keeps its proportions. */
  constrain?: boolean
  /** Alt: the box's centre stays put instead of the opposite corner. */
  fromCenter?: boolean
}

export type ScaleFactors = { sx: number; sy: number; anchor: Point }

/**
 * Factors for dragging `handle` from its place to `point` (a scene point).
 *
 * An edge handle only scales its own axis; a corner scales both. Shift takes the axis the pointer
 * moved further and applies it to both, which is Illustrator's constrained scale; Alt anchors at the
 * centre instead of the opposite corner.
 */
export function scaleFactors(handle: HandleId, box: Rect, point: Point, options: ScaleOptions = {}): ScaleFactors {
  const points = handlePoints(box)
  const start = points[handle]
  const horizontal = handle.includes('e') || handle.includes('w')
  const vertical = handle.includes('n') || handle.includes('s')
  const centreX = box.x + box.width / 2
  const centreY = box.y + box.height / 2
  const anchor: Point = options.fromCenter
    ? { x: horizontal ? centreX : start.x, y: vertical ? centreY : start.y }
    : {
        x: horizontal ? (handle.includes('e') ? box.x : box.x + box.width) : start.x,
        y: vertical ? (handle.includes('n') ? box.y + box.height : box.y) : start.y,
      }

  const factor = (from: number, to: number, fixed: number): number => {
    const span = from - fixed
    if (Math.abs(span) < 1e-9) return 1
    const next = (to - fixed) / span
    return Math.abs(next) < MIN_SCALE ? Math.sign(next || 1) * MIN_SCALE : next
  }

  let sx = horizontal ? factor(start.x, point.x, anchor.x) : 1
  let sy = vertical ? factor(start.y, point.y, anchor.y) : 1

  if (options.constrain === true && horizontal && vertical) {
    if (Math.abs(sx - 1) >= Math.abs(sy - 1)) sy = sx
    else sx = sy
  }
  return { sx, sy, anchor }
}

/**
 * The transform a scaled node needs. The node's own origin is moved about the anchor by the same
 * factors as its size, so the anchor point is a fixed point of the whole gesture.
 */
export function scaledTransform(
  transform: Pick<Transform, 'x' | 'y' | 'scaleX' | 'scaleY'>,
  anchor: Point,
  sx: number,
  sy: number,
): Pick<Transform, 'x' | 'y' | 'scaleX' | 'scaleY'> {
  return {
    x: anchor.x + (transform.x - anchor.x) * sx,
    y: anchor.y + (transform.y - anchor.y) * sy,
    scaleX: transform.scaleX * sx,
    scaleY: transform.scaleY * sy,
  }
}

/** Moves a node's transform by a scene delta, keeping everything else. */
export function nudgedTransform(transform: Transform, dx: number, dy: number): Transform {
  return { ...transform, x: transform.x + dx, y: transform.y + dy }
}
