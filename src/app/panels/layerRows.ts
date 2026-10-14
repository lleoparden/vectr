/**
 * Layers panel rows (issue #28).
 *
 * Flattening the tree into rows is pure logic, so it can be tested without a
 * browser, and the panel only renders what this returns. Ancestor flags travel down
 * the rows because Illustrator shows a child of a locked or hidden layer as locked
 * or hidden too.
 */

import { isGroup, type LayerNode, type NodeId } from '../../doc/types.ts'

export type LayerRow = {
  id: NodeId
  node: LayerNode
  depth: number
  hasChildren: boolean
  expanded: boolean
  /** True when this row's own flag is set. */
  hidden: boolean
  locked: boolean
  /** True when an ancestor is hidden or locked, which the panel dims. */
  inheritedHidden: boolean
  inheritedLocked: boolean
}

export function layerRows(
  nodes: LayerNode[],
  expanded: ReadonlySet<NodeId>,
  depth = 0,
  inherited: { hidden: boolean; locked: boolean } = { hidden: false, locked: false },
): LayerRow[] {
  const rows: LayerRow[] = []
  for (const node of nodes) {
    const isExpanded = expanded.has(node.id)
    const hasChildren = isGroup(node) && node.children.length > 0
    rows.push({
      id: node.id,
      node,
      depth,
      hasChildren,
      expanded: isExpanded,
      hidden: node.hidden,
      locked: node.locked,
      inheritedHidden: inherited.hidden,
      inheritedLocked: inherited.locked,
    })
    if (hasChildren && isExpanded && isGroup(node)) {
      rows.push(
        ...layerRows(node.children, expanded, depth + 1, {
          hidden: inherited.hidden || node.hidden,
          locked: inherited.locked || node.locked,
        }),
      )
    }
  }
  return rows
}

/** Groups start expanded, the way Illustrator shows a group you just made. */
export function expandedGroupIds(nodes: LayerNode[], into: NodeId[] = []): NodeId[] {
  for (const node of nodes) {
    if (isGroup(node)) {
      into.push(node.id)
      expandedGroupIds(node.children, into)
    }
  }
  return into
}

/** Description used by the row's accessible name, for example "group, hidden". */
export function rowDescription(row: LayerRow): string {
  const parts: string[] = [row.node.type]
  if (row.hidden) parts.push('hidden')
  else if (row.inheritedHidden) parts.push('hidden by parent layer')
  if (row.locked) parts.push('locked')
  else if (row.inheritedLocked) parts.push('locked by parent layer')
  return parts.join(', ')
}
