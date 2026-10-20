/**
 * Project file tests (issue #19).
 *
 * The format, the serializer, the open-time validation, the atomic write policy, and the
 * recovery snapshot are all pure or filesystem-injected, so every class of failure can be
 * provoked here instead of by corrupting a real project by hand.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand } from '../src/doc/commands.ts'
import {
  createDocument,
  createEllipse,
  createGroup,
  createImage,
  createRect,
  createText,
  findNode,
} from '../src/doc/document.ts'
import { assetKeyFor } from '../src/doc/assets.ts'
import { deserializeDocument, serializeDocument } from '../src/file/serialize.ts'
import { canonicalJson, MANIFEST_NAME, projectFileName, assetFileName } from '../src/file/format.ts'
import { pruneAssets, writeProject, type ProjectFileSystem } from '../src/file/atomicWrite.ts'
import { clearRecovery, readRecovery, writeRecovery } from '../src/file/recovery.ts'
import { verifyAssets } from '../src/file/validate.ts'
import { documentStore } from '../src/state/documentStore.ts'
import type { AssetRef, Document, LayerNode, NodeId } from '../src/doc/types.ts'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7])
const OTHER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9])

/** An in-memory filesystem, so write policies can be tested without touching disk. */
class MemoryFileSystem implements ProjectFileSystem {
  readonly files = new Map<string, string | Uint8Array>()
  /** Paths that should throw when written, to simulate an interrupted save. */
  readonly failures = new Set<string>()
  private renameCount = 0

  private maybeFail(path: string) {
    if (this.failures.has(path)) {
      const error = new Error(`simulated failure writing ${path}`)
      ;(error as NodeJS.ErrnoException).code = 'EIO'
      throw error
    }
  }

  async makeDirectory(path: string): Promise<void> {
    this.files.set(`${path}/`, '')
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.maybeFail(path)
    this.files.set(path, data)
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    const value = this.files.get(path)
    if (value === undefined) return null
    return typeof value === 'string' ? new TextEncoder().encode(value) : value
  }

  async exists(path: string): Promise<boolean> {
    if (this.files.has(path) || this.files.has(`${path}/`)) return true
    for (const key of this.files.keys()) if (key.startsWith(`${path}/`)) return true
    return false
  }

  async rename(from: string, to: string): Promise<void> {
    this.renameCount += 1
    if (this.failures.has(`rename:${this.renameCount}`)) throw new Error('simulated rename failure')
    const value = this.files.get(from)
    if (value === undefined) return
    this.files.delete(from)
    this.files.set(to, value)
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path)
  }

  async list(path: string): Promise<string[]> {
    const prefix = `${path}/`
    return [...this.files.keys()]
      .filter((key) => key.startsWith(prefix) && !key.endsWith('/'))
      .map((key) => key.slice(prefix.length))
  }
}

