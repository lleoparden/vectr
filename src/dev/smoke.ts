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

import { createEllipse, createGroup, createRect, createText, findNode, worldBounds } from '../doc/document.ts'
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

  // Layers panel actions: Duplicate and New Layer, each one undo step with a predictable result.
  const duplicateTarget = store.getState().document.root.children[0]
  store.setSelection([duplicateTarget.id])
  const depthBeforeDuplicate = store.getState().undoDepth
  const countBeforeDuplicate = store.getState().document.root.children.length
  runEditorAction('object.duplicate')
  const afterDuplicate = store.getState().document.root.children
  const copyId = store.getState().selection[0]
  record(
    'duplicate is one entry above the original',
    store.getState().undoDepth === depthBeforeDuplicate + 1 &&
      afterDuplicate.length === countBeforeDuplicate + 1 &&
      copyId !== undefined &&
      copyId !== duplicateTarget.id &&
      afterDuplicate[1].id === copyId,
    `${countBeforeDuplicate} -> ${afterDuplicate.length} top-level, copy at index 1: ${afterDuplicate[1].id === copyId}`,
  )
  store.undo()
  record(
    'undo removes the duplicate',
    store.getState().document.root.children.length === countBeforeDuplicate,
    `${store.getState().document.root.children.length} top-level again`,
  )

  const depthBeforeLayer = store.getState().undoDepth
  runEditorAction('layer.new')
  const withLayer = store.getState().document.root.children
  const topLayer = withLayer[withLayer.length - 1]
  record(
    'new layer lands on top and is selected',
    store.getState().undoDepth === depthBeforeLayer + 1 &&
      topLayer.type === 'group' &&
      store.getState().selection[0] === topLayer.id,
    `${topLayer.type} "${topLayer.name}" at the top`,
  )

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

  // Layers panel thumbnails: the preview must be a real render of the layer, not a placeholder.
  const thumbnailRenderer = getActiveRenderer()
  const thumbnailLayer = documentStore.getState().document.root.children[0]
  const thumbnailBounds = worldBounds(documentStore.getState().document, thumbnailLayer.id)
  const thumbnail =
    thumbnailRenderer === null || thumbnailBounds === null
      ? null
      : thumbnailRenderer.renderThumbnail(thumbnailLayer.id, 28, thumbnailBounds)
  record(
    'layer thumbnail renders a real preview',
    thumbnail !== null && thumbnail.startsWith('data:image/png;base64,') && thumbnail.length > 200,
    thumbnail === null
      ? 'no preview was produced'
      : `${Math.round(((thumbnail.length - 'data:image/png;base64,'.length) * 3) / 4)} bytes of PNG for "${thumbnailLayer.name}"`,
  )
  // A data URL that is merely well-formed could still be blank, so decode it and check its size.
  const decodedThumbnail =
    thumbnail === null
      ? null
      : await new Promise<{ width: number; height: number } | null>((resolve) => {
          const probe = new Image()
          probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight })
          probe.onerror = () => resolve(null)
          probe.src = thumbnail
        })
  record(
    'the thumbnail decodes as a 28x28 image',
    decodedThumbnail?.width === 28 && decodedThumbnail?.height === 28,
    decodedThumbnail === null ? 'the data URL did not decode' : `${decodedThumbnail.width}×${decodedThumbnail.height}`,
  )

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
 * Text entry at the DOM level (fix for "the Type tool does nothing").
 *
 * The unit tests cover the text commands, and the file round trip covers saving a text object, but
 * nothing exercised the actual interaction: press the Type tool, click the canvas, type, click away.
 * That gap is exactly where the editor was being closed by the same click that opened it, so this
 * report drives the real canvas element with real pointer events and reads the real DOM back.
 */
