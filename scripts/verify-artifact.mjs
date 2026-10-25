/**
 * Artifact verification (REA follow-up, 2026-10-23).
 *
 * The packaged app is the thing users run, so its identity is checked directly instead of assumed:
 * read `package.json` out of the ASAR, compare that version with the repository's, hash the ASAR and
 * the renderer bundle, and assert that the phase's command ids are present - and that ids from later
 * versions are absent, so a receipt says "this build is exactly 0.5.0", not merely "it has paths".
 *
 * No dependency is added: ASAR's header is a small, stable format and is read here directly.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ASAR_HEADER_BYTES = 8

function fail(message) {
  console.error(`verify-artifact: ${message}`)
  process.exit(1)
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (match === null) fail(`cannot parse version "${version}"`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function readAsar(asarPath) {
  const body = fs.readFileSync(asarPath)
  if (body.length < ASAR_HEADER_BYTES + 4) fail(`${asarPath} is too small to be an ASAR`)
  // ASAR starts with a pickle: [4][payload size][json length + 4][json length][JSON header][files].
  const payloadSize = body.readUInt32LE(4)
  const headerSize = body.readUInt32LE(12)
  const headerStart = 16
  const headerEnd = headerStart + headerSize
  if (headerEnd > body.length || payloadSize < headerSize) fail(`${asarPath} has an ASAR header beyond the file end`)
  let header
  try {
    header = JSON.parse(body.subarray(headerStart, headerEnd).toString('utf8'))
  } catch (cause) {
    fail(`${asarPath} has an unreadable ASAR header: ${String(cause)}`)
  }
  const dataStart = (headerEnd + 3) & ~3
  const sha256 = createHash('sha256').update(body).digest('hex')
  return { body, header, dataStart, sha256, bytes: body.length }
}

/** Header keys use the platform's separators; accept either and a leading separator. */
function findEntry(header, entryPath) {
  const segments = entryPath.split(/[\\/]+/u).filter((segment) => segment.length > 0)
  let node = header
  for (const segment of segments) {
    if (node.files === undefined) return null
    const key = Object.keys(node.files).find((candidate) => candidate === segment)
    if (key === undefined) return null
    node = node.files[key]
  }
  return node.files === undefined ? node : null
}

function readEntry(asar, entry) {
  // electron-builder stores offsets as strings so they survive JSON number precision.
  const offset = Number(entry.offset)
  const size = Number(entry.size)
  if (!Number.isFinite(offset) || !Number.isFinite(size)) return null
  return asar.body.subarray(asar.dataStart + offset, asar.dataStart + offset + size)
}

function listFiles(header, prefix = '') {
  const files = []
  for (const [name, entry] of Object.entries(header.files ?? {})) {
    const next = `${prefix}${prefix === '' ? '' : '/'}${name}`
    if (entry.files !== undefined) files.push(...listFiles(entry, next))
    else files.push(next)
  }
  return files
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) continue
    const key = argument.slice(2)
    const next = argv[index + 1]
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next
      index += 1
    } else {
      options[key] = true
    }
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
if (options.help === true) {
  console.log('usage: node scripts/verify-artifact.mjs [--asar <path>] [--expect-version <version>] [--receipt <path>]')
  console.log('  defaults to release/win-unpacked, then the per-user installed app')
  process.exit(0)
}
const repoRoot = process.cwd()
const repoPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const expectedVersion = typeof options['expect-version'] === 'string' ? options['expect-version'] : repoPackage.version
const stagedAsar = path.join(repoRoot, 'release', 'win-unpacked', 'resources', 'app.asar')
const installedAsar = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'vectr', 'resources', 'app.asar')
// Prefer the build this working tree just produced; an installed copy can lag the source on purpose.
const asarPath = path.resolve(
  typeof options.asar === 'string'
    ? options.asar
    : fs.existsSync(stagedAsar)
      ? stagedAsar
      : installedAsar,
)
if (!fs.existsSync(asarPath)) fail(`no ASAR at ${asarPath}`)

