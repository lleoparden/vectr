/**
 * Project file operations (issue #19).
 *
 * New, Open, Save, Save As, and Recover live here, so `actions.ts` stays a table of what can be
 * done and this module owns how it is done. Every disk operation goes through the preload
 * bridge; a browser build without it reports that file operations need the desktop app rather
 * than pretending to save.
 *
 * Dirty state is a comparison, never a flag: the store holds the revision the file matches and
 * `isDirty` compares it with the document's current revision, so no edit path can forget to set
 * a dirty bit.
 */

import { createDocument } from '../../doc/document.ts'
import { assetRegistry } from '../../state/assetRegistry.ts'
import { documentStore } from '../../state/documentStore.ts'
import { workspaceStore } from '../../state/workspaceStore.ts'
import { settingsStore } from '../../state/settingsStore.ts'
import { requiredAssets, verifyAssets } from '../../file/validate.ts'
import { deserializeDocument, serializeDocument } from '../../file/serialize.ts'
import { projectFileName } from '../../file/format.ts'
import { readRecovery, manifestAssets, type RecoverySnapshot } from '../../file/recovery.ts'
import { shouldWriteSnapshot, type AutosaveReason } from './autosavePolicy.ts'
import { needsUnsavedPrompt, promptChoiceFor } from './unsavedPrompt.ts'

function bridge() {
  return typeof window === 'undefined' ? undefined : window.vectrFiles
}

function report(code: string, message: string): void {
  documentStore.reportError(code, message)
}

/** New: an empty document. The caller confirms first when there is unsaved work. */
export function newDocument(): void {
  assetRegistry.clear()
  documentStore.replaceDocument(createDocument(), { savedRevision: 0, filePath: null })
}

/**
 * Open: reads a project, validates it, and only then replaces the document. A file that fails
 * validation leaves the open document exactly as it was.
 *
 * `directory` is an explicit destination used by the packaged smoke run (and available to a
 * future CLI); the UI always goes through the dialog.
 */
export async function openDocument(options: { directory?: string } = {}): Promise<boolean> {
  const api = bridge()
  if (api === undefined) {
    report('no-file-bridge', 'Opening projects needs the desktop app.')
    return false
  }
  const result =
    options.directory === undefined ? await api.openProject() : await api.openProjectAt(options.directory)
  if (!result.ok) {
    report(result.code, result.message)
    return false
  }
  if (result.canceled) return false

  const parsed = deserializeDocument(result.manifest)
  if (!parsed.ok) {
    report(parsed.code, parsed.message)
    return false
  }
  const found = new Map(result.assets.map((asset) => [asset.id, asset.bytes]))
  const verified = await verifyAssets(parsed.document, found)
  if (!verified.ok) {
    report(verified.code, verified.message)
    return false
  }

  // Only now is the work on screen touched: validated document, verified assets, then swap.
  for (const asset of requiredAssets(parsed.document)) {
    const bytes = found.get(asset.id)
    if (bytes !== undefined) assetRegistry.put({ ref: asset, bytes, name: asset.id })
  }
  documentStore.replaceDocument(parsed.document, {
    savedRevision: parsed.document.revision,
    filePath: result.directory,
  })
  documentStore.setRecovery({ available: false, savedAt: null })
  return true
}

