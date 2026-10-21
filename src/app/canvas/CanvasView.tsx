/**
 * Canvas view (issue #18).
 *
 * Owns the renderer and the pointer gestures. Every edit goes through the store,
 * so a drag is one transaction and one history entry, tools create nodes through
 * commands, and selection comes from the pure hit-test module.
 */

import { useEffect, useRef, useState } from 'react'
import { createPath, createShape, createText, estimateTextSize, findNode, shapeLabel, worldTransform } from '../../doc/document.ts'
import { localToScene } from '../../doc/pathEdit.ts'
import type { ShapeKind } from '../../doc/document.ts'
import { hitTest, hierarchySelection, lassoHitTest, marqueeHitTest, type Point } from '../../doc/hitTest.ts'
import { clampCornerRadius, outlinePoints } from '../../geom/shapeGeometry.ts'
import { boxFor, constrainEnd, dragIsBigEnough, lineFrom } from './shapeDrag.ts'
import { isGroup, isText, type NodeId, type Transform } from '../../doc/types.ts'
import { mimeTypeForName } from '../../doc/assets.ts'
import { ContextMenu, type ContextMenuState } from './ContextMenu.tsx'
import { canvasContextItems } from '../menus/contextMenus.ts'
import { addGuide, moveGuide, paintRegionAt, placeImage, removeGuide, runEditorAction, shapeBuilder } from '../actions.ts'
import { TextEditor, type TextEditorBox } from './TextEditor.tsx'
import { AnchorOverlay } from './AnchorOverlay.tsx'
import { PathPreview } from './PathPreview.tsx'
import { ShapePreview, type ShapePreviewState } from './ShapePreview.tsx'
import { SelectionOverlay } from './SelectionOverlay.tsx'
import { ArtboardOverlay } from './ArtboardOverlay.tsx'
import { RulersOverlay } from './RulersOverlay.tsx'
import { HoverOverlay } from './HoverOverlay.tsx'
import { cursorForTool, cursorWhileDragging } from './cursor.ts'
import { createToolStateMachines, isStateMachineTool } from '../../tools/index.ts'
import { createScaleTool, type ScaleTool } from '../../tools/transform.ts'
import type { PenDraft, ToolHost, ToolPoint } from '../../tools/types.ts'
import { pathBounds } from '../../geom/path.ts'
import { snapBox, snapTargets, SNAP_PIXELS, type SnapGuide } from '../editing/snapping.ts'
import { deepHitWithin, withinIsolation } from '../editing/isolation.ts'
import { unionBounds } from '../../doc/transform.ts'
import { angleFromCentre, handlePoints, normaliseAngle, rotatePoint, rotatedTransform, snapAngle } from '../../geom/transform.ts'
import { clampZoom } from '../../geom/viewport.ts'
import type { RotateCapture } from '../../tools/types.ts'
import { type HandleId } from '../../geom/transform.ts'
import { artboardAtPoint, artboardRect, artboardRects } from '../../doc/artboards.ts'
import { EditorRenderer, type RenderStats } from '../../render/EditorRenderer.ts'
import { getActiveRenderer, setActiveRenderer } from '../../render/activeRenderer.ts'
import { assetRegistry } from '../../state/assetRegistry.ts'
import { buildScene, type SceneShape } from '../../render/scene.ts'
import { documentStore, type Tool, type Viewport } from '../../state/documentStore.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { workspaceStore } from '../../state/workspaceStore.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { fitRect, zoomAtPoint } from '../../geom/viewport.ts'

/**
 * What the canvas still tracks itself: the middle-button pan. Every other gesture belongs to a tool
 * (Phase 3.2-3.3), which is why this union is down to two members.
 */
type Gesture = { kind: 'none' } | { kind: 'pan'; startClient: Point; panStart: Point }

const MIN_DRAG = 4
/** How far outside a corner, in screen pixels, a pointer starts a rotation (Illustrator's own zone). */
const ROTATE_ZONE = 18
const CORNERS: HandleId[] = ['nw', 'ne', 'se', 'sw']

/** The shape a tool draws, or `null` for the tools that are not shapes. */
export function shapeKindForTool(tool: Tool): ShapeKind | null {
  switch (tool) {
    case 'rect':
    case 'roundedRect':
    case 'ellipse':
    case 'line':
    case 'polygon':
    case 'star':
    case 'arc':
      return tool
    default:
      return null
  }
}

/**
 * What the drag preview draws and, on release, what the node becomes: the same box, produced by
 * the same constraint, so the preview cannot disagree with the shape (the owner's report was an
 * ellipse preview drawn as a rectangle).
 */
type DragPreview = ShapePreviewState

function scaledViewport(viewport: Viewport, ratio: number): Viewport {
  return { zoom: viewport.zoom * ratio, panX: viewport.panX * ratio, panY: viewport.panY * ratio }
}

function boundsOf(shape: SceneShape) {
  return { x: shape.x, y: shape.y, width: shape.width * shape.scaleX, height: shape.height * shape.scaleY }
}

