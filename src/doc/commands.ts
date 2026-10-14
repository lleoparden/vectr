/**
 * Document commands (issue #18).
 *
 * Every edit in Vectr goes through this module: UI gestures, keyboard shortcuts,
 * and — later — MCP calls and the built-in agent. Each command is serializable,
 * validates before it mutates, applies only through `applyCommand`, and returns an
 * inverse command that restores the previous state. No caller gets a second
 * mutation path, and no command stores a whole-document snapshot.
 */

import { childIndex, findNode, insertNodes, removeNodes, replaceNode } from './document.ts'
import { validateDestination, validateRemovable, type ValidationCode } from './validate.ts'
import {
  isGroup,
  type Document,
  type GroupNode,
  type LayerNode,
  type NodeId,
  type Style,
  type Transform,
} from './types.ts'

export type Command =
  | { type: 'insertNodes'; parentId: NodeId; index: number; nodes: LayerNode[] }
  | { type: 'removeNodes'; nodeIds: NodeId[] }
  | { type: 'setTransform'; nodeId: NodeId; transform: Transform }
  | { type: 'setStyle'; nodeId: NodeId; style: Style }
  | { type: 'setFlags'; nodeId: NodeId; locked: boolean; hidden: boolean }
  | { type: 'renameNode'; nodeId: NodeId; name: string }
  | { type: 'moveNode'; nodeId: NodeId; parentId: NodeId; index: number }
  /**
   * Several commands that undo and redo as one step (issue #34). Its inverse is a batch
   * of the step inverses in reverse order, which is what makes an undo of a composed edit
   * correct. Batches never nest: `batchCommand` flattens, so the inverse is always a flat
   * list and ordering stays obvious.
   */
  | { type: 'batch'; commands: Command[] }

export type CommandResult =
  | { ok: true; document: Document; inverse: Command }
  | { ok: false; code: ValidationCode; message: string }

function rejected(code: ValidationCode, message: string): CommandResult {
  return { ok: false, code, message }
}

