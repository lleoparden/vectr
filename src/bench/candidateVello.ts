/**
 * Renderer-comparison candidate: `vello_cpu` 0.3.0 — the rasterizer VectorCraft
 * uses — compiled to `wasm32-unknown-unknown` with SIMD128 (issue #25).
 *
 * Source and build: `tools/vello-raster/` (raw C ABI, no wasm-bindgen). This
 * target receives the same deterministic geometry as the CanvasKit baseline,
 * applies each item's transform per frame, re-draws the whole scene each frame
 * (no culling: every fixture node is inside the viewport), and blits the
 * premultiplied pixmap into a 2D canvas.
 *
 * Recorded handicaps, not adjusted for: single-threaded (wasm threads need
 * SharedArrayBuffer plus COOP/COEP isolation) and premultiplied-pixel copy-out on
 * every frame.
 */

import wasmUrl from './vendor/vello_raster.wasm?url'
import { primitiveLocalPoints, type Fixture, type FixtureNode, type PrimitiveNode } from './fixtures.ts'
import type { SceneTarget, TargetLiveObjects, TargetStats } from './target.ts'

type VelloExports = {
  memory: WebAssembly.Memory
  vc_new: (width: number, height: number) => number
  vc_free: (state: number) => void
  vc_alloc: (bytes: number) => number
  vc_scene: (
    state: number,
    points: number,
    pointCount: number,
    shapes: number,
    shapeCount: number,
    widths: number,
    transforms: number,
  ) => void
  vc_clear_scene: (state: number) => void
  vc_shape_count: (state: number) => number
  vc_begin: (state: number, translateX: number, translateY: number, scale: number) => void
  vc_draw: (state: number) => void
  vc_render: (state: number) => number
  vc_byte_len: (state: number) => number
}

type SceneUpload = {
  fixture: Fixture
  points: Float32Array
  shapes: Uint32Array
  shapeCount: number
  widths: Float32Array
  transforms: Float32Array
}

const BACKDROP = 0xffffffff

function hexToRgba(hex: string): number {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return ((value << 8) | 0xff) >>> 0
}

/**
 * Flattens a fixture into local-space vertices plus per-shape paint and item
 * transform, exactly as the CanvasKit baseline walks it.
 */
export function buildUpload(fixture: Fixture): SceneUpload {
  const points: number[] = []
  const shapes: number[] = []
  const widths: number[] = []
  const transforms: number[] = []

  const push = (node: PrimitiveNode, x: number, y: number, scale: number) => {
    const local = primitiveLocalPoints(node)
    const start = points.length / 2
    points.push(...local)
    const vertexCount = local.length / 2
    shapes.push(start, vertexCount, hexToRgba(node.style.fill), 0)
    widths.push(0)
    transforms.push(x, y, scale)
    if (node.style.stroke !== null) {
      shapes.push(start, vertexCount, hexToRgba(node.style.stroke), 1)
      widths.push(node.style.strokeWidth)
      transforms.push(x, y, scale)
    }
  }

  const walk = (node: FixtureNode, x: number, y: number, scale: number) => {
    const nextX = x + node.transform.x * scale
    const nextY = y + node.transform.y * scale
    const nextScale = scale * node.transform.scale
    if (node.kind === 'group') {
      for (const child of node.children) walk(child, nextX, nextY, nextScale)
      return
    }
    if (node.kind === 'rect' || node.kind === 'ellipse') {
      push(node, nextX, nextY, nextScale)
      return
    }
    // Text and image fixtures are not measured for this candidate.
  }
  // Opaque white page, mirroring the CanvasKit baseline's white surface clear.
  const artboard = fixture.roots.length > 0 ? { width: 1200, height: 800 } : { width: 0, height: 0 }
  if (artboard.width > 0) {
    const backdrop: PrimitiveNode = {
      kind: 'rect',
      id: 'backdrop',
      transform: { x: 0, y: 0, scale: 1 },
      width: artboard.width,
      height: artboard.height,
      style: { fill: '#ffffff', stroke: null, strokeWidth: 0 },
      segments: 4,
    }
    const local = primitiveLocalPoints(backdrop)
    const start = points.length / 2
    points.push(...local)
    shapes.push(start, local.length / 2, BACKDROP, 0)
    widths.push(0)
    transforms.push(0, 0, 1)
  }

  for (const root of fixture.roots) walk(root, 0, 0, 1)

  return {
    fixture,
    points: new Float32Array(points),
    shapes: new Uint32Array(shapes),
    shapeCount: shapes.length / 4,
    widths: new Float32Array(widths),
    transforms: new Float32Array(transforms),
  }
}

export class VelloSceneTarget implements SceneTarget {
  readonly candidate = 'vello-wasm'
  readonly details = {
    engine: 'vello_cpu 0.3.0 (VectorCraft crates/render backend)',
    simd: 'wasm simd128',
    threads: 0,
    threadNote: 'single-threaded: wasm threads need SharedArrayBuffer plus COOP/COEP isolation',
    wasmBytes: 0,
    culling: 'none (every fixture node is inside the viewport)',
  }

