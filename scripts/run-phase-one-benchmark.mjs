/**
 * Phase 1 renderer-spike runner (issue #15).
 *
 * Executes the packaged app five times against the frozen fixtures, keeps every
 * raw run record, and writes an aggregate summary that states the pass/fail
 * verdict against the retained 33 ms interaction target.
 *
 * Usage: npm run benchmark   (packages first, then runs this script)
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeRuns } from '../src/bench/report.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='))
const evidenceDirectory = directoryArgument ? directoryArgument.slice('--directory='.length) : 'phase-one'
const outputDirectory = path.join(root, '.ecc', 'benchmarks', evidenceDirectory)
const executable = path.join(root, 'release', 'win-unpacked', 'Vectr Phase Zero Benchmark.exe')
const runCount = 5

if (!fs.existsSync(executable)) {
  console.error(`Packaged executable not found: ${executable}`)
  console.error('Run `npm run package:benchmark` first.')
  process.exit(1)
}

fs.mkdirSync(outputDirectory, { recursive: true })

for (let run = 1; run <= runCount; run += 1) {
  const output = path.join(outputDirectory, `run-${run}.json`)
  console.log(`phase-one run ${run}/${runCount}`)
  const result = spawnSync(executable, ['--benchmark', `--output=${output}`], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`run ${run} exited with status ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

const payloads = []
for (let run = 1; run <= runCount; run += 1) {
  const file = path.join(outputDirectory, `run-${run}.json`)
  payloads.push(JSON.parse(fs.readFileSync(file, 'utf8')))
}

const records = payloads.map((payload) => payload.rendererResult.record)
const summary = summarizeRuns(records)
const memory = payloads.map((payload) => {
  const totals = payload.applicationProcesses.reduce(
    (accumulator, process) => ({
      workingSetBytes: accumulator.workingSetBytes + process.memory.workingSetSize * 1024,
      privateBytes: accumulator.privateBytes + process.memory.privateBytes * 1024,
      gpuWorkingSetBytes:
        accumulator.gpuWorkingSetBytes + (process.type === 'GPU' ? process.memory.workingSetSize * 1024 : 0),
      processCount: accumulator.processCount + 1,
    }),
    { workingSetBytes: 0, privateBytes: 0, gpuWorkingSetBytes: 0, processCount: 0 },
  )
  return {
    run: payload.capturedAt,
    ...totals,
    maxWorkingSetMiB: Math.round(totals.workingSetBytes / 1024 / 1024),
    maxPrivateMiB: Math.round(totals.privateBytes / 1024 / 1024),
  }
})

const memoryPeak = memory.reduce(
  (peak, run) => ({
    maxWorkingSetMiB: Math.max(peak.maxWorkingSetMiB, run.maxWorkingSetMiB),
    maxPrivateMiB: Math.max(peak.maxPrivateMiB, run.maxPrivateMiB),
    maxGpuWorkingSetMiB: Math.max(peak.maxGpuWorkingSetMiB, Math.round(run.gpuWorkingSetBytes / 1024 / 1024)),
    maxProcessCount: Math.max(peak.maxProcessCount, run.processCount),
  }),
  { maxWorkingSetMiB: 0, maxPrivateMiB: 0, maxGpuWorkingSetMiB: 0, maxProcessCount: 0 },
)

const finalSummary = {
  ...summary,
  capturedAt: new Date().toISOString(),
  method: {
    build: 'packaged Windows release',
    runs: runCount,
    fixtures: 'empty / representative / stress for primitives, text, images, and nested groups',
    gateMetric: 'interactionMs (viewport change + draw + flush, no vsync wait)',
    informational: 'presentedMs (with one presented frame) and uiInteractionMs (React-driven)',
  },
  environment: records[0]?.environment ?? null,
  renderer: records[0]?.renderer ?? null,
  memoryPerRun: memory,
  memoryPeak,
  verdict: {
    renderer: summary.pass
      ? `pass: worst interaction p95 ${summary.worstInteractionMsP95} ms is within ${summary.interactionTargetMs} ms (deciding mode: ${summary.decidingMode})`
      : `fail: worst interaction p95 ${summary.worstInteractionMsP95} ms exceeds ${summary.interactionTargetMs} ms (deciding mode: ${summary.decidingMode})`,
    perMode: {
      direct: summary.verdicts.direct.summary,
      picture: summary.verdicts.picture.summary,
    },
    leaks: records.some((record) => record.notes.some((note) => note.startsWith('LEAK')))
      ? 'fail: retained scene objects did not return to zero'
      : 'pass: retained scene objects returned to zero after release',
  },
}

fs.writeFileSync(path.join(outputDirectory, 'summary.json'), JSON.stringify(finalSummary, null, 2))
console.log(`
phase-one summary written to ${path.join(outputDirectory, 'summary.json')}
${
  summary.pass
    ? `PASS: worst interaction p95 ${summary.worstInteractionMsP95} ms (target ${summary.interactionTargetMs} ms)`
    : `FAIL: worst interaction p95 ${summary.worstInteractionMsP95} ms (target ${summary.interactionTargetMs} ms)`
}
peak working set ${memoryPeak.maxWorkingSetMiB} MiB, peak private ${memoryPeak.maxPrivateMiB} MiB, max processes ${memoryPeak.maxProcessCount}`)
