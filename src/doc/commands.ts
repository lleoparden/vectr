/**
 * Document commands (issue #18).
 *
 * Every edit in Vectr goes through this module: UI gestures, keyboard shortcuts,
 * and — later — MCP calls and the built-in agent. Each command is serializable,
 * validates before it mutates, applies only through `applyCommand`, and returns an
 * inverse command that restores the previous state. No caller gets a second
 * mutation path, and no command stores a whole-document snapshot.
 */

import {
  childIndex,
  estimateTextSize,
  findNode,
  insertNodes,
  MAX_TEXT_LENGTH,
  paintOrder,
  removeNodes,
  replaceNode,
} from './document.ts'
import { ALLOWED_IMAGE_MIME, MAX_ASSETS } from './assets.ts'
import { validateDestination, validateRemovable, type ValidationCode } from './validate.ts'
import {
  isGroup,
  isText,
  type AssetRef,
  type Document,
  type GroupNode,
  type ImageNode,
  type LayerNode,
  type NodeId,
  type Style,
  type TextAlign,
  type Transform,
} from './types.ts'

export type Command =
  | { type: 'insertNodes'; parentId: NodeId; index: number; nodes: LayerNode[] }
  | { type: 'removeNodes'; nodeIds: NodeId[] }
  | { type: 'setTransform'; nodeId: NodeId; transform: Transform }
  | { type: 'setStyle'; nodeId: NodeId; style: Style }
  | { type: 'setFlags'; nodeId: NodeId; locked: boolean; hidden: boolean }
  | { type: 'renameNode'; nodeId: NodeId; name: string }
  /** Text content, with the measured box when the caller could measure (issue #16). */
  | { type: 'setText'; nodeId: NodeId; text: string; width?: number; height?: number }
  | {
      type: 'setTextStyle'
      nodeId: NodeId
      fontSize: number
      fontFamily: string
      align: TextAlign
      lineHeight: number
      width?: number
      height?: number
    }
  /** Places an image and registers its asset in one undoable step (issue #17). */
  | { type: 'placeImage'; parentId: NodeId; index: number; node: ImageNode; asset: AssetRef }
  /** Adds an asset record; the inverse of removing one. */
  | { type: 'addAsset'; asset: AssetRef }
  /** Removes an unreferenced asset record. */
  | { type: 'removeAsset'; assetId: string }
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

/**
 * True when the node or any of its ancestors is locked. Illustrator's lock is inherited, so
 * a child of a locked layer cannot be edited even though its own flag is clear.
 */
