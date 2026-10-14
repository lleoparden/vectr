const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const packageJson = require('../package.json')

test('benchmark commands remain available', () => {
  assert.ok(packageJson.scripts.benchmark)
  assert.ok(packageJson.scripts['package:benchmark'])
  assert.ok(packageJson.scripts.typecheck)
})

test('CanvasKit renderer dependency is pinned for the renderer spike', () => {
  assert.equal(packageJson.dependencies['canvaskit-wasm'], '^0.42.0')
})

test('Tailwind is installed for the approved desktop baseline', () => {
  assert.ok(packageJson.dependencies.tailwindcss)
  assert.ok(packageJson.dependencies['@tailwindcss/vite'])
})

test('a bundled font ships with its license because CanvasKit has no system font manager', () => {
  const directory = path.join(__dirname, '..', 'src', 'assets', 'fonts')
  assert.ok(fs.existsSync(path.join(directory, 'Inter-Variable.ttf')))
  assert.ok(fs.existsSync(path.join(directory, 'OFL.txt')))
  const license = fs.readFileSync(path.join(directory, 'OFL.txt'), 'utf8')
  assert.match(license, /SIL OPEN FONT LICENSE/i)
})

