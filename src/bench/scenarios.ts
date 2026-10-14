/**
 * Measurement scenarios for the Phase 1 renderer spike (issue #15).
 *
 * Timing definitions, applied identically to every fixture:
 * - `buildMs`: one-time fixture-to-retained-object work (geometry/decode/layout).
 * - `drawMs`: median viewport-apply + draw + flush submission.
 * - `interactionMs` (gate): median of viewport change + draw + flush, excluding
 *   build and React, so it measures the renderer work an interaction costs.
 * - `presentedMs`: one interaction including a presented frame (vsync visible).
 * - `uiInteractionMs`: the same action driven through React state, as Phase 0 did.
 */

import { createFixture, type Fixture, type FixtureContent, type FixtureSize } from './fixtures.ts'
import type { ScenarioMetrics } from './report.ts'
import type { SceneRenderer } from './renderer.ts'

export type ScenarioSuiteOptions = {
  contents: FixtureContent[]
  sizes: FixtureSize[]
  /** Unload/reload cycles used for the leak check. */
  cycles?: number
  /** Repeated samples per timing measurement; the median is reported. */
  samples?: number
  /** React-driven interaction measurement supplied by the app shell. */
  measureUiInteraction?: () => Promise<number>
  onProgress?: (label: string) => void
}

export type ScenarioSuiteResult = {
  scenarios: ScenarioMetrics[]
  notes: string[]
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** Waits for a presented frame after a committed React render. */
export function afterPaint(): Promise<void> {
  return nextFrame().then(nextFrame)
}

export function heapBytes(): number | null {
  const memory = performance as Performance & { memory?: { usedJSHeapSize: number } }
  return memory.memory ? memory.memory.usedJSHeapSize : null
}

export function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export async function runScenarioSuite(
  renderer: SceneRenderer,
  options: ScenarioSuiteOptions,
): Promise<ScenarioSuiteResult> {
  const cycles = options.cycles ?? 10
  const samples = options.samples ?? 5
  const scenarios: ScenarioMetrics[] = []
  const notes: string[] = []
  let previous: { content: FixtureContent; size: FixtureSize; fixture: Fixture } | null = null

  for (const content of options.contents) {
    for (const size of options.sizes) {
      const label = `${content}/${size}`
      options.onProgress?.(label)
      const fixture = createFixture(content, size)
      const stats = renderer.build(fixture)

      const drawSamples: number[] = []
      for (let sample = 0; sample < samples; sample += 1) {
        renderer.setViewport({ zoom: 1, panX: 0, panY: 0 })
        drawSamples.push(renderer.draw())
      }

      const interactionSamples: number[] = []
      for (let sample = 0; sample < samples; sample += 1) {
        const started = performance.now()
        renderer.setViewport({
          zoom: 1 + (sample + 1) * 0.02,
          panX: (sample + 1) * 3,
          panY: (sample + 1) * 2,
        })
        renderer.draw()
        interactionSamples.push(performance.now() - started)
      }

      const presentedStarted = performance.now()
      renderer.setViewport({ zoom: 1.1, panX: 6, panY: 4 })
      renderer.draw()
      await nextFrame()
      const presentedMs = performance.now() - presentedStarted

      const uiInteractionMs = options.measureUiInteraction
        ? await options.measureUiInteraction()
        : 0

      renderer.setViewport({ zoom: 1, panX: 0, panY: 0 })
      renderer.draw()
      const live = renderer.liveObjects()

      scenarios.push({
        scenario: 'fixture',
        detail: label,
        buildMs: stats.buildMs,
        drawMs: median(drawSamples),
        interactionMs: median(interactionSamples),
        presentedMs,
        uiInteractionMs,
        livePaths: live.paths,
        liveImages: live.images,
        liveParagraphs: live.paragraphs,
        heapBytes: heapBytes(),
      })

      if (previous !== null) {
        const replaceStarted = performance.now()
        renderer.build(previous.fixture)
        const replaceDrawMs = renderer.draw()
        const replaceBuildMs = performance.now() - replaceStarted - replaceDrawMs
        const replaced = renderer.liveObjects()
        scenarios.push({
          scenario: 'replace',
          detail: `${previous.content}/${previous.size}<-${label}`,
          buildMs: replaceBuildMs,
          drawMs: replaceDrawMs,
          interactionMs: 0,
          presentedMs: 0,
          uiInteractionMs: 0,
          livePaths: replaced.paths,
          liveImages: replaced.images,
          liveParagraphs: replaced.paragraphs,
          heapBytes: heapBytes(),
        })
        renderer.build(fixture)
      }
      previous = { content, size, fixture }

      const resizeStarted = performance.now()
      renderer.resize(1280, 860)
      const resizeDrawMs = renderer.draw()
      renderer.resize(1200, 800)
      const resizeTotalMs = performance.now() - resizeStarted
      const resized = renderer.liveObjects()
      scenarios.push({
        scenario: 'resize',
        detail: label,
        buildMs: resizeTotalMs - resizeDrawMs,
        drawMs: resizeDrawMs,
        interactionMs: 0,
        presentedMs: 0,
        uiInteractionMs: 0,
        livePaths: resized.paths,
        liveImages: resized.images,
        liveParagraphs: resized.paragraphs,
        heapBytes: heapBytes(),
      })
    }
  }

  const heapBefore = heapBytes()
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const content of options.contents) {
      renderer.build(createFixture(content, 'representative'))
      renderer.draw()
    }
    renderer.releaseScene()
  }
  const idle = renderer.liveObjects()
  const heapAfter = heapBytes()
  const heapDelta = heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore
  notes.push(
    `after ${cycles} build/draw/release cycles: paths=${idle.paths} images=${idle.images} paragraphs=${idle.paragraphs}`,
  )
  if (idle.paths !== 0 || idle.images !== 0 || idle.paragraphs !== 0) {
    notes.push('LEAK: retained scene objects did not return to zero after release.')
  }
  scenarios.push({
    scenario: 'unload',
    detail: `${cycles} cycles`,
    buildMs: 0,
    drawMs: 0,
    interactionMs: 0,
    presentedMs: 0,
    uiInteractionMs: 0,
    livePaths: idle.paths,
    liveImages: idle.images,
    liveParagraphs: idle.paragraphs,
    heapBytes: heapDelta,
  })

  return { scenarios, notes }
}

