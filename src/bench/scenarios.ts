/**
 * Measurement scenarios for the Phase 1 renderer comparison (issues #15, #23, #25).
 *
 * Timing definitions, applied identically to every target and candidate:
 * - `buildMs`: one-time scene work (geometry, decode, layout, upload, recording).
 * - `drawMs`: median viewport-apply + frame production + flush.
 * - `interactionMs` (gate): median of viewport change + frame production + flush,
 *   excluding build and React, so it measures the work an interaction costs.
 * - `presentedMs`: one interaction including a presented frame (vsync visible).
 * - `uiInteractionMs`: the same action driven through React state, as Phase 0 did.
 *
 * One implementation serves every target, so candidates cannot accidentally be
 * measured with a different method.
 */

import { createFixture, type FixtureContent, type FixtureSize } from './fixtures.ts'
import type { ScenarioMetrics } from './report.ts'
import type { SceneTarget } from './target.ts'

export type ScenarioSuiteOptions = {
  /** Renderer targets to measure; each one reports its own candidate name. */
  targets: SceneTarget[]
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

export async function runScenarioSuite(options: ScenarioSuiteOptions): Promise<ScenarioSuiteResult> {
  const cycles = options.cycles ?? 10
  const samples = options.samples ?? 5
  const scenarios: ScenarioMetrics[] = []
  const notes: string[] = []

  const measureFixture = async (content: FixtureContent, size: FixtureSize, target: SceneTarget, mode: string) => {
    target.setMode(mode)
    const fixture = createFixture(content, size)
    const stats = target.build(fixture)

    const drawSamples: number[] = []
    for (let sample = 0; sample < samples; sample += 1) {
      target.setViewport({ zoom: 1, panX: 0, panY: 0 })
      drawSamples.push(target.draw())
    }

    const interactionSamples: number[] = []
    for (let sample = 0; sample < samples; sample += 1) {
      const started = performance.now()
      target.setViewport({
        zoom: 1 + (sample + 1) * 0.02,
        panX: (sample + 1) * 3,
        panY: (sample + 1) * 2,
      })
      target.draw()
      interactionSamples.push(performance.now() - started)
    }

    const presentedStarted = performance.now()
    target.setViewport({ zoom: 1.1, panX: 6, panY: 4 })
    target.draw()
    await nextFrame()
    const presentedMs = performance.now() - presentedStarted

    const uiInteractionMs = options.measureUiInteraction ? await options.measureUiInteraction() : 0

    target.setViewport({ zoom: 1, panX: 0, panY: 0 })
    target.draw()
    const live = target.liveObjects()
    scenarios.push({
      candidate: target.candidate,
      scenario: 'fixture',
      detail: `${content}/${size}`,
      renderMode: mode,
      buildMs: stats.buildMs,
      drawMs: median(drawSamples),
      interactionMs: median(interactionSamples),
      presentedMs,
      uiInteractionMs,
      livePaths: live.paths ?? 0,
      liveImages: live.images ?? 0,
      liveParagraphs: live.paragraphs ?? 0,
      livePictures: live.pictures ?? 0,
      liveShapes: live.shapes ?? 0,
      heapBytes: heapBytes(),
    })

    // Invalidation only exists on the recorded path; a candidate that reports no
    // roots skips the edit scenario rather than faking it.
    if (mode === 'picture') {
      const rootIds = target.rootIds()
      if (rootIds.length > 0) {
        const editedRoot = rootIds[0]
        const editStarted = performance.now()
        target.invalidateRoot(editedRoot)
        target.draw()
        const editMs = performance.now() - editStarted
        const editedLive = target.liveObjects()
        scenarios.push({
          candidate: target.candidate,
          scenario: 'edit',
          detail: `${content}/${size} root ${editedRoot}`,
          renderMode: mode,
          buildMs: editMs,
          drawMs: 0,
          interactionMs: 0,
          presentedMs: 0,
          uiInteractionMs: 0,
          livePaths: editedLive.paths ?? 0,
          liveImages: editedLive.images ?? 0,
          liveParagraphs: editedLive.paragraphs ?? 0,
          livePictures: editedLive.pictures ?? 0,
          liveShapes: editedLive.shapes ?? 0,
          heapBytes: heapBytes(),
        })
      }
    }
  }

  for (const target of options.targets) {
    for (const content of options.contents) {
      for (const size of options.sizes) {
        for (const mode of target.modes()) {
          options.onProgress?.(`${target.candidate}/${content}/${size} ${mode}`)
          await measureFixture(content, size, target, mode)
        }

        // Replacement and resize are measured on the target's active mode.
        const previousSize = options.sizes[options.sizes.indexOf(size) - 1]
        if (previousSize !== undefined) {
          const replaceStarted = performance.now()
          target.build(createFixture(content, previousSize))
          const replaceDrawMs = target.draw()
          const replaceBuildMs = performance.now() - replaceStarted - replaceDrawMs
          const replaced = target.liveObjects()
          scenarios.push({
            candidate: target.candidate,
            scenario: 'replace',
            detail: `${content}/${previousSize}<-${content}/${size}`,
            renderMode: target.currentMode(),
            buildMs: replaceBuildMs,
            drawMs: replaceDrawMs,
            interactionMs: 0,
            presentedMs: 0,
            uiInteractionMs: 0,
            livePaths: replaced.paths ?? 0,
            liveImages: replaced.images ?? 0,
            liveParagraphs: replaced.paragraphs ?? 0,
            livePictures: replaced.pictures ?? 0,
            liveShapes: replaced.shapes ?? 0,
            heapBytes: heapBytes(),
          })
          target.build(createFixture(content, size))
        }

        const resizeStarted = performance.now()
        target.resize(1280, 860)
        const resizeDrawMs = target.draw()
        target.resize(1200, 800)
        const resizeTotalMs = performance.now() - resizeStarted
        const resized = target.liveObjects()
        scenarios.push({
          candidate: target.candidate,
          scenario: 'resize',
          detail: `${content}/${size}`,
          renderMode: target.currentMode(),
          buildMs: resizeTotalMs - resizeDrawMs,
          drawMs: resizeDrawMs,
          interactionMs: 0,
          presentedMs: 0,
          uiInteractionMs: 0,
          livePaths: resized.paths ?? 0,
          liveImages: resized.images ?? 0,
          liveParagraphs: resized.paragraphs ?? 0,
          livePictures: resized.pictures ?? 0,
          liveShapes: resized.shapes ?? 0,
          heapBytes: heapBytes(),
        })
      }
    }
  }

  for (const target of options.targets) {
    for (const mode of target.modes()) {
      target.setMode(mode)
      const heapBefore = heapBytes()
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        for (const content of options.contents) {
          target.build(createFixture(content, 'representative'))
          target.draw()
        }
        target.releaseScene()
      }
      const idle = target.liveObjects()
      const heapAfter = heapBytes()
      const heapDelta = heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore
      const retained = (idle.paths ?? 0) + (idle.images ?? 0) + (idle.paragraphs ?? 0) + (idle.pictures ?? 0) + (idle.shapes ?? 0)
      notes.push(
        `${target.candidate}/${mode}: after ${cycles} build/draw/release cycles retained=${retained} (paths=${idle.paths ?? 0} images=${idle.images ?? 0} paragraphs=${idle.paragraphs ?? 0} pictures=${idle.pictures ?? 0} shapes=${idle.shapes ?? 0})`,
      )
      if (retained !== 0) {
        notes.push(`LEAK (${target.candidate}/${mode}): retained scene objects did not return to zero after release.`)
      }
      scenarios.push({
        candidate: target.candidate,
        scenario: 'unload',
        detail: `${cycles} cycles`,
        renderMode: mode,
        buildMs: 0,
        drawMs: 0,
        interactionMs: 0,
        presentedMs: 0,
        uiInteractionMs: 0,
        livePaths: idle.paths ?? 0,
        liveImages: idle.images ?? 0,
        liveParagraphs: idle.paragraphs ?? 0,
        livePictures: idle.pictures ?? 0,
        liveShapes: idle.shapes ?? 0,
        heapBytes: heapDelta,
      })
    }
  }

  return { scenarios, notes }
}
