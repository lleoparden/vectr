import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { BenchmarkApp } from './app/BenchmarkApp.tsx'
import { runEditorSmoke, runEditorStress, runFileRoundTrip } from './dev/smoke.ts'
import { documentStore } from './state/documentStore.ts'
import './styles.css'

// The editor is the product; the benchmark harness stays reachable for recorded
// evidence and candidate comparisons (`?benchmark`, optionally `&candidate=`).
const search = new URLSearchParams(window.location.search)
const isBenchmark = search.has('benchmark')

createRoot(document.getElementById('root')!).render(isBenchmark ? <BenchmarkApp /> : <App />)

// `?smoke` runs the scripted acceptance pass and logs JSON lines for the packaged
// evidence run (`electron . --smoke`); `?smoke=stress` adds the 1,000-shape case.
// The menu bar has the File menu now that Place exists; New/Open/Save join it in issue #19.
if (search.has('smoke')) {
  window.setTimeout(() => {
    void (async () => {
      const report = runEditorSmoke(documentStore)
      console.log(`[vectr-smoke] ${JSON.stringify(report)}`)
      const files = await runFileRoundTrip()
      console.log(`[vectr-file] ${JSON.stringify(files)}`)
      if (search.get('smoke') === 'stress') {
        const stress = await runEditorStress(documentStore)
        console.log(`[vectr-stress] ${JSON.stringify(stress)}`)
      }
    })()
  }, 1_500)
}


