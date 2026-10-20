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
import { segmentAt, splitCubicAt } from '../geom/path.ts'
import { localToScene, sceneToLocal, type PathEditCapture } from './pathEdit.ts'
import { ALLOWED_IMAGE_MIME, MAX_ASSETS } from './assets.ts'
import { validateDestination, validateRemovable, type ValidationCode } from './validate.ts'
import {
  isGroup,
  isText,
  type Artboard,
  type Cmyk,
  type Guide,
  type Swatch,
  type AssetRef,
  type Document,
  type GroupNode,
  type ImageNode,
  type ImageCrop,
  type LayerNode,
  type NodeId,
  type PathAnchor,
  type PathFillRule,
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
  /** Editable rounded corner on an existing rectangle (Phase 2.1, issue #64). */
  | { type: 'setCornerRadius'; nodeId: NodeId; cornerRadius: number }
  /** Makes a direct child clip its group's other children, or releases the clip (issue #71). */
  | { type: 'setClip'; groupId: NodeId; clipChildId: NodeId | null }
  /** Guide lines are document data (issue #67); positions are scene units. */
  | { type: 'addGuide'; guide: Guide }
  /** Named colours are document data (issue #69). */
  | { type: 'addSwatch'; swatch: Swatch }
  | { type: 'removeSwatch'; swatchId: string }
  | { type: 'setSwatch'; swatchId: string; name?: string; color?: string; cmyk?: Cmyk | null; spot?: boolean }
  | { type: 'removeGuide'; guideId: string }
  | { type: 'setGuide'; guideId: string; position: number }
  /** Joins two open paths at their nearest endpoints into one open path (Phase 5.3). */
  | { type: 'joinPaths'; firstId: NodeId; secondId: NodeId }
  /** Inserts an anchor on a segment at t (Phase 5.3, issue #139). */
  | { type: 'addPathAnchor'; nodeId: NodeId; index: number; t: number }
  /** Removes one anchor, keeping the path above its minimum. */
  | { type: 'removePathAnchor'; nodeId: NodeId; index: number }
  /** Converts an anchor between corner and smooth; smooth derives mirrored handles from its neighbours. */
  | { type: 'convertPathAnchor'; nodeId: NodeId; index: number; smooth: boolean }
  /** Edits a path's anchors, closure, or fill rule in one undoable step (Phase 5.1). */
  | { type: 'setPathAnchors'; nodeId: NodeId; anchors: PathAnchor[]; closed: boolean; fillRule: PathFillRule }
  /** Artboards are document data (Phase 2.4, issue #67); positions are derived, never stored. */
  | { type: 'addArtboard'; artboard: Artboard; index: number }
  | { type: 'removeArtboard'; artboardId: string }
  | { type: 'setArtboard'; artboardId: string; name?: string; width?: number; height?: number }
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
  | { type: 'setImageCrop'; nodeId: NodeId; crop: ImageCrop }
  | { type: 'setImageMask'; nodeId: NodeId; maskAssetId: string | null }
  | { type: 'setImageAsset'; nodeId: NodeId; assetId: string; width: number; height: number }
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

/** Bounded so a hand-edited file cannot make the swatch list unbounded. */
const MAX_SWATCHES = 512

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

    case 'addArtboard': {
      const artboard = command.artboard
      if (document.artboards.some((existing) => existing.id === artboard.id)) {
        return rejected('duplicate-id', `Artboard ${artboard.id} already exists.`)
      }
      if (!Number.isFinite(artboard.width) || !Number.isFinite(artboard.height) || artboard.width <= 0 || artboard.height <= 0) {
        return rejected('non-positive-size', `Artboard ${artboard.id} needs a positive size.`)
      }
      const index = Math.max(0, Math.min(document.artboards.length, Math.round(command.index)))
      const next = [...document.artboards]
      next.splice(index, 0, clone(artboard))
      return {
        ok: true,
        document: withRevision({ ...document, artboards: next }),
        inverse: { type: 'removeArtboard', artboardId: artboard.id },
      }
    }

    case 'removeArtboard': {
      if (document.artboards.length <= 1) {
        return rejected('invalid-index', 'A document needs at least one artboard.')
      }
      const index = document.artboards.findIndex((artboard) => artboard.id === command.artboardId)
      if (index < 0) return rejected('absent-node', `Artboard ${command.artboardId} does not exist.`)
      const removed = document.artboards[index]
      return {
        ok: true,
        document: withRevision({ ...document, artboards: document.artboards.filter((artboard) => artboard.id !== removed.id) }),
        inverse: { type: 'addArtboard', artboard: clone(removed), index },
      }
    }

    case 'setArtboard': {
      const artboard = document.artboards.find((existing) => existing.id === command.artboardId)
      if (artboard === undefined) return rejected('absent-node', `Artboard ${command.artboardId} does not exist.`)
      const name = command.name === undefined ? artboard.name : command.name.trim()
      if (name.length === 0 || name.length > 128) {
        return rejected('invalid-index', 'An artboard name must be between 1 and 128 characters.')
      }
      const width = command.width === undefined ? artboard.width : command.width
      const height = command.height === undefined ? artboard.height : command.height
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return rejected('non-positive-size', `Artboard ${artboard.id} needs a positive size.`)
      }
      return {
        ok: true,
        document: withRevision({
          ...document,
          artboards: document.artboards.map((existing) =>
            existing.id === artboard.id ? { ...existing, name, width, height } : existing,
          ),
        }),
        inverse: { type: 'setArtboard', artboardId: artboard.id, name: artboard.name, width: artboard.width, height: artboard.height },
      }
    }

    case 'addGuide': {
      const guides = document.guides ?? []
      if (guides.some((guide) => guide.id === command.guide.id)) {
        return rejected('duplicate-id', `Guide ${command.guide.id} already exists.`)
      }
      if (!Number.isFinite(command.guide.position)) {
        return rejected('non-finite', 'A guide needs a finite position.')
      }
      return {
        ok: true,
        document: withRevision({ ...document, guides: [...guides, { ...command.guide }] }),
        inverse: { type: 'removeGuide', guideId: command.guide.id },
      }
    }

    case 'addSwatch': {
      const swatches = document.swatches ?? []
      if (swatches.some((swatch) => swatch.id === command.swatch.id)) {
        return rejected('duplicate-id', `Swatch ${command.swatch.id} already exists.`)
      }
      if (swatches.length >= MAX_SWATCHES) {
        return rejected('invalid-index', `A document may hold ${MAX_SWATCHES} swatches.`)
      }
      const name = command.swatch.name.trim()
      if (name.length === 0 || name.length > 128) {
        return rejected('invalid-index', 'A swatch name must be between 1 and 128 characters.')
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(command.swatch.color)) {
        return rejected('invalid-index', `Swatch ${command.swatch.id} needs a hex colour.`)
      }
      return {
        ok: true,
        document: withRevision({ ...document, swatches: [...swatches, { ...command.swatch, name }] }),
        inverse: { type: 'removeSwatch', swatchId: command.swatch.id },
      }
    }

    case 'removeSwatch': {
      const swatches = document.swatches ?? []
      const swatch = swatches.find((candidate) => candidate.id === command.swatchId)
      if (swatch === undefined) return rejected('absent-node', `Swatch ${command.swatchId} does not exist.`)
      return {
        ok: true,
        document: withRevision({ ...document, swatches: swatches.filter((candidate) => candidate.id !== swatch.id) }),
        inverse: { type: 'addSwatch', swatch: { ...swatch } },
      }
    }

    case 'setSwatch': {
      const swatches = document.swatches ?? []
      const swatch = swatches.find((candidate) => candidate.id === command.swatchId)
      if (swatch === undefined) return rejected('absent-node', `Swatch ${command.swatchId} does not exist.`)
      const name = command.name === undefined ? swatch.name : command.name.trim()
      if (name.length === 0 || name.length > 128) {
        return rejected('invalid-index', 'A swatch name must be between 1 and 128 characters.')
      }
      const color = command.color ?? swatch.color
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return rejected('invalid-index', 'A swatch needs a hex colour.')
      }
      const cmyk = command.cmyk === undefined ? swatch.cmyk : (command.cmyk ?? undefined)
      if (cmyk !== undefined && ![cmyk.c, cmyk.m, cmyk.y, cmyk.k].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
        return rejected('non-finite', 'CMYK components run from 0 to 100.')
      }
      return {
        ok: true,
        document: withRevision({
          ...document,
          swatches: swatches.map((candidate) =>
            candidate.id === swatch.id
              ? { ...candidate, name, color, cmyk, spot: command.spot ?? candidate.spot }
              : candidate,
          ),
        }),
        inverse: { type: 'setSwatch', swatchId: swatch.id, name: swatch.name, color: swatch.color, cmyk: swatch.cmyk ?? null, spot: swatch.spot },
      }
    }

    case 'removeGuide': {
      const guides = document.guides ?? []
      const guide = guides.find((candidate) => candidate.id === command.guideId)
      if (guide === undefined) return rejected('absent-node', `Guide ${command.guideId} does not exist.`)
      return {
        ok: true,
        document: withRevision({ ...document, guides: guides.filter((candidate) => candidate.id !== guide.id) }),
        inverse: { type: 'addGuide', guide: { ...guide } },
      }
    }

    case 'setGuide': {
      const guides = document.guides ?? []
      const guide = guides.find((candidate) => candidate.id === command.guideId)
      if (guide === undefined) return rejected('absent-node', `Guide ${command.guideId} does not exist.`)
      if (!Number.isFinite(command.position)) return rejected('non-finite', 'A guide needs a finite position.')
      return {
        ok: true,
        document: withRevision({
          ...document,
          guides: guides.map((candidate) => (candidate.id === guide.id ? { ...candidate, position: command.position } : candidate)),
        }),
        inverse: { type: 'setGuide', guideId: guide.id, position: guide.position },
      }
    }

    case 'setClip': {
      const group = findNode(document, command.groupId)
      if (group === null) return rejected('absent-node', `Group ${command.groupId} does not exist.`)
      if (!isGroup(group)) return rejected('invalid-parent', `Node ${command.groupId} is not a group.`)
      if (isLocked(document, command.groupId)) return rejected('locked', `Group ${command.groupId} is locked.`)
      const previous = group.clipChildId ?? null
      if (command.clipChildId !== null && !group.children.some((child) => child.id === command.clipChildId)) {
        return rejected('invalid-parent', `Node ${command.clipChildId} is not a child of group ${command.groupId}.`)
      }
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, group.id, (current) =>
            current.type === 'group' ? { ...current, clipChildId: command.clipChildId } : current,
          ),
        ),
        inverse: { type: 'setClip', groupId: group.id, clipChildId: previous },
      }
    }

    case 'setPathAnchors': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (node.type !== 'path') return rejected('invalid-parent', `Node ${command.nodeId} is not a path.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      const minimum = command.closed ? 3 : 2
      if (!Array.isArray(command.anchors) || command.anchors.length < minimum) {
        return rejected('invalid-index', `Path ${command.nodeId} needs at least ${minimum} anchors.`)
      }
      for (const anchor of command.anchors) {
        if (![anchor.x, anchor.y, anchor.inX, anchor.inY, anchor.outX, anchor.outY].every((value) => Number.isFinite(value))) {
          return rejected('non-finite', `Path ${command.nodeId} has a non-finite anchor.`)
        }
      }
      if (command.fillRule !== 'nonzero' && command.fillRule !== 'evenodd') {
        return rejected('invalid-index', `Path ${command.nodeId} has an unsupported fill rule.`)
      }
      const previous = { anchors: node.anchors.map((anchor) => ({ ...anchor })), closed: node.closed, fillRule: node.fillRule }
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) => ({
            ...current,
            anchors: command.anchors.map((anchor) => ({ ...anchor })),
            closed: command.closed,
            fillRule: command.fillRule,
          })),
        ),
        inverse: { type: 'setPathAnchors', nodeId: command.nodeId, ...previous },
      }
    }

    case 'addPathAnchor': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (node.type !== 'path') return rejected('invalid-parent', `Node ${command.nodeId} is not a path.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      if (!Number.isFinite(command.t) || command.t <= 0 || command.t >= 1) {
        return rejected('invalid-index', 'An inserted anchor needs a t between 0 and 1.')
      }
      const segment = segmentAt(node.anchors, node.closed, command.index)
      if (segment === null) return rejected('invalid-index', `Path ${command.nodeId} has no segment ${command.index}.`)
      const split = splitCubicAt(segment.from, segment.to, command.t)
      const at = command.index
      const next = (at + 1) % node.anchors.length
      const anchors = node.anchors.map((anchor, index) => {
        if (index === at) return { ...anchor, outX: split.leftOut.x, outY: split.leftOut.y }
        if (index === next) return { ...anchor, inX: split.rightIn.x, inY: split.rightIn.y }
        return { ...anchor }
      })
      anchors.splice(at + 1, 0, split.middle)
      const previous = { anchors: node.anchors.map((anchor) => ({ ...anchor })), closed: node.closed, fillRule: node.fillRule }
      return {
        ok: true,
        document: withRevision(replaceNode(document, command.nodeId, (current) => ({ ...current, anchors }))),
        inverse: { type: 'setPathAnchors', nodeId: command.nodeId, ...previous },
      }
    }

    case 'removePathAnchor': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (node.type !== 'path') return rejected('invalid-parent', `Node ${command.nodeId} is not a path.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      const minimum = node.closed ? 3 : 2
      if (node.anchors.length <= minimum) {
        return rejected('invalid-index', `Path ${command.nodeId} cannot drop below ${minimum} anchors.`)
      }
      if (!Number.isInteger(command.index) || command.index < 0 || command.index >= node.anchors.length) {
        return rejected('invalid-index', `Path ${command.nodeId} has no anchor ${command.index}.`)
      }
      const anchors = node.anchors.filter((_, index) => index !== command.index).map((anchor) => ({ ...anchor }))
      const previous = { anchors: node.anchors.map((anchor) => ({ ...anchor })), closed: node.closed, fillRule: node.fillRule }
      return {
        ok: true,
        document: withRevision(replaceNode(document, command.nodeId, (current) => ({ ...current, anchors }))),
        inverse: { type: 'setPathAnchors', nodeId: command.nodeId, ...previous },
      }
    }

    case 'convertPathAnchor': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (node.type !== 'path') return rejected('invalid-parent', `Node ${command.nodeId} is not a path.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      if (!Number.isInteger(command.index) || command.index < 0 || command.index >= node.anchors.length) {
        return rejected('invalid-index', `Path ${command.nodeId} has no anchor ${command.index}.`)
      }
      const anchors = node.anchors.map((anchor) => ({ ...anchor }))
      const anchor = anchors[command.index]
      if (!command.smooth) {
        anchor.inX = 0
        anchor.inY = 0
        anchor.outX = 0
        anchor.outY = 0
        anchor.smooth = false
      } else {
        const count = anchors.length
        const previous = anchors[(command.index - 1 + count) % count]
        const next = anchors[(command.index + 1) % count]
        const dx = next.x - previous.x
        const dy = next.y - previous.y
        const length = Math.hypot(dx, dy)
        if (length === 0) {
          anchor.inX = 0
          anchor.inY = 0
          anchor.outX = 0
          anchor.outY = 0
          anchor.smooth = false
        } else {
          // A third of the distance to each neighbour is Illustrator's default handle length.
          const reach = Math.min(Math.hypot(anchor.x - previous.x, anchor.y - previous.y), Math.hypot(next.x - anchor.x, next.y - anchor.y)) / 3
          const ux = dx / length
          const uy = dy / length
          anchor.outX = ux * reach
          anchor.outY = uy * reach
          anchor.inX = -ux * reach
          anchor.inY = -uy * reach
          anchor.smooth = true
        }
      }
      const previous = { anchors: node.anchors.map((value) => ({ ...value })), closed: node.closed, fillRule: node.fillRule }
      return {
        ok: true,
        document: withRevision(replaceNode(document, command.nodeId, (current) => ({ ...current, anchors }))),
        inverse: { type: 'setPathAnchors', nodeId: command.nodeId, ...previous },
      }
    }

    case 'joinPaths': {
      const first = findNode(document, command.firstId)
      const second = findNode(document, command.secondId)
      if (first === null || second === null) return rejected('absent-node', 'Both paths must exist to join them.')
      if (first.type !== 'path' || second.type !== 'path') {
        return rejected('invalid-parent', 'Join needs two paths.')
      }
      if (first.id === second.id) return rejected('invalid-index', 'A path cannot join itself.')
      if (first.closed || second.closed) return rejected('invalid-index', 'Join needs two open paths.')
      if (isLocked(document, first.id) || isLocked(document, second.id)) return rejected('locked', 'A locked path cannot be joined.')
      if (!document.root.children.some((node) => node.id === first.id) || !document.root.children.some((node) => node.id === second.id)) {
        return rejected('invalid-parent', 'Join currently requires both paths at the top level.')
      }
      const captureFor = (node: Extract<LayerNode, { type: 'path' }>): PathEditCapture => ({
        nodeId: node.id,
        anchors: node.anchors,
        width: node.width,
        height: node.height,
        transform: node.transform,
      })
      const captureFirst = captureFor(first)
      const captureSecond = captureFor(second)
      const toScene = (anchor: PathAnchor, capture: PathEditCapture) => localToScene({ x: anchor.x, y: anchor.y }, capture)
      const firstStart = toScene(first.anchors[0], captureFirst)
      const firstEnd = toScene(first.anchors[first.anchors.length - 1], captureFirst)
      const secondStart = toScene(second.anchors[0], captureSecond)
      const secondEnd = toScene(second.anchors[second.anchors.length - 1], captureSecond)
      const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
      const options = [
        { atFirstStart: false, atSecondEnd: false, gap: distance(firstEnd, secondStart) },
        { atFirstStart: false, atSecondEnd: true, gap: distance(firstEnd, secondEnd) },
        { atFirstStart: true, atSecondEnd: false, gap: distance(firstStart, secondStart) },
        { atFirstStart: true, atSecondEnd: true, gap: distance(firstStart, secondEnd) },
      ]
      const best = options.reduce((left, right) => (right.gap < left.gap ? right : left))
      const orderedFirst = best.atFirstStart ? [...first.anchors].reverse() : first.anchors
      const orderedSecond = best.atSecondEnd ? [...second.anchors].reverse() : second.anchors
      // The joining endpoint becomes one anchor: keep the first path's, drop the second's.
      const movedSecond = orderedSecond.slice(1).map((anchor) => {
        const scene = localToScene({ x: anchor.x, y: anchor.y }, captureSecond)
        const local = sceneToLocal(scene, captureFirst)
        const inScene = localToScene({ x: anchor.x + anchor.inX, y: anchor.y + anchor.inY }, captureSecond)
        const outScene = localToScene({ x: anchor.x + anchor.outX, y: anchor.y + anchor.outY }, captureSecond)
        const inLocal = sceneToLocal(inScene, captureFirst)
        const outLocal = sceneToLocal(outScene, captureFirst)
        return {
          ...anchor,
          x: local.x,
          y: local.y,
          inX: inLocal.x - local.x,
          inY: inLocal.y - local.y,
          outX: outLocal.x - local.x,
          outY: outLocal.y - local.y,
        }
      })
      const anchors = [...orderedFirst, ...movedSecond].map((anchor) => ({ ...anchor }))
      const previous = { anchors: first.anchors.map((anchor) => ({ ...anchor })), closed: first.closed, fillRule: first.fillRule }
      const index = childIndex(document.root, second.id)
      const joined = removeNodes(replaceNode(document, first.id, (current) => ({ ...current, anchors })), [second.id])
      return {
        ok: true,
        document: withRevision(joined),
        inverse: batchCommand([
          { type: 'setPathAnchors', nodeId: first.id, ...previous },
          { type: 'insertNodes', parentId: document.root.id, index, nodes: [second] },
        ]),
      }
    }

    case 'setCornerRadius': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Node ${command.nodeId} does not exist.`)
      if (node.type !== 'rect') {
        return rejected('invalid-parent', `Node ${command.nodeId} is not a rectangle, so it has no corner radius.`)
      }
      if (isLocked(document, command.nodeId)) return rejected('locked', `Node ${command.nodeId} is locked.`)
      const radius = command.cornerRadius
      if (!Number.isFinite(radius) || radius < 0) {
        return rejected('non-finite', `Corner radius ${String(radius)} is not a usable number.`)
      }
      const limit = Math.min(node.width, node.height) / 2
      if (radius > limit) {
        return rejected(
          'invalid-index',
          `Corner radius ${radius} is larger than half the shorter side (${limit}).`,
        )
      }
      return {
        ok: true,
        document: withRevision(
          replaceNode(document, command.nodeId, (current) =>
            current.type === 'rect' ? { ...current, cornerRadius: radius } : current,
          ),
        ),
        inverse: { type: 'setCornerRadius', nodeId: command.nodeId, cornerRadius: node.cornerRadius },
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

    case 'setImageCrop': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Image ${command.nodeId} does not exist.`)
      if (node.type !== 'image') return rejected('invalid-asset', `${command.nodeId} is not an image.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Image ${command.nodeId} is locked.`)
      const crop = { ...command.crop }
      if (
        ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
        crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 ||
        crop.x + crop.width > 1 || crop.y + crop.height > 1
      ) {
        return rejected('invalid-asset', 'Crop must stay inside the image bounds.')
      }
      return {
        ok: true,
        document: withRevision(replaceNode(document, node.id, (current) => current.type === 'image' ? { ...current, crop } : current)),
        inverse: { type: 'setImageCrop', nodeId: node.id, crop: { ...node.crop } },
      }
    }

    case 'setImageMask': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Image ${command.nodeId} does not exist.`)
      if (node.type !== 'image') return rejected('invalid-asset', `${command.nodeId} is not an image.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Image ${command.nodeId} is locked.`)
      if (command.maskAssetId !== null && !document.assets.some((asset) => asset.id === command.maskAssetId)) {
        return rejected('invalid-asset', `Mask asset ${command.maskAssetId} is not in the document.`)
      }
      return {
        ok: true,
        document: withRevision(replaceNode(document, node.id, (current) => current.type === 'image' ? { ...current, maskAssetId: command.maskAssetId } : current)),
        inverse: { type: 'setImageMask', nodeId: node.id, maskAssetId: node.maskAssetId },
      }
    }

    case 'setImageAsset': {
      const node = findNode(document, command.nodeId)
      if (node === null) return rejected('absent-node', `Image ${command.nodeId} does not exist.`)
      if (node.type !== 'image') return rejected('invalid-asset', `${command.nodeId} is not an image.`)
      if (isLocked(document, command.nodeId)) return rejected('locked', `Image ${command.nodeId} is locked.`)
      if (!document.assets.some((asset) => asset.id === command.assetId)) {
        return rejected('invalid-asset', `Asset ${command.assetId} is not in the document.`)
      }
      if (!Number.isFinite(command.width) || !Number.isFinite(command.height) || command.width <= 0 || command.height <= 0) {
        return rejected('invalid-asset', 'Image dimensions must be positive.')
      }
      return {
        ok: true,
        document: withRevision(replaceNode(document, node.id, (current) => current.type === 'image' ? {
          ...current, assetId: command.assetId, width: command.width, height: command.height,
        } : current)),
        inverse: { type: 'setImageAsset', nodeId: node.id, assetId: node.assetId, width: node.width, height: node.height },
      }
    }

    case 'removeAsset': {
      const asset = document.assets.find((existing) => existing.id === command.assetId)
      if (asset === undefined) return rejected('absent-node', `Asset ${command.assetId} does not exist.`)
      const referenced = paintOrder(document).some((id) => {
        const node = findNode(document, id)
        return node !== null && node.type === 'image' && (node.assetId === command.assetId || node.maskAssetId === command.assetId)
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

