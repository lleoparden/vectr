/**
 * Editor actions (issue #28).
 *
 * The menu bar, the tool palette, and the keyboard map all name the same actions,
 * and every one of them ends up in the store's single `dispatch` path or on the
 * workspace store. Having one table is what keeps a menu item, its shortcut, and a
 * palette button from drifting apart.
 *
 * Nothing here adds a document command: object actions are built from the existing
 * `setFlags` command.
 */

import { findNode, paintOrder } from '../doc/document.ts'
import { isText, supportsFill, type GroupNode, type LayerNode, type NodeId, type ShapeNode, type TextAlign, type TextNode , type Style } from '../doc/types.ts'
import { documentStore, type EditorState } from '../state/documentStore.ts'
import { workspaceStore, type PanelId } from '../state/workspaceStore.ts'
import {
  duplicatedIds,
  planArrange,
  planDuplicate,
  planGroup,
  planUngroup,
  stepCommand,
  type ArrangeWhere,
  type PlanStep,
} from './editing/arrange.ts'
import { planDrop } from './editing/layerDrag.ts'
import { unionBounds } from '../doc/transform.ts'
import { normaliseAngle, nudgedTransform, scaledTransform } from '../geom/transform.ts'
import { artboardRect, artboardRects } from '../doc/artboards.ts'
import type { BlendMode, FillGradient, StrokeCap, StrokeJoin } from '../doc/types.ts'
import { ACTION_IDS, type EditorActionId } from './commands/registry.ts'
import { cmykToHex, hexToCmyk } from '../geom/cmyk.ts'
import { groupToIsolate } from './editing/isolation.ts'
import { planAlign, planDistribute, type AlignMode, type AlignMove, type DistributeAxis } from './editing/align.ts'
import { clipboardHasContent, copyToClipboard, pastedNodes } from './editing/clipboard.ts'
import type { LayerRow } from './panels/layerRows.ts'
import { importImageBytes, pickImageFile } from './files/imageImport.ts'
import { newDocument, openDocument, recoverDocument, requestNewDocument, requestOpenDocument, saveDocument } from './files/fileActions.ts'
import { assetRegistry } from '../state/assetRegistry.ts'
import { childIndex, createGroup, createImage, type ShapeKind, type ShapeParams } from '../doc/document.ts'
import { actualSize, canvasCenter, fitArtboard, fitRect, zoomByStep } from '../geom/viewport.ts'
import { isLocked, parentIdOf, type Command } from '../doc/commands.ts'
import { nudgedAnchor } from '../doc/pathEdit.ts'
import { createPath } from '../doc/document.ts'
import { nestPolygonIndices, polygonTouchesPath } from '../ops/polygon.ts'
import type { Point } from '../geom/transform.ts'
import { buildScene } from '../render/scene.ts'
import { getActiveRenderer } from '../render/activeRenderer.ts'
import { batchCommand } from '../doc/commands.ts'
import { cornerAnchor, pathBounds } from '../geom/path.ts'

