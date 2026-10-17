/**
 * Snapping (Phase 2.5, issue #68), implementing the contract in `docs/DECISIONS.md`.
 *
 * Pure: a moving box and the scene's snap targets in, an adjustment out. Snapping is a
 * *post-gesture delta adjustment* — the gesture computes its raw delta from the pointer and the
 * snapper may replace it — so the stored transform still comes from `setTransform`, one history
 * entry per gesture, and a snapped drag cannot appear in history as a second change.
 *
 * Targets are coordinates per axis: the active artboard's edges and centre, and every other
 * object's bounding-box edges and centre. Guides are reported so the canvas can draw them.
 */

import { artboardRect, artboardRects } from '../../doc/artboards.ts'
import { findNode, worldBounds } from '../../doc/document.ts'
import type { Document, NodeId } from '../../doc/types.ts'

/** The contract's threshold: six screen pixels, converted by the current zoom. */
export const SNAP_PIXELS = 6

export type Rect = { x: number; y: number; width: number; height: number }
export type SnapTargets = { x: number[]; y: number[] }
export type SnapGuide = { axis: 'x' | 'y'; position: number; start: number; end: number }
export type SnapResult = { dx: number; dy: number; guides: SnapGuide[] }

/** The three snap lines a box contributes on each axis: near edge, centre, far edge. */
export function boxLines(box: Rect): { x: number[]; y: number[] } {
  return {
    x: [box.x, box.x + box.width / 2, box.x + box.width],
    y: [box.y, box.y + box.height / 2, box.y + box.height],
  }
}

/**
 * Every line the scene can snap to: the active page's edges and centre, then every other visible
 * object's edges and centre. The selected objects are excluded, or a drag would snap to itself.
 */
export function snapTargets(document: Document, exclude: NodeId[], activeArtboardId: string | null): SnapTargets {
  const x: number[] = []
  const y: number[] = []
  const page = artboardRect(document, activeArtboardId)
  if (page !== null) {
    const lines = boxLines(page)
    x.push(...lines.x)
    y.push(...lines.y)
  }
  for (const other of artboardRects(document)) {
    if (page !== null && other.id === page.id) continue
    const lines = boxLines(other)
    x.push(...lines.x)
    y.push(...lines.y)
  }
  for (const id of exclude) void id
  const walk = (nodes: Document['root']['children']) => {
    for (const node of nodes) {
      if (node.hidden) continue
      if (exclude.includes(node.id)) continue
      if (node.type === 'group') {
        walk(node.children)
        continue
      }
      const bounds = worldBounds(document, node.id)
      if (bounds === null || (bounds.width === 0 && bounds.height === 0)) continue
      const lines = boxLines(bounds)
      x.push(...lines.x)
      y.push(...lines.y)
    }
  }
  walk(document.root.children)
  return { x, y }
}

/** Nearest target within the threshold, or null. */
function nearest(values: number[], targets: number[], threshold: number): number | null {
  let best: number | null = null
  for (const value of values) {
    for (const target of targets) {
      const delta = target - value
      if (Math.abs(delta) > threshold) continue
      if (best === null || Math.abs(delta) < Math.abs(best)) best = delta
    }
  }
  return best
}

/**
 * The adjustment that snaps `box` to the nearest targets within `threshold` (scene units, which the
 * caller derives from {@link SNAP_PIXELS} and the zoom). The two axes are independent, so a drag can
 * snap left-to-left on x and centre-to-centre on y at once.
 */
export function snapBox(box: Rect, targets: SnapTargets, threshold: number): SnapResult {
  if (threshold <= 0) return { dx: 0, dy: 0, guides: [] }
  const lines = boxLines(box)
  const dx = nearest(lines.x, targets.x, threshold) ?? 0
  const dy = nearest(lines.y, targets.y, threshold) ?? 0
  const guides: SnapGuide[] = []
  if (dx !== 0) {
    const position = lines.x.map((value) => value + dx).find((value) => targets.x.some((target) => Math.abs(target - value) < 1e-6))
    if (position !== undefined) guides.push({ axis: 'x', position, start: box.y, end: box.y + box.height })
  }
  if (dy !== 0) {
    const position = lines.y.map((value) => value + dy).find((value) => targets.y.some((target) => Math.abs(target - value) < 1e-6))
    if (position !== undefined) guides.push({ axis: 'y', position, start: box.x, end: box.x + box.width })
  }
  return { dx, dy, guides }
}

/** Whether a node can move at all, so a locked object neither snaps nor acts as a target. */
export function isMovable(document: Document, id: NodeId): boolean {
  const node = findNode(document, id)
  return node !== null && !node.locked && !node.hidden
}
