/**
 * Editor smoke run (issue #18).
 *
 * A scripted pass over the slice's acceptance flow at the store and command level,
 * so the packaged app can prove the editor path works without a human clicking.
 * Run with `electron . --smoke`; the result is logged as `[vectr-smoke] {...}` and
 * forwarded to stdout by the main process.
 *
 * This is a smoke check, not the test suite: the assertions live in
 * `tests/doc.test.ts` and `tests/editor.test.ts`.
 */

import { createEllipse, createGroup, createRect, createText, findNode } from '../doc/document.ts'
import { marqueeHitTest } from '../doc/hitTest.ts'
import { getActiveRenderer } from '../render/activeRenderer.ts'
import { buildScene } from '../render/scene.ts'
import { planGroup } from '../app/editing/arrange.ts'
import { placeImage, runEditorAction } from '../app/actions.ts'
import {
  newDocument,
  openDocument,
  recoverDocument,
  refreshRecoveryState,
  requestNewDocument,
  resolveUnsavedPrompt,
  saveDocument,
  writeRecoverySnapshot,
} from '../app/files/fileActions.ts'
import { workspaceStore } from '../state/workspaceStore.ts'
import { serializeDocument } from '../file/serialize.ts'
import { assetRegistry } from '../state/assetRegistry.ts'
import { documentStore } from '../state/documentStore.ts'
import type { DocumentStore } from '../state/documentStore.ts'

export type SmokeStep = { name: string; ok: boolean; detail: string }
export type SmokeReport = { passed: boolean; steps: SmokeStep[] }

