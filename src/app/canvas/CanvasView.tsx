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
import { hitTest, marqueeHitTest, type Point } from '../../doc/hitTest.ts'
import { clampCornerRadius, outlinePoints } from '../../doc/shapeGeometry.ts'
import { boxFor, constrainEnd, dragIsBigEnough, lineFrom } from './shapeDrag.ts'
import { isText, type NodeId, type Transform } from '../../doc/types.ts'
import { mimeTypeForName } from '../../doc/assets.ts'
import { ContextMenu, type ContextMenuState } from './ContextMenu.tsx'
import { canvasContextItems } from '../menus/contextMenus.ts'
import { placeImage } from '../actions.ts'
import { TextEditor, type TextEditorBox } from './TextEditor.tsx'
import { ShapePreview, type ShapePreviewState } from './ShapePreview.tsx'
import { EditorRenderer, type RenderStats } from '../../render/EditorRenderer.ts'
import { getActiveRenderer, setActiveRenderer } from '../../render/activeRenderer.ts'
import { assetRegistry } from '../../state/assetRegistry.ts'
import { buildScene, type SceneShape } from '../../render/scene.ts'
import { documentStore, type Tool, type Viewport } from '../../state/documentStore.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { workspaceStore } from '../../state/workspaceStore.ts'
import { fitArtboard, zoomAtPoint } from './viewportOps.ts'

