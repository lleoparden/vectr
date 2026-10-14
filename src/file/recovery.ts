/**
 * Recovery snapshots (issue #19; reshaped to the owner's spec after Phase 1).
 *
 * The snapshot is a **project folder**: `userData/recovery.vectr/` holds `manifest.json`, the
 * content-addressed `assets/` the document uses, and a `recovery.json` sidecar naming the document
 * it came from and when it was taken. It is written with the same failure-safe `writeProject` a
 * normal save uses (assets first, then the manifest through a temporary file and a rename), and it
 * lives outside any project so a crash mid-save can never make recovery the thing that corrupted
 * the work.
 *
 * The reason it is a whole folder and not a bare manifest: a document that crashed with placed
 * images has to come back **with** those images, and a manifest-only snapshot would have restored
 * an empty frame where the picture was.
 *
 * Bounded on purpose: **one** rolling snapshot, overwritten each time, no merges, no history.
 */

import { writeProject, type AssetPayload, type ProjectFileSystem } from './atomicWrite.ts'
import type { AssetRef } from '../doc/types.ts'
import { ASSET_DIRECTORY, MANIFEST_NAME, assetFileName, canonicalJson } from './format.ts'

/** Sidecar with what the manifest cannot say: where it came from and when it was taken. */
export const RECOVERY_NAME = 'recovery.json'

/** The bytes of one asset, keyed the way the manifest references it. */
export type RecoveryAsset = { id: string; mimeType: string; bytes: Uint8Array }

export type RecoverySnapshot = {
  savedAt: string
  documentName: string
  /** The project directory the dirty document came from, when it had one. */
  directory: string | null
  /** The revision the document's file matched; the snapshot is dirty by definition. */
  savedRevision: number
  manifest: string
  assets: RecoveryAsset[]
}

/** The asset references a manifest carries, which is where the file names come from. */
export function manifestAssets(manifest: string): AssetRef[] {
  try {
    const parsed = JSON.parse(manifest) as { assets?: AssetRef[] }
    return Array.isArray(parsed.assets) ? parsed.assets : []
  } catch {
    return []
  }
}

export type RecoveryLimits = {
  /** Snapshots kept: one. */
  snapshots: 1
  /** Merge: none. Newest wins. */
  merges: 0
}

export const RECOVERY_LIMITS: RecoveryLimits = { snapshots: 1, merges: 0 }

export function recoveryPath(directory: string): string {
  return `${directory}/${RECOVERY_NAME}`
}

/** The sidecar written beside the manifest, which is all the metadata a restore needs. */
export function recoverySidecar(snapshot: RecoverySnapshot): string {
  return canonicalJson({
    savedAt: snapshot.savedAt,
    documentName: snapshot.documentName,
    directory: snapshot.directory,
    savedRevision: snapshot.savedRevision,
  })
}

export async function writeRecovery(
  fs: ProjectFileSystem,
  directory: string,
  snapshot: RecoverySnapshot,
): Promise<void> {
  // The manifest is the source of the asset references, so the folder is written the same way a
  // project is: bytes first, then the manifest through a rename, then the sidecar.
  const bytesById = new Map(snapshot.assets.map((asset) => [asset.id, asset.bytes]))
  const refs = manifestAssets(snapshot.manifest)
  const payload: AssetPayload[] = refs
    .map((ref) => {
      const bytes = bytesById.get(ref.id)
      return bytes === undefined ? null : { ref, bytes }
    })
    .filter((entry): entry is AssetPayload => entry !== null)
  await writeProject(fs, directory, snapshot.manifest, payload, new Set(refs.map((ref) => ref.id)), snapshot.savedAt)
  const temporary = `${recoveryPath(directory)}.tmp`
  await fs.writeFile(temporary, recoverySidecar(snapshot))
  await fs.rename(temporary, recoveryPath(directory))
}

export async function readRecovery(
  fs: ProjectFileSystem,
  directory: string,
): Promise<RecoverySnapshot | null> {
  const bytes = await fs.readFile(recoveryPath(directory))
  if (bytes === null) return null
  let sidecar: Partial<RecoverySnapshot>
  try {
    sidecar = JSON.parse(new TextDecoder().decode(bytes)) as Partial<RecoverySnapshot>
  } catch {
    // A sidecar that cannot be read is not a snapshot; the caller treats this as "none".
    return null
  }
  if (typeof sidecar.savedAt !== 'string') return null
  const manifestBytes = await fs.readFile(`${directory}/${MANIFEST_NAME}`)
  if (manifestBytes === null) return null

  // Assets are rebuilt from the manifest's own references, so a missing file means "not there"
  // rather than a fabricated ref that would fail verification later.
  const manifest = new TextDecoder().decode(manifestBytes)
  const assets: RecoveryAsset[] = []
  for (const ref of manifestAssets(manifest)) {
    const assetBytes = await fs.readFile(`${directory}/${ASSET_DIRECTORY}/${assetFileName(ref)}`)
    if (assetBytes !== null) assets.push({ id: ref.id, mimeType: ref.mimeType, bytes: assetBytes })
  }

  return {
    savedAt: sidecar.savedAt,
    documentName: typeof sidecar.documentName === 'string' ? sidecar.documentName : 'Untitled',
    directory: typeof sidecar.directory === 'string' ? sidecar.directory : null,
    savedRevision: typeof sidecar.savedRevision === 'number' ? sidecar.savedRevision : 0,
    manifest,
    assets,
  }
}

/** Removes the whole snapshot folder, sidecar included. */
export async function clearRecovery(fs: ProjectFileSystem, directory: string): Promise<void> {
  await fs.remove(recoveryPath(directory))
  await fs.remove(`${directory}/${MANIFEST_NAME}`)
  await fs.remove(`${directory}/${ASSET_DIRECTORY}`)
}