/** Save, and Save As when there is no path yet or the caller asks for one. */
export async function saveDocument(options: { askForPath?: boolean; directory?: string } = {}): Promise<boolean> {
  const api = bridge()
  if (api === undefined) {
    report('no-file-bridge', 'Saving needs the desktop app.')
    return false
  }
  const state = documentStore.getState()
  const { manifest, assets } = serializeDocument(state.document)
  const payloadAssets = assets
    .map((ref) => {
      const record = assetRegistry.get(ref.id)
      return record === undefined ? null : { id: ref.id, mimeType: ref.mimeType, bytes: record.bytes }
    })
    .filter((entry): entry is { id: string; mimeType: string; bytes: Uint8Array } => entry !== null)

  const explicit = options.directory ?? null
  const result = await api.saveProject({
    directory: explicit ?? state.filePath,
    askForPath: explicit === null && (options.askForPath === true || state.filePath === null),
    suggestedName: projectFileName(state.document.name),
    manifest,
    assets: payloadAssets,
    usedAssetIds: assets.map((ref) => ref.id),
  })
  if (!result.ok) {
    report(result.code, result.message)
    return false
  }
  if (result.canceled) return false

  documentStore.markSaved(documentStore.getState().document.revision, result.directory)
  // The document now exists on disk, so the recovery snapshot has done its job.
  await api.clearRecovery().catch(() => undefined)
  documentStore.setRecovery({ available: false, savedAt: null })
  return true
}

/**
 * Writes the recovery snapshot: a whole project folder (manifest plus the document's assets), so a
 * crashed document comes back with its images. Called on the user's interval for a document that
 * already has a file, and once before unsaved work is dropped.
 */
export async function writeRecoverySnapshot(options: { reason: AutosaveReason } = { reason: 'interval' }): Promise<boolean> {
  const api = bridge()
  const state = documentStore.getState()
  const settings = settingsStore.getState()
  if (
    api === undefined ||
    !shouldWriteSnapshot({
      reason: options.reason,
      hasFilePath: state.filePath !== null,
      isDirty: documentStore.isDirty(),
      enabled: settings.autosaveEnabled,
    })
  ) {
    return false
  }
  const { manifest, assets } = serializeDocument(state.document)
  const payload = assets
    .map((ref) => {
      const record = assetRegistry.get(ref.id)
      return record === undefined ? null : { ref, bytes: record.bytes }
    })
    .filter((entry): entry is { ref: (typeof assets)[number]; bytes: Uint8Array } => entry !== null)
  const savedAt = new Date().toISOString()
  const result = await api.writeRecovery({
    savedAt,
    documentName: state.document.name,
    directory: state.filePath,
    savedRevision: state.savedRevision,
    manifest,
    assets: payload.map((entry) => ({ id: entry.ref.id, mimeType: entry.ref.mimeType, bytes: entry.bytes })),
  })
  if (result.ok) documentStore.setRecovery({ available: true, savedAt })
  return result.ok
}

/**
 * Checks for a recovery snapshot at launch. An **unclean** exit with a snapshot waiting opens the
 * crash dialog instead of leaving the user to find the File menu item, which is the owner's rule:
 * after a crash Vectr must say it closed in the wrong way and offer the work back.
 */
export async function refreshRecoveryState(): Promise<boolean> {
  const api = bridge()
  if (api === undefined) return false
  const result = await api.readRecovery()
  const snapshot: RecoverySnapshot | null = result.snapshot ?? null
  documentStore.setRecovery({ available: snapshot !== null, savedAt: snapshot?.savedAt ?? null })
  if (snapshot !== null && result.uncleanExit === true) {
    workspaceStore.setCrashPrompt({
      documentName: snapshot.documentName,
      savedAt: snapshot.savedAt,
      directory: snapshot.directory,
    })
    return true
  }
  return false
}

/**
 * The close question: the main process asks before it closes, and with unsaved work we answer
 * with Vectr's own dialog instead of a native message box. If the window is never told it may
 * close, it stays open — an unanswered prompt can never lose work.
 */
export async function handleBeforeClose(): Promise<void> {
  const api = bridge()
  if (api === undefined) return
  if (!needsUnsavedPrompt(documentStore.isDirty())) {
    await api.allowClose()
    return
  }
  workspaceStore.promptFor('close', documentStore.getState().document.name)
}

/**
 * Resolves the dialog: save, discard, or cancel. A failed or cancelled save leaves the prompt
 * open so nothing is dropped silently, and discarding on close takes a recovery snapshot first.
 */
