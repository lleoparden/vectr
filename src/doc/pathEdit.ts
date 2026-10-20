/**
 * Path editing maths (Phase 5.3, issue #139).
 *
 * Anchors are stored in a node's local box, but the pointer works in scene coordinates, and a node
 * may be rotated or scaled. These helpers convert between the two and find the anchor or handle a
 * pointer is nearest, with a screen-pixel tolerance the caller converts to scene units by zoom.
 *
 * L1: document-shaped, no renderer or React.
 */

import type { PathAnchor } from '../geom/path.ts'
import type { Point } from '../geom/transform.ts'
import { rotatePoint } from '../geom/transform.ts'
import type { NodeId, Transform } from './types.ts'

/** The geometry an anchor gesture needs: the node's box and transform, plus its anchors. */
export type PathEditCapture = {
  nodeId: NodeId
  /** A copy, so the gesture's originals survive even if the document updates. */
  anchors: PathAnchor[]
  width: number
  height: number
  transform: Transform
}

/** The scene point at the centre a node rotates about. */
export function pathCentre(capture: PathEditCapture): Point {
  const { transform, width, height } = capture
  return {
    x: transform.x + (width * transform.scaleX) / 2,
    y: transform.y + (height * transform.scaleY) / 2,
  }
}

/** Local box coordinates → scene coordinates, including scale and rotation. */
export function localToScene(point: Point, capture: PathEditCapture): Point {
  const { transform, width, height } = capture
  const x = transform.x + point.x * transform.scaleX
  const y = transform.y + point.y * transform.scaleY
  if (transform.rotation === 0) return { x, y }
  const centre = { x: transform.x + (width * transform.scaleX) / 2, y: transform.y + (height * transform.scaleY) / 2 }
  return rotatePoint({ x, y }, centre, transform.rotation)
}

/** Scene coordinates → local box coordinates: the inverse of `localToScene`. */
export function sceneToLocal(point: Point, capture: PathEditCapture): Point {
  const { transform, width, height } = capture
  const centre = { x: transform.x + (width * transform.scaleX) / 2, y: transform.y + (height * transform.scaleY) / 2 }
  const unrotated = transform.rotation === 0 ? point : rotatePoint(point, centre, -transform.rotation)
  return {
    x: (unrotated.x - transform.x) / (transform.scaleX === 0 ? 1 : transform.scaleX),
    y: (unrotated.y - transform.y) / (transform.scaleY === 0 ? 1 : transform.scaleY),
  }
}

export type AnchorHit = { index: number; distance: number }
export type HandleHit = { index: number; handle: 'in' | 'out'; distance: number }

/** The nearest anchor within `tolerance` scene units, or null. */
export function nearestAnchor(anchors: PathAnchor[], scenePoint: Point, capture: PathEditCapture, tolerance: number): AnchorHit | null {
  let best: AnchorHit | null = null
  for (let index = 0; index < anchors.length; index += 1) {
    const point = localToScene({ x: anchors[index].x, y: anchors[index].y }, capture)
    const distance = Math.hypot(point.x - scenePoint.x, point.y - scenePoint.y)
    if (distance <= tolerance && (best === null || distance < best.distance)) best = { index, distance }
  }
  return best
}

/**
 * The nearest handle of a smooth anchor within tolerance. Handles are checked before anchors are
 * dragged in the tool, because a handle sits on top of its anchor's neighbourhood.
 */
export function nearestHandle(anchors: PathAnchor[], scenePoint: Point, capture: PathEditCapture, tolerance: number): HandleHit | null {
  let best: HandleHit | null = null
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]
    for (const handle of ['in', 'out'] as const) {
      const local =
        handle === 'in'
          ? { x: anchor.x + anchor.inX, y: anchor.y + anchor.inY }
          : { x: anchor.x + anchor.outX, y: anchor.y + anchor.outY }
      if (handle === 'in' && anchor.inX === 0 && anchor.inY === 0) continue
      if (handle === 'out' && anchor.outX === 0 && anchor.outY === 0) continue
      const point = localToScene(local, capture)
      const distance = Math.hypot(point.x - scenePoint.x, point.y - scenePoint.y)
      if (distance <= tolerance && (best === null || distance < best.distance)) best = { index, handle, distance }
    }
  }
  return best
}

/** Moves one anchor to a local point, keeping its handles relative (they travel with it). */
export function movedAnchor(anchor: PathAnchor, local: Point): PathAnchor {
  return { ...anchor, x: local.x, y: local.y }
}

/**
 * Sets one handle from a drag. With `mirror` the opposite handle is mirrored, which is what a smooth
 * anchor means; without it (Alt) the other handle stays where it is and the anchor becomes a corner.
 */
export function draggedHandle(anchor: PathAnchor, handle: 'in' | 'out', localHandlePoint: Point, mirror: boolean): PathAnchor {
  const inX = handle === 'in' ? localHandlePoint.x - anchor.x : mirror ? -(localHandlePoint.x - anchor.x) : anchor.inX
  const inY = handle === 'in' ? localHandlePoint.y - anchor.y : mirror ? -(localHandlePoint.y - anchor.y) : anchor.inY
  const outX = handle === 'out' ? localHandlePoint.x - anchor.x : mirror ? -(localHandlePoint.x - anchor.x) : anchor.outX
  const outY = handle === 'out' ? localHandlePoint.y - anchor.y : mirror ? -(localHandlePoint.y - anchor.y) : anchor.outY
  return { ...anchor, inX, inY, outX, outY, smooth: mirror }
}
