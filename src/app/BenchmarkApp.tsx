/**
 * Benchmark shell for the renderer comparison (issues #15, #23, #25).
 *
 * `?candidate=canvaskit` (default) runs the CanvasKit target with both draw paths;
 * `?candidate=vello` runs the vello_cpu wasm candidate on the primitives and
 * nested-group gate fixtures. One measurement implementation serves both.
 */

import { useEffect, useRef, useState } from 'react'
import { runScenarioSuite, afterPaint } from '../bench/scenarios.ts'
import { computeVerdict, type RunRecord, type ScenarioMetrics, type Verdict } from '../bench/report.ts'
import { SceneRenderer, type RendererInfo } from '../bench/renderer.ts'
import { VelloSceneTarget } from '../bench/candidateVello.ts'
import type { SceneTarget } from '../bench/target.ts'
import { FIXTURE_VERSION, type FixtureContent, type FixtureSize } from '../bench/fixtures.ts'

const allContents: FixtureContent[] = ['primitives', 'text', 'images', 'groups']
const sizes: FixtureSize[] = ['empty', 'representative', 'stress']

const requestedCandidate = new URLSearchParams(window.location.search).get('candidate') ?? 'canvaskit'
const isVello = requestedCandidate === 'vello'

/** The vello candidate covers the gate fixtures; text and images are not measured. */
const candidateContents: FixtureContent[] = isVello ? ['primitives', 'groups'] : allContents

/** `?contents=primitives,text` narrows the run for quick validation checks. */
function activeContents(): FixtureContent[] {
  const requested = new URLSearchParams(window.location.search).get('contents')
  if (requested === null) return candidateContents
  const wanted = requested.split(',')
  const filtered = candidateContents.filter((content) => wanted.includes(content))
  return filtered.length > 0 ? filtered : candidateContents
}

type RunSummary = {
  verdict: Verdict
  info: string
  scenarios: ScenarioMetrics[]
  notes: string[]
}

export function BenchmarkApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef<SceneTarget | null>(null)
  const [targetInfo, setTargetInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('starting')
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const target = isVello
          ? await VelloSceneTarget.create(canvasRef.current!)
          : await SceneRenderer.create(canvasRef.current!)
        if (cancelled) {
          target.dispose()
          return
        }
        targetRef.current = target
        setTargetInfo(target.candidate)
        setProgress('idle')
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'The renderer target did not initialize.'
        console.error(`target create failed: ${message}`)
        setError(message)
        setProgress('failed')
      }
    })()
    return () => {
      cancelled = true
      targetRef.current?.dispose()
      targetRef.current = null
    }
  }, [])

  /** React-driven interaction, kept only as the Phase 0 comparable number. */
  async function measureUiInteraction() {
    const started = performance.now()
    setZoom((value) => value + 0.01)
    await afterPaint()
    return performance.now() - started
  }

  async function runAll() {
    const target = targetRef.current
    if (!target) return
    setSummary(null)
    try {
      const suite = await runScenarioSuite({
        targets: [target],
        contents: activeContents(),
        sizes,
        cycles: 10,
        samples: 5,
        measureUiInteraction,
        onProgress: setProgress,
      })
      const verdict = computeVerdict(
        suite.scenarios.filter(
          (scenario) =>
            (scenario.candidate ?? 'canvaskit') === target.candidate &&
            (target.candidate === 'canvaskit' ? scenario.renderMode === 'picture' : true),
        ),
      )
      const info: RendererInfo =
        target.candidate === 'canvaskit'
          ? (target as SceneRenderer).info
          : {
              backend: 'cpu-fallback',
              webglAvailable: false,
              fontLoaded: false,
              wasmBytes: (target as VelloSceneTarget).details.wasmBytes,
            }
      const record: RunRecord = {
        schemaVersion: 1,
        fixtureVersion: FIXTURE_VERSION,
        reportKind: 'phase-one-renderer-spike',
        capturedAt: new Date().toISOString(),
        renderer: {
          backend: info.backend,
          wasmBytes: info.wasmBytes ?? 0,
          webglAvailable: info.webglAvailable,
          fontLoaded: info.fontLoaded,
        },
        environment: {
          platform: navigator.platform,
          arch: navigator.userAgent,
          electron: 'n/a',
          chrome: navigator.userAgent,
          devicePixelRatio: window.devicePixelRatio,
        },
        scenarios: suite.scenarios,
        notes: [...suite.notes, `candidate: ${target.candidate}`],
      }
      const memory = await window.vectrBenchmark.getMemory()
      setSummary({ verdict, info: target.candidate, scenarios: suite.scenarios, notes: suite.notes })
      setProgress('reported')
      await window.vectrBenchmark.reportResult({ record, memory })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The benchmark run failed.'
      console.error(`benchmark run failed at ${progress}: ${message}`)
      setError(message)
      setProgress('failed')
    }
  }

  useEffect(() => {
    if (progress === 'idle' && new URLSearchParams(window.location.search).has('benchmark')) {
      const timer = window.setTimeout(() => void runAll(), 500)
      return () => window.clearTimeout(timer)
    }
  }, [progress])

  return (
    <main className="grid gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl">Vectr renderer comparison</h1>
          <p>Synthetic fixtures, one measurement implementation. Not the editor.</p>
        </div>
        <button
          className="rounded border border-neutral-600 px-3 py-1.5"
          disabled={targetInfo === null}
          onClick={() => void runAll()}
        >
          Run benchmark
        </button>
      </header>
      <section className="flex flex-wrap items-center gap-6" aria-label="Run status">
        <output aria-live="polite">
          candidate: {targetInfo ?? 'pending'} · progress: {progress} · zoom {Math.round(zoom * 100)}%
        </output>
      </section>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <canvas
          ref={canvasRef}
          className="canvas"
          width="1200"
          height="800"
          aria-label="Renderer comparison canvas"
        />
      )}
      {summary && (
        <section aria-label="Verdict" className="grid gap-2">
          <p role="status" className={summary.verdict.pass ? 'verdict-pass' : 'verdict-fail'}>
            {summary.verdict.pass ? 'PASS' : 'FAIL'}: {summary.verdict.summary}
          </p>
          {summary.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </section>
      )}
      {summary && <pre>{JSON.stringify(summary, null, 2)}</pre>}
    </main>
  )
}
