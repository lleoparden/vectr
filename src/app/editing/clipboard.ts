/**
 * Vectr's own clipboard (Phase 2.3, issue #66; owner-delegated decision: Vectr-first).
 *
 * It holds serializable node subtrees, not document copies and not pixels: one slot, replaced on
 * every copy, holding JSON clones of only the selected subtrees. Image nodes keep their
 * content-addressed `assetId`, so a pasted image shares the asset rather than duplicating its
 * bytes — the same reason `duplicateSubtree` exists.
 *
 * Deliberately not the operating-system clipboard: that needs a validated, bounded interchange
 * format and IPC, and it is recorded as later scope rather than guessed at here. Nothing in this
 * module persists; the clipboard is session state and disappears when the window closes.
 */

import { duplicateSubtree } from '../../doc/document.ts'
import { isGroup, type Document, type LayerNode, type NodeId } from '../../doc/types.ts'

/** Illustrator's paste offset: a pasted copy lands visibly off the original. */
export const PASTE_OFFSET = 10

export type ClipboardPayload = { nodes: LayerNode[]; count: number }

let stored: ClipboardPayload | null = null

/** Clones the selected top-level subtrees into the clipboard; returns how many were copied. */
export function copyToClipboard(document: Document, ids: NodeId[]): number {
  const nodes: LayerNode[] = []
  for (const id of ids) {
    const node = findNodeIn(document, id)
    if (node === null || node.hidden) continue
    nodes.push(structuredClone(node))
  }
  stored = nodes.length === 0 ? null : { nodes, count: nodes.length }
  return nodes.length
}

/** Removes the selection through the caller's command and copies it first, so Cut is Copy + Clear. */
export function clipboardHasContent(): boolean {
  return stored !== null
}

export function clipboardCount(): number {
  return stored === null ? 0 : stored.count
}

export function clearClipboard() {
  stored = null
}

/**
 * Fresh-id copies for a paste, each offset by {@link PASTE_OFFSET}. Ids are never reused, which is
 * what keeps two pastes, undo, and the manifest consistent.
 */
export function pastedNodes(): LayerNode[] {
  if (stored === null) return []
  const nodes = stored.nodes.map((node) => duplicateSubtree(node))
  for (const node of nodes) shiftSubtree(node, PASTE_OFFSET, PASTE_OFFSET)
  return nodes
}

function shiftSubtree(node: LayerNode, dx: number, dy: number) {
  node.transform = { ...node.transform, x: node.transform.x + dx, y: node.transform.y + dy }
  if (isGroup(node)) for (const child of node.children) shiftSubtree(child, 0, 0)
}

/** Local lookup so this module needs no document walk of its own. */
function findNodeIn(document: Document, id: NodeId): LayerNode | null {
  const walk = (nodes: LayerNode[]): LayerNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      if (isGroup(node)) {
        const found = walk(node.children)
        if (found !== null) return found
      }
    }
    return null
  }
  return walk(document.root.children)
}