export function runEditorSmoke(store: DocumentStore): SmokeReport {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })

  const rect = createRect('Smoke Rect', 40, 40, 160, 120)
  const ellipse = createEllipse('Smoke Ellipse', 280, 80, 120, 120)
  const inserted = store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [rect, ellipse] },
    'smoke insert',
  )
  record('create two shapes', inserted.ok, inserted.ok ? 'inserted rect + ellipse' : inserted.message)

  const scene = buildScene(store.getState().document)
  record('scene built', scene.shapes.length === 2, `${scene.shapes.length} shapes, ${scene.byRoot.length} roots`)

  store.setSelection([rect.id])
  record('selection', store.getState().selection.join(',') === rect.id, store.getState().selection.join(',') || 'none')

  const depthBeforeDrag = store.getState().undoDepth
  store.beginTransaction('smoke move')
  for (const x of [60, 90, 120]) {
    store.dispatch({ type: 'setTransform', nodeId: rect.id, transform: { x, y: 40, rotation: 0, scaleX: 1, scaleY: 1 } })
  }
  store.commitTransaction()
  const movedX = findNode(store.getState().document, rect.id)?.transform.x
  const depthAfterDrag = store.getState().undoDepth
  record(
    'drag is one entry',
    depthAfterDrag === depthBeforeDrag + 1 && movedX === 120,
    `depth ${depthBeforeDrag} -> ${depthAfterDrag}, x ${movedX}`,
  )

  store.undo()
  const undoneX = findNode(store.getState().document, rect.id)?.transform.x
  record('undo restores', undoneX === 40, `x ${undoneX}`)

  store.redo()
  const redoneX = findNode(store.getState().document, rect.id)?.transform.x
  record('redo re-applies', redoneX === 120, `x ${redoneX}`)

  const marquee = marqueeHitTest(store.getState().document, { x: 0, y: 0, width: 500, height: 400 })
  store.setSelection(marquee)
  record('marquee selects', marquee.length === 2, `${marquee.length} layers`)

  const rejected = store.dispatch({
    type: 'setTransform',
    nodeId: 'does-not-exist',
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  })
  const errorCode = store.getState().lastError?.code ?? 'none'
  record('invalid command rejected', !rejected.ok && errorCode === 'absent-node', errorCode)
  store.clearError()

  store.setSelection([ellipse.id])
  store.dispatch({ type: 'removeNodes', nodeIds: [ellipse.id] }, 'smoke delete')
  record('delete + prune selection', store.getState().selection.length === 0, `${store.getState().selection.length} selected`)

  // Issue #20: a second shape gives something to group, and grouping two layers is one
  // gesture, so it must be one history entry with the new group selected.
  const mate = createEllipse('Smoke Group Mate', 520, 200, 80, 80)
  const root = store.getState().document.root
  store.dispatch(
    { type: 'insertNodes', parentId: root.id, index: root.children.length, nodes: [mate] },
    'smoke group prep',
  )
  const orderBefore = store.getState().document.root.children.length
  store.setSelection(store.getState().document.root.children.map((node) => node.id))
  const groupPlan = planGroup(store.getState().document, store.getState().selection)
  record('group planned', groupPlan !== null, groupPlan === null ? 'no plan' : `${groupPlan.length} steps`)

  const depthBeforeGroup = store.getState().undoDepth
  runEditorAction('object.group')
  const grouped = store.getState().document.root.children
  const group = grouped[grouped.length - 1]
  record(
    'group is one entry',
    store.getState().undoDepth === depthBeforeGroup + 1 && grouped.length === orderBefore - 1,
    `depth ${depthBeforeGroup} -> ${store.getState().undoDepth}, ${orderBefore} -> ${grouped.length} top-level`,
  )
  record(
    'group selected and nested',
    store.getState().selection.length === 1 &&
      store.getState().selection[0] === group.id &&
      (group.type === 'group' ? group.children.length : -1) === orderBefore,
    `${store.getState().selection.length} selected, ${group.type} holds ${
      group.type === 'group' ? group.children.length : 0
    }`,
  )
  store.undo()
  record(
    'undo ungroups in one step',
    store.getState().document.root.children.length === orderBefore,
    `${store.getState().document.root.children.length} top-level again`,
  )

  // Issue #16: text is a document object like any other — created by a command, edited by one
  // command in one history entry, and validated like any other node.
  const text = createText('Smoke Text', 60, 240, 'Hello\nVectr')
  const textInsert = store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [text] },
    'smoke text',
  )
  record(
    'text created',
    textInsert.ok,
    textInsert.ok ? `${text.width.toFixed(0)}x${text.height.toFixed(0)} box, 2 lines` : textInsert.message,
  )

  const depthBeforeText = store.getState().undoDepth
  const edited = store.dispatch({ type: 'setText', nodeId: text.id, text: 'Hello again' }, 'edit text')
  const editedNode = findNode(store.getState().document, text.id)
  record(
    'text edit is one entry',
    edited.ok &&
      store.getState().undoDepth === depthBeforeText + 1 &&
      editedNode !== null &&
      editedNode.type === 'text' &&
      editedNode.text === 'Hello again',
    `depth ${depthBeforeText} -> ${store.getState().undoDepth}`,
  )
  store.undo()
  const restored = findNode(store.getState().document, text.id)
  record(
    'text undo restores content',
    restored !== null && restored.type === 'text' && restored.text === 'Hello\nVectr',
    restored !== null && restored.type === 'text' ? JSON.stringify(restored.text) : 'missing',
  )

  const badSize = store.dispatch(
    {
      type: 'setTextStyle',
      nodeId: text.id,
      fontSize: -4,
      fontFamily: 'Inter',
      align: 'left',
      lineHeight: 19,
    },
    'bad size',
  )
  record(
    'invalid text style rejected',
    !badSize.ok && store.getState().lastError?.code === 'non-finite',
    store.getState().lastError?.code ?? 'none',
  )
  store.clearError()

  // A family Vectr does not bundle is accepted and reported, not refused (slice 1's rule).
  const missingFont = store.dispatch(
    {
      type: 'setTextStyle',
      nodeId: text.id,
      fontSize: 20,
      fontFamily: 'Comic Sans MS',
      align: 'center',
      lineHeight: 24,
    },
    'missing font',
  )
  record('missing font is recorded, not refused', missingFont.ok, missingFont.ok ? 'set to Comic Sans MS' : missingFont.message)

  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Save/reopen/recovery evidence (issue #19), run on the packaged app.
 *
 * Everything here goes over the real preload bridge to the real filesystem, in a scratch
 * directory under user data, so the round trip is the same code path a user's save takes. It is
 * logged as `[vectr-file]`.
 */
export async function runFileRoundTrip(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const api = window.vectrFiles
  if (api === undefined) {
    record('file bridge', false, 'the preload bridge is missing')
    return { passed: false, steps }
  }

  // A document with a nested group, text, and a placed image.
  newDocument()
  const root = documentStore.getState().document.root
  const rect = createRect('Rect', 20, 30, 120, 80)
  const group = createGroup('Group 1')
  const inner = createRect('Inner', 200, 40, 60, 60)
  const text = createText('Label', 60, 220, 'Saved text\nsecond line')
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 0, nodes: [rect, group] })
  documentStore.dispatch({ type: 'insertNodes', parentId: group.id, index: 0, nodes: [inner] })
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 2, nodes: [text] })
  const png = await makeSmokePng()
  const placed = png === null ? null : await placeImage('round-trip.png', 'image/png', png)
  const manifestBefore = serializeDocument(documentStore.getState().document).manifest
  const idsBefore = documentStore
    .getState()
    .document.root.children.map((node) => node.id)
    .join(',')

  const directory = `${await api.scratchDirectory()}/round-trip-${Date.now()}.vectr`
  const saved = await saveDocument({ directory })
  record('save writes a project', saved, directory)
  const savedState = documentStore.getState()
  record(
    'saving clears the dirty state',
    savedState.document.revision === savedState.savedRevision && savedState.filePath === directory,
    `filePath ${savedState.filePath === null ? 'none' : 'set'}`,
  )

  // An edit after the save must be discarded by reopening, which proves the file is the truth.
  documentStore.dispatch({ type: 'renameNode', nodeId: rect.id, name: 'Changed after save' }, 'rename')
  record('an edit after save is dirty', documentStore.isDirty(), 'dirty')

  const opened = await openDocument({ directory })
  const reopened = documentStore.getState().document
  record(
    'reopen restores the layer tree',
    opened && reopened.root.children.map((node) => node.id).join(',') === idsBefore,
    `${reopened.root.children.length} top-level nodes`,
  )
  record(
    'reopen restores geometry, text, and the image',
    findNode(reopened, rect.id)?.name === 'Rect' &&
      reopened.assets.length === 1 &&
      documentStore.getState().document.root.children.some((node) => node.type === 'text'),
    `${reopened.assets.length} assets`,
  )
  record(
    'a reopened document resaves byte-identically',
    serializeDocument(reopened).manifest === manifestBefore,
    serializeDocument(reopened).manifest.length + ' bytes',
  )
  record('reopened document is clean', documentStore.isDirty() === false, 'clean')

  // Recovery: unsaved work is snapshotted, offered, and comes back.
  documentStore.dispatch({ type: 'renameNode', nodeId: rect.id, name: 'Unsaved work' }, 'rename')
  const wrote = await writeRecoverySnapshot()
  await refreshRecoveryState()
  record(
    'recovery snapshot is written',
    wrote && documentStore.getState().recovery.available,
    documentStore.getState().recovery.savedAt ?? 'no timestamp',
  )
  const recovered = await recoverDocument()
  record(
    'recovery restores the unsaved work',
    recovered && findNode(documentStore.getState().document, rect.id)?.name === 'Unsaved work',
    'unsaved rename recovered',
  )
  await api.clearRecovery()
  await refreshRecoveryState()
  record('recovery clears after it is consumed', documentStore.getState().recovery.available === false, 'cleared')

  // The unsaved-work guard: starting a new document must ask instead of discarding.
  documentStore.dispatch({ type: 'renameNode', nodeId: rect.id, name: 'Guarded edit' }, 'rename')
  requestNewDocument()
  const prompt = workspaceStore.getState().pendingPrompt
  const keptWhileAsking = findNode(documentStore.getState().document, rect.id)?.name === 'Guarded edit'
  record(
    'starting a new document asks before discarding unsaved work',
    prompt?.kind === 'new' && keptWhileAsking,
    prompt === null ? 'no prompt was raised' : `prompt "${prompt.kind}", work kept: ${keptWhileAsking}`,
  )
  await resolveUnsavedPrompt('cancel')
  record(
    'cancelling the prompt leaves the document untouched',
    workspaceStore.getState().pendingPrompt === null &&
      findNode(documentStore.getState().document, rect.id)?.name === 'Guarded edit',
    'prompt closed, document unchanged',
  )

  const memory = await window.vectrBenchmark.getMemory()
  record(
    'memory recorded after save and reopen',
    memory.workingSetBytes > 0,
    `${(memory.workingSetBytes / (1024 * 1024)).toFixed(1)} MiB whole app, ${placed === null ? 'no image' : 'one image asset'}`,
  )
  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Memory and zoom evidence (Phase 1 exit criteria 5 and 6), run on the packaged app.
 *
 * Criterion 6 asks for memory on a representative *and* a stress document, recorded after save,
 * reopen, and close. Issue #19 adds "with many assets". Criterion 5 asks for zoom evidence, which
 * no earlier recorded run contained. Everything here is measured, not asserted from theory, and
 * logged as `[vectr-memory]`.
 *
 * There is **no owner-approved memory budget** yet (`docs/DECISIONS.md`: the exact budgets need
 * owner approval), so this records the numbers and marks the budget question as open rather than
 * inventing a threshold to pass.
 */