export async function resolveUnsavedPrompt(button: 'confirm' | 'discard' | 'cancel'): Promise<void> {
  const prompt = workspaceStore.getState().pendingPrompt
  if (prompt === null) return
  const choice = promptChoiceFor(button)

  if (choice === 'cancel') {
    workspaceStore.clearPrompt()
    return
  }
  if (choice === 'save') {
    const saved = await saveDocument()
    if (!saved) {
      // The user cancelled the save dialog or the write failed: keep asking rather than lose work.
      workspaceStore.setPromptBusy(false)
      return
    }
  }

  workspaceStore.clearPrompt()
  if (prompt.kind === 'close') {
    // Discarding is the only path that can lose work, so the snapshot is taken first. This is the
    // close net, not autosave: it covers an untitled document too, which the interval never does.
    if (choice === 'discard') await writeRecoverySnapshot({ reason: 'close' })
    await bridge()?.allowClose()
    return
  }
  if (prompt.kind === 'new') {
    newDocument()
    return
  }
  await openDocument()
}

/**
 * New, guarded: starting a new document used to discard unsaved work without asking, which is
 * exactly the silent data loss the recovery rules exist to prevent.
 */
export function requestNewDocument(): void {
  if (needsUnsavedPrompt(documentStore.isDirty())) {
    workspaceStore.promptFor('new', documentStore.getState().document.name)
    return
  }
  newDocument()
}

/** Open, guarded the same way as New. */
export function requestOpenDocument(): void {
  if (needsUnsavedPrompt(documentStore.isDirty())) {
    workspaceStore.promptFor('open', documentStore.getState().document.name)
    return
  }
  void openDocument()
}
/**
 * Restores the snapshot: the document, its assets, and the file it came from. Restoring reopens it
 * where it lived, so the next Save writes back to the user's own file rather than a copy — which is
 * what the owner asked for ("if vectr crashes it brings up the old file").
 */
export async function recoverDocument(): Promise<boolean> {
  const api = bridge()
  if (api === undefined) return false
  const result = await api.readRecovery()
  const snapshot: RecoverySnapshot | null = result.snapshot ?? null
  if (snapshot === null) {
    report('no-recovery', 'No recovery snapshot is available.')
    return false
  }
  const parsed = deserializeDocument(snapshot.manifest)
  if (!parsed.ok) {
    report(parsed.code, parsed.message)
    return false
  }
  // Assets come from the snapshot folder, matched to the manifest's own references so the registry
  // holds exactly what the document declares (id, mime type, size, and dimensions). An image that
  // was placed but never saved into a project therefore still draws after a crash.
  assetRegistry.clear()
  const refsById = new Map(manifestAssets(snapshot.manifest).map((ref) => [ref.id, ref]))
  for (const asset of snapshot.assets) {
    const ref = refsById.get(asset.id)
    if (ref !== undefined) assetRegistry.put({ ref, bytes: asset.bytes, name: ref.id })
  }
  documentStore.replaceDocument(parsed.document, {
    savedRevision: snapshot.savedRevision,
    filePath: snapshot.directory,
  })
  documentStore.setRecovery({ available: true, savedAt: snapshot.savedAt })
  return true
}

/**
 * The crash dialog's two answers. Discard removes the copy so it cannot be offered again; restore
 * runs the same path the File menu item does.
 */
export async function resolveCrashPrompt(button: 'restore' | 'discard'): Promise<void> {
  workspaceStore.setCrashPrompt(null)
  if (button === 'discard') {
    await bridge()?.clearRecovery().catch(() => undefined)
    documentStore.setRecovery({ available: false, savedAt: null })
    return
  }
  await recoverDocument()
}

/**
 * Closes the crash dialog and keeps the copy. Escape and a click outside take this path, so the
 * non-destructive answer is always available; the File menu still offers the restore.
 */
export function dismissCrashPrompt(): void {
  workspaceStore.setCrashPrompt(null)
}
