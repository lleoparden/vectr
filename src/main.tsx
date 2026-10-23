import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { BenchmarkApp } from './bench/BenchmarkApp.tsx'
import { runEditorSmoke, runFileRoundTrip, runMemoryReport, runShapeToolsReport, runTextEntryReport, runToolOptionsReport } from './dev/smoke.ts'
import { documentStore } from './state/documentStore.ts'
import { createEllipse, createPath, createRect, findNode, insertNodes } from './doc/document.ts'
import { hitTest } from './doc/hitTest.ts'
import { runEditorAction } from './app/actions.ts'
import './styles.css'

// The editor is the product; the benchmark harness stays reachable for recorded
// evidence and candidate comparisons (`?benchmark`, optionally `&candidate=`).
const search = new URLSearchParams(window.location.search)
const isBenchmark = search.has('benchmark')

createRoot(document.getElementById('root')!).render(isBenchmark ? <BenchmarkApp /> : <App />)

// A debug handle for scripted reproduction (`?debug`), used by the harness and by hand when a
// gesture misbehaves; it never exists in a normal launch.
if (search.has('debug')) {
  ;(window as unknown as { __vectrDebug: unknown }).__vectrDebug = {
    documentStore,
    createRect,
    createEllipse,
    createPath,
    findNode,
    insertNodes,
    hitTest,
    runEditorAction,
  }
}

// `?smoke` runs the scripted acceptance pass and logs JSON lines for the packaged
// evidence run (`electron . --smoke`); `?smoke=stress` adds the text, UI, path, and memory reports.
// The 1,000-shape stress case was removed on request in 2026-10-21 and is recorded as not run.
if (search.has('smoke')) {
  window.setTimeout(() => {
    void (async () => {
      const report = runEditorSmoke(documentStore)
      console.log(`[vectr-smoke] ${JSON.stringify(report)}`)
      const files = await runFileRoundTrip()
      console.log(`[vectr-file] ${JSON.stringify(files)}`)
      if (search.get('smoke') === 'stress') {
        const text = await runTextEntryReport()
        console.log(`[vectr-text] ${JSON.stringify(text)}`)
        const toolOptions = await runToolOptionsReport()
        console.log(`[vectr-ui] ${JSON.stringify(toolOptions)}`)
        const shapes = await runShapeToolsReport()
        console.log(`[vectr-path] ${JSON.stringify(shapes)}`)
        const memory = await runMemoryReport()
        console.log(`[vectr-memory] ${JSON.stringify(memory)}`)
      }
    })()
  }, 1_500)
}