export async function runMemoryReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const mib = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const renderer = getActiveRenderer()
  if (renderer === null) {
    record('renderer available', false, 'no active renderer')
    return { passed: false, steps }
  }
  const api = window.vectrFiles
  if (api === undefined) {
    record('file bridge', false, 'the preload bridge is missing')
    return { passed: false, steps }
  }

  // A stress document: 1,000 shapes plus 48 distinct images, so the asset path is under load and
  // every image needs its own decoded entry rather than a shared one.
  newDocument()
  assetRegistry.clear()
  const root = documentStore.getState().document.root
  const shapes = Array.from({ length: 1_000 }, (_, index) =>
    createRect(`Stress ${index}`, (index * 17) % 1200, (index * 29) % 800, 40, 30),
  )
  documentStore.dispatch({ type: 'insertNodes', parentId: root.id, index: 0, nodes: shapes })

  let placed = 0
  for (let index = 0; index < 48; index += 1) {
    // 384×384 decoded to ~0.55 MiB of pixels each, so 48 images hold ~27 MiB inside the renderer
    // and releasing them is measurable rather than theoretical.
    const bytes = await makeSmokePng(index, 384)
    if (bytes === null) break
    if ((await placeImage(`stress-${index}.png`, 'image/png', bytes)) !== null) placed += 1
  }
  const assetBytes = documentStore
    .getState()
    .document.assets.reduce((total, asset) => total + asset.byteLength, 0)
  const assetSize = assetBytes < 1024 * 1024 ? `${Math.round(assetBytes / 1024)} KiB` : mib(assetBytes)
  record(
    'stress document built',
    placed === 48 && documentStore.getState().document.assets.length === 48,
    `1,000 shapes + ${placed} images, ${assetSize} of PNG bytes (~${(48 * 384 * 384 * 4 / (1024 * 1024)).toFixed(0)} MiB decoded)`,
  )

  await settle(900)
  const placedMemory = await window.vectrBenchmark.getMemory()
  const decodedAfterPlace = renderer.stats().decodedAssets
  record(
    'memory after building the stress document',
    decodedAfterPlace >= 1,
    `${mib(placedMemory.workingSetBytes)} working set (${mib(placedMemory.privateBytes)} private), ${decodedAfterPlace} decoded images, budget: not owner-approved`,
  )

  // Zoom evidence (criterion 5): the same scene drawn at four zoom levels.
  const zooms = [0.25, 1, 2, 4]
  const zoomTimes = zooms.map((zoom) => renderer.render({ zoom, panX: 0, panY: 0 }, []))
  const worstZoom = Math.max(...zoomTimes)
  record(
    'zoom frames render and are recorded',
    zoomTimes[1] <= 33,
    `${zooms.map((zoom, index) => `${zoom}× ${zoomTimes[index].toFixed(1)} ms`).join(' · ')} (worst ${worstZoom.toFixed(1)} ms)`,
  )

  const directory = `${await api.scratchDirectory()}/memory-${Date.now()}.vectr`
  const saved = await saveDocument({ directory })
  await settle(300)
  const savedMemory = await window.vectrBenchmark.getMemory()
  record('memory after save', saved, `${mib(savedMemory.workingSetBytes)} working set`)

  const opened = await openDocument({ directory })
  await settle(900)
  const openedMemory = await window.vectrBenchmark.getMemory()
  const assetsAfterOpen = documentStore.getState().document.assets.length
  record(
    'memory after reopen',
    opened && assetsAfterOpen === 48,
    `${mib(openedMemory.workingSetBytes)} working set, ${assetsAfterOpen} assets, ${renderer.stats().decodedAssets} decoded images`,
  )

  // Closing the document must release the decoded pixels, not just the records (the epic's
  // "caches are derived, bounded, and explicitly disposed" constraint).
  newDocument()
  assetRegistry.clear()
  await settle(600)
  const closedMemory = await window.vectrBenchmark.getMemory()
  const decodedAfterClose = renderer.stats().decodedAssets
  record(
    'closing the document releases its decoded assets',
    decodedAfterClose === 0,
    `${decodedAfterClose} decoded images held after close, registry empty: ${assetRegistry.size() === 0}, ${mib(closedMemory.workingSetBytes)} working set`,
  )

  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Generates a small PNG in the page, so the smoke run exercises the real import path —
 * decode, content key, placement, and drawing — without shipping a fixture file (issue #17).
 */
async function makeSmokePng(index = 0, size = 8): Promise<Uint8Array | null> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context === null) return null
  // A different colour per index, so importing many images produces many distinct content keys
  // rather than one asset referenced repeatedly. The PNG of a flat colour stays small while the
  // decoded pixels are size², which is what makes the asset cache measurable.
  context.fillStyle = `hsl(${(index * 37) % 360} 70% 55%)`
  context.fillRect(0, 0, size, size)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  return blob === null ? null : new Uint8Array(await blob.arrayBuffer())
}

