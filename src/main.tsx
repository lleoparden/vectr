import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { BenchmarkApp } from './bench/BenchmarkApp.tsx'
import { runEditorSmoke, runEditorStress, runFileRoundTrip, runMemoryReport, runTextEntryReport } from './dev/smoke.ts'
import { documentStore } from './state/documentStore.ts'
import './styles.css'

// The editor is the product; the benchmark harness stays reachable for recorded
// evidence and candidate comparisons (`?benchmark`, optionally `&candidate=`).
const search = new URLSearchParams(window.location.search)
const isBenchmark = search.has('benchmark')

createRoot(document.getElementById('root')!).render(isBenchmark ? <BenchmarkApp /> : <App />)

// `?smoke` runs the scripted acceptance pass and logs JSON lines for the packaged
// evidence run (`electron . --smoke`); `?smoke=stress` adds the memory/zoom report and the
// 1,000-shape stress case.
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
        const memory = await runMemoryReport()
        console.log(`[vectr-memory] ${JSON.stringify(memory)}`)
        const stress = await runEditorStress(documentStore)
        console.log(`[vectr-stress] ${JSON.stringify(stress)}`)
      }
    })()
  }, 1_500)
}


