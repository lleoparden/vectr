/**
 * Shared renderer-target interface for the Phase 1 renderer comparison
 * (issue #25).
 *
 * The slice 1b suite was written against the CanvasKit scene renderer. The
 * comparison needs the same fixtures, the same gate definition, and the same
 * scenario sequence applied to other rasterizers, so this interface names the
 * exact operations the suite performs. Implementations: `SceneRenderer`
 * (CanvasKit, candidates `canvaskit`) and the candidate targets
 * (`vello-wasm`, `resvg-wasm`).
 */

import type { Fixture } from './fixtures.ts'

export type TargetStats = {
  mode: string
  buildMs: number
  items: number
}

export type TargetLiveObjects = {
  paths?: number
  images?: number
  paragraphs?: number
  pictures?: number
  /** Wasm-side scene shapes, used by the vello candidate's leak check. */
  shapes?: number
}

export interface SceneTarget {
  /** Stable candidate name recorded in the report, for example `canvaskit`. */
  readonly candidate: string
  /** Draw paths this target exposes; the suite measures each one. */
  modes(): string[]
  setMode(mode: string): void
  currentMode(): string
  /** Builds retained state for a fixture; excluded from interaction timing. */
  build(fixture: Fixture): TargetStats
  /** Produces one frame with the current viewport; returns milliseconds. */
  draw(): number
  resize(width: number, height: number): void
  /** Drops retained scene state without destroying the surface. */
  releaseScene(): void
  dispose(): void
  liveObjects(): TargetLiveObjects
  rootIds(): string[]
  invalidateRoot(rootId: string): void
  setViewport(next: { zoom?: number; panX?: number; panY?: number }): void
}
