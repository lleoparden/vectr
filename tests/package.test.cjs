const test = require('node:test')
const assert = require('node:assert/strict')
const packageJson = require('../package.json')

test('benchmark commands remain available', () => {
  assert.ok(packageJson.scripts.benchmark)
  assert.ok(packageJson.scripts['package:benchmark'])
})