type Gesture =
  | { kind: 'none' }
  | { kind: 'create'; tool: ShapeKind; start: Point; current: Point; shift: boolean }
  | { kind: 'move'; start: Point; current: Point; originals: Map<string, Transform> }
  | { kind: 'marquee'; start: Point; current: Point }
  | { kind: 'pan'; startClient: Point; panStart: Point }

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<EditorRenderer | null>(null)
  const gestureRef = useRef<Gesture>({ kind: 'none' })
  const [ready, setReady] = useState(false)
  const [stats, setStats] = useState<RenderStats | null>(null)
  const [overlay, setOverlay] = useState<DragPreview | null>(null)
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
      documentStore.setViewport(fitArtboard(state.document.artboards[0], { width: box.width, height: box.height }))
    }
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
  }, [ready, state.document, state.viewport, state.selection])

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
    return {
      left: world.x * zoom + panX,
      top: world.y * zoom + panY,
      width: Math.max(32, node.width * world.scaleX * zoom),
      height: Math.max(node.lineHeight * world.scaleY * zoom, node.height * world.scaleY * zoom),
      fontSize: Math.max(8, node.fontSize * world.scaleY * zoom),
      lineHeight: Math.max(10, node.lineHeight * world.scaleY * zoom),
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(event.pointerId)
    const start = toScene(event)
    if (event.button === 1) {
      gestureRef.current = {
        kind: 'pan',
        startClient: { x: event.clientX, y: event.clientY },
        panStart: { x: state.viewport.panX, y: state.viewport.panY },
      }
      return
    }
    if (event.button !== 0) return

    const shapeKind = shapeKindForTool(state.tool)
    if (shapeKind !== null) {
      gestureRef.current = { kind: 'create', tool: shapeKind, start, current: start, shift: event.shiftKey }
      setOverlay({ kind: shapeKind, start, current: start, shift: event.shiftKey })
      return
    }

    // The Type tool places a text object where the click landed and starts editing it, which
    // is what Illustrator's Type tool does.
    if (state.tool === 'text') {
      // Keep focus on the canvas from moving: a real mouse-down runs the browser's default focus
      // change *after* this handler, which would blur the editor we are about to open and close it
      // before the user could type a character.
      event.preventDefault()
      const existing = state.document.root.children.filter((node) => node.type === 'text').length
      const defaults = workspaceStore.getState().creationDefaults
      const node = createText(`Text ${existing + 1}`, start.x, start.y, '', {
        // The Type tool's options apply to the object it is about to create.
        fill: defaults.textFill,
        fontSize: defaults.textFontSize,
        align: defaults.textAlign,
      })
      const result = documentStore.dispatch(
        {
          type: 'insertNodes',
          parentId: state.document.root.id,
          index: state.document.root.children.length,
          nodes: [node],
        },
        'add text',
      )
      if (result.ok) {
        documentStore.setSelection([node.id])
        setEditing({ nodeId: node.id, text: '' })
      }
      return
    }

    const hit = hitTest(state.document, start)
    if (hit === null) {
      gestureRef.current = { kind: 'marquee', start, current: start }
      return
    }
    if (event.shiftKey || event.metaKey || event.ctrlKey) documentStore.toggleSelection(hit)
    else if (!state.selection.includes(hit)) documentStore.setSelection([hit])

    // Capture each movable node's transform before the drag so undo restores it.
    const originals = new Map<string, Transform>()
    for (const id of documentStore.getState().selection) {
      const node = findNode(state.document, id)
      if (node !== null && !node.locked) originals.set(id, { ...node.transform })
    }
    if (originals.size === 0) {
      gestureRef.current = { kind: 'none' }
      return
    }
    documentStore.beginTransaction('move')
    gestureRef.current = { kind: 'move', start, current: start, originals }
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current
    if (gesture.kind === 'none') return
    if (gesture.kind === 'pan') {
      documentStore.setViewport({
        panX: gesture.panStart.x + (event.clientX - gesture.startClient.x),
        panY: gesture.panStart.y + (event.clientY - gesture.startClient.y),
      })
      return
    }
    const current = toScene(event)
    if (gesture.kind === 'move') {
      gestureRef.current = { ...gesture, current }
      const dx = current.x - gesture.start.x
      const dy = current.y - gesture.start.y
      for (const [id, original] of gesture.originals) {
        documentStore.dispatch(
          { type: 'setTransform', nodeId: id, transform: { ...original, x: original.x + dx, y: original.y + dy } },
          'move',
        )
      }
      return
    }
    if (gesture.kind === 'create') {
      // Shift is read every move so holding or releasing it mid-drag updates the shape live.
      const next = { ...gesture, current, shift: event.shiftKey }
      gestureRef.current = next
      setOverlay({ kind: next.tool, start: next.start, current: next.current, shift: next.shift })
      return
    }
    gestureRef.current = { ...gesture, current }
    setOverlay({
      kind: 'rect',
      start: gesture.start,
      current,
      shift: false,
    })
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current
    gestureRef.current = { kind: 'none' }
    setOverlay(null)
    canvasRef.current?.releasePointerCapture(event.pointerId)

    if (gesture.kind === 'move') {
      documentStore.commitTransaction()
      return
    }
    if (gesture.kind === 'marquee') {
      documentStore.setSelection(
        marqueeHitTest(state.document, {
          x: Math.min(gesture.start.x, gesture.current.x),
          y: Math.min(gesture.start.y, gesture.current.y),
          width: Math.abs(gesture.current.x - gesture.start.x),
          height: Math.abs(gesture.current.y - gesture.start.y),
        }),
      )
      return
    }
    if (gesture.kind !== 'create') return
    const end = constrainEnd(gesture.start, gesture.current, gesture.tool, gesture.shift)
    if (!dragIsBigEnough(gesture.start, end, gesture.tool, MIN_DRAG)) return
    const box = boxFor(gesture.start, end, gesture.tool)
    const defaults = workspaceStore.getState().creationDefaults
    const label = shapeLabel(gesture.tool)
    const existing = state.document.root.children.filter((node) => node.type === gesture.tool).length
    const node = createShape(
      gesture.tool,
      `${label} ${existing + 1}`,
      box,
      defaults.shape,
      lineFrom(gesture.start, end),
    )
    const result = documentStore.dispatch(
      {
        type: 'insertNodes',
        parentId: state.document.root.id,
        index: state.document.root.children.length,
        nodes: [node],
      },
      `add ${label.toLowerCase()}`,
    )
    if (result.ok) documentStore.setSelection([node.id])
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
        className="block h-full w-full touch-none bg-neutral-900"
        aria-label="Design canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          // Double-clicking a text object with the Selection tool edits it, as in Illustrator.
          const hit = hitTest(documentStore.getState().document, toScene(event), { deep: true })
          const node = hit === null ? null : findNode(documentStore.getState().document, hit)
          if (node !== null && isText(node)) startEditingText(node.id)
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
              onCommit={(text) => commitText(editing.nodeId, text)}
              onCancel={() => setEditing(null)}
            />
          )
        })()}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

