/**
 * Image asset tests (issue #17).
 *
 * The import rules and the document half of image placement are pure, so they are tested
 * directly: content addressing, the limits, the rule that an image must reference an asset the
 * document carries, and that one `placeImage` command registers the asset and inserts the node
 * together so undo removes both at once.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand } from '../src/doc/commands.ts'
import {
  assetKeyFor,
  checkAssetLimits,
  formatByteLength,
  importAsset,
  MAX_ASSET_BYTES,
  MAX_ASSET_PIXELS,
  mimeTypeForName,
} from '../src/doc/assets.ts'
import { createDocument, createImage, findNode } from '../src/doc/document.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { hitTest, marqueeHitTest } from '../src/doc/hitTest.ts'
import { buildScene } from '../src/render/scene.ts'
import { AssetRegistry, assetRegistry } from '../src/state/assetRegistry.ts'
import { documentStore } from '../src/state/documentStore.ts'
import { placeImage } from '../src/app/actions.ts'
import type { AssetRef, Document } from '../src/doc/types.ts'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const PNG_ASSET: AssetRef = { id: 'sha256-test', mimeType: 'image/png', byteLength: PNG.byteLength, width: 40, height: 20 }

function documentWithAsset(asset: AssetRef = PNG_ASSET): Document {
  const result = applyCommand(createDocument(), { type: 'addAsset', asset })
  assert.equal(result.ok, true, result.ok ? '' : result.message)
  return result.ok ? result.document : createDocument()
}

test('asset keys are content-addressed', async () => {
  const first = await assetKeyFor(PNG)
  const same = await assetKeyFor(new Uint8Array(PNG))
  const different = await assetKeyFor(new Uint8Array([...PNG, 4]))
  assert.equal(first, same, 'the same bytes give the same key')
  assert.notEqual(first, different, 'different bytes give a different key')
  assert.match(first, /^sha256-[0-9a-f]{64}$/)
})

test('the import rules reject unsupported types, oversized files, and huge images', () => {
  assert.equal(checkAssetLimits('image/png', 1024, 10, 10, 0), null)
  assert.equal(checkAssetLimits('image/jpeg', 1024, 10, 10, 0), null)
  assert.equal(checkAssetLimits('image/gif', 1024, 10, 10, 0)?.code, 'unsupported-type')
  assert.equal(checkAssetLimits('image/png', MAX_ASSET_BYTES + 1, 10, 10, 0)?.code, 'too-large')
  assert.equal(checkAssetLimits('image/png', 0, 10, 10, 0)?.code, 'too-large')
  assert.equal(checkAssetLimits('image/png', 1024, MAX_ASSET_PIXELS, 2, 0)?.code, 'too-many-pixels')
  assert.equal(checkAssetLimits('image/png', 1024, 0, 10, 0)?.code, 'corrupt')
  assert.equal(checkAssetLimits('image/png', 1024, 10, 10, 512)?.code, 'too-many-assets')
  assert.equal(mimeTypeForName('photo.PNG'), 'image/png')
  assert.equal(mimeTypeForName('photo.jpeg'), 'image/jpeg')
  assert.equal(mimeTypeForName('notes.txt'), null)
  assert.equal(formatByteLength(2048), '2 KiB')
})

test('a rejected import reports a reason instead of altering anything', async () => {
  const rejected = await importAsset(
    { name: 'huge.png', mimeType: 'image/png', bytes: new Uint8Array(MAX_ASSET_BYTES + 1), width: 10, height: 10 },
    0,
  )
  assert.equal(rejected.ok, false)
  if (!rejected.ok) assert.equal(rejected.code, 'too-large')

  const wrongType = await importAsset({ name: 'a.gif', mimeType: 'image/gif', bytes: PNG, width: 10, height: 10 }, 0)
  assert.equal(wrongType.ok, false)

  const accepted = await importAsset({ name: 'a.png', mimeType: 'image/png', bytes: PNG, width: 40, height: 20 }, 0)
  assert.equal(accepted.ok, true)
  if (!accepted.ok) return
  assert.equal(accepted.asset.ref.byteLength, PNG.byteLength)
  assert.equal(accepted.asset.ref.id, await assetKeyFor(PNG))
  assert.equal(accepted.asset.name, 'a.png')
})

test('placeImage registers the asset and inserts the node in one undoable step', () => {
  const node = createImage('photo.png', 10, 20, PNG_ASSET.id, 40, 20)
  const placed = applyCommand(createDocument(), {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node,
    asset: PNG_ASSET,
  })
  assert.equal(placed.ok, true)
  if (!placed.ok) return
  assert.equal(placed.document.assets.length, 1, 'the asset is recorded with the node')
  assert.equal(placed.document.assets[0].id, PNG_ASSET.id)
  assert.deepEqual(
    placed.document.root.children.map((child) => child.id),
    [node.id],
  )
  assert.equal(validateDocument(placed.document).ok, true)

  const undone = applyCommand(placed.document, placed.inverse)
  assert.equal(undone.ok, true, 'undo removes the node and the asset together')
  if (!undone.ok) return
  assert.equal(undone.document.assets.length, 0)
  assert.equal(undone.document.root.children.length, 0)

  const redone = applyCommand(undone.document, {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node,
    asset: PNG_ASSET,
  })
  assert.equal(redone.ok, true)
  if (redone.ok) {
    assert.equal(redone.document.assets.length, 1)
    assert.equal(redone.document.root.children.length, 1)
  }
})

test('a second copy of the same image shares one asset, and its undo leaves the asset alone', () => {
  const first = createImage('one.png', 0, 0, PNG_ASSET.id, 40, 20)
  const second = createImage('two.png', 50, 0, PNG_ASSET.id, 40, 20)
  const placed = applyCommand(createDocument(), {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node: first,
    asset: PNG_ASSET,
  })
  assert.equal(placed.ok, true)
  if (!placed.ok) return
  const again = applyCommand(placed.document, {
    type: 'placeImage',
    parentId: 'root',
    index: 1,
    node: second,
    asset: PNG_ASSET,
  })
  assert.equal(again.ok, true)
  if (!again.ok) return
  assert.equal(again.document.assets.length, 1, 'the second placement reuses the asset')
  assert.equal(again.inverse.type, 'removeNodes', 'and its undo must not drop the shared asset')

  const undone = applyCommand(again.document, again.inverse)
  assert.equal(undone.ok, true)
  if (!undone.ok) return
  assert.equal(undone.document.assets.length, 1, 'the asset stays while the first copy uses it')
  assert.equal(undone.document.root.children.length, 1)
})

test('placeImage refuses a mismatched node, a bad size, a disallowed type, and a bad parent', () => {
  const document = createDocument()
  const node = createImage('photo.png', 0, 0, PNG_ASSET.id, 40, 20)

  const mismatch = applyCommand(document, {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node,
    asset: { ...PNG_ASSET, id: 'sha256-other' },
  })
  assert.equal(mismatch.ok ? '' : mismatch.code, 'invalid-asset')

  const zeroSize = applyCommand(document, {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node: { ...node, width: 0 },
    asset: PNG_ASSET,
  })
  assert.equal(zeroSize.ok ? '' : zeroSize.code, 'non-positive-size')

  const gif = applyCommand(document, {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node,
    asset: { ...PNG_ASSET, mimeType: 'image/gif' },
  })
  assert.equal(gif.ok ? '' : gif.code, 'invalid-asset')

  const noParent = applyCommand(document, {
    type: 'placeImage',
    parentId: 'missing',
    index: 0,
    node,
    asset: PNG_ASSET,
  })
  assert.equal(noParent.ok ? '' : noParent.code, 'absent-parent')
  assert.equal(document.assets.length, 0, 'nothing was registered by a refused placement')
})

test('an asset cannot be removed while an image uses it, and validation knows the difference', () => {
  const node = createImage('photo.png', 0, 0, PNG_ASSET.id, 40, 20)
  const placed = applyCommand(documentWithAsset(), {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node,
    asset: PNG_ASSET,
  })
  assert.equal(placed.ok, true)
  if (!placed.ok) return

  const stillUsed = applyCommand(placed.document, { type: 'removeAsset', assetId: PNG_ASSET.id })
  assert.equal(stillUsed.ok ? '' : stillUsed.code, 'invalid-asset', 'a used asset cannot be dropped')

  const removed = applyCommand(placed.document, { type: 'removeNodes', nodeIds: [node.id] })
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  const dropped = applyCommand(removed.document, { type: 'removeAsset', assetId: PNG_ASSET.id })
  assert.equal(dropped.ok, true, 'once the image is gone the asset may go')
  if (!dropped.ok) return
  assert.equal(dropped.document.assets.length, 0)

  const restored = applyCommand(dropped.document, dropped.inverse)
  assert.equal(restored.ok, true, 'undo of a removal adds the asset back')
  if (restored.ok) assert.equal(restored.document.assets.length, 1)

  const orphan: Document = { ...placed.document, assets: [] }
  const validation = validateDocument(orphan)
  assert.equal(validation.ok, false)
  if (!validation.ok) assert.equal(validation.issue.code, 'invalid-asset')
})

test('an image is selected, hit, marqueed, and drawn in paint order like any node', () => {
  const node = createImage('photo.png', 100, 50, PNG_ASSET.id, 60, 30)
  const placed = applyCommand(documentWithAsset(), {
    type: 'placeImage',
    parentId: 'root',
    index: 0,
    node,
    asset: PNG_ASSET,
  })
  assert.equal(placed.ok, true)
  if (!placed.ok) return
  const document = placed.document

  assert.equal(hitTest(document, { x: 110, y: 60 }), node.id)
  assert.equal(hitTest(document, { x: 10, y: 10 }), null)
  assert.deepEqual(marqueeHitTest(document, { x: 90, y: 40, width: 100, height: 60 }), [node.id])

  const scene = buildScene(document).shapes[0]
  assert.equal(scene.kind, 'image')
  assert.equal(scene.assetId, PNG_ASSET.id, 'the renderer is told which asset to draw')
  assert.equal(scene.text, null)

  // Moving and locking go through the same commands as any other node.
  const moved = applyCommand(document, {
    type: 'setTransform',
    nodeId: node.id,
    transform: { x: 120, y: 70, rotation: 0, scaleX: 1, scaleY: 1 },
  })
  assert.equal(moved.ok, true)
  const locked = applyCommand(document, { type: 'setFlags', nodeId: node.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
})

test('the asset registry keeps one copy per key and prunes what the document dropped', () => {
  const registry = new AssetRegistry()
  const record = { ref: PNG_ASSET, bytes: PNG, name: 'photo.png' }
  assert.equal(registry.put(record), record)
  assert.equal(registry.put({ ...record, name: 'copy.png' }).name, 'photo.png', 'the first record wins')
  assert.equal(registry.size(), 1)
  assert.equal(registry.has(PNG_ASSET.id), true)
  assert.deepEqual(registry.ids(), [PNG_ASSET.id])

  assert.deepEqual(registry.prune(new Set()), [PNG_ASSET.id], 'an unused asset is dropped')
  assert.equal(registry.size(), 0)
  registry.put(record)
  assert.deepEqual(registry.prune(new Set([PNG_ASSET.id])), [], 'a used asset is kept')
  registry.clear()
  assert.equal(registry.get(PNG_ASSET.id), undefined)
})

test('the store reports an import it cannot decode and leaves the document alone', async () => {
  documentStore.replaceDocument(createDocument())
  assetRegistry.clear()
  // Decoding needs the renderer's image decoder, which this Node test does not have, so the
  // import must fail cleanly. That is the same path Electron takes for a corrupt file.
  const placed = await placeImage('broken.png', 'image/png', PNG)
  assert.equal(placed, null)
  assert.equal(documentStore.getState().document.assets.length, 0, 'no asset was recorded')
  assert.equal(documentStore.getState().document.root.children.length, 0, 'no node was inserted')
  assert.equal(assetRegistry.size(), 0, 'no bytes were retained')
  assert.notEqual(documentStore.getState().lastError, null, 'the failure is reported')
  documentStore.clearError()
})