function insert(document: Document, nodes: LayerNode[], parentId: NodeId = 'root'): Document {
  const parent = findNode(document, parentId)
  const index = parent !== null && parent.type === 'group' ? parent.children.length : 0
  const result = applyCommand(document, { type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : result.message)
  return result.ok ? result.document : document
}

/** A document with every node kind, a nested group, text, and one placed image. */
async function mixedDocument(): Promise<{ document: Document; asset: AssetRef }> {
  const rect = createRect('Rect', 10, 20, 30, 40)
  const ellipse = createEllipse('Ellipse', 60, 70)
  const group = createGroup('Group 1')
  const nested = createRect('Nested', 5, 5, 15, 15)
  const text = createText('Label', 100, 100, 'Hello\nVectr', { fontSize: 18, align: 'center' })
  const id = await assetKeyFor(PNG)
  const asset: AssetRef = { id, mimeType: 'image/png', byteLength: PNG.byteLength, width: 8, height: 8 }
  const image = createImage('photo.png', 200, 30, id, 8, 8)

  let document = createDocument('Mixed')
  document = insert(document, [rect, ellipse, group])
  document = insert(document, [nested], group.id)
  document = insert(document, [text])
  // The image enters through the same command the app uses, so the asset record is real.
  const placed = applyCommand(document, {
    type: 'placeImage',
    parentId: 'root',
    index: document.root.children.length,
    node: image,
    asset,
  })
  assert.equal(placed.ok, true, placed.ok ? '' : placed.message)
  if (!placed.ok) throw new Error(placed.message)
  return { document: placed.document, asset }
}

test('a mixed document survives a manifest round trip exactly', async () => {
  const { document } = await mixedDocument()
  const { manifest, assets } = serializeDocument(document)
  const parsed = deserializeDocument(manifest)
  assert.equal(parsed.ok, true, parsed.ok ? '' : `${parsed.code}: ${parsed.message}`)
  if (!parsed.ok) return

  assert.equal(parsed.document.formatVersion, document.formatVersion)
  assert.equal(parsed.document.revision, document.revision)
  assert.equal(parsed.document.name, 'Mixed')
  assert.deepEqual(parsed.document.assets, document.assets)
  assert.deepEqual(parsed.document.artboards, document.artboards)

  // Layer order, nesting, geometry, styles, text, and image references, node by node.
  const flatten = (nodes: LayerNode[], depth = 0): Array<[string, number]> => {
    const rows: Array<[string, number]> = []
    for (const node of nodes) {
      rows.push([node.id, depth])
      if (node.type === 'group') rows.push(...flatten(node.children, depth + 1))
    }
    return rows
  }
  assert.deepEqual(
    flatten(parsed.document.root.children),
    flatten(document.root.children),
    'ids and nesting survive, in paint order',
  )
  assert.deepEqual(parsed.document.root.children, document.root.children, 'the whole tree is identical')
  assert.deepEqual(assets, document.assets)
})

test('v2 image manifests gain an explicit full crop and no mask on open (and are upgraded to the current version)', async () => {
  const { document } = await mixedDocument()
  const legacy = JSON.parse(serializeDocument(document).manifest) as { formatVersion: number; root: { children: Array<Record<string, unknown>> } }
  legacy.formatVersion = 2
  const image = legacy.root.children.find((node) => node.type === 'image')
  assert.notEqual(image, undefined)
  delete image?.crop
  delete image?.maskAssetId

  const parsed = deserializeDocument(JSON.stringify(legacy))
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message)
  if (!parsed.ok) return
  const reopened = parsed.document.root.children.find((node) => node.type === 'image')
  assert.equal(parsed.document.formatVersion, 5)
  assert.deepEqual(reopened?.type === 'image' ? reopened.crop : null, { x: 0, y: 0, width: 1, height: 1 })
  assert.equal(reopened?.type === 'image' ? reopened.maskAssetId : undefined, null)
})

test('saving an unchanged document twice produces byte-identical manifests', async () => {
  const { document } = await mixedDocument()
  const first = serializeDocument(document).manifest
  const second = serializeDocument(document).manifest
  assert.equal(first, second)

  // And the round trip is a fixed point: re-serializing what was read changes nothing.
  const parsed = deserializeDocument(first)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(serializeDocument(parsed.document).manifest, first)

  // Canonical form: sorted keys, two-space indent, trailing newline.
  assert.equal(first.endsWith('\n'), true)
  assert.equal(first.includes('\n  "artboards"'), true)
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{\n  "a": 2,\n  "b": 1\n}\n')
})

test('manifests never inline asset bytes', async () => {
  const { document } = await mixedDocument()
  const { manifest } = serializeDocument(document)
  assert.equal(manifest.includes('base64'), false, 'no base64 blobs in the manifest')
  assert.equal(manifest.includes('data:image'), false, 'no data URLs in the manifest')
  assert.equal(/[A-Za-z0-9+/]{80,}={0,2}/.test(manifest), false, 'no long base64-looking runs')
  assert.equal(manifest.includes('sha256-'), true, 'assets are referenced by content key instead')
})

