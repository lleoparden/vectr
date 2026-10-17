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
import { nudgedTransform, scaledTransform, unionBounds } from './editing/transform.ts'
import { artboardRect, artboardRects } from '../doc/artboards.ts'
import type { BlendMode, FillGradient, StrokeCap, StrokeJoin } from '../doc/types.ts'
import { groupToIsolate } from './editing/isolation.ts'
import { planAlign, planDistribute, type AlignMode, type AlignMove, type DistributeAxis } from './editing/align.ts'
import { clipboardHasContent, copyToClipboard, pastedNodes } from './editing/clipboard.ts'
import type { LayerRow } from './panels/layerRows.ts'
import { importImageBytes, pickImageFile } from './files/imageImport.ts'
import { newDocument, openDocument, recoverDocument, requestNewDocument, requestOpenDocument, saveDocument } from './files/fileActions.ts'
import { assetRegistry } from '../state/assetRegistry.ts'
import { childIndex, createGroup, createImage, type ShapeKind, type ShapeParams } from '../doc/document.ts'
import { actualSize, canvasCenter, fitArtboard, fitRect, zoomByStep } from './canvas/viewportOps.ts'
import { isLocked, parentIdOf, type Command } from '../doc/commands.ts'

/** Artboard ids are opaque and never reused, like node ids. */
function newArtboardId(): string {
  return 'artboard-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

/** Any node that carries a style (everything except a group). */
type StyledNode = Exclude<LayerNode, GroupNode>

export const ACTION_IDS = [
  'tool.select',
  'tool.directSelect',
  'tool.lasso',
  'tool.rect',
  'tool.roundedRect',
  'tool.ellipse',
  'tool.line',
  'tool.polygon',
  'tool.star',
  'tool.arc',
  'tool.text',
  'file.place',
  'file.placeLinked',
  'file.new',
  'file.open',
  'file.save',
  'file.saveAs',
  'file.recover',
  'type.sizeUp',
  'type.sizeDown',
  'type.alignLeft',
  'type.alignCenter',
  'type.alignRight',
  'edit.undo',
  'edit.redo',
  'edit.clear',
  'edit.preferences',
  'select.all',
  'select.deselect',
  'object.hideSelection',
  'object.showAll',
  'object.lockSelection',
  'object.unlockAll',
  'object.group',
  'object.ungroup',
  'object.arrangeFront',
  'object.arrangeForward',
  'object.arrangeBackward',
  'object.arrangeBack',
  'object.duplicate',
  'object.makeClip',
  'object.releaseClip',
  'object.isolate',
  'object.exitIsolation',
  'object.alignLeft',
  'object.alignCenterH',
  'object.alignRight',
  'object.alignTop',
  'object.alignCenterV',
  'object.alignBottom',
  'object.distributeH',
  'object.distributeV',
  'edit.cut',
  'edit.copy',
  'edit.paste',

  'layer.new',
  'artboard.new',
  'artboard.delete',
  'view.zoomIn',
  'view.zoomOut',
  'view.fitArtboard',
  'view.actualSize',
  'view.smartGuides',
  'window.togglePanel.layers',
  'window.togglePanel.properties',
  'window.togglePanel.appearance',
  'window.togglePanel.color',
  'help.about',
] as const

export type EditorActionId = (typeof ACTION_IDS)[number]

export const ACTION_LABELS: Record<EditorActionId, string> = {
  'tool.select': 'Selection Tool',
  'tool.directSelect': 'Direct Selection Tool',
  'tool.lasso': 'Lasso Tool',
  'tool.rect': 'Rectangle Tool',
  'tool.roundedRect': 'Rounded Rectangle Tool',
  'tool.ellipse': 'Ellipse Tool',
  'tool.line': 'Line Segment Tool',
  'tool.polygon': 'Polygon Tool',
  'tool.star': 'Star Tool',
  'tool.arc': 'Arc Tool',
  'tool.text': 'Type Tool',
  'file.place': 'Place…',
  'file.placeLinked': 'Place Linked…',
  'file.new': 'New',
  'file.open': 'Open…',
  'file.save': 'Save',
  'file.saveAs': 'Save As…',
  'file.recover': 'Recover Unsaved Work',
  'type.sizeUp': 'Increase Size',
  'type.sizeDown': 'Decrease Size',
  'type.alignLeft': 'Horizontal Align Left',
  'type.alignCenter': 'Horizontal Align Center',
  'type.alignRight': 'Horizontal Align Right',
  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'edit.clear': 'Clear',
  'edit.preferences': 'Preferences…',
  'select.all': 'All',
  'select.deselect': 'Deselect',
  'object.hideSelection': 'Hide Selection',
  'object.showAll': 'Show All',
  'object.lockSelection': 'Lock Selection',
  'object.unlockAll': 'Unlock All',
  'object.group': 'Group',
  'object.ungroup': 'Ungroup',
  'object.arrangeFront': 'Bring to Front',
  'object.arrangeForward': 'Bring Forward',
  'object.arrangeBackward': 'Send Backward',
  'object.arrangeBack': 'Send to Back',
  'object.duplicate': 'Duplicate',
  'object.makeClip': 'Make Clipping Mask',
  'object.releaseClip': 'Release Clipping Mask',
  'object.isolate': 'Isolate Selection',
  'object.exitIsolation': 'Exit Isolation Mode',
  'object.alignLeft': 'Horizontal Align Left',
  'object.alignCenterH': 'Horizontal Align Center',
  'object.alignRight': 'Horizontal Align Right',
  'object.alignTop': 'Vertical Align Top',
  'object.alignCenterV': 'Vertical Align Center',
  'object.alignBottom': 'Vertical Align Bottom',
  'object.distributeH': 'Distribute Horizontal Centers',
  'object.distributeV': 'Distribute Vertical Centers',
  'edit.cut': 'Cut',
  'edit.copy': 'Copy',
  'edit.paste': 'Paste',
  'layer.new': 'New Layer',
  'artboard.new': 'New Artboard',
  'artboard.delete': 'Delete Artboard',
  'view.zoomIn': 'Zoom In',
  'view.zoomOut': 'Zoom Out',
  'view.fitArtboard': 'Fit Artboard in Window',
  'view.actualSize': 'Actual Size',
  'view.smartGuides': 'Smart Guides',
  'window.togglePanel.layers': 'Layers',
  'window.togglePanel.properties': 'Properties',
  'window.togglePanel.appearance': 'Appearance',
  'window.togglePanel.color': 'Color',
  'help.about': 'About Vectr',
}

const PANEL_ACTION_IDS: Record<PanelId, EditorActionId> = {
  layers: 'window.togglePanel.layers',
  properties: 'window.togglePanel.properties',
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
  documentStore.beginTransaction(label)
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
  documentStore.beginTransaction(label)
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
  documentStore.beginTransaction(label)
  const applied: Command[] = []
  for (const step of steps) {
    const result = documentStore.dispatch(stepCommand(step))
    if (!result.ok) {
      for (const inverse of [...applied].reverse()) documentStore.dispatch(inverse)
      documentStore.abortTransaction()
      return
    }
    applied.push(result.inverse)
  }
  documentStore.commitTransaction()
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
  documentStore.beginTransaction(label)
  let changed = false
  for (const move of moves) {
    const result = documentStore.dispatch({ type: 'setTransform', nodeId: move.nodeId, transform: move.transform })
    if (result.ok) changed = true
  }
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
  documentStore.beginTransaction(kind === 'text' ? 'text color' : 'shape color')
  let changed = false
  for (const node of targets) {
    if (node === null || node.style.fill === color) continue
    const result = documentStore.dispatch(
      { type: 'setStyle', nodeId: node.id, style: { ...node.style, fill: color } },
      'apply fill',
    )
    if (result.ok) changed = true
  }
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
export function nudgeSelection(dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
  const { document, selection } = documentStore.getState()
  const targets = selection
    .map((id) => findNode(document, id))
    .filter((node): node is LayerNode => node !== null)
  if (targets.length === 0) return
  documentStore.beginTransaction('nudge')
  let changed = false
  for (const node of targets) {
    const result = documentStore.dispatch({
      type: 'setTransform',
      nodeId: node.id,
      transform: nudgedTransform(node.transform, dx, dy),
    })
    if (result.ok) changed = true
  }
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

/**
 * Sets the selection's world box, which is what the Properties panel's X/Y/W/H fields edit
 * (Phase 2.2). Position is a move; size is a scale about the top-left corner, so the arithmetic
 * lives in the transform planner rather than in the panel.
 */
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

  documentStore.beginTransaction('transform selection')
  let changed = false
  for (const node of targets) {
    const next =
      sx === 1 && sy === 1
        ? { ...node.transform, x: node.transform.x + dx, y: node.transform.y + dy }
        : { ...node.transform, ...scaledTransform(node.transform, { x: box.x + dx, y: box.y + dy }, sx, sy) }
    const result = documentStore.dispatch({ type: 'setTransform', nodeId: node.id, transform: next })
    if (result.ok) changed = true
  }
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

/** Applies or removes a gradient fill on the selection, one undo entry. */
export function setSelectionGradient(gradient: FillGradient | null): void {
  applySelectionStyle((node) => ({ ...node.style, gradient }), 'gradient')
}

/** Sets how the selection's fill composites, as one undo entry (issue #71). */
export function setSelectionBlendMode(mode: BlendMode): void {
  applySelectionStyle((node) => ({ ...node.style, blendMode: mode }), 'blend mode')
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
  documentStore.beginTransaction(label)
  let changed = false
  for (const node of targets) {
    const result = documentStore.dispatch({ type: 'setStyle', nodeId: node.id, style: next(node) })
    if (result.ok) changed = true
  }
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
    case 'tool.text':
      documentStore.setTool('text')
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