export function CanvasView() {
  const state = useEditorState()
  const workspace = useWorkspaceState()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<EditorRenderer | null>(null)
  const gestureRef = useRef<Gesture>({ kind: 'none' })
  // Phase 3.2: the pointer tools are state machines; the canvas routes to them and supplies the host.
  const toolsRef = useRef<ReturnType<typeof createToolStateMachines> | null>(null)
  if (toolsRef.current === null) toolsRef.current = createToolStateMachines()
  const moveRef = useRef<{ originals: Map<string, Transform>; box: ReturnType<typeof unionBounds> } | null>(null)
  const [ready, setReady] = useState(false)
  const [stats, setStats] = useState<RenderStats | null>(null)
  const [overlay, setOverlay] = useState<DragPreview | null>(null)
  const [penDraft, setPenDraft] = useState<PenDraft | null>(null)
  // The anchor overlay only exists for one selected path: a multi-selection has no single set of
  // anchors to edit, which is also why the tool's capture refuses it (Phase 5.3).
  const selectedPath = (() => {
    const { selection, document } = documentStore.getState()
    if (selection.length !== 1) return null
    const node = findNode(document, selection[0])
    return node !== null && node.type === 'path' ? node : null
  })()
  /** The object a click would select, outlined (Phase 4.3). */
  const [hover, setHover] = useState<{ box: { x: number; y: number; width: number; height: number }; rotation: number } | null>(null)
  /** What the pointer is doing, so the cursor can say so (Phase 4.3). */
  const [dragging, setDragging] = useState<'move' | 'marquee' | 'pan' | null>(null)
  /** The angle shown while a rotation gesture is in flight (Phase 4.3). */
  const [rotationBadge, setRotationBadge] = useState<string | null>(null)
  /** Alt turns the zoom cursor into the zoom-out cursor, as Illustrator's does (issue #131). */
  const [altHeld, setAltHeld] = useState(false)
  const [lassoPath, setLassoPath] = useState<Point[] | null>(null)
  /** Smart-guide lines shown while a snapped drag is in flight (issue #68). */
  const [guides, setGuides] = useState<SnapGuide[]>([])
  /** The scale gesture's starting box and transforms, captured once so every move is absolute. */
  // Phase 4.1: the scale gesture is a tool; the overlay's callbacks below adapt to it.
  const scaleToolRef = useRef<ScaleTool | null>(null)
  const rotateRef = useRef<RotateCapture | null>(null)
  if (scaleToolRef.current === null) scaleToolRef.current = createScaleTool('default')
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState<ContextMenuState>(null)
  const [editing, setEditing] = useState<{ nodeId: NodeId; text: string } | null>(null)
  const renderedOnce = useRef(false)
  const fittedOnce = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const renderer = await EditorRenderer.create(canvasRef.current!)
        if (cancelled) {
          renderer.dispose()
          return
        }
        rendererRef.current = renderer
        setActiveRenderer(renderer)
        setReady(true)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'The renderer did not initialize.'
        console.error(`renderer create failed: ${message}`)
        setError(message)
      }
    })()
    return () => {
      cancelled = true
      setActiveRenderer(null)
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  // Redraw when the document, the viewport, or the canvas size changes.
  useEffect(() => {
    const renderer = rendererRef.current
    const canvas = canvasRef.current
    if (!ready || renderer === null || canvas === null) return
    const ratio = window.devicePixelRatio || 1
    const box = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(box.width * ratio))
    const height = Math.max(1, Math.round(box.height * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      renderer.resize(width, height)
    }
    // The panel dock and the View commands need the canvas size in CSS pixels; the
    // status bar and Fit Artboard in Window both read it from the workspace store.
    workspaceStore.setCanvasSize(box.width, box.height)
    // Illustrator opens on the artboard rather than wherever the origin happens to
    // be, so the first known canvas size fits it. Later zoom is the user's to own.
    if (!fittedOnce.current && box.width > 0 && box.height > 0) {
      fittedOnce.current = true
      documentStore.setViewport(fitRect(artboardRects(state.document)[0] ?? state.document.artboards[0], { width: box.width, height: box.height }))
    }
    renderer.setGrid({ visible: workspace.showGrid, spacing: 10 })
    const scene = buildScene(state.document)
    renderer.setScene(scene)
    const outlines = scene.shapes
      .filter((shape) => state.selection.includes(shape.id) || state.selection.includes(shape.root))
      .map(boundsOf)
    renderer.render(scaledViewport(state.viewport, ratio), outlines)
    const next = renderer.stats()
    setStats(next)
    if (!renderedOnce.current) {
      renderedOnce.current = true
      console.log(`[vectr-render] ${JSON.stringify({ ...next, backend: renderer.info.backend })}`)
    }
  }, [ready, state.document, state.viewport, state.selection, workspace.showGrid])

  const toScene = (event: { clientX: number; clientY: number }): Point => {
    const box = canvasRef.current!.getBoundingClientRect()
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    return {
      x: (x - state.viewport.panX) / state.viewport.zoom,
      y: (y - state.viewport.panY) / state.viewport.zoom,
    }
  }

  const toScreen = (rect: { x: number; y: number; width: number; height: number }) => ({
    x: rect.x * state.viewport.zoom + state.viewport.panX,
    y: rect.y * state.viewport.zoom + state.viewport.panY,
    width: rect.width * state.viewport.zoom,
    height: rect.height * state.viewport.zoom,
  })

  /** The selection box the handles are drawn on, or null when the active tool has no box. */
  const selectionBox =
    (state.tool === 'select' || state.tool === 'directSelect') && state.selection.length > 0
      ? unionBounds(state.document, state.selection)
      : null

  /** Measured box when the renderer has the font, otherwise the shared estimate. */
  function textBoxFor(fontFamily: string, fontSize: number, lineHeight: number, text: string) {
    const measured = getActiveRenderer()?.measureTextBox(fontFamily, fontSize, lineHeight, text) ?? null
    return measured ?? estimateTextSize(text, fontSize, lineHeight)
  }

  function startEditingText(nodeId: NodeId) {
    const current = documentStore.getState().document
    const node = findNode(current, nodeId)
    if (node === null || !isText(node)) return
    documentStore.setSelection([nodeId])
    setEditing({ nodeId, text: node.text })
  }

  /**
   * Commits the inline editor: the text and its measured box go through one `setText` command,
   * so a text edit is one undo step. Text left empty is discarded rather than left behind as
   * an invisible object.
   */
  function commitText(nodeId: NodeId, text: string) {
    setEditing(null)
    const current = documentStore.getState().document
    const node = findNode(current, nodeId)
    if (node === null || !isText(node)) return
    if (text.trim().length === 0) {
      if (node.text.trim().length === 0) {
        documentStore.dispatch({ type: 'removeNodes', nodeIds: [nodeId] }, 'discard empty text')
        documentStore.clearSelection()
      }
      return
    }
    if (text === node.text) return
    const box = textBoxFor(node.fontFamily, node.fontSize, node.lineHeight, text)
    documentStore.dispatch({ type: 'setText', nodeId, text, width: box.width, height: box.height }, 'edit text')
  }

  /** Screen box the editor is positioned over, in the text object's own type metrics. */
  function editorBox(nodeId: NodeId): TextEditorBox | null {
    const current = documentStore.getState().document
    const node = findNode(current, nodeId)
    const world = worldTransform(current, nodeId)
    if (node === null || world === null || !isText(node)) return null
    const { zoom, panX, panY } = state.viewport
    // Size comes from `editorMeasure`, which grows with the text; this box is the anchor and the type.
    return {
      left: world.x * zoom + panX,
      top: world.y * zoom + panY,
      fontSize: Math.max(8, node.fontSize * world.scaleY * zoom),
      lineHeight: Math.max(10, node.lineHeight * world.scaleY * zoom),
      fontFamily: node.fontFamily,
    }
  }

  /**
   * Screen-space size of the given text, measured the way the commit will store it (the renderer's
   * metrics when it has them, otherwise the shared estimate). The editor grows with this, so the
   * box you type into is the box the canvas will draw.
   */
  function editorMeasure(nodeId: NodeId, text: string): { width: number; height: number } {
    const current = documentStore.getState().document
    const node = findNode(current, nodeId)
    const world = worldTransform(current, nodeId)
    if (node === null || world === null || !isText(node)) return { width: 0, height: 0 }
    const size = textBoxFor(node.fontFamily, node.fontSize, node.lineHeight, text)
    const { zoom } = state.viewport
    return { width: size.width * world.scaleX * zoom, height: size.height * world.scaleY * zoom }
  }

  /**
   * The overlay's three callbacks, adapted onto the scale tool (Phase 4.1). The gesture, its captured
   * box, and the per-node transforms live in `src/tools/transform.ts`; this is the wiring only.
   */
  function startScale(handle: HandleId) {
    scaleToolRef.current?.startHandle(toolHost(), handle)
  }

  function moveScale(_handle: HandleId, point: Point, modifiers: { constrain: boolean; fromCenter: boolean }) {
    scaleToolRef.current?.moveHandle(toolHost(), point, modifiers)
  }

  function endScale() {
    scaleToolRef.current?.endHandle(toolHost())
  }

  /** Every movable selected node with its extent, plus the oriented frame it belongs to. */
  function captureSelection() {
    const current = documentStore.getState()
    const box = unionBounds(current.document, current.selection)
    if (box === null) return null
    const nodes = []
    for (const id of current.selection) {
      const node = findNode(current.document, id)
      if (node === null || node.locked || isGroup(node)) continue
      nodes.push({ id, kind: node.type, transform: { ...node.transform }, width: node.width, height: node.height })
    }
    if (nodes.length === 0) return null
    return {
      box,
      rotation: selectionRotation(),
      centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      nodes,
    }
  }

  /** The rotation the frame is drawn at: a common rotation, or zero when the selection disagrees. */
  function selectionRotation(): number {
    const current = documentStore.getState()
    const rotations: number[] = []
    for (const id of current.selection) {
      const node = findNode(current.document, id)
      if (node === null || isGroup(node)) continue
      rotations.push(normaliseAngle(node.transform.rotation))
    }
    if (rotations.length === 0) return 0
    return rotations.every((value) => value === rotations[0]) ? rotations[0] : 0
  }

  /** A pointer position in scene units and in screen pixels, which the Hand tool needs. */
  function toolPoint(event: React.PointerEvent<HTMLCanvasElement>): ToolPoint {
    const box = canvasRef.current?.getBoundingClientRect()
    return {
      scene: toScene(event),
      screen: { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) },
    }
  }

  /**
   * What a tool may do. Everything the machines need is here, calling the stores the same way the
   * inline gestures did, so porting a tool cannot change what a click means.
   */
  function toolHost(): ToolHost {
    return {
      selection: () => documentStore.getState().selection,
      hitTest: (scene, deep) => {
        const document = documentStore.getState().document
        const isolated = workspaceStore.getState().isolatedGroupId
        return isolated === null
          ? hitTest(document, scene, deep ? { deep: true } : {})
          : deepHitWithin(document, isolated, scene)
      },
      select: (id) => documentStore.setSelection([id]),
      duplicateSelection: () => {
        documentStore.beginTransaction('duplicate and move')
        runEditorAction('object.duplicate')
      },
      toggleSelection: (id) => documentStore.toggleSelection(id),
      beginMove: () => {
        setDragging('move')
        // An Alt-drag has already opened the transaction with its duplicate; joining it keeps the
        // duplicate and the move in one undo entry.
        if (!documentStore.inTransaction()) documentStore.beginTransaction('move')
        const document = documentStore.getState().document
        const originals = new Map<string, Transform>()
        for (const id of documentStore.getState().selection) {
          const node = findNode(document, id)
          if (node !== null && !node.locked) originals.set(id, { ...node.transform })
        }
        if (originals.size === 0) {
          moveRef.current = null
          return
        }
        moveRef.current = { originals, box: unionBounds(document, [...originals.keys()]) }
      },
      moveBy: (dx, dy, shift) => {
        const move = moveRef.current
        if (move === null) return
        const viewport = documentStore.getState().viewport
        const document = documentStore.getState().document
        if (workspaceStore.getState().smartGuides && move.box !== null) {
          // Smart Guides replace the raw delta with the nearest target, so the pointer drives the
          // drag but the stored transform lands exactly on an edge.
          const snap = snapBox(
            { x: move.box.x + dx, y: move.box.y + dy, width: move.box.width, height: move.box.height },
            snapTargets(document, [...move.originals.keys()], workspaceStore.getState().activeArtboardId),
            SNAP_PIXELS / viewport.zoom,
          )
          dx += snap.dx
          dy += snap.dy
          setGuides(snap.guides)
        } else {
          setGuides([])
        }
        void shift
        for (const [id, original] of move.originals) {
          documentStore.dispatch(
            { type: 'setTransform', nodeId: id, transform: { ...original, x: original.x + dx, y: original.y + dy } },
            'move',
          )
        }
      },
      endMove: () => {
        setDragging(null)
        if (moveRef.current === null) return
        moveRef.current = null
        setGuides([])
        documentStore.commitTransaction()
      },
      cancelMove: () => {
        setDragging(null)
        if (moveRef.current === null) return
        moveRef.current = null
        setGuides([])
        documentStore.abortTransaction()
      },
      setMarquee: (rect) => {
        setDragging(rect === null ? null : 'marquee')
        setOverlay(
          rect === null
            ? null
            : {
                kind: 'rect',
                start: { x: rect.x, y: rect.y },
                current: { x: rect.x + rect.width, y: rect.y + rect.height },
                shift: false,
              },
        )
      },
      commitMarquee: (rect, deep) =>
        documentStore.setSelection(marqueeHitTest(documentStore.getState().document, rect, { deep })),
      viewport: () => {
        const viewport = documentStore.getState().viewport
        return { panX: viewport.panX, panY: viewport.panY }
      },
      panTo: (panX, panY) => documentStore.setViewport({ panX, panY }),
      setLasso: (points) => setLassoPath(points),
      zoomAt: (screen, factor) => {
        documentStore.setViewport(zoomAtPoint(documentStore.getState().viewport, screen, factor))
      },
      zoomToBox: (box) => {
        // A dragged zoom frames the rectangle with a small margin, like Illustrator's marquee zoom.
        const canvas = workspaceStore.getState().canvas
        if (box.width <= 0 || box.height <= 0) return
        const margin = 0.92
        const zoom = clampZoom(Math.min(canvas.width / box.width, canvas.height / box.height) * margin)
        documentStore.setViewport({
          zoom,
          panX: canvas.width / 2 - (box.x + box.width / 2) * zoom,
          panY: canvas.height / 2 - (box.y + box.height / 2) * zoom,
        })
      },
      commitLasso: (points, modifiers) => {
        const document = documentStore.getState().document
        const ids = lassoHitTest(document, points)
        if (modifiers.shift) {
          // Shift adds to the selection, the way it does for a click or a marquee.
          const merged = [...documentStore.getState().selection]
          for (const id of ids) if (!merged.includes(id)) merged.push(id)
          documentStore.setSelection(merged)
        } else {
          documentStore.setSelection(withinIsolation(document, workspaceStore.getState().isolatedGroupId, ids))
        }
      },
      setShapePreview: (preview) => setOverlay(preview),
      setPenDraft: (draft) => setPenDraft(draft),
      applyShapeBuilder: (ids, subtract, path, tolerance) => shapeBuilder(ids, subtract, path, tolerance),
      paintRegion: (point) => paintRegionAt(point),
      pathEditCapture: () => {
        const { selection, document } = documentStore.getState()
        if (selection.length !== 1) return null
        const node = findNode(document, selection[0])
        if (node === null || node.type !== 'path') return null
        return {
          nodeId: node.id,
          anchors: node.anchors.map((anchor) => ({ ...anchor })),
          width: node.width,
          height: node.height,
          transform: { ...node.transform },
        }
      },
      selectAnchor: (nodeId, index, additive) => {
        const current = workspaceStore.getState().anchorSelection
        const same = current !== null && current.nodeId === nodeId ? current.indices : []
        const indices = !additive ? [index] : same.includes(index) ? same.filter((value) => value !== index) : [...same, index]
        workspaceStore.setAnchorSelection(indices.length === 0 ? null : { nodeId, indices })
      },
      clearAnchorSelection: () => workspaceStore.setAnchorSelection(null),
      beginPathDrag: () => documentStore.beginTransaction('edit anchors'),
      setPathAnchors: (nodeId, anchors) => {
        const node = findNode(documentStore.getState().document, nodeId)
        if (node === null || node.type !== 'path') return
        documentStore.dispatch({ type: 'setPathAnchors', nodeId, anchors, closed: node.closed, fillRule: node.fillRule }, 'edit anchors')
      },
      endPathDrag: () => documentStore.commitTransaction(),
      cancelPathDrag: () => documentStore.abortTransaction(),
      zoomFactor: () => documentStore.getState().viewport.zoom,
      commitPenPath: (anchors, closed) => {
        if (anchors.length < 2) return
        const document = documentStore.getState().document
        const existing = document.root.children.filter((node) => node.type === 'path').length
        const bounds = pathBounds(anchors, closed)
        const defaults = workspaceStore.getState().creationDefaults
        const node = createPath(`Path ${existing + 1}`, bounds.x, bounds.y, anchors, {
          closed,
          fill: defaults.shape.fill,
        })
        const result = documentStore.dispatch(
          { type: 'insertNodes', parentId: document.root.id, index: document.root.children.length, nodes: [node] },
          'add path',
        )
        if (result.ok) documentStore.setSelection([node.id])
      },
      commitShape: (toolId, start, end, shift) => {
        const kind = shapeKindForTool(toolId as Tool)
        if (kind === null) return
        const constrained = constrainEnd(start, end, kind, shift)
        if (!dragIsBigEnough(start, constrained, kind, MIN_DRAG)) return
        const box = boxFor(start, constrained, kind)
        const defaults = workspaceStore.getState().creationDefaults
        const label = shapeLabel(kind)
        const document = documentStore.getState().document
        const existing = document.root.children.filter((node) => node.type === kind).length
        const node = createShape(kind, `${label} ${existing + 1}`, box, defaults.shape, lineFrom(start, constrained))
        const result = documentStore.dispatch(
          {
            type: 'insertNodes',
            parentId: document.root.id,
            index: document.root.children.length,
            nodes: [node],
          },
          `add ${label.toLowerCase()}`,
        )
        if (result.ok) documentStore.setSelection([node.id])
      },
      scaleBegin: () => {
        const captured = captureSelection()
        if (captured === null) return null
        documentStore.beginTransaction('scale')
        return captured
      },
      rotationBegin: (point) => {
        const captured = captureSelection()
        if (captured === null) return null
        const tolerance = ROTATE_ZONE / documentStore.getState().viewport.zoom
        // A press *inside* the frame near a corner is a scale, not a rotation - Illustrator's own rule.
        const inFrame = rotatePoint(point, captured.centre, -captured.rotation)
        const insideFrame =
          inFrame.x > captured.box.x &&
          inFrame.x < captured.box.x + captured.box.width &&
          inFrame.y > captured.box.y &&
          inFrame.y < captured.box.y + captured.box.height
        if (insideFrame) return null
        const corners = handlePoints(captured.box)
        const inZone = CORNERS.some((handle) => {
          const corner = rotatePoint(corners[handle], captured.centre, captured.rotation)
          return Math.hypot(point.x - corner.x, point.y - corner.y) <= tolerance
        })
        if (!inZone) return null
        documentStore.beginTransaction('rotate')
        const capture = { centre: captured.centre, startAngle: angleFromCentre(captured.centre, point), nodes: captured.nodes }
        rotateRef.current = capture
        return capture
      },
      rotateBy: (point, shift) => {
        const gesture = rotateRef.current
        if (gesture === null) return
        const raw = angleFromCentre(gesture.centre, point) - gesture.startAngle
        const degrees = normaliseAngle(shift ? snapAngle(raw) : raw)
        setRotationBadge(Math.round(degrees) + '°')
        for (const node of gesture.nodes) {
          const next = rotatedTransform(node.transform, node, gesture.centre, degrees)
          documentStore.dispatch({ type: 'setTransform', nodeId: node.id, transform: next }, 'rotate')
          // Keep the captured transform in step with what was applied, so each move is absolute.
          node.transform = next
        }
      },
      rotateEnd: () => {
        setRotationBadge(null)
        if (rotateRef.current === null) return
        rotateRef.current = null
        documentStore.commitTransaction()
      },
      rotateCancel: () => {
        setRotationBadge(null)
        if (rotateRef.current === null) return
        rotateRef.current = null
        documentStore.abortTransaction()
      },
      setNodeTransform: (nodeId, transform) => {
        documentStore.dispatch({ type: 'setTransform', nodeId, transform }, 'scale')
      },
      resizeNode: (nodeId, x, y, width, height) => {
        documentStore.dispatch({ type: 'resizeNode', nodeId, x, y, width, height }, 'reshape')
      },
      scaleEnd: () => documentStore.commitTransaction(),
      scaleCancel: () => documentStore.abortTransaction(),
      widthBegin: (point) => {
        const document = documentStore.getState().document
        const hit = hitTest(document, point)
        if (hit === null) return null
        const node = findNode(document, hit)
        if (node === null || node.type !== 'path' || node.style.stroke === null || node.anchors.length < 2) return null
        const points = node.anchors.map((anchor) => localToScene({ x: anchor.x, y: anchor.y }, { nodeId: node.id, anchors: node.anchors, transform: node.transform, width: node.width, height: node.height }))
        const profile = node.style.stroke.widthProfile ?? node.anchors.map(() => 1)
        documentStore.beginTransaction('width profile')
        return { nodeId: node.id, points, profile: [...profile], width: node.style.stroke.width }
      },
      widthApply: (nodeId, profile) => {
        documentStore.dispatch({ type: 'setWidthProfile', nodeId, profile }, 'width profile')
      },
      widthEnd: () => documentStore.commitTransaction(),
      widthCancel: () => documentStore.abortTransaction(),
      placeText: (scene) => {
        const document = documentStore.getState().document
        const existing = document.root.children.filter((node) => node.type === 'text').length
        const defaults = workspaceStore.getState().creationDefaults
        const node = createText(`Text ${existing + 1}`, scene.x, scene.y, '', {
          // The Type tool's options apply to the object it is about to create.
          fill: defaults.textFill,
          fontSize: defaults.textFontSize,
          align: defaults.textAlign,
        })
        const result = documentStore.dispatch(
          {
            type: 'insertNodes',
            parentId: document.root.id,
            index: document.root.children.length,
            nodes: [node],
          },
          'add text',
        )
        if (result.ok) {
          documentStore.setSelection([node.id])
          setEditing({ nodeId: node.id, text: '' })
        }
      },
    }
  }

  // Escape drops a multi-step draft and Enter finishes it, the way the Pen behaves in
  // Illustrator: the tool owns the gesture, so the keys go to the tool rather than to a store.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isStateMachineTool(state.tool)) return
      if (event.key !== 'Escape' && event.key !== 'Enter') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const tool = toolsRef.current?.[state.tool]
      if (tool === undefined) return
      if (event.key === 'Escape') {
        tool.cancel(toolHost())
        setOverlay(null)
        setLassoPath(null)
        setPenDraft(null)
      } else {
        tool.finish?.(toolHost())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.tool])

  useEffect(() => {
    if (state.tool !== 'pen') setPenDraft(null)
  }, [state.tool])

  // Anchor selection belongs to one path in the white arrow; anything else clears it.
  useEffect(() => {
    const selection = workspaceStore.getState().anchorSelection
    if (selection === null) return
    const node = findNode(documentStore.getState().document, selection.nodeId)
    if (state.tool !== 'directSelect' || state.selection.length !== 1 || node === null || node.type !== 'path') {
      workspaceStore.setAnchorSelection(null)
    }
  }, [state.tool, state.selection])

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(event.pointerId)
    const start = toScene(event)
    // The pointer tools are state machines (Phase 3.2): the canvas routes the event and supplies
    // the host, so the tool owns the gesture and the canvas owns the document.
    if (event.button === 0 && isStateMachineTool(state.tool)) {
      setHover(null)
      // A real mouse-down moves focus after this handler, which would blur the text editor the Type
      // tool is about to open and close it before a character could be typed.
      if (state.tool === 'text') event.preventDefault()
      gestureRef.current = { kind: 'none' }
      toolsRef.current?.[state.tool].onPointerDown(toolHost(), toolPoint(event), {
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
      })
      return
    }
    if (event.button === 1) {
      gestureRef.current = {
        kind: 'pan',
        startClient: { x: event.clientX, y: event.clientY },
        panStart: { x: state.viewport.panX, y: state.viewport.panY },
      }
      return
    }
    if (event.button !== 0) return


  }

  /**
   * Outlines the object the pointer would select, using the tools' own hit test so the outline and the
   * click cannot disagree (Phase 4.3).
   */
  function updateHover(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.buttons !== 0 || !isStateMachineTool(state.tool)) return
    if (state.tool !== 'select' && state.tool !== 'directSelect') {
      setHover(null)
      return
    }
    const document = documentStore.getState().document
    const point = toScene(event)
    const isolated = workspaceStore.getState().isolatedGroupId
    const hit = isolated === null
      ? hitTest(document, point, state.tool === 'directSelect' ? { deep: true } : {})
      : deepHitWithin(document, isolated, point)
    if (hit === null) {
      setHover(null)
      return
    }
    const box = unionBounds(document, [hit])
    const node = findNode(document, hit)
    if (box === null || node === null) {
      setHover(null)
      return
    }
    setHover({ box, rotation: node.type === 'group' ? 0 : node.transform.rotation })
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    updateHover(event)
    const gesture = gestureRef.current
    if (gesture.kind === 'none') {
      if (isStateMachineTool(state.tool)) {
        toolsRef.current?.[state.tool].onPointerMove(toolHost(), toolPoint(event), {
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
          ctrl: event.ctrlKey,
        })
      }
      return
    }
    if (gesture.kind === 'pan') {
      documentStore.setViewport({
        panX: gesture.panStart.x + (event.clientX - gesture.startClient.x),
        panY: gesture.panStart.y + (event.clientY - gesture.startClient.y),
      })
      return
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current
    gestureRef.current = { kind: 'none' }
    // Phase 3.2-3.3: every tool is a state machine, so the release goes to the active one and it
    // decides what the gesture meant. The canvas only releases the pointer.
    if (gesture.kind === 'none' && isStateMachineTool(state.tool)) {
      toolsRef.current?.[state.tool].onPointerUp(toolHost(), toolPoint(event), {
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
      })
    }
    setOverlay(null)
    setLassoPath(null)
    canvasRef.current?.releasePointerCapture(event.pointerId)
  }

  // Hand the renderer the bytes for every asset the document carries, then release any decoded
  // image the document no longer needs. Decoding happens once per asset id inside the renderer,
  // so registering the same set again is free (issue #17); `retainAssets` is what keeps the
  // decoded cache bounded when documents are swapped (issue #19's cache constraint).
  useEffect(() => {
    const renderer = rendererRef.current
    if (!ready || renderer === null) return
    const wanted = new Set<string>()
    for (const asset of state.document.assets) {
      wanted.add(asset.id)
      const record = assetRegistry.get(asset.id)
      if (record !== undefined) renderer.putAsset(asset.id, record.bytes)
    }
    renderer.retainAssets(wanted)
  }, [ready, state.document.assets])

  useEffect(() => {
    if (state.tool !== 'zoom') {
      setAltHeld(false)
      return
    }
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAltHeld(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAltHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [state.tool])

  // Wheel zoom needs a non-passive listener, so it is attached directly.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const viewport = documentStore.getState().viewport
      // Shift turns the wheel into a horizontal scroll, Illustrator's own modifier for it.
      if (event.shiftKey) {
        documentStore.setViewport({ panX: viewport.panX - event.deltaY, panY: viewport.panY })
        return
      }
      const box = canvas.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.0015)
      documentStore.setViewport(
        zoomAtPoint(viewport, { x: event.clientX - box.left, y: event.clientY - box.top }, factor),
      )
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="relative min-h-0">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none bg-neutral-900"
        style={{ cursor: state.tool === 'zoom' && altHeld ? 'zoom-out' : cursorWhileDragging(state.tool, dragging) }}
        aria-label="Design canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={(event) => {
      // A cancelled pointer never completed the gesture, so the tool drops it rather than
      // committing: a cancelled lasso must not select, and a cancelled drag must not move.
      const gesture = gestureRef.current
      gestureRef.current = { kind: 'none' }
      if (gesture.kind === 'none' && isStateMachineTool(state.tool)) {
        toolsRef.current?.[state.tool].cancel(toolHost())
      }
      setOverlay(null)
      setLassoPath(null)
      canvasRef.current?.releasePointerCapture(event.pointerId)
    }}
        onDoubleClick={(event) => {
          // Illustrator's Zoom tool double-click returns to 100% about the click.
          if (state.tool === 'zoom') {
            const box = canvasRef.current?.getBoundingClientRect()
            const viewport = documentStore.getState().viewport
            if (box !== null && box !== undefined) {
              documentStore.setViewport(
                zoomAtPoint(viewport, { x: event.clientX - box.left, y: event.clientY - box.top }, 1 / viewport.zoom),
              )
            }
            return
          }
          // Illustrator's double-click descends one level into the group under the pointer, and
          // opens a text object it reaches. Shape and lasso tools have no double-click meaning.
          const document = documentStore.getState().document
          const target = hierarchySelection(document, toScene(event), documentStore.getState().selection)
          if (target === null) return
          const node = findNode(document, target)
          if (node !== null && isText(node)) {
            startEditingText(node.id)
            return
          }
          documentStore.setSelection([target])
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          const point = toScene(event)
          const hit = hitTest(documentStore.getState().document, point)
          // Illustrator selects what is under the pointer when the selection does not
          // already include it, so the menu always acts on something visible.
          if (hit !== null && !documentStore.getState().selection.includes(hit)) documentStore.setSelection([hit])
          setMenu({ x: event.clientX, y: event.clientY, items: canvasContextItems() })
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault()
        }}
        onDrop={(event) => {
          // Dropping an image file onto the canvas places it, as Illustrator does.
          const files = Array.from(event.dataTransfer.files).filter(
            (file) => file.type === 'image/png' || file.type === 'image/jpeg' || mimeTypeForName(file.name) !== null,
          )
          if (files.length === 0) return
          event.preventDefault()
          void (async () => {
            for (const file of files) {
              const bytes = new Uint8Array(await file.arrayBuffer())
              const mimeType = file.type !== '' ? file.type : (mimeTypeForName(file.name) ?? '')
              await placeImage(file.name, mimeType, bytes)
            }
          })()
        }}
      />
      {overlay !== null && (
        <ShapePreview
          preview={overlay}
          params={workspaceStore.getState().creationDefaults.shape}
          zoom={state.viewport.zoom}
          panX={state.viewport.panX}
          panY={state.viewport.panY}
        />
      )}
      {selectedPath !== null && (
        <AnchorOverlay
          nodeId={selectedPath.id}
          anchors={selectedPath.anchors}
          width={selectedPath.width}
          height={selectedPath.height}
          transform={selectedPath.transform}
          activeIndices={workspace.anchorSelection?.nodeId === selectedPath.id ? workspace.anchorSelection.indices : []}
          zoom={state.viewport.zoom}
          panX={state.viewport.panX}
          panY={state.viewport.panY}
        />
      )}
      {penDraft !== null && (
        <PathPreview draft={penDraft} zoom={state.viewport.zoom} panX={state.viewport.panX} panY={state.viewport.panY} />
      )}
      {lassoPath !== null && lassoPath.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" data-lasso-preview>
          <polygon
            points={lassoPath
              .map((point) => {
                const screen = toScreen({ x: point.x, y: point.y, width: 0, height: 0 })
                return `${screen.x},${screen.y}`
              })
              .join(' ')}
            fill="rgba(124,108,245,0.12)"
            stroke="rgba(124,108,245,0.9)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        </svg>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-neutral-300">
        {stats === null
          ? 'renderer starting…'
          : `${stats.shapes} shapes · ${stats.buckets} buckets · ${Math.round(state.viewport.zoom * 100)}% · last ${stats.lastRenderMs.toFixed(1)} ms · p95 ${stats.p95RenderMs.toFixed(1)} ms`}
      </div>
      {stats !== null && stats.substitutedFonts.length > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-8 left-2 rounded bg-amber-900/80 px-2 py-1 text-[10px] text-amber-100"
        >
          Font not available, drawn with Inter: {stats.substitutedFonts.join(', ')}
        </div>
      )}
      {error !== null && (
        <p role="alert" className="absolute left-2 right-2 top-2 rounded bg-red-900/80 px-2 py-1 text-xs text-red-100">
          {error}
        </p>
      )}
      {stats !== null && stats.missingAssets.length > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-14 left-2 rounded bg-amber-900/80 px-2 py-1 text-[10px] text-amber-100"
        >
          Image link missing, drawn as a frame: {stats.missingAssets.length}
        </div>
      )}
      {state.lastError !== null && (
        <p
          role="status"
          className="absolute bottom-2 right-2 rounded bg-amber-900/80 px-2 py-1 text-[10px] text-amber-100"
        >
          Rejected {state.lastError.code}: {state.lastError.message}
        </p>
      )}
      {editing !== null &&
        (() => {
          const box = editorBox(editing.nodeId)
          const node = findNode(state.document, editing.nodeId)
          if (box === null || node === null || !isText(node)) return null
          return (
            <TextEditor
              initialText={editing.text}
              box={box}
              color={node.style.fill}
              align={node.align}
              measure={(text) => editorMeasure(editing.nodeId, text)}
              onCommit={(text) => commitText(editing.nodeId, text)}
              onCancel={() => setEditing(null)}
            />
          )
        })()}
      {hover !== null && (
        <HoverOverlay
          box={hover.box}
          rotation={hover.rotation}
          zoom={state.viewport.zoom}
          panX={state.viewport.panX}
          panY={state.viewport.panY}
        />
      )}
      {rotationBadge !== null && (
        <div
          data-rotation-badge
          className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-chrome-panel/95 px-2 py-1 text-[11px] tabular-nums text-ink shadow"
        >
          {rotationBadge}
        </div>
      )}
      <RulersOverlay
        guides={state.document.guides ?? []}
        showRulers={workspace.showRulers}
        showGuides={workspace.showGuides}
        zoom={state.viewport.zoom}
        panX={state.viewport.panX}
        panY={state.viewport.panY}
        width={workspace.canvas.width}
        height={workspace.canvas.height}
        onAddGuide={addGuide}
        onMoveGuide={moveGuide}
        onRemoveGuide={removeGuide}
      />
      <ArtboardOverlay
        pages={artboardRects(state.document)}
        activeId={workspace.activeArtboardId}
        zoom={state.viewport.zoom}
        panX={state.viewport.panX}
        panY={state.viewport.panY}
      />
      {selectionBox !== null && (
        <SelectionOverlay
          box={selectionBox}
          zoom={state.viewport.zoom}
          panX={state.viewport.panX}
          panY={state.viewport.panY}
          toScene={toScene}
          onScaleStart={startScale}
          onScaleMove={moveScale}
          onScaleEnd={endScale}
          rotation={selectionRotation()}
        />
      )}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

