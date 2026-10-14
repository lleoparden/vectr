/**
 * Canvas view (issue #18).
 *
 * Owns the renderer and the pointer gestures. Every edit goes through the store,
 * so a drag is one transaction and one history entry, tools create nodes through
 * commands, and selection comes from the pure hit-test module.
 */

import { useEffect, useRef, useState } from 'react'
import { createEllipse, createRect, findNode } from '../doc/document.ts'
import { hitTest, marqueeHitTest, type Point } from '../doc/hitTest.ts'
import type { Transform } from '../doc/types.ts'
import { EditorRenderer, type RenderStats } from '../render/EditorRenderer.ts'
import { setActiveRenderer } from '../render/activeRenderer.ts'
import { buildScene, type SceneShape } from '../render/scene.ts'
import { documentStore, type Viewport } from '../state/documentStore.ts'
import { useEditorState } from '../state/useEditorState.ts'

type Gesture =
  | { kind: 'none' }
  | { kind: 'create'; tool: 'rect' | 'ellipse'; start: Point; current: Point }
  | { kind: 'move'; start: Point; current: Point; originals: Map<string, Transform> }
  | { kind: 'marquee'; start: Point; current: Point }
  | { kind: 'pan'; startClient: Point; panStart: Point }

const MIN_DRAG = 4
const ZOOM_MIN = 0.05
const ZOOM_MAX = 32

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
  const [overlay, setOverlay] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const renderedOnce = useRef(false)

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

    if (state.tool === 'rect' || state.tool === 'ellipse') {
      gestureRef.current = { kind: 'create', tool: state.tool, start, current: start }
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
    gestureRef.current = { ...gesture, current }
    setOverlay(
      toScreen({
        x: Math.min(gesture.start.x, current.x),
        y: Math.min(gesture.start.y, current.y),
        width: Math.abs(current.x - gesture.start.x),
        height: Math.abs(current.y - gesture.start.y),
      }),
    )
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
    const width = Math.abs(gesture.current.x - gesture.start.x)
    const height = Math.abs(gesture.current.y - gesture.start.y)
    if (width < MIN_DRAG || height < MIN_DRAG) return
    const x = Math.min(gesture.start.x, gesture.current.x)
    const y = Math.min(gesture.start.y, gesture.current.y)
    const kind = gesture.tool
    const existing = state.document.root.children.filter((node) => node.type === kind).length
    const label = kind === 'rect' ? 'Rectangle' : 'Ellipse'
    const node =
      kind === 'rect'
        ? createRect(`${label} ${existing + 1}`, x, y, width, height)
        : createEllipse(`${label} ${existing + 1}`, x, y, width, height)
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

  // Wheel zoom needs a non-passive listener, so it is attached directly.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const viewport = documentStore.getState().viewport
      const box = canvas.getBoundingClientRect()
      const pointerX = event.clientX - box.left
      const pointerY = event.clientY - box.top
      const factor = Math.exp(-event.deltaY * 0.0015)
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, viewport.zoom * factor))
      const ratio = zoom / viewport.zoom
      documentStore.setViewport({
        zoom,
        panX: pointerX - (pointerX - viewport.panX) * ratio,
        panY: pointerY - (pointerY - viewport.panY) * ratio,
      })
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
      />
      {overlay !== null && (
        <div
          className="pointer-events-none absolute border border-violet-400/80 bg-violet-400/10"
          style={{ left: overlay.x, top: overlay.y, width: overlay.width, height: overlay.height }}
        />
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-neutral-300">
        {stats === null
          ? 'renderer starting…'
          : `${stats.shapes} shapes · ${stats.buckets} buckets · ${Math.round(state.viewport.zoom * 100)}% · last ${stats.lastRenderMs.toFixed(1)} ms · p95 ${stats.p95RenderMs.toFixed(1)} ms`}
      </div>
      {error !== null && (
        <p role="alert" className="absolute left-2 right-2 top-2 rounded bg-red-900/80 px-2 py-1 text-xs text-red-100">
          {error}
        </p>
      )}
      {state.lastError !== null && (
        <p
          role="status"
          className="absolute bottom-2 right-2 rounded bg-amber-900/80 px-2 py-1 text-[10px] text-amber-100"
        >
          Rejected {state.lastError.code}: {state.lastError.message}
        </p>
      )}
    </div>
  )
}

