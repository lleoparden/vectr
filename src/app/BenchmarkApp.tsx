/**
 * Benchmark shell for the Phase 1 renderer spike (issue #15).
 *
 * This is deliberately a measurement surface, not the editor: it owns one canvas,
 * one SceneRenderer, and the run/report flow. The editor shell replaces it in the
 * next slice, reusing the renderer module unchanged.
 */

import { useEffect, useRef, useState } from 'react'
import { runScenarioSuite, afterPaint } from '../bench/scenarios.ts'
import { computeVerdict, type RunRecord, type ScenarioMetrics, type Verdict } from '../bench/report.ts'
import { SceneRenderer, type RendererInfo } from '../bench/renderer.ts'
import { FIXTURE_VERSION, type FixtureContent, type FixtureSize } from '../bench/fixtures.ts'

const contents: FixtureContent[] = ['primitives', 'text', 'images', 'groups']
const sizes: FixtureSize[] = ['empty', 'representative', 'stress']

type RunSummary = {
  verdict: Verdict
  renderer: RendererInfo
  scenarios: ScenarioMetrics[]
  notes: string[]
}

export function BenchmarkApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SceneRenderer | null>(null)
  const [rendererInfo, setRendererInfo] = useState<RendererInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('starting')
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const renderer = await SceneRenderer.create(canvasRef.current!)
        if (cancelled) {
          renderer.dispose()
          return
        }
        rendererRef.current = renderer
        setRendererInfo(renderer.info)
        setProgress('idle')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'CanvasKit did not initialize.')
        setProgress('failed')
      }
    })()
    return () => {
      cancelled = true
      rendererRef.current?.dispose()
      rendererRef.current = null
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
    const renderer = rendererRef.current
    if (!renderer) return
    setSummary(null)
    try {
      const suite = await runScenarioSuite(renderer, {
        contents,
        sizes,
        cycles: 10,
        samples: 5,
        measureUiInteraction,
        onProgress: setProgress,
      })
      suite.notes.push(
        'Spike scope: every fixture node is visible (no viewport culling, no retained layer cache),',
        'so per-item draw cost includes JS-to-WASM call overhead that an editor optimization pass would reduce.',
      )
      const verdict = computeVerdict(suite.scenarios)
      const record: RunRecord = {
        schemaVersion: 1,
        fixtureVersion: FIXTURE_VERSION,
        reportKind: 'phase-one-renderer-spike',
        capturedAt: new Date().toISOString(),
        renderer: {
          backend: renderer.info.backend,
          wasmBytes: renderer.info.wasmBytes ?? 0,
          webglAvailable: renderer.info.webglAvailable,
          fontLoaded: renderer.info.fontLoaded,
        },
        environment: {
          platform: navigator.platform,
          arch: navigator.userAgent,
          electron: 'n/a',
          chrome: navigator.userAgent,
          devicePixelRatio: window.devicePixelRatio,
        },
        scenarios: suite.scenarios,
        notes: suite.notes,
      }
      const memory = await window.vectrBenchmark.getMemory()
      setSummary({ verdict, renderer: renderer.info, scenarios: suite.scenarios, notes: suite.notes })
      setProgress('reported')
      await window.vectrBenchmark.reportResult({ record, memory })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The benchmark run failed.')
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
          <h1 className="text-xl">Vectr CanvasKit renderer spike</h1>
          <p>GPU-first synthetic fixture benchmark. Not the editor.</p>
        </div>
        <button
          className="rounded border border-neutral-600 px-3 py-1.5"
          disabled={rendererInfo === null}
          onClick={() => void runAll()}
        >
          Run benchmark
        </button>
      </header>
      <section className="flex flex-wrap items-center gap-6" aria-label="Run status">
        <output aria-live="polite">
          backend: {rendererInfo?.backend ?? 'pending'} · font {rendererInfo ? String(rendererInfo.fontLoaded) : 'pending'} ·
          progress: {progress} · zoom {Math.round(zoom * 100)}%
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
          aria-label="CanvasKit renderer benchmark canvas"
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
