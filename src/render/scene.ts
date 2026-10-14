/**
 * Paint-order scene building for the editor renderer (issue #18).
 *
 * Pure and renderer-free: the document in, an ordered draw list out. Canvas order
 * therefore comes from the tree walk in exactly one place, which is what makes the
 * "paint order equals layer order" acceptance criterion testable without a GPU.
 */

import { isGroup, type Document, type LayerNode, type NodeId } from '../doc/types.ts'

export type SceneShape = {
  id: NodeId
  kind: 'rect' | 'ellipse'
  /** Top-level ancestor, which is the invalidation unit of the renderer. */
  root: NodeId
  x: number
  y: number
  scaleX: number
  scaleY: number
  width: number
  height: number
  cornerRadius: number
  fill: string
  stroke: { color: string; width: number } | null
  opacity: number
}

export type Scene = {
  revision: number
  shapes: SceneShape[]
  /** Shapes grouped by top-level root, in paint order; the renderer's buckets. */
  byRoot: Array<{ root: NodeId; shapes: SceneShape[] }>
}

function walkShapes(
  node: LayerNode,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  opacity: number,
  root: NodeId,
  into: SceneShape[],
): void {
  const nextX = x + node.transform.x * scaleX
  const nextY = y + node.transform.y * scaleY
  const nextScaleX = scaleX * node.transform.scaleX
  const nextScaleY = scaleY * node.transform.scaleY
  if (isGroup(node)) {
    const nextOpacity = opacity * 1
    for (const child of node.children) {
      if (child.hidden) continue
      walkShapes(child, nextX, nextY, nextScaleX, nextScaleY, nextOpacity, root, into)
    }
    return
  }
  into.push({
    id: node.id,
    kind: node.type,
    root,
    x: nextX,
    y: nextY,
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    width: node.width,
    height: node.height,
    cornerRadius: node.type === 'rect' ? node.cornerRadius : 0,
    fill: node.style.fill,
    stroke: node.style.stroke,
    opacity: opacity * node.style.opacity,
  })
}

/** Builds the ordered draw list for a document; never returns hidden nodes. */
export function buildScene(document: Document): Scene {
  const shapes: SceneShape[] = []
  const byRoot: Array<{ root: NodeId; shapes: SceneShape[] }> = []
  for (const root of document.root.children) {
    if (root.hidden) continue
    const rootShapes: SceneShape[] = []
    walkShapes(root, 0, 0, 1, 1, 1, root.id, rootShapes)
    shapes.push(...rootShapes)
    byRoot.push({ root: root.id, shapes: rootShapes })
  }
  return { revision: document.revision, shapes, byRoot }
}

/** Root ids in paint order, matching {@link paintOrder} at the top level. */
export function sceneRootIds(scene: Scene): NodeId[] {
  return scene.byRoot.map((bucket) => bucket.root)
}
