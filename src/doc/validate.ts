/**
 * Document validation (issue #18).
 *
 * Every command validates before it mutates, and open/deserialize reuses the same
 * checks (slice #19). Error codes are stable strings so the UI, the tests, and
 * later surfaces (files, MCP) can act on them without parsing messages.
 */

import { findNode, findParent, findWithin } from './document.ts'
import { MAX_TEXT_LENGTH } from './document.ts'
import { BLEND_MODES, isGroup, isImage, isText, SUPPORTED_FORMAT_VERSION_LIST, type Document, type GroupNode, type LayerNode, type NodeId } from './types.ts'
import { clampCornerRadius } from '../geom/shapeGeometry.ts'

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
  /** The node, or an ancestor of it, is locked (issue #20; replaces the #18 wart). */
  | 'locked'
  /** An asset record is missing, disallowed, or still referenced (issue #17). */
  | 'invalid-asset'

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

/**
 * Shape parameters that live in the file. Returns `null` when the node is fine, so the tree walk
 * stays readable. Only the kinds that carry parameters beyond a box are checked.
 */
export function validateShapeGeometry(node: LayerNode): ValidationResult | null {
  if (node.type === 'rect' && node.cornerRadius !== 0) {
    if (!Number.isFinite(node.cornerRadius) || node.cornerRadius < 0) {
      return fail('non-finite', `Rect ${node.id} has an out-of-range corner radius.`, node.id)
    }
    if (node.cornerRadius > clampCornerRadius(node.width, node.height, node.cornerRadius)) {
      return fail(
        'invalid-index',
        `Rect ${node.id} has a corner radius larger than half its shorter side.`,
        node.id,
      )
    }
  }
  if (!isGroup(node)) {
    const align = node.style.stroke?.align
    if (align !== undefined && align !== 'center' && align !== 'inside' && align !== 'outside') {
      return fail('invalid-index', `Node ${node.id} has an unsupported stroke alignment.`, node.id)
    }
    const mode = node.style.blendMode
    if (mode !== undefined && !BLEND_MODES.includes(mode)) {
      return fail('invalid-index', `Node ${node.id} has an unsupported blend mode.`, node.id)
    }
    const target = node.style.gradientTarget
    if (target !== undefined && target !== 'fill' && target !== 'stroke' && target !== 'both') {
      return fail('invalid-index', `Node ${node.id} has an unsupported gradient target.`, node.id)
    }
    const gradient = node.style.gradient ?? null
    if (gradient !== null) {
      if (gradient.type !== 'linear' && gradient.type !== 'radial') {
        return fail('invalid-index', `Node ${node.id} has an unsupported gradient type.`, node.id)
      }
      if (gradient.stops.length < 2 || gradient.stops.length > 8) {
        return fail('invalid-index', `Gradient needs two to eight stops.`, node.id)
      }
      for (const stop of gradient.stops) {
        if (!Number.isFinite(stop.offset) || stop.offset < 0 || stop.offset > 1) {
          return fail('non-finite', `Gradient ${node.id} has a stop outside 0..1.`, node.id)
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(stop.color)) {
          return fail('invalid-index', `Gradient ${node.id} has an unusable colour.`, node.id)
        }
      }
      if (![gradient.from.x, gradient.from.y, gradient.to.x, gradient.to.y].every((value) => Number.isFinite(value))) {
        return fail('non-finite', `Gradient ${node.id} has non-finite endpoints.`, node.id)
      }
      if (gradient.from.x === gradient.to.x && gradient.from.y === gradient.to.y) {
        return fail('invalid-index', `Gradient ${node.id} has identical endpoints.`, node.id)
      }
      if (gradient.type === 'radial') {
        const radius = Math.hypot(gradient.to.x - gradient.from.x, gradient.to.y - gradient.from.y)
        if (!(radius > 0)) return fail('invalid-index', `Radial gradient ${node.id} has no radius.`, node.id)
      }
    }
  }
  const CAPS = new Set(['butt', 'round', 'square'])
  const JOINS = new Set(['miter', 'round', 'bevel'])
  if (!isGroup(node)) {
    const stroke = node.style.stroke
    if (stroke !== null && stroke.cap !== undefined && !CAPS.has(stroke.cap)) {
      return fail('invalid-index', `Node ${node.id} has an unsupported stroke cap.`, node.id)
    }
    if (stroke !== null && stroke.dash !== undefined && stroke.dash.length > 0) {
      if (stroke.dash.length > 8) {
        return fail('invalid-index', `Node ${node.id} has too many dash entries.`, node.id)
      }
      if (!stroke.dash.every((value) => Number.isFinite(value) && value > 0 && value <= 1000)) {
        return fail('non-finite', `Node ${node.id} has an unusable dash pattern.`, node.id)
      }
    }
    if (stroke !== null && stroke.join !== undefined && !JOINS.has(stroke.join)) {
      return fail('invalid-index', `Node ${node.id} has an unsupported stroke join.`, node.id)
    }
  }
  if (node.type === 'path') {
    if (node.fillRule !== 'nonzero' && node.fillRule !== 'evenodd') {
      return fail('invalid-index', `Path ${node.id} has an unsupported fill rule.`, node.id)
    }
    const minimum = node.closed ? 3 : 2
    if (!Array.isArray(node.anchors) || node.anchors.length < minimum) {
      return fail('invalid-index', `Path ${node.id} needs at least ${minimum} anchors.`, node.id)
    }
    if (node.anchors.length > 10000) {
      return fail('invalid-index', `Path ${node.id} has too many anchors.`, node.id)
    }
    for (const anchor of node.anchors) {
      const numbers = [anchor.x, anchor.y, anchor.inX, anchor.inY, anchor.outX, anchor.outY]
      if (!numbers.every((value) => Number.isFinite(value))) {
        return fail('non-finite', `Path ${node.id} has a non-finite anchor.`, node.id)
      }
      if (Math.hypot(anchor.inX, anchor.inY) > 100000 || Math.hypot(anchor.outX, anchor.outY) > 100000) {
        return fail('invalid-index', `Path ${node.id} has an unusable handle length.`, node.id)
      }
    }
    const contours = [node.anchors, ...(node.subpaths ?? [])]
    if (contours.length > 64) return fail('invalid-index', `Path ${node.id} has too many contours.`, node.id)
    for (const contour of node.subpaths ?? []) {
      if (!Array.isArray(contour) || contour.length < 2) {
        return fail('invalid-index', `Path ${node.id} has a contour with fewer than two anchors.`, node.id)
      }
      for (const anchor of contour) {
        if (![anchor.x, anchor.y, anchor.inX, anchor.inY, anchor.outX, anchor.outY].every((value) => Number.isFinite(value))) {
          return fail('non-finite', `Path ${node.id} has a non-finite contour anchor.`, node.id)
        }
      }
    }
  }
  if (node.type === 'line' && node.from !== 'top-left' && node.from !== 'top-right') {
    return fail('invalid-index', `Line ${node.id} has an unsupported start corner.`, node.id)
  }
  if (node.type === 'polygon' && (!Number.isInteger(node.sides) || node.sides < 3 || node.sides > 60)) {
    return fail('invalid-index', `Polygon ${node.id} has ${String(node.sides)} sides; expected 3 to 60.`, node.id)
  }
  if (node.type === 'star') {
    if (!Number.isInteger(node.points) || node.points < 3 || node.points > 60) {
      return fail('invalid-index', `Star ${node.id} has ${String(node.points)} points; expected 3 to 60.`, node.id)
    }
    if (!Number.isFinite(node.innerRadius) || node.innerRadius < 0.05 || node.innerRadius > 0.95) {
      return fail('non-finite', `Star ${node.id} has an out-of-range inner radius.`, node.id)
    }
  }
  if (node.type === 'arc') {
    if (!Number.isFinite(node.startAngle) || !Number.isFinite(node.sweepAngle)) {
      return fail('non-finite', `Arc ${node.id} has a non-finite angle.`, node.id)
    }
    if (node.sweepAngle === 0 || Math.abs(node.sweepAngle) > 360) {
      return fail('invalid-index', `Arc ${node.id} has an out-of-range sweep; expected -360 to 360.`, node.id)
    }
  }
  return null
}