const asar = readAsar(asarPath)
const appPackageEntry = findEntry(asar.header, 'package.json')
if (appPackageEntry === null) fail('the ASAR has no package.json')
const appPackage = JSON.parse(readEntry(asar, appPackageEntry).toString('utf8'))

/** The phase contract. IDs are the shipped command/tool identifiers, not labels. */
const CONTRACT = {
  'phase-1-4': [
    'edit.undo',
    'edit.redo',
    'file.save',
    'object.group',
    'object.ungroup',
    'object.makeClip',
    'object.alignLeft',
    'tool.select',
    'tool.rect',
    'tool.ellipse',
    'tool.text',
  ],
  'phase-5': [
    'tool.pen',
    'tool.shapeBuilder',
    'tool.livePaint',
    'tool.width',
    'path.addAnchor',
    'path.deleteAnchor',
    'path.join',
    'path.unite',
    'path.intersect',
    'path.subtract',
    'path.exclude',
    'path.divide',
    'path.simplify',
    'path.offsetPath',
    'path.outlineStroke',
    'path.profileBulge',
    'setWidthProfile',
    'object.compoundMake',
    'object.compoundRelease',
  ],
}

/** Symbols that arrived in a fix release: required at/after it, and forbidden before it. */
const SINCE = {
  hitTestAll: '0.5.1',
  pointInShape: '0.5.1',
  placeAreaText: '0.5.2',
  textType: '0.5.2',
  textPath: '0.5.3',
  threadStory: '0.5.4',
  orientation: '0.5.5',
  'type.createOutlines': '0.5.6',
}

const bundlePath = listFiles(asar.header).find((file) => /(^|\/)dist\/assets\/index-[^/]+\.js$/u.test(file))
if (bundlePath === undefined) fail('no dist/assets/index-*.js renderer bundle in the ASAR')
const bundleEntry = findEntry(asar.header, bundlePath)
const bundle = readEntry(asar, bundleEntry)
if (bundle === null) fail(`cannot read ${bundlePath}`)
const bundleSha256 = createHash('sha256').update(bundle).digest('hex')
const bundleText = bundle.toString('utf8')

const failures = []
const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok, detail })
  if (!ok) failures.push(`${name}: ${detail}`)
}

check(
  'repository and artifact versions match',
  appPackage.version === expectedVersion,
  `artifact ${appPackage.version}, expected ${expectedVersion}${appPackage.version === expectedVersion ? '' : ' - stale staging or the wrong artifact'}`,
)

for (const [phase, ids] of Object.entries(CONTRACT)) {
  for (const id of ids) {
    const present = bundleText.includes(id)
    check(`${phase} ${id}`, present, present ? 'present' : 'missing from the renderer bundle')
  }
}

for (const [symbol, since] of Object.entries(SINCE)) {
  const present = bundleText.includes(symbol)
  const expected = compareVersions(appPackage.version, since) >= 0
  check(
    `${symbol} (since ${since})`,
    present === expected,
    expected ? (present ? 'present as expected' : `missing, required from ${since}`) : present ? `present, must be absent before ${since}` : `absent as expected before ${since}`,
  )
}

const receipt = {
  tool: 'verify-artifact',
  generatedAt: new Date().toISOString(),
  asar: { path: asarPath, version: appPackage.version, sha256: asar.sha256, bytes: asar.bytes },
  expectedVersion,
  bundle: { path: bundlePath, sha256: bundleSha256, bytes: bundle.length },
  checks,
  passed: failures.length === 0,
  failures,
}

if (typeof options.receipt === 'string') {
  const receiptPath = path.resolve(options.receipt)
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true })
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
  console.log(`verify-artifact: receipt written to ${path.relative(repoRoot, receiptPath)}`)
}

console.log(`verify-artifact: artifact ${asarPath}`)
console.log(
  `verify-artifact: ${appPackage.version} ${asar.sha256.slice(0, 12)} bundle ${bundleSha256.slice(0, 12)} (${checks.length} checks)`,
)
if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`)
  process.exit(1)
}
console.log('verify-artifact: artifact matches the phase contract')