test('unsupported versions, foreign files, and broken JSON are refused with reasons', () => {
  const newer = deserializeDocument(JSON.stringify({ manifestVersion: 99, formatVersion: 1, root: {} }))
  assert.equal(newer.ok ? '' : newer.code, 'unsupported-manifest-version')

  const futureFormat = deserializeDocument(JSON.stringify({ manifestVersion: 1, formatVersion: 9, root: {} }))
  assert.equal(futureFormat.ok ? '' : futureFormat.code, 'unsupported-format-version')

  const broken = deserializeDocument('{ not json')
  assert.equal(broken.ok ? '' : broken.code, 'not-json')

  const foreign = deserializeDocument(JSON.stringify(['not', 'a', 'manifest']))
  assert.equal(foreign.ok ? '' : foreign.code, 'not-a-manifest')

  const noTree = deserializeDocument(JSON.stringify({ manifestVersion: 1, formatVersion: 1 }))
  assert.equal(noTree.ok ? '' : noTree.code, 'not-a-manifest')
})

test('a document that fails validation is refused instead of partially loaded', async () => {
  const { document } = await mixedDocument()
  const parsed = JSON.parse(serializeDocument(document).manifest) as Record<string, unknown>

  // Duplicate ids: two children sharing one id.
  const duplicate = structuredClone(parsed)
  const root = duplicate.root as { children: Array<{ id: string }> }
  root.children[1].id = root.children[0].id
  const duplicateResult = deserializeDocument(JSON.stringify(duplicate))
  assert.equal(duplicateResult.ok ? '' : duplicateResult.code, 'invalid-document')
  assert.match(duplicateResult.ok ? '' : duplicateResult.message, /duplicate-id/)

  // Non-finite geometry: JSON can carry Infinity as an overflowing literal.
  const infinite = JSON.parse(serializeDocument(document).manifest.replace('"width": 30', '"width": 1e999'))
  const infiniteResult = deserializeDocument(JSON.stringify(infinite))
  assert.equal(infiniteResult.ok ? '' : infiniteResult.code, 'invalid-document')
  assert.match(infiniteResult.ok ? '' : infiniteResult.message, /non-finite/)

  // Missing asset record for an image that references one.
  const orphan = JSON.parse(serializeDocument(document).manifest) as Record<string, unknown>
  orphan.assets = []
  const orphanResult = deserializeDocument(JSON.stringify(orphan))
  assert.equal(orphanResult.ok ? '' : orphanResult.code, 'invalid-document')
  assert.match(orphanResult.ok ? '' : orphanResult.message, /invalid-asset/)
})

test('asset verification catches missing, truncated, and replaced files', async () => {
  const { document, asset } = await mixedDocument()
  const good = new Map([[asset.id, PNG]])
  assert.equal((await verifyAssets(document, good)).ok, true)

  const missing = await verifyAssets(document, new Map())
  assert.equal(missing.ok ? '' : missing.code, 'missing-asset')

  const truncated = await verifyAssets(document, new Map([[asset.id, PNG.slice(0, 4)]]))
  assert.equal(truncated.ok ? '' : truncated.code, 'length-mismatch')

  // Same length, different bytes: only the content key can catch this.
  const replaced = new Uint8Array(PNG)
  replaced[replaced.length - 1] = 42
  const swapped = await verifyAssets(document, new Map([[asset.id, replaced]]))
  assert.equal(swapped.ok ? '' : swapped.code, 'hash-mismatch')

  const linked: Document = { ...document, assets: [{ ...asset, sourcePath: 'C:/images/photo.png' }] }
  const unavailableLink = await verifyAssets(linked, new Map())
  assert.equal(unavailableLink.ok, true, 'a missing link keeps the document open for relinking')
  if (unavailableLink.ok) assert.equal(unavailableLink.available.length, 0)
})

test('writing a project stores each asset once and keeps the manifest byte-identical', async () => {
  const { document, asset } = await mixedDocument()
  const fs = new MemoryFileSystem()
  const directory = '/projects/Mixed.vectr'
  const { manifest, assets } = serializeDocument(document)
  const payload = [{ ref: asset, bytes: PNG }]
  const ids = new Set(assets.map((ref) => ref.id))

  const first = await writeProject(fs, directory, manifest, payload, ids, 'now')
  assert.equal(first.writtenAssets, 1, 'the asset is written once')
  assert.equal(fs.files.has(`${directory}/metadata.json`), true, 'the save time lives outside the manifest')
  assert.equal(fs.files.has(`${directory}/assets/${assetFileName(asset)}`), true)

  const second = await writeProject(fs, directory, manifest, payload, ids, 'later')
  assert.equal(second.writtenAssets, 0, 'a second save reuses the content-addressed bytes')
  assert.equal(second.reusedAssets, 1)
  const stored = await fs.readFile(`${directory}/${MANIFEST_NAME}`)
  assert.equal(stored === null ? '' : new TextDecoder().decode(stored), manifest, 'and the manifest is identical')
})

