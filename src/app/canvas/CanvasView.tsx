/**
 * Canvas view (issue #18).
 *
 * Owns the renderer and the pointer gestures. Every edit goes through the store,
 * so a drag is one transaction and one history entry, tools create nodes through
 * commands, and selection comes from the pure hit-test module.
 */

import { useEffect, useRef, useState } from 'react'
import { createShape, createText, estimateTextSize, findNode, shapeLabel, worldTransform } from '../../doc/document.ts'
import type { ShapeKind } from '../../doc/document.ts'
import { hitTest, hierarchySelection, lassoHitTest, marqueeHitTest, type Point } from '../../doc/hitTest.ts'
import { clampCornerRadius, outlinePoints } from '../../geom/shapeGeometry.ts'
import { boxFor, constrainEnd, dragIsBigEnough, lineFrom } from './shapeDrag.ts'
import { isText, type NodeId, type Transform } from '../../doc/types.ts'
import { mimeTypeForName } from '../../doc/assets.ts'
import { ContextMenu, type ContextMenuState } from './ContextMenu.tsx'
import { canvasContextItems } from '../menus/contextMenus.ts'
import { addGuide, moveGuide, placeImage, removeGuide } from '../actions.ts'
import { TextEditor, type TextEditorBox } from './TextEditor.tsx'
import { ShapePreview, type ShapePreviewState } from './ShapePreview.tsx'
import { SelectionOverlay } from './SelectionOverlay.tsx'
import { ArtboardOverlay } from './ArtboardOverlay.tsx'
import { RulersOverlay } from './RulersOverlay.tsx'
import { createToolStateMachines, isStateMachineTool } from '../../tools/index.ts'
import { createScaleTool, type ScaleTool } from '../../tools/transform.ts'
import type { ToolHost, ToolPoint } from '../../tools/types.ts'
import { snapBox, snapTargets, SNAP_PIXELS, type SnapGuide } from '../editing/snapping.ts'
import { deepHitWithin, withinIsolation } from '../editing/isolation.ts'
import { unionBounds } from '../../doc/transform.ts'
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
  const [lassoPath, setLassoPath] = useState<Point[] | null>(null)
  /** Smart-guide lines shown while a snapped drag is in flight (issue #68). */
  const [guides, setGuides] = useState<SnapGuide[]>([])
  /** The scale gesture's starting box and transforms, captured once so every move is absolute. */
  // Phase 4.1: the scale gesture is a tool; the overlay's callbacks below adapt to it.
  const scaleToolRef = useRef<ScaleTool | null>(null)
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
      toggleSelection: (id) => documentStore.toggleSelection(id),
      beginMove: () => {
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
        documentStore.beginTransaction('move')
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
        if (moveRef.current === null) return
        moveRef.current = null
        setGuides([])
        documentStore.commitTransaction()
      },
      cancelMove: () => {
        if (moveRef.current === null) return
        moveRef.current = null
        setGuides([])
        documentStore.abortTransaction()
      },
      setMarquee: (rect) =>
        setOverlay(
          rect === null
            ? null
            : {
                kind: 'rect',
                start: { x: rect.x, y: rect.y },
                current: { x: rect.x + rect.width, y: rect.y + rect.height },
                shift: false,
              },
        ),
      commitMarquee: (rect, deep) =>
        documentStore.setSelection(marqueeHitTest(documentStore.getState().document, rect, { deep })),
      viewport: () => {
        const viewport = documentStore.getState().viewport
        return { panX: viewport.panX, panY: viewport.panY }
      },
      panTo: (panX, panY) => documentStore.setViewport({ panX, panY }),
      setLasso: (points) => setLassoPath(points),
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
        const current = documentStore.getState()
        const box = unionBounds(current.document, current.selection)
        if (box === null) return null
        const originals = new Map<string, Transform>()
        for (const id of current.selection) {
          const node = findNode(current.document, id)
          if (node !== null && !node.locked) originals.set(id, { ...node.transform })
        }
        if (originals.size === 0) return null
        documentStore.beginTransaction('scale')
        return { box, originals }
      },
      setNodeTransform: (nodeId, transform) => {
        documentStore.dispatch({ type: 'setTransform', nodeId, transform }, 'scale')
      },
      scaleEnd: () => documentStore.commitTransaction(),
      scaleCancel: () => documentStore.abortTransaction(),
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

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(event.pointerId)
    const start = toScene(event)
    // The pointer tools are state machines (Phase 3.2): the canvas routes the event and supplies
    // the host, so the tool owns the gesture and the canvas owns the document.
    if (event.button === 0 && isStateMachineTool(state.tool)) {
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

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
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

  // Wheel zoom needs a non-passive listener, so it is attached directly.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const viewport = documentStore.getState().viewport
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
        className={
          'block h-full w-full touch-none bg-neutral-900 ' +
          (state.tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : '')
        }
        aria-label="Design canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
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
        />
      )}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

