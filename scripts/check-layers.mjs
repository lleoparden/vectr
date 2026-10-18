#!/usr/bin/env node
/**
 * Layer rule check (Phase 3.1).
 *
 * Vectr follows the reference architecture's layering: a module may only import from a lower layer.
 * This script is the enforcement - prose rules drift, a failing test does not.
 *
 *   L0  geom/            curves, transforms, colour models, conversions
 *   L1  doc/             the document model: pure data, serializable, no UI or GPU
 *   L2  ops/             operations over the model: booleans, text layout, effects
 *   L3  render/ file/    document to pixels, and every file format read or written
 *   L4  tools/           state machines: pointer and keyboard in, commands and overlays out
 *   L5  state/ app/actions.ts app/editing/ app/files/   sessions, history, command registry
 *   L6  app/             the interface: menus, panels, dialogs, canvas host
 *   L7  everything else  application shells, harnesses, scripts
 *
 * Type-only imports may cross layers in either direction: they vanish at runtime and exist so a
 * lower layer can name a shape without depending on the layer that owns it.
 *
 * Run with `npm run check:layers`; it is part of `npm test`.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE = [path.join(ROOT, 'src'), path.join(ROOT, 'electron')]

const LAYER_RULES = [
  { layer: 0, prefixes: ['src/geom/'] },
  { layer: 1, prefixes: ['src/doc/'] },
  { layer: 2, prefixes: ['src/ops/'] },
  { layer: 3, prefixes: ['src/render/', 'src/file/'] },
  { layer: 4, prefixes: ['src/tools/'] },
  { layer: 5, prefixes: ['src/state/', 'src/app/actions.ts', 'src/app/editing/', 'src/app/files/'] },
  { layer: 6, prefixes: ['src/app/'] },
  { layer: 7, prefixes: [] },
]

const WORKFLOW_LABELS = ['L0 geom', 'L1 doc', 'L2 ops', 'L3 render/file', 'L4 tools', 'L5 engine', 'L6 interface', 'L7 shell']

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function layerOf(file) {
  const rel = relative(file)
  for (const rule of LAYER_RULES) {
    if (rule.prefixes.some((prefix) => rel === prefix || rel.startsWith(prefix))) return rule.layer
  }
  return 7
}

function sourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
      continue
    }
    if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.mjs') || full.endsWith('.cjs')) out.push(full)
  }
  return out
}

/** A statement is type-only when nothing in it survives compilation. */
function isTypeOnly(statement) {
  if (/^import\s+type\s/.test(statement)) return true
  const named = statement.match(/\{([\s\S]*?)\}/)
  if (named === null) return false
  const specifiers = named[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return specifiers.length > 0 && specifiers.every((part) => part.startsWith('type '))
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

const violations = []
const files = SOURCE.flatMap((dir) => (fs.existsSync(dir) ? sourceFiles(dir) : []))
for (const file of files) {
  const own = layerOf(file)
  const text = fs.readFileSync(file, 'utf8')
  const statementPattern = /import\s+type\s+[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g
  let match
  while ((match = statementPattern.exec(text)) !== null) {
    const specifier = match[1] ?? match[2] ?? match[3]
    const statement = match[0]
    const target = resolveImport(file, specifier)
    if (target === null) continue
    const imported = layerOf(target)
    if (imported <= own) continue
    if (isTypeOnly(statement)) continue
    violations.push({
      file: relative(file),
      from: WORKFLOW_LABELS[own],
      target: relative(target),
      to: WORKFLOW_LABELS[imported],
    })
  }
}

if (violations.length > 0) {
  console.error('Layer rule violations (a module may only import from a lower layer):')
  for (const violation of violations) {
    console.error('  ' + violation.file + ' [' + violation.from + '] imports ' + violation.target + ' [' + violation.to + ']')
  }
  console.error('\nFix by moving the code down a layer, or make the import type-only if it only names a shape.')
  process.exit(1)
}

console.log('layer rule: ' + files.length + ' source files respect the L0-L7 import direction')