/** Full-tree validation: ids, parents, cycles, geometry, and version. */
export function validateDocument(document: Document): ValidationResult {
  if (!SUPPORTED_FORMAT_VERSION_LIST.includes(document.formatVersion)) {
    return fail(
      'unsupported-version',
      `Unsupported document format version ${document.formatVersion}; expected one of ${SUPPORTED_FORMAT_VERSION_LIST.join(', ')}.`,
    )
  }
  const artboardIds = new Set<string>()
  for (const artboard of document.artboards) {
    if (artboardIds.has(artboard.id)) return fail('duplicate-id', `Duplicate artboard id ${artboard.id}.`)
    artboardIds.add(artboard.id)
    if (!Number.isFinite(artboard.width) || !Number.isFinite(artboard.height) || artboard.width <= 0 || artboard.height <= 0) {
      return fail('non-positive-size', `Artboard ${artboard.id} has a non-positive size.`)
    }
    if (artboard.name.trim().length === 0) return fail('invalid-index', `Artboard ${artboard.id} has no name.`)
    if ((artboard.x !== undefined && !Number.isFinite(artboard.x)) || (artboard.y !== undefined && !Number.isFinite(artboard.y))) {
      return fail('non-finite', `Artboard ${artboard.id} has a non-finite position.`)
    }
  }
  const guideIds = new Set<string>()
  for (const guide of document.guides ?? []) {
    if (guideIds.has(guide.id)) return fail('duplicate-id', `Duplicate guide id ${guide.id}.`)
    guideIds.add(guide.id)
    if (guide.axis !== 'x' && guide.axis !== 'y') return fail('invalid-index', `Guide ${guide.id} has an unknown axis.`)
    if (!Number.isFinite(guide.position)) return fail('non-finite', `Guide ${guide.id} has a non-finite position.`)
  }
  const swatchIds = new Set<string>()
  for (const swatch of document.swatches ?? []) {
    if (swatchIds.has(swatch.id)) return fail('duplicate-id', `Duplicate swatch id ${swatch.id}.`)
    swatchIds.add(swatch.id)
    if (swatch.name.trim().length === 0) return fail('invalid-index', `Swatch ${swatch.id} has no name.`)
    if (!/^#[0-9a-fA-F]{6}$/.test(swatch.color)) return fail('invalid-index', `Swatch ${swatch.id} has an unusable colour.`)
    if (swatch.cmyk !== undefined) {
      const { c, m, y, k } = swatch.cmyk
      if (![c, m, y, k].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
        return fail('non-finite', `Swatch ${swatch.id} has CMYK components outside 0..100.`)
      }
    }
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
      // Text carries its own metrics (issue #16); a corrupt font size or leading would break
      // measurement, so document boundaries check them too.
      if (isText(node)) {
        if (!Number.isFinite(node.fontSize) || node.fontSize <= 0 || node.fontSize > 1000) {
          return fail('non-finite', `Text node ${node.id} has an out-of-range font size.`, node.id)
        }
        if (!Number.isFinite(node.lineHeight) || node.lineHeight <= 0) {
          return fail('non-finite', `Text node ${node.id} has an out-of-range line height.`, node.id)
        }
        if (node.align !== 'left' && node.align !== 'center' && node.align !== 'right') {
          return fail('invalid-index', `Text node ${node.id} has an unsupported alignment.`, node.id)
        }
        if (node.fontFamily.trim().length === 0) {
          return fail('invalid-index', `Text node ${node.id} has no font family.`, node.id)
        }
        if (node.text.length > MAX_TEXT_LENGTH) {
          return fail('invalid-index', `Text node ${node.id} is longer than ${MAX_TEXT_LENGTH} characters.`, node.id)
        }
      }
      // An image must point at an asset the document carries, so a broken file reference
      // fails at the boundary instead of drawing nothing (issue #17).
      if (isImage(node)) {
        if (node.assetId.trim().length === 0) {
          return fail('invalid-asset', `Image ${node.id} has no asset reference.`, node.id)
        }
        if (!document.assets.some((asset) => asset.id === node.assetId)) {
          return fail('invalid-asset', `Image ${node.id} references missing asset ${node.assetId}.`, node.id)
        }
        const crop = node.crop
        if (
          ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
          crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 ||
          crop.x + crop.width > 1 || crop.y + crop.height > 1
        ) {
          return fail('invalid-asset', `Image ${node.id} has an invalid crop rectangle.`, node.id)
        }
        if (node.maskAssetId !== null && !document.assets.some((asset) => asset.id === node.maskAssetId)) {
          return fail('invalid-asset', `Image ${node.id} references missing mask ${node.maskAssetId}.`, node.id)
        }
      }
      // Shape parameters are part of the file: a polygon without valid sides, or an arc with a
      // non-finite sweep, would corrupt geometry at draw time, so they are checked here.
      const geometry = validateShapeGeometry(node)
      if (geometry !== null) return geometry
      return ok
    }
    if (node.clipChildId !== undefined && node.clipChildId !== null) {
      if (!node.children.some((child) => child.id === node.clipChildId)) {
        return fail('invalid-parent', `Group ${node.id} clips to ${node.clipChildId}, which is not its child.`, node.id)
      }
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