export async function runTextEntryReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Design canvas"]')
  if (canvas === null) {
    record('canvas found', false, 'no canvas element')
    return { passed: false, steps }
  }
  const editor = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit text"]')

  /** Clicks the canvas the way a user does: pointerdown then pointerup at the same point. */
  const clickCanvas = (x: number, y: number) => {
    const box = canvas.getBoundingClientRect()
    const clientX = box.left + x
    const clientY = box.top + y
    const options = { pointerId: 1, button: 0, buttons: 1, clientX, clientY, bubbles: true, isPrimary: true }
    canvas.dispatchEvent(new PointerEvent('pointerdown', options))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }))
  }

  /** Types into a controlled React textarea the way the browser would. */
  const typeInto = (element: HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  newDocument()
  await settle(150)
  runEditorAction('tool.text')
  await settle(100)

  // 1. Clicking with the Type tool must place a text object *and* leave an editor open.
  clickCanvas(200, 180)
  await settle(150)
  const placed = documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  const openedEditor = editor()
  record(
    'clicking with the Type tool places text and opens the editor',
    placed === 1 && openedEditor !== null,
    `${placed} text object(s), editor ${openedEditor === null ? 'NOT open' : 'open'}`,
  )

  // 2. Typing must survive committing, and be one history entry.
  if (openedEditor !== null) {
    const depthBefore = documentStore.getState().undoDepth
    typeInto(openedEditor, 'Hello Vectr')
    await settle(50)
    openedEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
    const textNode = documentStore.getState().document.root.children.find((node) => node.type === 'text')
    const content = textNode !== undefined && textNode.type === 'text' ? textNode.text : null
    record(
      'typed text is committed as one entry',
      content === 'Hello Vectr' && documentStore.getState().undoDepth === depthBefore + 1,
      `content ${JSON.stringify(content)}, depth ${depthBefore} -> ${store_depth()} `,
    )
    record(
      'the editor closes after committing',
      editor() === null && documentStore.getState().selection.length === 1,
      `editor ${editor() === null ? 'closed' : 'still open'}`,
    )
  }

  // 3. Clicking away without typing must not leave an invisible empty object behind.
  runEditorAction('tool.text')
  clickCanvas(320, 260)
  await settle(150)
  const emptyEditor = editor()
  if (emptyEditor !== null) {
    typeInto(emptyEditor, '   ')
    emptyEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
  }
  const remaining = documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  record(
    'an abandoned empty text object is discarded',
    remaining === 1,
    `${remaining} text object(s) left after the empty one was abandoned`,
  )

  // 4. A real mouse click moves focus, so a blur can arrive the instant the editor opens. That
  //    must not destroy the object the user was about to type into.
  runEditorAction('tool.text')
  clickCanvas(420, 320)
  await settle(150)
  const beforeBlur = editor()
  beforeBlur?.blur()
  await settle(150)
  const stillOpen = editor()
  const stillPlaced = documentStore.getState().document.root.children.filter((node) => node.type === 'text').length
  record(
    'a blur before typing does not destroy the text object',
    stillOpen !== null && stillPlaced >= 1,
    `editor ${stillOpen === null ? 'closed' : 'open'}, ${stillPlaced} text object(s)`,
  )
  if (stillOpen !== null) {
    typeInto(stillOpen, 'Recovered')
    stillOpen.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
    const typed = documentStore
      .getState()
      .document.root.children.filter((node) => node.type === 'text' && node.text === 'Recovered').length
    record('typing still works after that blur', typed === 1, `${typed} object(s) with the typed content`)
  }

  // 5. Double-clicking an existing text object opens the same editor.
  runEditorAction('tool.select')
  await settle(50)
  const onlyText = documentStore.getState().document.root.children.find((node) => node.type === 'text')
  if (onlyText !== undefined) {
    documentStore.setSelection([onlyText.id])
    const box = canvas.getBoundingClientRect()
    const world = worldBounds(documentStore.getState().document, onlyText.id)
    const viewport = documentStore.getState().viewport
    if (world !== null) {
      const x = (world.x + 4) * viewport.zoom + viewport.panX
      const y = (world.y + 4) * viewport.zoom + viewport.panY
      canvas.dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, clientX: box.left + x, clientY: box.top + y }),
      )
      await settle(150)
      record(
        'double-clicking a text object reopens the editor',
        editor() !== null,
        editor() === null ? 'no editor' : 'editor open for the existing text',
      )
      editor()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await settle(100)
    }
  }

  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Tool palette grouping and the tool options bar (owner request after Phase 1).
 *
 * The unit tests cover the model; this report drives the real chrome: it clicks the real palette
 * slots and the real bar controls in the packaged app, then reads the document back to prove the
 * bar's settings reached the object the tool drew. Logged as `[vectr-ui]`.
 */