test('an interrupted save leaves the previous project intact', async () => {
  const { document, asset } = await mixedDocument()
  const fs = new MemoryFileSystem()
  const directory = '/projects/Mixed.vectr'
  const original = serializeDocument(document).manifest
  const ids = new Set(document.assets.map((ref) => ref.id))
  await writeProject(fs, directory, original, [{ ref: asset, bytes: PNG }], ids, 'first')

  // The next save fails while writing the manifest's temporary file.
  fs.failures.add(`${directory}/${MANIFEST_NAME}.tmp`)
  const changed = original.replace('"revision"', '"revisionAfterInterruption"')
  await assert.rejects(() => writeProject(fs, directory, changed, [{ ref: asset, bytes: PNG }], ids, 'second'))

  const after = await fs.readFile(`${directory}/${MANIFEST_NAME}`)
  assert.equal(after === null ? '' : new TextDecoder().decode(after), original, 'the old manifest is untouched')
  const parsed = deserializeDocument(new TextDecoder().decode(after ?? new Uint8Array()))
  assert.equal(parsed.ok, true, 'and the project still opens')
})

test('stale asset files are pruned while used ones stay', async () => {
  const { document, asset } = await mixedDocument()
  const fs = new MemoryFileSystem()
  const directory = '/projects/Mixed.vectr'
  const { manifest, assets } = serializeDocument(document)
  await writeProject(fs, directory, manifest, [{ ref: asset, bytes: PNG }], new Set(assets.map((ref) => ref.id)), 'now')

  const stale: AssetRef = {
    id: await assetKeyFor(OTHER),
    mimeType: 'image/png',
    byteLength: OTHER.byteLength,
    width: 8,
    height: 8,
  }
  await fs.writeFile(`${directory}/assets/${assetFileName(stale)}`, OTHER)

  const removed = await pruneAssets(fs, directory, new Set(document.assets.map((ref) => ref.id)))
  assert.deepEqual(removed, [assetFileName(stale)])
  assert.equal(fs.files.has(`${directory}/assets/${assetFileName(asset)}`), true, 'the used asset stays')
})

test('the recovery snapshot is a project folder: assets included, newest wins, clears on save', async () => {
  const { document } = await mixedDocument()
  const fs = new MemoryFileSystem()
  const directory = '/recovery.vectr'
  const { manifest, assets } = serializeDocument(document)
  const mixedAsset = document.assets[0]

  assert.equal(await readRecovery(fs, directory), null, 'no snapshot yet')

  await writeRecovery(fs, directory, {
    savedAt: '2026-10-14T10:00:00.000Z',
    documentName: 'Mixed',
    directory: '/projects/Mixed.vectr',
    savedRevision: 7,
    manifest,
    assets: assets.map((ref) => ({ id: ref.id, mimeType: ref.mimeType, bytes: PNG })),
  })
  const first = await readRecovery(fs, directory)
  assert.equal(first?.savedAt, '2026-10-14T10:00:00.000Z')
  assert.equal(first?.directory, '/projects/Mixed.vectr')
  assert.equal(first?.savedRevision, 7, 'the revision the file matched comes back, so a restore is dirty')
  assert.equal(first?.assets.length, assets.length, 'every asset the document declares is in the folder')
  assert.equal(first?.assets[0].bytes.byteLength, PNG.byteLength, 'and its bytes are the real bytes')
  assert.equal(
    fs.files.has(`${directory}/assets/${mixedAsset.id.replace(/^sha256-/, '')}.png`),
    true,
    'assets live under the same content-addressed name a project uses',
  )

  await writeRecovery(fs, directory, {
    savedAt: '2026-10-14T11:00:00.000Z',
    documentName: 'Mixed again',
    directory: null,
    savedRevision: 9,
    manifest,
    assets: [],
  })
  const second = await readRecovery(fs, directory)
  assert.equal(second?.savedAt, '2026-10-14T11:00:00.000Z', 'the newest snapshot replaces the older one')
  assert.equal(second?.documentName, 'Mixed again')
  assert.equal(
    second?.assets.length,
    assets.length,
    'content-addressed files are not rewritten, so they are still there for the same manifest',
  )

  // What the manifest references is what comes back: a manifest with no assets yields none, even
  // though older files are still on disk from the previous write.
  const cleanManifest = serializeDocument(createDocument('Clean')).manifest
  await writeRecovery(fs, directory, {
    savedAt: '2026-10-14T12:00:00.000Z',
    documentName: 'Clean',
    directory: null,
    savedRevision: 1,
    manifest: cleanManifest,
    assets: [],
  })
  const third = await readRecovery(fs, directory)
  assert.equal(third?.assets.length, 0, 'unreferenced files are ignored rather than invented')

  await clearRecovery(fs, directory)
  assert.equal(await readRecovery(fs, directory), null, 'clear removes the whole folder')
})

