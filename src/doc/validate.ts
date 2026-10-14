/**
 * Document validation (issue #18).
 *
 * Every command validates before it mutates, and open/deserialize reuses the same
 * checks (slice #19). Error codes are stable strings so the UI, the tests, and
 * later surfaces (files, MCP) can act on them without parsing messages.
 */

import { findNode, findParent, findWithin } from './document.ts'
import { isGroup, type Document, type GroupNode, type LayerNode, type NodeId } from './types.ts'

export type ValidationCode =
  | 'duplicate-id'
  | 'absent-node'
  | 'absent-parent'
  | 'invalid-parent'
  | 'cycle'
  | 'invalid-index'
  | 'non-finite'
  | 'non-positive-size'
  | 'unsupported-version'

export type ValidationIssue = { code: ValidationCode; message: string; nodeId?: NodeId }

export type ValidationResult = { ok: true } | { ok: false; issue: ValidationIssue }

const ok: ValidationResult = { ok: true }

export function fail(code: ValidationCode, message: string, nodeId?: NodeId): ValidationResult {
  return { ok: false, issue: nodeId === undefined ? { code, message } : { code, message, nodeId } }
}

/** Finite, non-negative geometry. NaN/Infinity silently corrupts caches. */
export function validTransform(node: LayerNode): boolean {
  const { x, y, rotation, scaleX, scaleY } = node.transform
  return [x, y, rotation, scaleX, scaleY].every((value) => Number.isFinite(value))
}

/** Full-tree validation: ids, parents, cycles, geometry, and version. */
export function validateDocument(document: Document): ValidationResult {
  if (document.formatVersion !== 1) {
    return fail(
      'unsupported-version',
      `Unsupported document format version ${document.formatVersion}; expected 1.`,
    )
  }
  const seen = new Set<NodeId>()
  const walk = (node: LayerNode, ancestry: Set<NodeId>): ValidationResult => {
    if (seen.has(node.id)) return fail('duplicate-id', `Duplicate node id ${node.id}.`, node.id)
    seen.add(node.id)
    if (ancestry.has(node.id)) return fail('cycle', `Node ${node.id} is its own ancestor.`, node.id)
    if (!validTransform(node)) return fail('non-finite', `Node ${node.id} has non-finite transform.`, node.id)
    if (!isGroup(node)) {
      if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) {
        return fail('non-finite', `Node ${node.id} has non-finite size.`, node.id)
      }
      if (node.width <= 0 || node.height <= 0) {
        return fail('non-positive-size', `Node ${node.id} has a non-positive size.`, node.id)
      }
      return ok
    }
    const next = new Set(ancestry)
    next.add(node.id)
    for (const child of node.children) {
      const childResult = walk(child, next)
      if (!childResult.ok) return childResult
    }
    return ok
  }
  return walk(document.root, new Set())
}

/** Checks a destination parent and index without mutating anything. */
export function validateDestination(
  document: Document,
  parentId: NodeId,
  index: number,
  moving: NodeId[] = [],
): ValidationResult {
  const parent = findNode(document, parentId)
  if (parent === null) return fail('absent-parent', `Parent ${parentId} does not exist.`, parentId)
  if (!isGroup(parent)) return fail('invalid-parent', `Parent ${parentId} is not a group.`, parentId)
  if (!Number.isInteger(index) || index < 0 || index > parent.children.length) {
    return fail('invalid-index', `Index ${index} is outside ${parentId}'s children.`, parentId)
  }
  for (const nodeId of moving) {
    if (nodeId === parentId) return fail('cycle', `Cannot move ${nodeId} into itself.`, nodeId)
    const target = findNode(document, nodeId)
    if (target !== null && isGroup(target) && findWithin(target, parentId) !== null) {
      return fail('cycle', `Cannot move ${parentId} into its own descendant ${nodeId}.`, nodeId)
    }
  }
  return ok
}

/** Rejects a remove that would take the document root with it. */
export function validateRemovable(document: Document, nodeIds: NodeId[]): ValidationResult {
  for (const nodeId of nodeIds) {
    if (nodeId === document.root.id) {
      return fail('invalid-parent', 'The document root cannot be removed.', nodeId)
    }
    if (findNode(document, nodeId) === null) {
      return fail('absent-node', `Node ${nodeId} does not exist.`, nodeId)
    }
    if (findParent(document, nodeId) === null) {
      return fail('absent-parent', `Node ${nodeId} has no parent.`, nodeId)
    }
  }
  return ok
}

export function asGroup(node: LayerNode | null): GroupNode | null {
  return node !== null && isGroup(node) ? node : null
}
