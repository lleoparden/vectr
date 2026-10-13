import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createFixture, type FixtureKind, type Layer } from './fixtures'
import './styles.css'

type ScenarioResult = {
  fixture: FixtureKind
  renderMs: number
  interactionMs: number
  saveReopenMs: number
  heapBytes?: number
}

const fixtureKinds: FixtureKind[] = ['empty', 'representative', 'stress']

function afterPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function heapBytes() {
  const memory = performance as Performance & { memory?: { usedJSHeapSize: number } }
  return memory.memory?.usedJSHeapSize
}

function App() {
  const [fixture, setFixture] = useState<FixtureKind>('representative')
  const [layers, setLayers] = useState<Layer[]>(() => createFixture('representative'))
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<ScenarioResult[]>([])

  const layerCount = useMemo(() => layers.length, [layers])

  function loadFixture(next: FixtureKind) {
    setFixture(next)
    setSelected(null)
    setLayers(createFixture(next))
  }

  async function runScenario(kind: FixtureKind): Promise<ScenarioResult> {
    const started = performance.now()
    loadFixture(kind)
    await afterPaint()
    const renderMs = performance.now() - started

    const interactionStarted = performance.now()
    setZoom((current) => current + 0.05)
    setSelected(kind === 'empty' ? null : `${kind}-0`)
    await afterPaint()
    const interactionMs = performance.now() - interactionStarted

    const saveReopenStarted = performance.now()
    const snapshot = JSON.stringify(createFixture(kind))
    setLayers(JSON.parse(snapshot) as Layer[])
    await afterPaint()
    const saveReopenMs = performance.now() - saveReopenStarted

    return { fixture: kind, renderMs, interactionMs, saveReopenMs, heapBytes: heapBytes() }
  }

  async function runAll() {
    const nextResults: ScenarioResult[] = []
    for (const kind of fixtureKinds) nextResults.push(await runScenario(kind))
    setResults(nextResults)
    await window.vectrBenchmark.reportResult({ scenarios: nextResults })
  }

  useEffect(() => {
    window.vectrBenchmark.reportReady()
    window.vectrBenchmark.onRun(() => void runAll())
  }, [])

  return (
    <main>
      <header>
        <div>
          <h1>Vectr Phase 0 benchmark</h1>
          <p>Synthetic SVG fixtures only — not the editor.</p>
        </div>
        <button onClick={() => void runAll()}>Run benchmark</button>
      </header>
      <section className="controls" aria-label="Fixture selection">
        {fixtureKinds.map((kind) => (
          <button key={kind} aria-pressed={fixture === kind} onClick={() => loadFixture(kind)}>
            {kind}
          </button>
        ))}
        <output>{layerCount.toLocaleString()} layers · {Math.round(zoom * 100)}% zoom</output>
      </section>
      <svg className="canvas" viewBox="0 0 1200 800" aria-label="Synthetic vector benchmark canvas">
        {layers.map((layer) => (
          <path
            key={layer.id}
            d={layer.d}
            fill="none"
            stroke={layer.fill}
            strokeWidth="1"
            opacity={selected === layer.id ? 1 : 0.7}
            onClick={() => setSelected(layer.id)}
          />
        ))}
      </svg>
      {results.length > 0 && <pre>{JSON.stringify(results, null, 2)}</pre>}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