test('a corrupt or half-written recovery folder counts as no snapshot', async () => {
  const { document } = await mixedDocument()
  const fs = new MemoryFileSystem()
  const directory = '/recovery.vectr'
  const { manifest } = serializeDocument(document)

  // A manifest with no sidecar: the write is not finished, so there is nothing to offer.
  await fs.writeFile(`${directory}/manifest.json`, manifest)
  assert.equal(await readRecovery(fs, directory), null, 'a manifest alone is not a snapshot')

  await writeRecovery(fs, directory, {
    savedAt: '2026-10-14T10:00:00.000Z',
    documentName: 'Mixed',
    directory: null,
    savedRevision: 0,
    manifest,
    assets: [],
  })
  assert.notEqual(await readRecovery(fs, directory), null, 'a complete folder is a snapshot')

  await fs.writeFile(`${directory}/recovery.json`, 'not json')
  assert.equal(await readRecovery(fs, directory), null, 'a corrupt sidecar counts as none')

  await writeRecovery(fs, directory, {
    savedAt: '2026-10-14T10:30:00.000Z',
    documentName: 'Mixed',
    directory: null,
    savedRevision: 0,
    manifest,
    assets: [],
  })
  await fs.remove(`${directory}/manifest.json`)
  assert.equal(await readRecovery(fs, directory), null, 'a missing manifest counts as none')
})

test('dirty state is derived from the saved revision, not from a flag', async () => {
  const { document } = await mixedDocument()
  documentStore.replaceDocument(document, { savedRevision: document.revision, filePath: '/projects/Mixed.vectr' })
  assert.equal(documentStore.isDirty(), false, 'a freshly opened document is clean')
  assert.equal(documentStore.getState().filePath, '/projects/Mixed.vectr')

  const rect = document.root.children[0]
  documentStore.dispatch(
    { type: 'setTransform', nodeId: rect.id, transform: { x: 99, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    'move',
  )
  assert.equal(documentStore.isDirty(), true, 'an edit makes it dirty')

  documentStore.markSaved(documentStore.getState().document.revision, '/projects/Mixed.vectr')
  assert.equal(documentStore.isDirty(), false, 'saving makes it clean again')

  documentStore.replaceDocument(createDocument('Fresh'), { savedRevision: 0, filePath: null })
  assert.equal(documentStore.isDirty(), false)
  assert.equal(documentStore.getState().filePath, null)
  assert.equal(documentStore.getState().recovery.available, false)
})

test('project and asset file names are filesystem-safe', () => {
  assert.equal(projectFileName('My Drawing'), 'My Drawing.vectr')
  assert.equal(projectFileName('a/b:c*d?'), 'a-b-c-d-.vectr')
  assert.equal(projectFileName('   '), 'Untitled.vectr')
  const asset: AssetRef = { id: 'sha256-abc', mimeType: 'image/jpeg', byteLength: 3, width: 1, height: 1 }
  assert.equal(assetFileName(asset), 'abc.jpg')
})

