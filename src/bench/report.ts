/**
 * Report and verdict logic for the Phase 1 renderer spike (issue #15).
 *
 * Pure and dependency-free so it can be unit tested and so the packaged run and
 * the summarizer agree on one schema.
 */

import { FIXTURE_VERSION } from './fixtures.ts'
import type { RenderMode } from './renderer.ts'

export const REPORT_SCHEMA_VERSION = 1

/** Provisional Phase 0 target retained for the Phase 1 gate. */
export const INTERACTION_TARGET_MS = 33

export type RendererBackend = 'webgl' | 'cpu-fallback' | 'unsupported'

export type ScenarioMetrics = {
  scenario: string
  /** Fixture content or interaction label this measurement belongs to. */
  detail: string
  /** Draw path under test: the slice 1 control path or recorded-picture replay. */
  renderMode: RenderMode
  /** One-time parse/build cost for the scene, excluded from interaction timing. */
  buildMs: number
  /** Draw submission time for the measured action, excluding build and React. */
  drawMs: number
  /**
   * Primary gate metric: viewport change + draw + flush, without waiting for a
   * presented frame. This is the renderer work an interaction costs.
   */
  interactionMs: number
  /**
   * Informational: the same action including one presented frame, so the
   * vsync-inclusive cost is visible without deciding the gate.
   */
  presentedMs: number
  /** Informational: the same action driven through React state, as in Phase 0. */
  uiInteractionMs: number
  /** Retained Skia objects still alive after the action. */
  livePaths: number
  liveImages: number
  liveParagraphs: number
  livePictures: number
  /** Transient JS heap reading, when the runtime exposes it. */
  heapBytes: number | null
}

export type RunRecord = {
  schemaVersion: number
  fixtureVersion: number
  reportKind: 'phase-one-renderer-spike'
  capturedAt: string
  renderer: {
    backend: RendererBackend
    wasmBytes: number
    webglAvailable: boolean
    fontLoaded: boolean
  }
  environment: {
    platform: string
    arch: string
    electron: string
    chrome: string
    devicePixelRatio: number
  }
  scenarios: ScenarioMetrics[]
  notes: string[]
}

export type MemorySample = { privateBytes: number; workingSetBytes: number }

export type Verdict = {
  interactionTargetMs: number
  worstInteractionMs: number
  pass: boolean
  summary: string
}

/**
 * The verdict uses the renderer interaction path (`interactionMs`): viewport
 * change, draw, and flush, excluding one-time build work, React rendering, and
 * the vsync wait. Phase 0's number included a two-frame wait, so it was dominated
 * by presentation latency; this definition measures the work Vectr controls.
 * `presentedMs` and `uiInteractionMs` are reported next to it so the
 * vsync-inclusive picture stays visible without deciding the gate.
 */
export function computeVerdict(scenarios: ScenarioMetrics[], target = INTERACTION_TARGET_MS): Verdict {
  const measured = scenarios.filter((scenario) => scenario.interactionMs > 0)
  const worst = measured.reduce((highest, scenario) => Math.max(highest, scenario.interactionMs), 0)
  const pass = measured.length > 0 && worst <= target
  return {
    interactionTargetMs: target,
    worstInteractionMs: round(worst),
    pass,
    summary:
      measured.length === 0
        ? 'no interaction measurements were recorded'
        : pass
          ? `worst renderer interaction ${round(worst)} ms is within the ${target} ms target`
          : `worst renderer interaction ${round(worst)} ms exceeds the ${target} ms target`,
  }
}

export function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index]
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Aggregates repeated runs so the summary can compare against one target. */
export function summarizeRuns(runs: RunRecord[], target = INTERACTION_TARGET_MS) {
  const byDetail = new Map<string, ScenarioMetrics[]>()
  for (const run of runs) {
    for (const scenario of run.scenarios) {
      const key = `${scenario.renderMode}:${scenario.scenario}:${scenario.detail}`
      const list = byDetail.get(key) ?? []
      list.push(scenario)
      byDetail.set(key, list)
    }
  }
  const entries = [...byDetail.entries()].map(([key, list]) => {
    const [renderMode, scenario, detail] = key.split(':')
    const interactions = list.map((item) => item.interactionMs)
    const draws = list.map((item) => item.drawMs)
    return {
      renderMode,
      scenario,
      detail,
      runs: list.length,
      buildMsP95: round(percentile(list.map((item) => item.buildMs), 0.95)),
      drawMsP95: round(percentile(draws, 0.95)),
      interactionMsP95: round(percentile(interactions, 0.95)),
      presentedMsP95: round(percentile(list.map((item) => item.presentedMs), 0.95)),
      uiInteractionMsP95: round(percentile(list.map((item) => item.uiInteractionMs), 0.95)),
      worstInteractionMs: round(Math.max(...interactions)),
      maxLivePaths: Math.max(...list.map((item) => item.livePaths)),
      maxLiveImages: Math.max(...list.map((item) => item.liveImages)),
      maxLiveParagraphs: Math.max(...list.map((item) => item.liveParagraphs)),
      maxLivePictures: Math.max(...list.map((item) => item.livePictures)),
      maxHeapBytes: Math.max(...list.map((item) => item.heapBytes ?? 0)),
    }
  })

  const scenariosOf = (mode: RenderMode) =>
    runs.flatMap((run) => run.scenarios.filter((scenario) => scenario.renderMode === mode))
  const verdicts = {
    // The control path is measured, reported, and not used to decide the gate.
    direct: computeVerdict(scenariosOf('direct'), target),
    // The production candidate: recorded-picture replay.
    picture: computeVerdict(scenariosOf('picture'), target),
  }
  const deciding = verdicts.picture.worstInteractionMs > 0 ? verdicts.picture : verdicts.direct

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    fixtureVersion: FIXTURE_VERSION,
    runCount: runs.length,
    interactionTargetMs: target,
    worstInteractionMsP95: deciding.worstInteractionMs,
    decidingMode: deciding === verdicts.picture ? 'picture' : 'direct',
    pass: deciding.pass,
    backend: runs[0]?.renderer.backend ?? 'unsupported',
    fontLoaded: runs[0]?.renderer.fontLoaded ?? false,
    wasmBytes: runs[0]?.renderer.wasmBytes ?? 0,
    verdicts,
    entries,
  }
}
