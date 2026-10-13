const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const outputDirectory = path.join(root, '.ecc', 'benchmarks', 'phase-zero')
const executable = path.join(root, 'release', 'win-unpacked', 'Vectr Phase Zero Benchmark.exe')

fs.mkdirSync(outputDirectory, { recursive: true })

for (let run = 1; run <= 5; run += 1) {
  const output = path.join(outputDirectory, `run-${run}.json`)
  const result = spawnSync(executable, ['--benchmark', `--output=${output}`], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
