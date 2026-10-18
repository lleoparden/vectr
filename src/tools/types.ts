/**
 * The tool contract (Phase 3.2).
 *
 * A tool is a state machine: pointer and keyboard input in, commands and overlays out. Tools never
 * touch the document - the host does that - so a tool can be tested without a canvas, and a
 * behaviour fixed in one tool does not have to be re-fixed in the next.
 */

import type { ShapeKind } from '../doc/document.ts'
import type { Point, Rect } from '../geom/transform.ts'
import type { NodeId, Transform } from '../doc/types.ts'

/** A pointer position in both coordinate systems the tools need. */
export type ToolPoint = {
  /** Scene units, for hit testing and drawing. */
  scene: Point
  /** Screen pixels, for gestures that must not depend on the view (panning). */
  screen: Point
}

export type ToolModifiers = { shift: boolean; alt: boolean; meta: boolean; ctrl: boolean }

/** A marquee rectangle, already normalised so width and height are positive. */
export type MarqueeRect = { x: number; y: number; width: number; height: number }

/**
 * Everything a tool may do. The canvas implements this; the tools call it and nothing else, which
 * is what keeps the document, the history, and the renderer out of the tool layer.
 */
export type ToolHost = {
  selection(): NodeId[]
  /** Resolves a scene point to a node; `deep` reaches the leaf, like the white arrow. */
  hitTest(scene: Point, deep: boolean): NodeId | null
  select(id: NodeId): void
  toggleSelection(id: NodeId): void
  /** Captures the movable selection's transforms and opens the move transaction. */
  beginMove(): void
  /** Applies a move delta from the gesture's origin, with smart-guide snapping. */
  moveBy(dx: number, dy: number, shift: boolean): void
  endMove(): void
  /** Rolls back a move that never became a drag. */
  cancelMove(): void
  /** Draws (or clears) the marquee preview. */
  setMarquee(rect: MarqueeRect | null): void
  /** Resolves the marquee to a selection and clears the preview. */
  commitMarquee(rect: MarqueeRect, deep: boolean): void
  viewport(): { panX: number; panY: number }
  panTo(panX: number, panY: number): void
  /** The lasso's freehand path, drawn while the pointer moves and cleared on release. */
  setLasso(points: Point[] | null): void
  /** Resolves a lasso path to a selection, honouring the modifier that adds to it. */
  commitLasso(points: Point[], modifiers: ToolModifiers): void
  /** The shape being dragged out, drawn as the canvas preview. */
  setShapePreview(preview: ShapePreview | null): void
  /** Creates the shape the drag describes, or does nothing when the drag is too small. */
  commitShape(toolId: string, start: Point, end: Point, shift: boolean): void
  /** Places a text object at a scene point and opens its editor. */
  placeText(scene: Point): void
  /** Captures the selection's box, rotation, and transforms and opens the scale transaction. */
  scaleBegin(): ScaleCapture | null
  /** Captures the selection for a rotation when the pointer is on a rotation zone, else null. */
  rotationBegin(point: Point): RotateCapture | null
  /** Applies one rotation step from the gesture's start. */
  rotateBy(point: Point, shift: boolean): void
  rotateEnd(): void
  rotateCancel(): void
  /** Applies one node's transform during a scale. */
  setNodeTransform(nodeId: NodeId, transform: Transform): void
  scaleEnd(): void
  scaleCancel(): void
}

/** One node captured for a transform gesture: its original transform and its own extent. */
export type CapturedNode = { id: NodeId; transform: Transform; width: number; height: number }

/** What a scale gesture needs: the oriented frame and every node in it. */
export type ScaleCapture = { box: Rect; rotation: number; centre: Point; nodes: CapturedNode[] }

/** What a rotation gesture needs: the pivot and every node around it. */
export type RotateCapture = { centre: Point; startAngle: number; nodes: CapturedNode[] }

/** The preview the canvas draws while a shape is being dragged out. */
export type ShapePreview = { kind: ShapeKind; start: Point; current: Point; shift: boolean }

export type Tool = {
  id: string
  /** CSS cursor while this tool is active. */
  cursor: string
  onPointerDown(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers): void
  onPointerMove(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers): void
  onPointerUp(host: ToolHost, point: ToolPoint, modifiers: ToolModifiers): void
  /** Escape or a lost pointer: leave no gesture behind. */
  cancel(host: ToolHost): void
}

/** The rectangle between two scene points, normalised for the marquee preview and hit test. */
export function marqueeRect(start: Point, end: Point): MarqueeRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}
