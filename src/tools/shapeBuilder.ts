/**
 * Shape Builder (Phase 5.4, issue #140).
 *
 * Illustrator's Shape Builder is region-based; Vectr's first version is drag-based and says so: you
 * drag across objects, they are collected, and on release they are united (or, with Alt, the crossed
 * objects are subtracted from the rest). The collection uses the same hit test as every other tool,
 * so what the gesture covers is what it combines.
 */

import { marqueeRect, type Tool, type ToolHost, type ToolModifiers, type ToolPoint } from './types.ts'
import type { NodeId } from '../doc/types.ts'

/** How far apart the samples are, in screen pixels: fine enough not to skip a thin shape. */
const SAMPLE_STEP = 4

export function createShapeBuilderTool(cursor: string): Tool {
  let start: { x: number; y: number } | null = null
  let last: { x: number; y: number } | null = null
  let crossed: NodeId[] = []

  const collect = (host: ToolHost, point: ToolPoint): void => {
    const hit = host.hitTest(point.scene, true)
    if (hit !== null && !crossed.includes(hit)) crossed = [...crossed, hit]
    host.setMarquee(marqueeRect({ x: start?.x ?? point.scene.x, y: start?.y ?? point.scene.y }, point.scene))
  }

  const sampleBetween = (host: ToolHost, from: { x: number; y: number }, to: { x: number; y: number }): void => {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(distance / SAMPLE_STEP))
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps
      const scene = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
      const hit = host.hitTest(scene, true)
      if (hit !== null && !crossed.includes(hit)) crossed = [...crossed, hit]
    }
  }

  const reset = (host: ToolHost): void => {
    host.setMarquee(null)
    start = null
    last = null
    crossed = []
  }

  return {
    id: 'shapeBuilder',
    cursor,

    onPointerDown(host: ToolHost, point: ToolPoint): void {
      start = { x: point.scene.x, y: point.scene.y }
      last = { x: point.scene.x, y: point.scene.y }
      crossed = []
      collect(host, point)
    },

    onPointerMove(host: ToolHost, point: ToolPoint): void {
      if (start === null || last === null) return
      sampleBetween(host, last, point.scene)
      last = { x: point.scene.x, y: point.scene.y }
      host.setMarquee(marqueeRect(start, point.scene))
    },

    onPointerUp(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers): void {
      if (start === null) return
      if (last !== null) sampleBetween(host, last, point.scene)
      const ids = crossed
      const subtract = modifiers.alt
      reset(host)
      if (ids.length >= 2) host.applyShapeBuilder(ids, subtract)
    },

    cancel(host: ToolHost): void {
      reset(host)
    },
  }
}