export function isLocked(document: Document, nodeId: NodeId): boolean {
  const node = findNode(document, nodeId)
  if (node !== null && node.locked) return true
  let container = parentIdOf(document, nodeId)
  while (container !== null) {
    if (container.locked) return true
    container = parentIdOf(document, container.id)
  }
  return false
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

const TEXT_ALIGNS = new Set<TextAlign>(['left', 'center', 'right'])

/** Measured box when the caller could measure, otherwise the shared estimate. */
function textBox(
  text: string,
  fontSize: number,
  lineHeight: number,
  width?: number,
  height?: number,
): { width: number; height: number } {
  const estimate = estimateTextSize(text, fontSize, lineHeight)
  const resolvedWidth = width !== undefined && Number.isFinite(width) && width > 0 ? width : estimate.width
  const resolvedHeight = height !== undefined && Number.isFinite(height) && height > 0 ? height : estimate.height
  return { width: resolvedWidth, height: resolvedHeight }
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
      // A locked node, or a node inside a locked group, cannot be deleted (issue #20).
      const blocked = command.nodeIds.find((nodeId) => isLocked(document, nodeId))
      if (blocked !== undefined) return rejected('locked', `Node ${blocked} is locked; unlock it before deleting.`)
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
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
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
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
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
      if (isLocked(document, command.nodeId)) {
        return rejected('locked', `Node ${command.nodeId} is locked; unlock it before reordering.`)
      }
      if (isLocked(document, command.parentId)) {
        return rejected('locked', `Group ${command.parentId} is locked; unlock it before moving nodes into it.`)
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

    case 'setText': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (!isText(node)) return rejected('invalid-parent', `Node ${command.nodeId} is not a text object.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      if (command.text.length > MAX_TEXT_LENGTH) {
        return rejected('invalid-index', `Text is longer than ${MAX_TEXT_LENGTH} characters.`)
      }
      const box = textBox(command.text, node.fontSize, node.lineHeight, command.width, command.height)
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) =>
            isText(current) ? { ...current, text: command.text, ...box } : current,
          ),
        ),
        inverse: {
          type: 'setText',
          nodeId: command.nodeId,
          text: node.text,
          width: node.width,
          height: node.height,
        },
      }
    }

    case 'setTextStyle': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (!isText(node)) return rejected('invalid-parent', `Node ${command.nodeId} is not a text object.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      if (!Number.isFinite(command.fontSize) || command.fontSize <= 0 || command.fontSize > 1000) {
        return rejected('non-finite', `Font size ${command.fontSize} is out of range.`)
      }
      if (!Number.isFinite(command.lineHeight) || command.lineHeight <= 0) {
        return rejected('non-finite', `Line height ${command.lineHeight} is out of range.`)
      }
      if (!TEXT_ALIGNS.has(command.align)) {
        return rejected('invalid-index', `Alignment ${command.align} is not supported.`)
      }
      const fontFamily = command.fontFamily.trim()
      if (fontFamily.length === 0 || fontFamily.length > 128) {
        return rejected('invalid-index', 'A font family name must be between 1 and 128 characters.')
      }
      const box = textBox(node.text, command.fontSize, command.lineHeight, command.width, command.height)
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) =>
            isText(current)
              ? {
                  ...current,
                  fontSize: command.fontSize,
                  fontFamily,
                  align: command.align,
                  lineHeight: command.lineHeight,
                  ...box,
                }
              : current,
          ),
        ),
        inverse: {
          type: 'setTextStyle',
          nodeId: command.nodeId,
          fontSize: node.fontSize,
          fontFamily: node.fontFamily,
          align: node.align,
          lineHeight: node.lineHeight,
          width: node.width,
          height: node.height,
        },
      }
    }

    case 'placeImage': {
      const node = command.node as ImageNode
      if (node.type !== 'image' || node.assetId !== command.asset.id) {
        return rejected('invalid-asset', 'The image node does not match the asset being placed.')
      }
      if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) {
        return rejected('non-finite', `Image ${node.id} has a non-finite size.`)
      }
      if (node.width <= 0 || node.height <= 0) {
        return rejected('non-positive-size', `Image ${node.id} has a non-positive size.`)
      }
      const asset = command.asset
      if (!ALLOWED_IMAGE_MIME.has(asset.mimeType)) {
        return rejected('invalid-asset', `${asset.mimeType} is not an importable image type.`)
      }
      if (
        asset.byteLength <= 0 ||
        !Number.isFinite(asset.width) ||
        !Number.isFinite(asset.height) ||
        asset.width <= 0 ||
        asset.height <= 0
      ) {
        return rejected('invalid-asset', `Asset ${asset.id} has no usable size.`)
      }
      const alreadyStored = document.assets.some((existing) => existing.id === asset.id)
      if (!alreadyStored && document.assets.length >= MAX_ASSETS) {
        return rejected('invalid-asset', `A document may hold ${MAX_ASSETS} images.`)
      }
      const destination = validateDestination(document, command.parentId, command.index)
      if (!destination.ok) return rejected(destination.issue.code, destination.issue.message)

      const inserted = insertNodes(document, command.parentId, command.index, [clone(node)])
      // One command covers both halves, so undo restores both: the node goes away, and the
      // asset record goes with it when this placement was what added it.
      const inverse: Command =
        alreadyStored
          ? { type: 'removeNodes', nodeIds: [node.id] }
          : {
              type: 'batch',
              commands: [
                { type: 'removeNodes', nodeIds: [node.id] },
                { type: 'removeAsset', assetId: asset.id },
              ],
            }
      return {
        ok: true,
        document: withRevision({
          ...inserted,
          assets: alreadyStored ? document.assets : [...document.assets, clone(asset)],
        }),
        inverse,
      }
    }

    case 'addAsset': {
      const asset = command.asset
      if (document.assets.some((existing) => existing.id === asset.id)) {
        return rejected('invalid-asset', `Asset ${asset.id} is already in the document.`)
      }
      if (!ALLOWED_IMAGE_MIME.has(asset.mimeType)) {
        return rejected('invalid-asset', `${asset.mimeType} is not an importable image type.`)
      }
      if (document.assets.length >= MAX_ASSETS) {
        return rejected('invalid-asset', `A document may hold ${MAX_ASSETS} images.`)
      }
      return {
        ok: true,
        document: withRevision({ ...document, assets: [...document.assets, clone(asset)] }),
        inverse: { type: 'removeAsset', assetId: asset.id },
      }
    }

    case 'removeAsset': {
      const asset = document.assets.find((existing) => existing.id === command.assetId)
      if (asset === undefined) return rejected('absent-node', `Asset ${command.assetId} does not exist.`)
      const referenced = paintOrder(document).some((id) => {
        const node = findNode(document, id)
        return node !== null && node.type === 'image' && node.assetId === command.assetId
      })
      if (referenced) {
        return rejected('invalid-asset', `Asset ${command.assetId} is still used by an image.`)
      }
      return {
        ok: true,
        document: withRevision({
          ...document,
          assets: document.assets.filter((existing) => existing.id !== command.assetId),
        }),
        inverse: { type: 'addAsset', asset: clone(asset) },
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