export async function runToolOptionsReport(): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })
  const settle = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Design canvas"]')
  const bar = () => document.querySelector<HTMLElement>('[aria-label="Tool options"]')

  if (canvas === null || bar() === null) {
    record('the tool options bar is on screen', false, 'canvas or options bar missing')
    return { passed: false, steps }
  }

  /** Clicks the canvas the way a user does: pointerdown then pointerup at the same point. */
  const clickCanvas = (x: number, y: number) => {
    const box = canvas.getBoundingClientRect()
    const options = {
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: box.left + x,
      clientY: box.top + y,
      bubbles: true,
      isPrimary: true,
    }
    canvas.dispatchEvent(new PointerEvent('pointerdown', options))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }))
  }

  /** Drags on the canvas, which is how the shape tool draws. Pointer id 1 is the mouse. */
  const dragCanvas = (fromX: number, fromY: number, toX: number, toY: number) => {
    const box = canvas.getBoundingClientRect()
    const base = { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true, isPrimary: true }
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { ...base, buttons: 1, clientX: box.left + fromX, clientY: box.top + fromY }),
    )
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { ...base, buttons: 1, clientX: box.left + toX, clientY: box.top + toY }),
    )
    canvas.dispatchEvent(
      new PointerEvent('pointerup', { ...base, buttons: 0, clientX: box.left + toX, clientY: box.top + toY }),
    )
  }

  const barButton = (text: string) =>
    Array.from(bar()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === text,
    )
  const setNumber = (value: string) => {
    const input = bar()?.querySelector<HTMLInputElement>('input[type="number"]')
    if (input === undefined || input === null) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  newDocument()
  await settle(150)
  // 1. The palette groups Rectangle and Ellipse into one slot with a flyout, like Illustrator.
  const slots = document.querySelectorAll('[data-tool-slot]')
  const shapeFlyout = document.querySelector('[data-tool-flyout="shape"]')
  const shapeSlot = document.querySelector<HTMLButtonElement>('[data-tool-slot="shape"]')
  record(
    'the palette groups the shape tools into one slot with a flyout',
    slots.length === 3 && shapeFlyout !== null && shapeSlot?.title?.includes('Shape Tool') === true,
    `${slots.length} slots, shape flyout ${shapeFlyout === null ? 'missing' : 'present'}, slot labelled ${JSON.stringify(shapeSlot?.title)}`,
  )

  // 2. Clicking the Type tool must change the bar to the Type tool's controls.
  document.querySelector<HTMLButtonElement>('[data-tool-slot="text"]')?.click()
  await settle(120)
  record(
    'the options bar changes with the active tool',
    bar()?.dataset.toolOptions === 'text' && setNumber('42'),
    `bar reports ${JSON.stringify(bar()?.dataset.toolOptions)} for the Type tool`,
  )
  barButton('Center')?.click()
  document.querySelector<HTMLButtonElement>('[aria-label="Text colour #7c6cf5"]')?.click()
  await settle(80)

  // 3. Those settings must reach the object the Type tool is about to draw.
  clickCanvas(200, 200)
  await settle(150)
  const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit text"]')
  if (editor !== null) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(editor, 'Bar settings')
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(150)
  }
  const text = documentStore.getState().document.root.children.find((node) => node.type === 'text')
  record(
    'the Type tool draws with the bar settings',
    text !== undefined &&
      text.type === 'text' &&
      text.text === 'Bar settings' &&
      text.fontSize === 42 &&
      text.align === 'center' &&
      text.style.fill === '#7c6cf5',
    text === undefined || text.type !== 'text'
      ? 'no text object'
      : `size ${text.fontSize}, align ${text.align}, fill ${text.style.fill}`,
  )

  // 4. The shape row's switch picks the member and activates it.
  runEditorAction('tool.rect')
  await settle(100)
  barButton('Ellipse')?.click()
  await settle(100)
  const ellipsePressed = barButton('Ellipse')?.getAttribute('aria-pressed') === 'true'
  record(
    'the shape switch activates the member it names',
    documentStore.getState().tool === 'ellipse' && bar()?.dataset.toolOptions === 'shape' && ellipsePressed,
    `tool ${documentStore.getState().tool}, bar ${JSON.stringify(bar()?.dataset.toolOptions)}, ellipse pressed ${ellipsePressed}`,
  )

  // 5. The shape fill must reach the shape the drag creates.
  document.querySelector<HTMLButtonElement>('[aria-label="Fill #e2665c"]')?.click()
  await settle(80)
  dragCanvas(320, 240, 420, 320)
  await settle(150)
  const ellipse = documentStore.getState().document.root.children.find((node) => node.type === 'ellipse')
  record(
    'the shape tool draws one shape with the bar fill',
    ellipse !== undefined && ellipse.type === 'ellipse' && ellipse.style.fill === '#e2665c',
    ellipse === undefined || ellipse.type !== 'ellipse'
      ? 'no ellipse'
      : `fill ${ellipse.style.fill}, ${documentStore.getState().document.root.children.length} root children`,
  )
  // 6. With that shape selected, the bar shows its object numbers and its commands.
  documentStore.setSelection(ellipse === undefined ? [] : [ellipse.id])
  await settle(120)
  runEditorAction('tool.select')
  await settle(120)
  const numbers = ['X', 'Y', 'W', 'H'].map(
    (label) => bar()?.querySelector(`[data-tool-readout="${label}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  )
  const duplicate = Array.from(bar()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
    (button) => button.textContent?.trim() === 'Duplicate',
  )
  record(
    'the Selection tool row reports the object and enables its commands',
    numbers.every((text) => /^[XYWH] -?\d+$/.test(text)) && duplicate !== undefined && duplicate.disabled === false,
    `readouts ${JSON.stringify(numbers)}, duplicate ${duplicate === undefined ? 'missing' : 'present'}`,
  )

  // 7. The palette flyout switches members too, which is how Illustrator's tool groups work.
  document.querySelector<HTMLButtonElement>('[data-tool-flyout="shape"]')?.click()
  await settle(120)
  const members = document.querySelectorAll('[data-tool-member]')
  document.querySelector<HTMLButtonElement>('[data-tool-member="rect"]')?.click()
  await settle(120)
  record(
    'the palette flyout offers both members and switches between them',
    members.length === 2 &&
      documentStore.getState().tool === 'rect' &&
      workspaceStore.getState().creationDefaults.shapeTool === 'rect',
    `flyout listed ${members.length} member(s), tool now ${documentStore.getState().tool}`,
  )

  return { passed: steps.every((step) => step.ok), steps }
}

/** Current history depth, for step details. */
function store_depth(): string {
  return String(documentStore.getState().undoDepth)
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

  // A bucket that holds several top-level layers must refuse to preview rather than showing a
  // layer's neighbours (the documented thumbnail limitation on very large documents).
  const crowdedLayer = documentStore.getState().document.root.children[0]
  const crowdedBounds = worldBounds(documentStore.getState().document, crowdedLayer.id)
  const crowdedThumbnail =
    crowdedBounds === null ? null : renderer.renderThumbnail(crowdedLayer.id, 28, crowdedBounds)
  record(
    'a chunked bucket refuses a misleading thumbnail',
    crowdedThumbnail === null,
    crowdedThumbnail === null ? 'no preview offered for a shared bucket' : 'produced a misleading preview',
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