  private upload: SceneUpload | null = null

  private constructor(
    private readonly exports: VelloExports,
    private handle: number,
    private readonly context2d: CanvasRenderingContext2D,
    private imageData: ImageData,
    private byteLength: number,
    private viewport: { zoom: number; panX: number; panY: number },
  ) {}

  static async create(canvas: HTMLCanvasElement): Promise<VelloSceneTarget> {
    const response = await fetch(new URL(wasmUrl, document.baseURI).href)
    const bytes = await response.arrayBuffer()
    const module = await WebAssembly.instantiate(bytes, {})
    const exports = module.instance.exports as unknown as VelloExports
    const context2d = canvas.getContext('2d')
    if (context2d === null) throw new Error('A 2D context is required for the vello candidate.')
    const handle = exports.vc_new(canvas.width, canvas.height)
    const byteLength = exports.vc_byte_len(handle)
    const pointer = exports.vc_render(handle)
    const pixels = new Uint8ClampedArray(exports.memory.buffer, pointer, byteLength)
    const target = new VelloSceneTarget(
      exports,
      handle,
      context2d,
      new ImageData(new Uint8ClampedArray(pixels), canvas.width, canvas.height),
      byteLength,
      { zoom: 1, panX: 0, panY: 0 },
    )
    target.details.wasmBytes = bytes.byteLength
    return target
  }

  modes(): string[] {
    return ['per-item-transform']
  }

  setMode(): void {
    // Single draw path: vello_cpu always re-rasterizes the scene per frame.
  }

  currentMode(): string {
    return 'per-item-transform'
  }

  build(fixture: Fixture): TargetStats {
    const started = performance.now()
    const upload = buildUpload(fixture)
    this.upload = upload
    this.pushScene(upload)
    return { mode: this.currentMode(), buildMs: performance.now() - started, items: upload.shapeCount }
  }

  private pushScene(upload: SceneUpload) {
    const { exports } = this
    const pointsPointer = exports.vc_alloc(upload.points.byteLength)
    const shapesPointer = exports.vc_alloc(upload.shapes.byteLength)
    const widthsPointer = exports.vc_alloc(upload.widths.byteLength)
    const transformsPointer = exports.vc_alloc(upload.transforms.byteLength)
    new Uint8Array(exports.memory.buffer, pointsPointer, upload.points.byteLength).set(
      new Uint8Array(upload.points.buffer),
    )
    new Uint8Array(exports.memory.buffer, shapesPointer, upload.shapes.byteLength).set(
      new Uint8Array(upload.shapes.buffer),
    )
    new Uint8Array(exports.memory.buffer, widthsPointer, upload.widths.byteLength).set(
      new Uint8Array(upload.widths.buffer),
    )
    new Uint8Array(exports.memory.buffer, transformsPointer, upload.transforms.byteLength).set(
      new Uint8Array(upload.transforms.buffer),
    )
    exports.vc_scene(
      this.handle,
      pointsPointer,
      upload.points.length / 2,
      shapesPointer,
      upload.shapeCount,
      widthsPointer,
      transformsPointer,
    )
  }

  draw(): number {
    const started = performance.now()
    const { exports } = this
    exports.vc_begin(this.handle, this.viewport.panX, this.viewport.panY, this.viewport.zoom)
    exports.vc_draw(this.handle)
    const pointer = exports.vc_render(this.handle)
    const pixels = new Uint8ClampedArray(exports.memory.buffer, pointer, this.byteLength)
    this.imageData.data.set(pixels)
    this.context2d.putImageData(this.imageData, 0, 0)
    return performance.now() - started
  }

  resize(width: number, height: number): void {
    this.exports.vc_free(this.handle)
    this.handle = this.exports.vc_new(width, height)
    this.byteLength = this.exports.vc_byte_len(this.handle)
    const pointer = this.exports.vc_render(this.handle)
    const pixels = new Uint8ClampedArray(this.exports.memory.buffer, pointer, this.byteLength)
    this.imageData = new ImageData(new Uint8ClampedArray(pixels), width, height)
    if (this.upload !== null) this.pushScene(this.upload)
  }

  releaseScene(): void {
    this.exports.vc_clear_scene(this.handle)
    this.upload = null
  }

  dispose(): void {
    this.releaseScene()
    this.exports.vc_free(this.handle)
    this.handle = 0
  }

  liveObjects(): TargetLiveObjects {
    return { shapes: this.handle === 0 ? 0 : this.exports.vc_shape_count(this.handle) }
  }

  rootIds(): string[] {
    return []
  }

  invalidateRoot(): void {
    // This candidate has no retained-recording invalidation; the edit scenario is
    // skipped for it by the suite because rootIds() is empty.
  }

  setViewport(next: { zoom?: number; panX?: number; panY?: number }): void {
    this.viewport = { ...this.viewport, ...next }
  }
}

