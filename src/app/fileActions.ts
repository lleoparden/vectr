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

import { createDocument } from '../doc/document.ts'
import { assetRegistry } from '../state/assetRegistry.ts'
import { documentStore } from '../state/documentStore.ts'
import { requiredAssets, verifyAssets } from '../file/validate.ts'
import { deserializeDocument, serializeDocument } from '../file/serialize.ts'
import { projectFileName } from '../file/format.ts'
import { readRecovery } from '../file/recovery.ts'

/** Autosave interval for the recovery snapshot: bounded work while the document is dirty. */
export const RECOVERY_INTERVAL_MS = 30_000

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

/** Writes the rolling recovery snapshot; called on an interval and before unload. */
export async function writeRecoverySnapshot(): Promise<boolean> {
  const api = bridge()
  if (api === undefined || !documentStore.isDirty()) return false
  const state = documentStore.getState()
  const { manifest } = serializeDocument(state.document)
  const savedAt = new Date().toISOString()
  const result = await api.writeRecovery({
    savedAt,
    documentName: state.document.name,
    directory: state.filePath,
    manifest,
  })
  if (result.ok) documentStore.setRecovery({ available: true, savedAt })
  return result.ok
}

/** Checks for a recovery snapshot at launch and offers it through the File menu. */
export async function refreshRecoveryState(): Promise<void> {
  const api = bridge()
  if (api === undefined) return
  const result = await api.readRecovery()
  const snapshot = result.snapshot ?? null
  documentStore.setRecovery({ available: snapshot !== null, savedAt: snapshot?.savedAt ?? null })
}

/** The close question (issue #19): save, discard with a recovery snapshot, or cancel. */
export async function handleBeforeClose(): Promise<void> {
  const api = bridge()
  if (api === undefined) return
  if (!documentStore.isDirty()) {
    await api.allowClose()
    return
  }
  const choice = await api.confirmClose({ name: documentStore.getState().document.name })
  if (choice === 'cancel') return
  if (choice === 'save') {
    const saved = await saveDocument()
    if (!saved) return
    await api.allowClose()
    return
  }
  // Discarding is the only path that can lose work, so the snapshot is taken first.
  await writeRecoverySnapshot()
  await api.allowClose()
}
export async function recoverDocument(): Promise<boolean> {
  const api = bridge()
  if (api === undefined) return false
  const result = await api.readRecovery()
  const snapshot = result.snapshot ?? null
  if (snapshot === null) {
    report('no-recovery', 'No recovery snapshot is available.')
    return false
  }
  const parsed = deserializeDocument(snapshot.manifest)
  if (!parsed.ok) {
    report(parsed.code, parsed.message)
    return false
  }
  documentStore.replaceDocument(parsed.document, {
    savedRevision: parsed.document.revision,
    // Recovered work is deliberately not attached to the old path: the user decides where it goes.
    filePath: null,
  })
  documentStore.setRecovery({ available: true, savedAt: snapshot.savedAt })
  return true
}