/**
 * Adds 1,000 shapes and measures the renderer's own frame time, so the slice's
 * interaction criterion is recorded with numbers instead of an assumption.
 */
export async function runEditorStress(store: DocumentStore): Promise<SmokeReport> {
  const steps: SmokeStep[] = []

  // Each evidence run starts from a known document: the file round trip runs before this one
  // and replaces the document, so depending on the earlier fixture would make these steps
  // order-dependent evidence.
  newDocument()

  // Issue #17: a generated PNG runs the whole image path, including the renderer drawing the
  // asset instead of its placeholder frame.
  let placedAssetId: string | null = null
  const png = await makeSmokePng()
  if (png === null) {
    steps.push({ name: 'image imported', ok: false, detail: 'the page could not encode a PNG' })
  } else {
    const placed = await placeImage('smoke.png', 'image/png', png)
    const placedDocument = store.getState().document
    const asset = placedDocument.assets[0]
    placedAssetId = asset?.id ?? null
    steps.push({
      name: 'image imported',
      ok: placed !== null && placedDocument.assets.length === 1,
      detail:
        placed === null
          ? (store.getState().lastError?.message ?? 'no node placed')
          : `${asset.width}x${asset.height} pixels, ${asset.byteLength} bytes, asset ${asset.id.slice(0, 14)}`,
    })

    const depthBeforeUndo = store.getState().undoDepth
    store.undo()
    steps.push({
      name: 'image undo removes node and asset',
      ok: store.getState().document.assets.length === 0 && store.getState().undoDepth === depthBeforeUndo - 1,
      detail: `${store.getState().document.assets.length} assets after undo`,
    })
    store.redo()
    steps.push({
      name: 'image redo restores both',
      ok: store.getState().document.assets.length === 1,
      detail: `${store.getState().document.assets.length} assets after redo`,
    })
  }

  const nodes = Array.from({ length: 1_000 }, (_, index) =>
    createRect(`Stress ${index}`, (index * 17) % 1200, (index * 29) % 800, 40, 30),
  )
  const root = store.getState().document.root
  // Issue #16: this run owns the text object that asks for a family Vectr does not bundle, so
  // the substitution report below is this run's evidence rather than a leftover from another.
  const missingFontText = createText('Missing font', 20, 20, 'Missing family', { fontFamily: 'Comic Sans MS' })
  const textInserted = store.dispatch(
    { type: 'insertNodes', parentId: root.id, index: 0, nodes: [missingFontText] },
    'smoke missing font',
  )
  steps.push({
    name: 'missing font text placed',
    ok: textInserted.ok,
    detail: textInserted.ok ? missingFontText.fontFamily : textInserted.message,
  })
  const inserted = store.dispatch({ type: 'insertNodes', parentId: root.id, index: root.children.length, nodes }, 'smoke stress')

  if (!inserted.ok) {
    steps.push({ name: 'stress insert', ok: false, detail: inserted.message })
    return { passed: false, steps }
  }
  steps.push({ name: 'stress insert', ok: true, detail: `${nodes.length} rects` })

  // Let the shell rebuild the scene from the new document before measuring.
  await new Promise((resolve) => window.setTimeout(resolve, 750))
  const renderer = getActiveRenderer()
  if (renderer === null) {
    steps.push({ name: 'stress frames', ok: false, detail: 'no active renderer' })
    return { passed: false, steps }
  }

  const samples: number[] = []
  for (let index = 0; index < 60; index += 1) {
    samples.push(renderer.render({ zoom: 1 + (index % 5) * 0.01, panX: index, panY: index }, []))
  }
  const sorted = [...samples].sort((left, right) => left - right)
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]
  const stats = renderer.stats()
  steps.push({
    name: 'stress frames',
    ok: p95 <= 33,
    detail: `${stats.shapes} shapes, ${stats.buckets} buckets, render p95 ${p95.toFixed(2)} ms over 60 frames, build ${stats.lastBuildMs.toFixed(1)} ms`,
  })
  // Issue #16: the unavailable family set earlier must be reported, not silently drawn.
  steps.push({
    name: 'font substitution reported',
    ok: stats.substitutedFonts.includes('Comic Sans MS'),
    detail: stats.substitutedFonts.join(', ') || 'none reported',
  })
  // Issue #17: the placed image must have been drawn from its asset, not as a placeholder.
  steps.push({
    name: 'image drawn from its asset',
    ok: placedAssetId !== null && !stats.missingAssets.includes(placedAssetId),
    detail: stats.missingAssets.length === 0 ? 'no missing assets' : stats.missingAssets.join(', '),
  })
  return { passed: steps.every((step) => step.ok), steps }
}