function withRevision(document: Document): Document {
  return { ...document, revision: document.revision + 1 }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Parent group of a node, or null when it is missing or the document root. */
export function parentIdOf(document: Document, nodeId: NodeId): GroupNode | null {
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
  return document.root.id === nodeId ? null : walk(document.root)
}

/** Insertion indices shift down when the node left the same parent before it. */
function adjustIndexAfterDetach(
  previousParent: GroupNode,
  nextParentId: NodeId,
  index: number,
  previousIndex: number,
): number {
  if (previousParent.id !== nextParentId) return index
  return index > previousIndex ? index - 1 : index
}

/**
 * Groups several commands into one that undoes and redoes as a single step.
 *
 * A single command is returned unchanged and nested batches are flattened, so a batch is
 * always a flat list of leaf commands and its inverse ordering stays obvious. An empty
 * list is a programming error rather than a user-facing rejection, so it throws.
 */
export function batchCommand(commands: Command[]): Command {
  const flat = commands.flatMap((command) => (command.type === 'batch' ? command.commands : [command]))
  if (flat.length === 0) throw new Error('A batch command needs at least one command.')
  return flat.length === 1 ? flat[0] : { type: 'batch', commands: flat }
}

/**
 * Applies one command and returns the inverse. The document is never mutated in
 * place; the caller swaps in the returned document.
 */
export function applyCommand(document: Document, command: Command): CommandResult {
  switch (command.type) {
    case 'insertNodes': {
      const destination = validateDestination(document, command.parentId, command.index)
      if (!destination.ok) return rejected(destination.issue.code, destination.issue.message)
      const nodes = command.nodes.map(clone)
      return {
        ok: true,
        document: withRevision(insertNodes(document, command.parentId, command.index, nodes)),
        inverse: { type: 'removeNodes', nodeIds: nodes.map((node) => node.id) },
      }
    }

    case 'removeNodes': {
      const removable = validateRemovable(document, command.nodeIds)
      if (!removable.ok) return rejected(removable.issue.code, removable.issue.message)
      // Capture the first removed node's position and the removed nodes themselves
      // so the inverse restores the exact tree.
      const first = command.nodeIds[0]
      const container = parentIdOf(document, first)
      if (container === null) return rejected('absent-node', `Node ${first} cannot be removed.`)
      const index = childIndex(container, first)
      const nodes = command.nodeIds
        .map((nodeId) => findNode(document, nodeId))
        .filter((value): value is LayerNode => value !== null)
      return {
        ok: true,
        document: withRevision(removeNodes(document, command.nodeIds)),
        inverse: { type: 'insertNodes', parentId: container.id, index, nodes: nodes.map(clone) },
      }
    }

    case 'setTransform': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (node.locked) return rejected('invalid-parent', `Node ${command.nodeId} is locked.`)
      const next = { ...command.transform }
      if (![next.x, next.y, next.rotation, next.scaleX, next.scaleY].every((value) => Number.isFinite(value))) {
        return rejected('non-finite', `Transform for ${command.nodeId} is not finite.`)
      }
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) => ({ ...current, transform: next })),
        ),
        inverse: { type: 'setTransform', nodeId: command.nodeId, transform: { ...node.transform } },
      }
    }

    case 'setStyle': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (isGroup(node)) return rejected('invalid-parent', `Groups have no style (${command.nodeId}).`)
      const previous = node.style
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) => ({ ...current, style: { ...command.style } })),
        ),
        inverse: { type: 'setStyle', nodeId: command.nodeId, style: { ...previous } },
      }
    }

    case 'setFlags': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) => ({
            ...current,
            locked: command.locked,
            hidden: command.hidden,
          })),
        ),
        inverse: { type: 'setFlags', nodeId: command.nodeId, locked: node.locked, hidden: node.hidden },
      }
    }

    case 'renameNode': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      const name = command.name.trim()
      if (name.length === 0) return rejected('invalid-index', 'A layer name cannot be empty.')
      return {
        ok: true,
        document: withRevision(replaceNode(document, command.nodeId, (current) => ({ ...current, name }))),
        inverse: { type: 'renameNode', nodeId: command.nodeId, name: node.name },
      }
    }

    case 'moveNode': {
      const node = findNode(document, command.nodeId)
      const container = parentIdOf(document, command.nodeId)
      if (node === null || container === null) {
        return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      }
      const destination = validateDestination(document, command.parentId, command.index, [command.nodeId])
      if (!destination.ok) return rejected(destination.issue.code, destination.issue.message)
      const previousParent = container.id
      const previousIndex = childIndex(container, command.nodeId)
      const detached = removeNodes(document, [command.nodeId])
      const target = adjustIndexAfterDetach(container, command.parentId, command.index, previousIndex)
      return {
        ok: true,
        document: withRevision(insertNodes(detached, command.parentId, target, [clone(node)])),
        inverse: { type: 'moveNode', nodeId: command.nodeId, parentId: previousParent, index: previousIndex },
      }
    }

    case 'batch': {
      if (command.commands.length === 0) {
        return rejected('invalid-index', 'A batch command needs at least one command.')
      }
      let current = document
      const inverses: Command[] = []
      for (const [offset, step] of command.commands.entries()) {
        if (step.type === 'batch') {
          return rejected('invalid-index', 'Nested batch commands are not supported; flatten them first.')
        }
        const result = applyCommand(current, step)
        if (!result.ok) {
          // Atomic by construction: `document` is never mutated and `current` stays local,
          // so a rejected step leaves the caller's document exactly as it was. The failing
          // step's own code and message survive; the position and type add context.
          return rejected(
            result.code,
            `Batch step ${offset + 1} of ${command.commands.length} (${step.type}) was rejected: ${result.message}`,
          )
        }
        current = result.document
        inverses.push(result.inverse)
      }
      // Reverse order: a later step can depend on an earlier one, so undo unwinds from the
      // last applied change back to the first.
      const reversed = [...inverses].reverse()
      return {
        ok: true,
        document: current,
        inverse: reversed.length === 1 ? reversed[0] : { type: 'batch', commands: reversed },
      }
    }

    default: {
      const exhaustive: never = command
      return rejected('invalid-index', `Unsupported command ${JSON.stringify(exhaustive)}`)
    }
  }
}