/** Artboard ids are opaque and never reused, like node ids. */
function newArtboardId(): string {
  return 'artboard-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/** Any node that carries a style (everything except a group). */
type StyledNode = Exclude<LayerNode, GroupNode>

export { ACTION_IDS, ACTION_LABELS } from './commands/registry.ts'
export type { EditorActionId } from './commands/registry.ts'

const PANEL_ACTION_IDS: Record<PanelId, EditorActionId> = {
  layers: 'window.togglePanel.layers',
  properties: 'window.togglePanel.properties',
  align: 'window.togglePanel.align',
  transform: 'window.togglePanel.transform',
  pathfinder: 'window.togglePanel.pathfinder',
  appearance: 'window.togglePanel.appearance',
  color: 'window.togglePanel.color',
}

export function isEditorActionId(value: string): value is EditorActionId {
  return (ACTION_IDS as readonly string[]).includes(value)
}

/** The Window-menu action that shows a panel, so both stay in step. */
export function panelActionId(panel: PanelId): EditorActionId {
  return PANEL_ACTION_IDS[panel]
}

/** Every node id in paint order, used by Show All and Unlock All. */
function allNodeIds(): NodeId[] {
  return paintOrder(documentStore.getState().document)
}

function anyNode(predicate: (node: LayerNode) => boolean): boolean {
  const document = documentStore.getState().document
  for (const id of allNodeIds()) {
    const node = findNode(document, id)
    if (node !== null && predicate(node)) return true
  }
  return false
}

function nodeOf(id: NodeId): LayerNode | null {
  return findNode(documentStore.getState().document, id)
}

/**
 * Applies flag changes through one transaction, so a multi-object Hide or Lock is a
 * single undo step, the way it is in Illustrator.
 *
 * This needs the aggregate inverse from issue #34: a transaction used to keep only the
 * first inverse, which restored the first node and left the others changed, so #28 had to
 * record one entry per node. Now the transaction commits a batch of every command with a
 * batch of the inverses in reverse order as its inverse, and one undo step restores all of
 * them. A change that would do nothing records no history at all.
 */
function applyFlags(
  ids: NodeId[],
  next: (node: LayerNode) => { locked: boolean; hidden: boolean } | null,
  label: string,
) {
  if (ids.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction(label)
  let changed = false
  for (const id of ids) {
    const node = nodeOf(id)
    if (node === null) continue
    const flags = next(node)
    if (flags === null) continue
    const result = documentStore.dispatch({
      type: 'setFlags',
      nodeId: id,
      locked: flags.locked,
      hidden: flags.hidden,
    })
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

function selectedIds(): NodeId[] {
  return documentStore.getState().selection
}

/** Illustrator's font-size list, so Increase/Decrease Size steps the way its menu does. */
export const FONT_SIZE_STEPS = [6, 8, 9, 10, 11, 12, 14, 16, 18, 21, 24, 30, 36, 48, 60, 72, 96, 144]

export function nextFontSize(current: number, direction: 1 | -1): number {
  const epsilon = 1e-6
  if (direction === 1) {
    return FONT_SIZE_STEPS.find((step) => step > current + epsilon) ?? Math.min(1000, current * 1.2)
  }
  const descending = [...FONT_SIZE_STEPS].reverse()
  return descending.find((step) => step < current - epsilon) ?? Math.max(1, current / 1.2)
}

/** The text nodes in the selection. */
function selectedTextNodes() {
  const document = documentStore.getState().document
  return documentStore
    .getState()
    .selection.map((id) => findNode(document, id))
    .filter((node): node is TextNode => node !== null && isText(node))
}

/**
 * Applies a text-style change to every selected text node in one transaction, so a size or
 * alignment change is one history entry no matter how many text objects are selected.
 */
function applyTextStyle(patch: (node: TextNode) => { fontSize: number; fontFamily: string; align: TextAlign; lineHeight: number }, label: string) {
  const targets = selectedTextNodes()
  if (targets.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction(label)
  let changed = false
  for (const node of targets) {
    const next = patch(node)
    if (next.fontSize === node.fontSize && next.align === node.align) continue
    const result = documentStore.dispatch({
      type: 'setTextStyle',
      nodeId: node.id,
      fontSize: next.fontSize,
      fontFamily: next.fontFamily,
      align: next.align,
      lineHeight: next.lineHeight,
      width: node.width,
      height: node.height,
    })
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/**
 * Runs a planned gesture: every step goes through `dispatch` inside one transaction, so the
 * whole gesture is one history entry (the aggregate inverse from #34). A step that fails
 * anyway rolls the applied steps back before the transaction is dropped, so a refused plan
 * leaves the document exactly as it was rather than half-applied.
 */
function runPlan(steps: PlanStep[] | null, label: string) {
  if (steps === null || steps.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction(label)
  const applied: Command[] = []
  for (const step of steps) {
    const result = documentStore.dispatch(stepCommand(step))
    if (!result.ok) {
      for (const inverse of [...applied].reverse()) documentStore.dispatch(inverse)
      // A plan that joined someone else's transaction leaves it to its owner to abort.
      if (own) documentStore.abortTransaction()
      return
    }
    applied.push(result.inverse)
  }
  // Only the transaction this plan opened is its to commit; joining one must not end it early,
  // or a batch (Alt-drag's duplicate plus its move) becomes two undo entries.
  if (own) documentStore.commitTransaction()
}

/** Which alignment an action means; the Object menu and the tests share this table. */
export const ALIGN_MODE: Record<
  'object.alignLeft' | 'object.alignCenterH' | 'object.alignRight' | 'object.alignTop' | 'object.alignCenterV' | 'object.alignBottom',
  AlignMode
> = {
  'object.alignLeft': 'left',
  'object.alignCenterH': 'horizontalCenter',
  'object.alignRight': 'right',
  'object.alignTop': 'top',
  'object.alignCenterV': 'verticalCenter',
  'object.alignBottom': 'bottom',
}

/** Runs a planner's moves as one transaction, so an align or distribute is one undo entry. */
function applyMoves(moves: AlignMove[], label: string) {
  if (moves.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction(label)
  let changed = false
  for (const move of moves) {
    const result = documentStore.dispatch({ type: 'setTransform', nodeId: move.nodeId, transform: move.transform })
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

const ARRANGE_WHERE: Partial<Record<EditorActionId, ArrangeWhere>> = {
  'object.arrangeFront': 'front',
  'object.arrangeForward': 'forward',
  'object.arrangeBackward': 'backward',
  'object.arrangeBack': 'back',
}

/** Runs a Layers-panel drop; exported so the panel shares the planning with the store. */
export function runLayerDrop(rows: LayerRow[], dragging: NodeId[], targetRowId: NodeId, ratio: number) {
  const document = documentStore.getState().document
  runPlan(planDrop(document, rows, dragging, targetRowId, ratio), 'reorder layers')
}

/**
 * Places an image from picked or dropped bytes (issue #17): limits and decode first, then one
 * `placeImage` command that inserts the node and registers the asset together, so undo removes
 * both. Any failure is reported through the store's error path and leaves the document alone.
 */
export async function placeImage(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
  sourcePath?: string,
): Promise<NodeId | null> {
  const document = documentStore.getState().document
  const imported = await importImageBytes(name, mimeType, bytes, document.assets.length)
  if (!imported.ok) {
    documentStore.reportError(imported.code, imported.message)
    return null
  }
  const ref = sourcePath === undefined ? imported.asset.ref : { ...imported.asset.ref, sourcePath }
  const artboard = artboardRect(document, workspaceStore.getState().activeArtboardId) ?? document.artboards[0]
  const node = createImage(
    name,
    Math.max(0, (artboard.width - ref.width) / 2),
    Math.max(0, (artboard.height - ref.height) / 2),
    ref.id,
    ref.width,
    ref.height,
  )
  const result = documentStore.dispatch(
    {
      type: 'placeImage',
      parentId: document.root.id,
      index: document.root.children.length,
      node,
      asset: ref,
    },
    'place image',
  )
  if (!result.ok) {
    documentStore.reportError(result.code, result.message)
    return null
  }
  // The bytes are remembered only after the document accepted the asset, so a rejected import
  // cannot leave an orphan in memory.
  assetRegistry.put({ ref, bytes: imported.asset.bytes, name: imported.asset.name })
  documentStore.setSelection([node.id])
  return node.id
}

/**
 * Tool options (owner request after Phase 1).
 *
 * Illustrator's tool options edit the selection when the selection can take the change and otherwise
 * set what the *next* object will be drawn with. Both halves live here: the defaults are remembered
 * in the workspace store, and applying to a selection goes through the ordinary style and text
 * commands so it is undoable like any other edit.
 */

/** The member a shape tool's action id names. */
export function shapeKindForAction(id: EditorActionId): ShapeKind {
  switch (id) {
    case 'tool.rect':
      return 'rect'
    case 'tool.roundedRect':
      return 'roundedRect'
    case 'tool.ellipse':
      return 'ellipse'
    case 'tool.line':
      return 'line'
    case 'tool.polygon':
      return 'polygon'
    case 'tool.star':
      return 'star'
    case 'tool.arc':
      return 'arc'
    default:
      throw new Error(`${id} is not a shape tool`)
  }
}

/** The action that activates a shape member; the palette flyout and the bar both use it. */
export function shapeActionForKind(kind: ShapeKind): EditorActionId {
  switch (kind) {
    case 'rect':
      return 'tool.rect'
    case 'roundedRect':
      return 'tool.roundedRect'
    case 'ellipse':
      return 'tool.ellipse'
    case 'line':
      return 'tool.line'
    case 'polygon':
      return 'tool.polygon'
    case 'star':
      return 'tool.star'
    case 'arc':
      return 'tool.arc'
  }
}

function fillTargets(kind: 'shape' | 'text') {
  const document = documentStore.getState().document
  return documentStore
    .getState()
    .selection.map((id) => findNode(document, id))
    .filter(
      (node): node is ShapeNode | TextNode =>
        node !== null && supportsFill(node) && (kind === 'text' ? isText(node) : !isText(node)),
    )
}

/** Applies a fill to the selection when it has nodes that take one, as one history entry. */
function applyToolFill(kind: 'shape' | 'text', color: string): void {
  const targets = fillTargets(kind)
  if (targets.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction(kind === 'text' ? 'text color' : 'shape color')
  let changed = false
  for (const node of targets) {
    if (node === null || node.style.fill === color) continue
    const result = documentStore.dispatch(
      { type: 'setStyle', nodeId: node.id, style: { ...node.style, fill: color } },
      'apply fill',
    )
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/** Picks the shape member, which also activates it so the next drag draws that shape. */
export function setToolShapeMember(tool: ShapeKind): void {
  workspaceStore.setCreationDefaults({ shapeTool: tool })
  documentStore.setTool(tool)
}

/** A numeric or switch option from the shape row of the tool options bar. */
export function setToolShapeParam(patch: Partial<ShapeParams>): void {
  const current = workspaceStore.getState().creationDefaults.shape
  const next: ShapeParams = { ...current, ...patch }
  if (patch.sides !== undefined) next.sides = Math.max(3, Math.min(60, Math.round(patch.sides)))
  if (patch.points !== undefined) next.points = Math.max(3, Math.min(60, Math.round(patch.points)))
  if (patch.innerRadius !== undefined) next.innerRadius = Math.max(0.05, Math.min(0.95, patch.innerRadius))
  if (patch.cornerRadius !== undefined) next.cornerRadius = Math.max(0, patch.cornerRadius)
  if (patch.strokeWidth !== undefined) next.strokeWidth = Math.max(0.25, Math.min(100, patch.strokeWidth))
  if (patch.sweepAngle !== undefined) next.sweepAngle = Math.max(-360, Math.min(360, patch.sweepAngle))
  if (patch.sweepAngle === 0) next.sweepAngle = current.sweepAngle
  workspaceStore.setCreationDefaults({ shape: next })
}

export function setToolShapeFill(color: string): void {
  setToolShapeParam({ fill: color })
  applyToolFill('shape', color)
}

export function setToolTextFill(color: string): void {
  workspaceStore.setCreationDefaults({ textFill: color })
  applyToolFill('text', color)
}

/** Font size for the next text object, or for the selected one when text is selected. */
export function setToolTextSize(fontSize: number): void {
  if (!Number.isFinite(fontSize) || fontSize <= 0 || fontSize > 1000) return
  workspaceStore.setCreationDefaults({ textFontSize: fontSize })
  applyTextStyle(
    (node) => ({ ...node, fontSize, lineHeight: (node.lineHeight / node.fontSize) * fontSize }),
    'set font size',
  )
}

/**
 * Moves the selection by a scene delta — Illustrator's arrow-key nudge (Phase 2.2, issue #65).
 * Every selected object moves in one transaction, so a nudge is one undo entry, and a locked
 * object is refused by the command path rather than skipped silently.
 */
/**
 * Nudges every anchor Direct Selection picked, as one undo entry. With no anchor selection, or one
 * that no longer belongs to a path, this clears it rather than nudging the whole object.
 */
export function nudgeActiveAnchors(dx: number, dy: number): void {
  const selection = workspaceStore.getState().anchorSelection
  if (selection === null) return
  const node = findNode(documentStore.getState().document, selection.nodeId)
  if (node === null || node.type !== 'path' || selection.indices.some((index) => index < 0 || index >= node.anchors.length)) {
    workspaceStore.setAnchorSelection(null)
    return
  }
  let anchors = node.anchors.map((value) => ({ ...value }))
  for (const index of selection.indices) anchors = nudgedAnchor(anchors, index, dx, dy)
  documentStore.dispatch({ type: 'setPathAnchors', nodeId: node.id, anchors, closed: node.closed, fillRule: node.fillRule }, 'nudge anchor')
}

/** The selected single path and the anchors the white arrow picked, or null. */
function activePath(): { node: Extract<ReturnType<typeof findNode>, { type: 'path' }>; indices: number[] } | null {
  const { selection, document } = documentStore.getState()
  if (selection.length !== 1) return null
  const node = findNode(document, selection[0])
  if (node === null || node.type !== 'path') return null
  const picked = workspaceStore.getState().anchorSelection
  const indices = picked !== null && picked.nodeId === node.id ? picked.indices : [0]
  const valid = indices.filter((index) => Number.isInteger(index) && index >= 0 && index < node.anchors.length)
  if (valid.length === 0) return null
  return { node, indices: valid }
}

/** Adds a point on the segment after the first picked anchor, in one undo entry. */
export function addAnchorAtActive(): void {
  const target = activePath()
  if (target === null || target.node.anchors.length < 2) return
  documentStore.dispatch({ type: 'addPathAnchor', nodeId: target.node.id, index: Math.min(target.indices[0], target.node.anchors.length - 1), t: 0.5 }, 'add anchor')
}

/** Removes every picked anchor that the path can lose, in one undo entry. */
export function deleteActiveAnchor(): void {
  const target = activePath()
  if (target === null) return
  const minimum = target.node.closed ? 3 : 2
  const indices = [...target.indices].sort((left, right) => right - left)
  let anchors = target.node.anchors.map((value) => ({ ...value }))
  for (const index of indices) {
    if (anchors.length <= minimum) break
    anchors = anchors.filter((_, at) => at !== index)
  }
  if (anchors.length === target.node.anchors.length) return
  documentStore.dispatch({ type: 'setPathAnchors', nodeId: target.node.id, anchors, closed: target.node.closed, fillRule: target.node.fillRule }, 'delete anchor')
}

/** Converts every picked anchor to smooth or corner, in one undo entry. */
export function convertActiveAnchor(smooth: boolean): void {
  const target = activePath()
  if (target === null) return
  const count = target.node.anchors.length
  const anchors = target.node.anchors.map((anchor) => ({ ...anchor }))
  for (const index of target.indices) {
    const value = anchors[index]
    if (!smooth) {
      value.inX = 0
      value.inY = 0
      value.outX = 0
      value.outY = 0
      value.smooth = false
      continue
    }
    const previous = anchors[(index - 1 + count) % count]
    const next = anchors[(index + 1) % count]
    const dx = next.x - previous.x
    const dy = next.y - previous.y
    const length = Math.hypot(dx, dy)
    if (length === 0) continue
    const reach = Math.min(Math.hypot(value.x - previous.x, value.y - previous.y), Math.hypot(next.x - value.x, next.y - value.y)) / 3
    value.outX = (dx / length) * reach
    value.outY = (dy / length) * reach
    value.inX = -(dx / length) * reach
    value.inY = -(dy / length) * reach
    value.smooth = true
  }
  documentStore.dispatch({ type: 'setPathAnchors', nodeId: target.node.id, anchors, closed: target.node.closed, fillRule: target.node.fillRule }, smooth ? 'smooth anchors' : 'corner anchors')
}

/** Moves the picked anchors to their mean point, in one undo entry. */
export function averageActiveAnchors(): void {
  const target = activePath()
  if (target === null || target.indices.length < 2) return
  documentStore.dispatch({ type: 'averagePathAnchors', nodeId: target.node.id, indices: target.indices }, 'average anchors')
}

/** Joins two selected open paths at their nearest endpoints, in one undo entry. */
/** Applies a Pathfinder mode to the selection: one batched command, one undo entry. */
export function runPathfinder(mode: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'): void {
  pathfinderOn(documentStore.getState().selection, mode)
}

/**
 * Shape Builder: the crossed objects are divided into their faces, the faces the drag touched are
 * collected - united, or removed with Alt - and everything else survives as its own path. This is
 * region-based, with the faces coming from the same Divide engine the panel uses.
 */
/** Live Paint bucket: fills the divided face under a scene point, leaving the artwork underneath. */
export function paintRegionAt(point: Point): void {
  const { document } = documentStore.getState()
  const renderer = getActiveRenderer()
  if (renderer === null) return
  const shapes = buildScene(document).shapes.filter(
    (shape) =>
      shape.kind !== 'line' &&
      point.x >= shape.x &&
      point.x <= shape.x + shape.width * shape.scaleX &&
      point.y >= shape.y &&
      point.y <= shape.y + shape.height * shape.scaleY,
  )
  if (shapes.length === 0) return
  const face = renderer.regionAt(shapes, point)
  if (face === null) return
  const anchors = face.map((vertex) => cornerAnchor(vertex.x, vertex.y))
  const bounds = pathBounds(anchors, true)
  const defaults = workspaceStore.getState().creationDefaults
  const existing = document.root.children.filter((node) => node.name.startsWith('Live Paint')).length
  const node = createPath(`Live Paint ${existing + 1}`, bounds.x, bounds.y, anchors, { closed: true, fill: defaults.shape.fill })
  const result = documentStore.dispatch(
    { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes: [node] },
    'live paint',
  )
  if (result.ok) documentStore.setSelection([node.id])
}

export function shapeBuilder(ids: NodeId[], subtract: boolean, path: Point[], tolerance: number): void {
  const { document } = documentStore.getState()
  const renderer = getActiveRenderer()
  if (renderer === null || ids.length < 1 || path.length === 0) return
  const scene = buildScene(document)
  const shapes = scene.shapes.filter((shape) => ids.includes(shape.id))
  if (shapes.length < 1) return
  const faces = renderer.divideShapes(shapes)
  if (faces.length === 0) return
  const touched = faces.filter((face) => polygonTouchesPath(face, path, tolerance))
  if (touched.length === 0) return
  const rest = faces.filter((face) => !touched.includes(face))
  const polygons = subtract ? rest : [...renderer.unitePolygons(touched), ...rest]
  if (polygons.length === 0) return
  const nodes = polygons.map((polygon, index) => {
    const anchors = polygon.map((point) => cornerAnchor(point.x, point.y))
    const bounds = pathBounds(anchors, true)
    return createPath(`Shape Builder ${index + 1}`, bounds.x, bounds.y, anchors, { closed: true, fill: shapes[0].fill })
  })
  const result = documentStore.dispatch(
    batchCommand([
      { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes },
      { type: 'removeNodes', nodeIds: ids },
    ]),
    'shape builder',
  )
  if (result.ok) documentStore.setSelection(nodes.map((node) => node.id))
}

function pathfinderOn(targetIds: NodeId[], mode: 'unite' | 'intersect' | 'subtract' | 'exclude' | 'divide'): void {
  const { document } = documentStore.getState()
  const renderer = getActiveRenderer()
  if (renderer === null || targetIds.length < 2) return
  const scene = buildScene(document)
  const shapes = scene.shapes.filter((shape) => targetIds.includes(shape.id))
  if (shapes.length < 2) return
  // Boolean modes keep their curves: the renderer builds scene-space Skia paths and reads back cubics.
  // Divide still works on flattened faces, because it needs a finite set of polygons to trim.
  const nodes =
    mode === 'divide'
      ? renderer.divideShapes(shapes).map((polygon, index) => {
          const anchors = polygon.map((point) => cornerAnchor(point.x, point.y))
          const bounds = pathBounds(anchors, true)
          return createPath(`Pathfinder ${index + 1}`, bounds.x, bounds.y, anchors, { closed: true, fill: shapes[0].fill })
        })
      : (() => {
          const contours = renderer.booleanShapesCurved(shapes, mode)
          const groups = nestPolygonIndices(contours.map((contour) => contour.map((anchor) => ({ x: anchor.x, y: anchor.y }))))
          return groups.map((group, index) => {
            const anchors = contours[group.outer]
            const subpaths = group.holes.map((hole) => contours[hole])
            const bounds = pathBounds(anchors, true)
            return createPath(`Pathfinder ${index + 1}`, bounds.x, bounds.y, anchors, {
              closed: true,
              fillRule: subpaths.length > 0 ? 'evenodd' : 'nonzero',
              fill: shapes[0].fill,
              subpaths,
            })
          })
        })()
  if (nodes.length === 0) return
  const result = documentStore.dispatch(
    batchCommand([
      { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes },
      { type: 'removeNodes', nodeIds: targetIds },
    ]),
    'pathfinder',
  )
  if (result.ok) documentStore.setSelection(nodes.map((node) => node.id))
}

/** Simplify: the selected path keeps its shape but loses redundant anchors. */
export function simplifySelectedPath(): void {
  const { selection } = documentStore.getState()
  if (selection.length !== 1) return
  documentStore.dispatch({ type: 'simplifyPath', nodeId: selection[0], tolerance: 1 }, 'simplify path')
}

/** Outline Stroke: an open shape's stroke becomes a filled path, one undo entry (Phase 5.6). */
export function outlineStrokeSelection(): void {
  const { document, selection } = documentStore.getState()
  const renderer = getActiveRenderer()
  if (renderer === null || selection.length === 0) return
  const shapes = buildScene(document).shapes.filter((shape) => selection.includes(shape.id))
  const nodes: ReturnType<typeof createPath>[] = []
  const removed: string[] = []
  for (const shape of shapes) {
    const outline = renderer.outlineStrokeForShape(shape)
    if (outline === null || shape.stroke === null) continue
    const anchors = outline.map((point) => cornerAnchor(point.x, point.y))
    const bounds = pathBounds(anchors, true)
    const existing = document.root.children.filter((node) => node.name.startsWith('Outline')).length
    nodes.push(createPath(`Outline ${existing + 1}`, bounds.x, bounds.y, anchors, { closed: true, fill: shape.stroke.color }))
    removed.push(shape.id)
  }
  if (nodes.length === 0) return
  const result = documentStore.dispatch(
    batchCommand([
      { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes },
      { type: 'removeNodes', nodeIds: removed },
    ]),
    'outline stroke',
  )
  if (result.ok) documentStore.setSelection(nodes.map((node) => node.id))
}

/** Compound Path: the selected leaves become one path with holes, one undo entry (Phase 5.6). */
export function makeCompoundPath(): void {
  const { document, selection } = documentStore.getState()
  const renderer = getActiveRenderer()
  if (renderer === null || selection.length < 2) return
  const shapes = buildScene(document).shapes.filter((shape) => selection.includes(shape.id))
  const contours: Array<Array<{ x: number; y: number }>> = []
  for (const shape of shapes) {
    const outline = renderer.outlineFillForShape(shape)
    if (outline !== null && outline.length >= 3) contours.push(outline)
  }
  if (contours.length < 2) return
  const anchors = contours[0].map((point) => cornerAnchor(point.x, point.y))
  const subpaths = contours.slice(1).map((contour) => contour.map((point) => cornerAnchor(point.x, point.y)))
  const bounds = pathBounds(anchors, true)
  const existing = document.root.children.filter((node) => node.name.startsWith('Compound')).length
  const node = createPath(`Compound ${existing + 1}`, bounds.x, bounds.y, anchors, {
    closed: true,
    fillRule: 'evenodd',
    fill: shapes[0].fill,
    subpaths,
  })
  const result = documentStore.dispatch(
    batchCommand([
      { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes: [node] },
      { type: 'removeNodes', nodeIds: selection },
    ]),
    'make compound path',
  )
  if (result.ok) documentStore.setSelection([node.id])
}

/** Release Compound Path: every contour becomes its own path, one undo entry. */
export function releaseCompoundPath(): void {
  const { document, selection } = documentStore.getState()
  if (selection.length !== 1) return
  const node = findNode(document, selection[0])
  if (node === null || node.type !== 'path' || node.subpaths === undefined || node.subpaths.length === 0) return
  const contours = [node.anchors, ...node.subpaths]
  const nodes = contours.map((contour, index) => {
    const bounds = pathBounds(contour, true)
    return createPath(`Released ${index + 1}`, bounds.x, bounds.y, contour, { closed: true, fill: node.style.fill })
  })
  const result = documentStore.dispatch(
    batchCommand([
      { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes },
      { type: 'removeNodes', nodeIds: [node.id] },
    ]),
    'release compound path',
  )
  if (result.ok) documentStore.setSelection(nodes.map((entry) => entry.id))
}

export function joinSelectedPaths(): void {
  const { selection } = documentStore.getState()
  if (selection.length !== 2) return
  documentStore.dispatch({ type: 'joinPaths', firstId: selection[0], secondId: selection[1] }, 'join paths')
}

export function nudgeSelection(dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
  const { document, selection } = documentStore.getState()
  const targets = selection
    .map((id) => findNode(document, id))
    .filter((node): node is LayerNode => node !== null)
  if (targets.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction('nudge')
  let changed = false
  for (const node of targets) {
    const result = documentStore.dispatch({
      type: 'setTransform',
      nodeId: node.id,
      transform: nudgedTransform(node.transform, dx, dy),
    })
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/**
 * Sets the selection's world box, which is what the Properties panel's X/Y/W/H fields edit
 * (Phase 2.2). Position is a move; size is a scale about the top-left corner, so the arithmetic
 * lives in the transform planner rather than in the panel.
 */
/** Sets the selection's rotation in degrees, normalised to 0..360 (issue #120). */
export function setSelectionRotation(degrees: number): void {
  if (!Number.isFinite(degrees)) return
  const rotation = normaliseAngle(degrees)
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction('rotate')
  const state = documentStore.getState()
  for (const id of state.selection) {
    const node = findNode(state.document, id)
    if (node === null || node.locked) continue
    documentStore.dispatch({ type: 'setTransform', nodeId: id, transform: { ...node.transform, rotation } }, 'rotate')
  }
  if (own) documentStore.commitTransaction()
}

export function setSelectionBounds(patch: { x?: number; y?: number; width?: number; height?: number }): void {
  const { document, selection } = documentStore.getState()
  const box = unionBounds(document, selection)
  if (box === null) return
  const targets = selection
    .map((id) => findNode(document, id))
    .filter((node): node is LayerNode => node !== null)
  if (targets.length === 0) return

  const dx = patch.x !== undefined && Number.isFinite(patch.x) ? patch.x - box.x : 0
  const dy = patch.y !== undefined && Number.isFinite(patch.y) ? patch.y - box.y : 0
  const sx =
    patch.width !== undefined && Number.isFinite(patch.width) && patch.width > 0 && box.width > 0
      ? patch.width / box.width
      : 1
  const sy =
    patch.height !== undefined && Number.isFinite(patch.height) && patch.height > 0 && box.height > 0
      ? patch.height / box.height
      : 1
  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) return

  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction('transform selection')
  let changed = false
  for (const node of targets) {
    const next =
      sx === 1 && sy === 1
        ? { ...node.transform, x: node.transform.x + dx, y: node.transform.y + dy }
        : { ...node.transform, ...scaledTransform(node.transform, { x: box.x + dx, y: box.y + dy }, sx, sy) }
    const result = documentStore.dispatch({ type: 'setTransform', nodeId: node.id, transform: next })
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/** Alignment for the next text object, or for the selected text. */
export function setToolTextAlign(align: 'left' | 'center' | 'right'): void {
  workspaceStore.setCreationDefaults({ textAlign: align })
  applyTextStyle((node) => ({ ...node, align }), 'align text')
}

/**
 * The selected rectangle's corner radius (Phase 2.1, issue #64).
 *
 * The typed value is clamped to half the shorter side, which is what Illustrator does when you drag
 * a live corner past the middle, and the change goes through `setCornerRadius` so it is one undo
 * step. A selection that cannot take the edit — an ellipse, several objects, nothing — is left
 * alone rather than reported as a failure, because the control is not offered for those.
 */
export function setSelectionCornerRadius(radius: number): void {
  if (!Number.isFinite(radius)) return
  const { document, selection } = documentStore.getState()
  if (selection.length !== 1) return
  const node = findNode(document, selection[0])
  if (node === null || node.type !== 'rect') return
  const clamped = Math.max(0, Math.min(radius, Math.min(node.width, node.height) / 2))
  if (clamped === node.cornerRadius) return
  documentStore.dispatch({ type: 'setCornerRadius', nodeId: node.id, cornerRadius: clamped }, 'corner radius')
}

/** Opens the platform file dialog and places whatever the user picks. */
export async function placeImageFromDialog(linked = false): Promise<void> {
  const picked = await pickImageFile()
  if (picked === null) return
  await placeImage(picked.name, picked.mimeType, picked.bytes, linked ? picked.sourcePath : undefined)
}

/** Replaces a selected image with a newly chosen external file in one undo step. */
export async function relinkImageFromDialog(nodeId: NodeId): Promise<void> {
  const picked = await pickImageFile()
  if (picked === null) return
  const document = documentStore.getState().document
  const imported = await importImageBytes(picked.name, picked.mimeType, picked.bytes, document.assets.length)
  if (!imported.ok) {
    documentStore.reportError(imported.code, imported.message)
    return
  }
  const ref = { ...imported.asset.ref, sourcePath: picked.sourcePath }
  const exists = document.assets.some((asset) => asset.id === ref.id)
  const result = documentStore.dispatch(
    exists
      ? { type: 'setImageAsset', nodeId, assetId: ref.id, width: ref.width, height: ref.height }
      : { type: 'batch', commands: [
          { type: 'addAsset', asset: ref },
          { type: 'setImageAsset', nodeId, assetId: ref.id, width: ref.width, height: ref.height },
        ] },
    'relink image',
  )
  if (!result.ok) {
    documentStore.reportError(result.code, result.message)
    return
  }
  assetRegistry.put({ ref, bytes: imported.asset.bytes, name: imported.asset.name })
}

/** Adds a picked raster asset as the selected image's alpha mask in one undo step. */
export async function setImageMaskFromDialog(nodeId: NodeId): Promise<void> {
  const picked = await pickImageFile()
  if (picked === null) return
  const document = documentStore.getState().document
  const imported = await importImageBytes(picked.name, picked.mimeType, picked.bytes, document.assets.length)
  if (!imported.ok) {
    documentStore.reportError(imported.code, imported.message)
    return
  }
  const ref = imported.asset.ref
  const exists = document.assets.some((asset) => asset.id === ref.id)
  const result = documentStore.dispatch(
    exists
      ? { type: 'setImageMask', nodeId, maskAssetId: ref.id }
      : { type: 'batch', commands: [
          { type: 'addAsset', asset: ref },
          { type: 'setImageMask', nodeId, maskAssetId: ref.id },
        ] },
    'set image mask',
  )
  if (!result.ok) {
    documentStore.reportError(result.code, result.message)
    return
  }
  assetRegistry.put({ ref, bytes: imported.asset.bytes, name: imported.asset.name })
}

/**
 * Deletes the unlocked nodes in the selection. A locked layer is skipped rather than making the
 * whole delete fail, which is the same policy the context menu uses; returns how many went.
 */
export function deleteUnlockedSelection(): number {
  const document = documentStore.getState().document
  const removable = documentStore.getState().selection.filter((id) => !isLocked(document, id))
  if (removable.length === 0) return 0
  const result = documentStore.dispatch({ type: 'removeNodes', nodeIds: removable }, 'delete')
  if (!result.ok) return 0
  documentStore.clearSelection()
  return removable.length
}

/** Whether an action can do anything right now; menus disable what cannot run. */
export function canRunAction(id: EditorActionId, editor: EditorState): boolean {
  switch (id) {
    case 'edit.undo':
      return editor.canUndo
    case 'edit.redo':
      return editor.canRedo
    case 'edit.clear':
    case 'object.hideSelection':
    case 'object.lockSelection':
      return editor.selection.length > 0
    case 'object.showAll':
      return anyNode((node) => node.hidden)
    case 'object.unlockAll':
      return anyNode((node) => node.locked)
    case 'object.compoundMake': {
    const leaves = editor.selection
      .map((id) => findNode(editor.document, id))
      .filter((node) => node !== null && node.type !== 'group' && node.type !== 'image' && node.type !== 'text')
    return leaves.length >= 2
  }
  case 'object.compoundRelease': {
    const node = editor.selection.length === 1 ? findNode(editor.document, editor.selection[0]) : null
    return node !== null && node.type === 'path' && (node.subpaths?.length ?? 0) > 0
  }
  case 'path.outlineStroke':
    return editor.selection.some((id) => {
      const node = findNode(editor.document, id)
      if (node === null || node.type === 'group' || node.type === 'image' || node.type === 'text') return false
      const stroke = node.style.stroke
      const open = node.type === 'line' || (node.type === 'path' && !node.closed)
      return open && stroke !== null && stroke.width > 0
    })
  case 'file.recover':
      // Illustrator-style: the command is only available when there is something to recover.
      return editor.recovery.available
    case 'file.save':
    case 'file.saveAs':
    case 'file.new':
    case 'file.open':
    case 'file.place':
    case 'file.placeLinked':
      return true
    case 'object.group':
      return planGroup(editor.document, editor.selection) !== null
    case 'object.ungroup':
      return planUngroup(editor.document, editor.selection) !== null
    case 'object.duplicate':
      return planDuplicate(editor.document, editor.selection) !== null
    case 'layer.new':
      return true
    case 'type.sizeUp':
    case 'type.sizeDown':
    case 'type.alignLeft':
    case 'type.alignCenter':
    case 'type.alignRight':
      // Illustrator greys the Type commands out until text is selected.
      return editor.selection.some((id) => {
        const node = findNode(editor.document, id)
        return node !== null && isText(node)
      })
    case 'object.arrangeFront':
    case 'object.arrangeForward':
    case 'object.arrangeBackward':
    case 'object.arrangeBack': {
      const where = ARRANGE_WHERE[id]
      return where !== undefined && planArrange(editor.document, editor.selection, where).length > 0
    }
    default:
      return true
  }
}

/** Applies a stroke colour and weight to the selected shapes and text as one undo entry (PAINT-01). */
export function setSelectionStroke(patch: { color?: string; width?: number; cap?: StrokeCap; join?: StrokeJoin; dash?: number[] }): void {
  applySelectionStyle((node) => {
    const current = node.style.stroke ?? { color: node.style.fill, width: 1 }
    const width = patch.width === undefined ? current.width : Math.max(0, Math.min(100, patch.width))
    if (width === 0) return { ...node.style, stroke: null }
    const stroke: NonNullable<typeof current> = { color: patch.color ?? current.color, width }
    const cap = patch.cap ?? current.cap
    const join = patch.join ?? current.join
    if (cap !== undefined) stroke.cap = cap
    if (join !== undefined) stroke.join = join
    const dash = patch.dash ?? current.dash
    if (dash !== undefined && dash.length > 0) stroke.dash = dash
    if (patch.dash !== undefined && patch.dash.length === 0) delete stroke.dash
    return { ...node.style, stroke }
  }, 'stroke')
}

/**
 * A two-stop linear gradient across the node's box, from an angle in degrees (issue #70). Angles
 * are measured the way Illustrator's gradient tool reports them: 0 runs left to right, 90 runs
 * bottom to top.
 */
export function linearGradientFrom(angleDegrees: number, fromColor: string, toColor: string): FillGradient {
  const radians = (Math.max(-360, Math.min(360, angleDegrees)) * Math.PI) / 180
  const dx = Math.cos(radians) / 2
  const dy = Math.sin(radians) / 2
  return {
    type: 'linear',
    stops: [
      { offset: 0, color: fromColor },
      { offset: 1, color: toColor },
    ],
    // Scene y grows downward, so the vertical component is flipped: 90 degrees runs bottom to top.
    from: { x: 0.5 - dx, y: 0.5 + dy },
    to: { x: 0.5 + dx, y: 0.5 - dy },
  }
}

/** The angle a stored gradient runs at, so the panel can show and re-apply it (issue #70). */
export function gradientAngle(gradient: FillGradient): number {
  const dx = gradient.to.x - gradient.from.x
  const dy = gradient.to.y - gradient.from.y
  if (dx === 0 && dy === 0) return 90
  // The y flip matches linearGradientFrom: scene y grows downward, 90 degrees runs bottom to top.
  const degrees = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI)
  return Object.is(degrees, -0) ? 0 : degrees
}

/** Applies or removes a gradient fill on the selection, one undo entry. */
export function setSelectionGradient(gradient: FillGradient | null): void {
  applySelectionStyle((node) => ({ ...node.style, gradient }), 'gradient')
}

/** Sets how the selection's fill composites, as one undo entry (issue #71). */
export function setSelectionBlendMode(mode: BlendMode): void {
  applySelectionStyle((node) => ({ ...node.style, blendMode: mode }), 'blend mode')
}

/** Chooses whether the gradient paints the fill, the stroke, or both (issue #70). */
export function setSelectionGradientTarget(target: 'fill' | 'stroke' | 'both'): void {
  applySelectionStyle((node) => ({ ...node.style, gradientTarget: target }), 'gradient target')
}

/** Switches a gradient between linear and radial, keeping its stops and endpoints. */
export function setSelectionGradientType(type: 'linear' | 'radial'): void {
  applySelectionStyle((node) => {
    const gradient = node.style.gradient ?? null
    if (gradient === null) return node.style
    return { ...node.style, gradient: { ...gradient, type } }
  }, 'gradient type')
}

/** Appends a stop at an offset; validation refuses more than eight. */
export function addGradientStop(offset: number, color: string): void {
  applySelectionStyle((node) => {
    const gradient = node.style.gradient ?? null
    if (gradient === null) return node.style
    const stops = [...gradient.stops, { offset: Math.max(0, Math.min(1, offset)), color }].sort((left, right) => left.offset - right.offset)
    return { ...node.style, gradient: { ...gradient, stops } }
  }, 'add gradient stop')
}

/** Removes a stop; the last two are kept, because one stop is not a gradient. */
export function removeGradientStop(index: number): void {
  applySelectionStyle((node) => {
    const gradient = node.style.gradient ?? null
    if (gradient === null || gradient.stops.length <= 2) return node.style
    return { ...node.style, gradient: { ...gradient, stops: gradient.stops.filter((_, at) => at !== index) } }
  }, 'remove gradient stop')
}

/** Edits one stop's colour or offset. */
export function setGradientStop(index: number, patch: { offset?: number; color?: string }): void {
  applySelectionStyle((node) => {
    const gradient = node.style.gradient ?? null
    if (gradient === null) return node.style
    const stops = gradient.stops.map((stop, at) => {
      if (at !== index) return stop
      const offset = patch.offset === undefined ? stop.offset : Math.max(0, Math.min(1, patch.offset))
      return { offset, color: patch.color ?? stop.color }
    })
    return { ...node.style, gradient: { ...gradient, stops: stops.sort((left, right) => left.offset - right.offset) } }
  }, 'gradient stop')
}

/** Sets the selection's opacity (0–1) as one undo entry; the renderer already applies it. */
export function setSelectionOpacity(opacity: number): void {
  if (!Number.isFinite(opacity)) return
  const clamped = Math.max(0, Math.min(1, opacity))
  applySelectionStyle((node) => ({ ...node.style, opacity: clamped }), 'opacity')
}

/** Applies a fill colour to the selected shapes and text as one undo entry. */
export function setSelectionFill(color: string): void {
  applySelectionStyle((node) => ({ ...node.style, fill: color }), 'fill')
}

/**
 * One style transaction for the whole selection: a fill or stroke edit on several objects is one
 * history entry, and a locked object is refused by the command rather than skipped silently.
 */
function applySelectionStyle(next: (node: StyledNode) => Style, label: string): void {
  const { document, selection } = documentStore.getState()
  const targets = selection
    .map((id) => findNode(document, id))
    .filter((node): node is StyledNode => node !== null && node.type !== 'group')
  if (targets.length === 0) return
  const own = !documentStore.inTransaction()
  if (own) documentStore.beginTransaction(label)
  let changed = false
  for (const node of targets) {
    const result = documentStore.dispatch({ type: 'setStyle', nodeId: node.id, style: next(node) })
    if (result.ok) changed = true
  }
  if (!own) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/** Makes an artboard the active page (session state, never persisted). */
export function setActiveArtboard(artboardId: string): void {
  workspaceStore.setActiveArtboard(artboardId)
}

/** Resizes the active page through the validated command, one undo entry per commit. */
export function setActiveArtboardSize(patch: { width?: number; height?: number }): void {
  const document = documentStore.getState().document
  const active = artboardRect(document, workspaceStore.getState().activeArtboardId)
  if (active === null) return
  documentStore.dispatch({ type: 'setArtboard', artboardId: active.id, ...patch }, 'resize artboard')
}

/** The pages a panel lists, with the active one marked. */
export function artboardList(): Array<{ id: string; name: string; width: number; height: number; active: boolean }> {
  const document = documentStore.getState().document
  const active = artboardRect(document, workspaceStore.getState().activeArtboardId)
  return artboardRects(document).map((rect) => ({
    id: rect.id,
    name: rect.name,
    width: rect.width,
    height: rect.height,
    active: rect.id === active?.id,
  }))
}

/** Sets the stroke alignment of the selection (issue #69), one undo entry. */
export function setSelectionStrokeAlign(align: 'center' | 'inside' | 'outside'): void {
  applySelectionStyle((node) => {
    const current = node.style.stroke ?? { color: node.style.fill, width: 1 }
    return { ...node.style, stroke: { ...current, align } }
  }, 'stroke alignment')
}

/** Saves the selection's fill as a named swatch, with its CMYK equivalent recorded (issue #69). */
export function addSwatchFromSelection(name: string): string | null {
  const { document, selection } = documentStore.getState()
  const node = selection.length === 0 ? null : findNode(document, selection[0])
  const color = node !== null && node.type !== 'group' ? node.style.fill : '#7c6cf5'
  return addSwatch(name, color)
}

/** Adds a named swatch from an explicit colour, converting it to CMYK for the record. */
export function addSwatch(name: string, color: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return null
  const swatch = {
    id: 'swatch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    name: trimmed,
    color,
    cmyk: hexToCmyk(color) ?? undefined,
  }
  const result = documentStore.dispatch({ type: 'addSwatch', swatch }, 'add swatch')
  return result.ok ? swatch.id : null
}

/** Adds a swatch defined in CMYK; the stored colour is the naive conversion used for display. */
export function addCmykSwatch(name: string, cmyk: { c: number; m: number; y: number; k: number }, spot = false): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return null
  const swatch = {
    id: 'swatch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    name: trimmed,
    color: cmykToHex(cmyk),
    cmyk,
    spot,
  }
  const result = documentStore.dispatch({ type: 'addSwatch', swatch }, 'add swatch')
  return result.ok ? swatch.id : null
}

/** Applies a named swatch's colour to the selection as its fill, one undo entry. */
export function applySwatch(swatchId: string): void {
  const swatch = (documentStore.getState().document.swatches ?? []).find((candidate) => candidate.id === swatchId)
  if (swatch === undefined) return
  applySelectionStyle((node) => ({ ...node.style, fill: swatch.color }), 'apply swatch')
}

/** Removes a named swatch; nodes already filled with it keep their colour. */
export function removeSwatch(swatchId: string): void {
  documentStore.dispatch({ type: 'removeSwatch', swatchId }, 'remove swatch')
}

/** Places a guide at a scene position (issue #67). Dragging from a ruler calls this. */
export function addGuide(axis: 'x' | 'y', position: number): string | null {
  if (!Number.isFinite(position)) return null
  const guide = {
    id: 'guide-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    axis,
    position: Math.round(position),
  }
  const result = documentStore.dispatch({ type: 'addGuide', guide }, 'add guide')
  return result.ok ? guide.id : null
}

/** Moves an existing guide; call inside a live session so a drag is one entry. */
export function moveGuide(guideId: string, position: number): void {
  if (!Number.isFinite(position)) return
  documentStore.dispatch({ type: 'setGuide', guideId, position: Math.round(position) }, 'move guide')
}

/** Removes one guide. */
export function removeGuide(guideId: string): void {
  documentStore.dispatch({ type: 'removeGuide', guideId }, 'remove guide')
}

/** Runs one action. Components reach the stores through this table and nowhere else. */
export function runEditorAction(id: EditorActionId): void {
  const editor = documentStore.getState()
  const workspace = workspaceStore.getState()
  switch (id) {
    case 'tool.select':
      documentStore.setTool('select')
      return
    case 'tool.directSelect':
      documentStore.setTool('directSelect')
      return
    case 'tool.lasso':
      documentStore.setTool('lasso')
      return
    case 'tool.pen':
      documentStore.setTool('pen')
      return
    case 'tool.shapeBuilder':
      documentStore.setTool('shapeBuilder')
      return
    case 'tool.livePaint':
      documentStore.setTool('livePaint')
      return
    case 'tool.rect':
    case 'tool.roundedRect':
    case 'tool.ellipse':
    case 'tool.line':
    case 'tool.polygon':
    case 'tool.star':
    case 'tool.arc':
      // Picking a shape member anywhere — palette, flyout, options bar, or its shortcut — also
      // remembers it, so the palette's shape slot shows the tool last used the way Illustrator's
      // does. The action id and the member's name differ only for the rounded rectangle.
      setToolShapeMember(shapeKindForAction(id))
      return
    case 'tool.hand':
      documentStore.setTool('hand')
      return
    case 'tool.zoom':
      documentStore.setTool('zoom')
      return
    case 'tool.text':
      documentStore.setTool('text')
      return
    case 'path.addAnchor':
      addAnchorAtActive()
      return
    case 'path.deleteAnchor':
      deleteActiveAnchor()
      return
    case 'path.convertSmooth':
      convertActiveAnchor(true)
      return
    case 'path.convertCorner':
      convertActiveAnchor(false)
      return
    case 'path.join':
      joinSelectedPaths()
      return
    case 'path.average':
      averageActiveAnchors()
      return
    case 'path.simplify':
      simplifySelectedPath()
      return
    case 'path.outlineStroke':
      outlineStrokeSelection()
      return
    case 'object.compoundMake':
      makeCompoundPath()
      return
    case 'object.compoundRelease':
      releaseCompoundPath()
      return
    case 'path.unite':
      runPathfinder('unite')
      return
    case 'path.intersect':
      runPathfinder('intersect')
      return
    case 'path.subtract':
      runPathfinder('subtract')
      return
    case 'path.exclude':
      runPathfinder('exclude')
      return
    case 'path.divide':
      runPathfinder('divide')
      return
    case 'artboard.new': {
      const document = documentStore.getState().document
      const first = document.artboards[0]
      const artboard = { id: newArtboardId(), name: 'Artboard ' + (document.artboards.length + 1), width: first.width, height: first.height }
      const result = documentStore.dispatch({ type: 'addArtboard', artboard, index: document.artboards.length }, 'new artboard')
      if (result.ok) workspaceStore.setActiveArtboard(artboard.id)
      return
    }
    case 'artboard.delete': {
      const document = documentStore.getState().document
      const active = artboardRect(document, workspaceStore.getState().activeArtboardId)
      if (active === null) return
      const result = documentStore.dispatch({ type: 'removeArtboard', artboardId: active.id }, 'delete artboard')
      if (result.ok) workspaceStore.setActiveArtboard(null)
      return
    }
    case 'file.place':
      // Importing is asynchronous (dialog, decode, hashing); failures surface through the
      // store's error path, which the canvas already renders.
      void placeImageFromDialog()
      return
    case 'file.placeLinked':
      void placeImageFromDialog(true)
      return
    case 'file.new':
      requestNewDocument()
      return
    case 'file.open':
      requestOpenDocument()
      return
    case 'file.save':
      void saveDocument()
      return
    case 'file.saveAs':
      void saveDocument({ askForPath: true })
      return
    case 'file.recover':
      void recoverDocument()
      return
    case 'type.sizeUp':
      applyTextStyle((node) => ({ ...node, fontSize: nextFontSize(node.fontSize, 1) }), 'increase size')
      return
    case 'type.sizeDown':
      applyTextStyle((node) => ({ ...node, fontSize: nextFontSize(node.fontSize, -1) }), 'decrease size')
      return
    case 'type.alignLeft':
      applyTextStyle((node) => ({ ...node, align: 'left' }), 'align left')
      return
    case 'type.alignCenter':
      applyTextStyle((node) => ({ ...node, align: 'center' }), 'align center')
      return
    case 'type.alignRight':
      applyTextStyle((node) => ({ ...node, align: 'right' }), 'align right')
      return
    case 'edit.undo':
      documentStore.undo()
      return
    case 'edit.redo':
      documentStore.redo()
      return
    case 'edit.clear': {
      const selection = selectedIds()
      if (selection.length === 0) return
      documentStore.dispatch({ type: 'removeNodes', nodeIds: selection }, 'delete')
      documentStore.clearSelection()
      return
    }
    case 'select.all':
      documentStore.selectAll()
      return
    case 'select.deselect':
      documentStore.clearSelection()
      documentStore.clearError()
      return
    case 'object.hideSelection':
      applyFlags(selectedIds(), (node) => (node.hidden ? null : { locked: node.locked, hidden: true }), 'hide selection')
      return
    case 'object.lockSelection':
      applyFlags(selectedIds(), (node) => (node.locked ? null : { locked: true, hidden: node.hidden }), 'lock selection')
      return
    case 'object.showAll':
      applyFlags(allNodeIds(), (node) => (node.hidden ? { locked: node.locked, hidden: false } : null), 'show all')
      return
    case 'object.unlockAll':
      applyFlags(allNodeIds(), (node) => (node.locked ? { locked: false, hidden: node.hidden } : null), 'unlock all')
      return
    case 'object.group': {
      const selection = selectedIds()
      const plan = planGroup(editor.document, selection)
      if (plan === null) return
      const created = plan[0]
      runPlan(plan, 'group')
      // Illustrator leaves the new group selected, which is what makes a following Ungroup
      // and the Arrange commands act on it.
      if (created.kind === 'insert' && created.nodes.length > 0 && documentStore.getState().document.root !== null) {
        documentStore.setSelection([created.nodes[0].id])
      }
      return
    }
    case 'object.ungroup': {
      const plan = planUngroup(editor.document, selectedIds())
      if (plan === null) return
      const released = plan.filter((step) => step.kind === 'move').map((step) => step.nodeId)
      runPlan(plan, 'ungroup')
      if (released.length > 0) documentStore.setSelection(released)
      return
    }
    case 'object.duplicate': {
      const plan = planDuplicate(editor.document, selectedIds())
      if (plan === null) return
      const created = duplicatedIds(plan)
      runPlan(plan, 'duplicate')
      // Illustrator leaves the copies selected, so dragging right after duplicating moves them.
      if (created.length > 0) documentStore.setSelection(created)
      return
    }
    case 'edit.copy': {
      const copied = copyToClipboard(editor.document, selectedIds())
      if (copied === 0) documentStore.reportError('absent-node', 'Nothing to copy.')
      return
    }
    case 'edit.cut': {
      const copied = copyToClipboard(editor.document, selectedIds())
      if (copied > 0) deleteUnlockedSelection()
      return
    }
    case 'edit.paste': {
      const nodes = pastedNodes()
      if (nodes.length === 0) return
      const document = documentStore.getState().document
      const result = documentStore.dispatch(
        {
          type: 'insertNodes',
          parentId: document.root.id,
          index: document.root.children.length,
          nodes,
        },
        'paste',
      )
      if (result.ok) documentStore.setSelection(nodes.map((node) => node.id))
      return
    }
    case 'object.alignLeft':
    case 'object.alignCenterH':
    case 'object.alignRight':
    case 'object.alignTop':
    case 'object.alignCenterV':
    case 'object.alignBottom':
      applyMoves(planAlign(editor.document, selectedIds(), ALIGN_MODE[id]), 'align')
      return
    case 'object.distributeH':
    case 'object.distributeV':
      applyMoves(
        planDistribute(editor.document, selectedIds(), id === 'object.distributeH' ? 'horizontal' : 'vertical'),
        'distribute',
      )
      return
    case 'layer.new': {
      const document = documentStore.getState().document
      const layer = createGroup(`Layer ${document.root.children.length + 1}`)
      runPlan(
        [{ kind: 'insert', parentId: document.root.id, index: document.root.children.length, nodes: [layer] }],
        'new layer',
      )
      documentStore.setSelection([layer.id])
      return
    }
    case 'object.arrangeFront':
    case 'object.arrangeForward':
    case 'object.arrangeBackward':
    case 'object.arrangeBack': {
      const where = ARRANGE_WHERE[id]
      if (where === undefined) return
      runPlan(planArrange(editor.document, selectedIds(), where), `arrange: ${where}`)
      return
    }
    case 'view.zoomIn':
      documentStore.setViewport(zoomByStep(editor.viewport, 1, workspace.canvas))
      return
    case 'view.zoomOut':
      documentStore.setViewport(zoomByStep(editor.viewport, -1, workspace.canvas))
      return
    case 'view.fitArtboard':
      documentStore.setViewport(fitRect(artboardRect(editor.document, workspace.activeArtboardId) ?? artboardRects(editor.document)[0], workspace.canvas))
      return
    case 'view.rulers':
      workspaceStore.setViewChrome({ showRulers: !workspace.showRulers })
      return
    case 'view.grid':
      workspaceStore.setViewChrome({ showGrid: !workspace.showGrid })
      return
    case 'view.guides':
      workspaceStore.setViewChrome({ showGuides: !workspace.showGuides })
      return
    case 'view.clearGuides': {
      const document = documentStore.getState().document
      const guides = document.guides ?? []
      if (guides.length === 0) return
      documentStore.beginTransaction('clear guides')
      for (const guide of guides) documentStore.dispatch({ type: 'removeGuide', guideId: guide.id })
      documentStore.commitTransaction()
      return
    }
    case 'view.smartGuides':
      workspaceStore.setSmartGuides(!workspace.smartGuides)
      return
    case 'view.actualSize':
      documentStore.setViewport(actualSize(editor.viewport, workspace.canvas))
      return
    case 'window.togglePanel.layers':
    case 'window.togglePanel.properties':
    case 'window.togglePanel.appearance':
    case 'window.togglePanel.color': {
      const panel = (Object.keys(PANEL_ACTION_IDS) as PanelId[]).find((candidate) => PANEL_ACTION_IDS[candidate] === id)
      if (panel !== undefined) workspaceStore.togglePanel(panel)
      return
    }
    case 'help.about':
      workspaceStore.setAboutOpen(true)
      return
  }
}

