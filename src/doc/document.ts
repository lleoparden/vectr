/**
 * Document construction, lookup, and structural editing helpers (issue #18).
 *
 * Every mutation returns a new `Document` built with structural sharing, so
 * unchanged subtrees keep their identity. That keeps React memoization honest and
 * avoids the retained whole-document copies the architecture forbids.
 */

import {
  FORMAT_VERSION,
  createStyle,
  createTransform,
  isGroup,
  type Artboard,
  type Document,
  type GroupNode,
  type LayerNode,
  type NodeId,
} from './types.ts'

const defaultArtboard: Artboard = { id: 'artboard-0', name: 'Artboard 1', width: 1200, height: 800 }

export function createDocument(name = 'Untitled'): Document {
  return {
    formatVersion: FORMAT_VERSION,
    revision: 0,
    id: 'document-0',
    name,
    artboards: [defaultArtboard],
    root: {
      id: 'root',
      name: 'Document',
      type: 'group',
      transform: createTransform(),
      locked: false,
      hidden: false,
      children: [],
    },
    assets: [],
  }
}

let idCounter = 0

/** Stable, collision-checked ids. Slice #19 persists them verbatim. */
export function newId(prefix: 'rect' | 'ellipse' | 'group'): NodeId {
  idCounter += 1
  return `${prefix}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createRect(name: string, x: number, y: number, width = 160, height = 120): LayerNode {
  return {
    id: newId('rect'),
    name,
    type: 'rect',
    transform: createTransform(x, y),
    width,
    height,
    cornerRadius: 0,
    style: createStyle(),
    locked: false,
    hidden: false,
  }
}

export function createEllipse(name: string, x: number, y: number, width = 140, height = 140): LayerNode {
  return {
    id: newId('ellipse'),
    name,
    type: 'ellipse',
    transform: createTransform(x, y),
    width,
    height,
    style: createStyle('#f0a24b'),
    locked: false,
    hidden: false,
  }
}

export function createGroup(name: string): GroupNode {
  return {
    id: newId('group'),
    name,
    type: 'group',
    transform: createTransform(),
    locked: false,
    hidden: false,
    children: [],
  }
}

export function findNode(document: Document, nodeId: NodeId): LayerNode | null {
  return document.root.id === nodeId ? document.root : findWithin(document.root, nodeId)
}

/** Subtree search, used by validation and by callers that hold a node, not a document. */
export function findWithin(node: LayerNode, nodeId: NodeId): LayerNode | null {
  if (!isGroup(node)) return null
  for (const child of node.children) {
    if (child.id === nodeId) return child
    if (isGroup(child)) {
      const found = findWithin(child, nodeId)
      if (found) return found
    }
  }
  return null
}

export function findParent(document: Document, nodeId: NodeId): GroupNode | null {
  const walk = (group: GroupNode): GroupNode | null => {
    for (const child of group.children) {
      if (child.id === nodeId) return group
      if (isGroup(child)) {
        const found = walk(child)
        if (found) return found
      }
    }
    return null
  }
  return walk(document.root)
}

export function childIndex(parent: GroupNode, nodeId: NodeId): number {
  return parent.children.findIndex((child) => child.id === nodeId)
}

/** Node ids in paint order (depth-first, last child painted last). */
export function paintOrder(document: Document): NodeId[] {
  const order: NodeId[] = []
  const walk = (nodes: LayerNode[]) => {
    for (const node of nodes) {
      order.push(node.id)
      if (isGroup(node)) walk(node.children)
    }
  }
  walk(document.root.children)
  return order
}

export function countNodes(document: Document): number {
  return paintOrder(document).length
}

export function depthOf(document: Document, nodeId: NodeId): number {
  const walk = (nodes: LayerNode[], depth: number): number | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return depth
      if (isGroup(node)) {
        const found = walk(node.children, depth + 1)
        if (found !== null) return found
      }
    }
    return null
  }
  return walk(document.root.children, 1) ?? 0
}

/**
 * Returns a new document with `nodeId` replaced by `patch(node)`. Ancestors on the
 * path are rebuilt; every other subtree keeps its identity.
 */
export function replaceNode(
  document: Document,
  nodeId: NodeId,
  patch: (node: LayerNode) => LayerNode,
): Document {
  // The root is never a *child*, so it needs its own check; without it, inserts at
  // root level silently changed nothing.
  if (document.root.id === nodeId) {
    const patched = patch(document.root)
    return patched === document.root ? document : { ...document, root: patched as GroupNode }
  }
  const root = replaceIn(document.root, nodeId, patch)
  return root === document.root ? document : { ...document, root }
}

function replaceIn(group: GroupNode, nodeId: NodeId, patch: (node: LayerNode) => LayerNode): GroupNode {
  let changed = false
  const children = group.children.map((child) => {
    if (child.id === nodeId) {
      changed = true
      return patch(child)
    }
    if (isGroup(child)) {
      const next = replaceIn(child, nodeId, patch)
      if (next !== child) {
        changed = true
        return next
      }
    }
    return child
  })
  return changed ? { ...group, children } : group
}

/** Inserts nodes into a parent at an index, clamped to the valid range. */
export function insertNodes(document: Document, parentId: NodeId, index: number, nodes: LayerNode[]): Document {
  const parent = findNode(document, parentId)
  if (parent === null || !isGroup(parent)) throw new Error(`Parent ${parentId} is not a group.`)
  const clamped = Math.max(0, Math.min(index, parent.children.length))
  return replaceNode(document, parentId, (node) => {
    const group = node as GroupNode
    const children = [...group.children]
    children.splice(clamped, 0, ...nodes)
    return { ...group, children }
  })
}

/** Removes nodes by id, preserving sibling order for the survivors. */
export function removeNodes(document: Document, nodeIds: NodeId[]): Document {
  const ids = new Set(nodeIds)
  const prune = (group: GroupNode): GroupNode => {
    let changed = false
    const children: LayerNode[] = []
    for (const child of group.children) {
      if (ids.has(child.id)) {
        changed = true
        continue
      }
      if (isGroup(child)) {
        const next = prune(child)
        if (next !== child) changed = true
        children.push(next)
        continue
      }
      children.push(child)
    }
    return changed ? { ...group, children } : group
  }
  const root = prune(document.root)
  return root === document.root ? document : { ...document, root }
}

/** All node ids in the subtree rooted at `nodeId`, including itself. */
export function subtreeIds(document: Document, nodeId: NodeId): NodeId[] {
  const node = findNode(document, nodeId)
  if (node === null) return []
  const ids: NodeId[] = []
  const walk = (current: LayerNode) => {
    ids.push(current.id)
    if (isGroup(current)) current.children.forEach(walk)
  }
  walk(node)
  return ids
}

/**
 * Absolute translation and scale of a node, composing its ancestors. Accumulated
 * in one descent rather than rebuilt as a chain, so it stays O(depth).
 */
export function worldTransform(
  document: Document,
  nodeId: NodeId,
): { x: number; y: number; scaleX: number; scaleY: number } | null {
  const walk = (
    nodes: LayerNode[],
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
  ): { x: number; y: number; scaleX: number; scaleY: number } | null => {
    for (const node of nodes) {
      const nextX = x + node.transform.x * scaleX
      const nextY = y + node.transform.y * scaleY
      const nextScaleX = scaleX * node.transform.scaleX
      const nextScaleY = scaleY * node.transform.scaleY
      if (node.id === nodeId) return { x: nextX, y: nextY, scaleX: nextScaleX, scaleY: nextScaleY }
      if (isGroup(node)) {
        const found = walk(node.children, nextX, nextY, nextScaleX, nextScaleY)
        if (found !== null) return found
      }
    }
    return null
  }
  return walk(document.root.children, 0, 0, 1, 1)
}

/** World-space bounds of a leaf shape, or null for groups and missing ids. */
export function worldBounds(
  document: Document,
  nodeId: NodeId,
): { x: number; y: number; width: number; height: number } | null {
  const node = findNode(document, nodeId)
  if (node === null || isGroup(node)) return null
  const world = worldTransform(document, nodeId)
  if (world === null) return null
  return {
    x: world.x,
    y: world.y,
    width: node.width * world.scaleX,
    height: node.height * world.scaleY,
  }
}

