/**
 * Recovery snapshots (issue #19).
 *
 * Deliberately bounded: **one** rolling snapshot, written on an interval while the document is
 * dirty and once more before the window unloads, and overwritten each time. There is no merge
 * and no history of snapshots — newest wins — so the cost is one manifest plus the assets the
 * document already has on disk. The snapshot lives outside the project so a crash mid-save can
 * never make recovery the thing that corrupted the work.
 */

import { canonicalJson } from './format.ts'
import type { ProjectFileSystem } from './atomicWrite.ts'

export const RECOVERY_NAME = 'recovery.manifest.json'

export type RecoverySnapshot = {
  savedAt: string
  documentName: string
  /** The project directory the dirty document came from, when it had one. */
  directory: string | null
  manifest: string
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

export async function writeRecovery(
  fs: ProjectFileSystem,
  directory: string,
  snapshot: RecoverySnapshot,
): Promise<void> {
  await fs.makeDirectory(directory)
  // Write then rename, so a crash while snapshotting cannot leave half a manifest to "recover".
  const temporary = `${recoveryPath(directory)}.tmp`
  await fs.writeFile(temporary, canonicalJson(snapshot))
  await fs.rename(temporary, recoveryPath(directory))
}

export async function readRecovery(
  fs: ProjectFileSystem,
  directory: string,
): Promise<RecoverySnapshot | null> {
  const bytes = await fs.readFile(recoveryPath(directory))
  if (bytes === null) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<RecoverySnapshot>
    if (typeof parsed.manifest !== 'string' || typeof parsed.savedAt !== 'string') return null
    return {
      savedAt: parsed.savedAt,
      documentName: typeof parsed.documentName === 'string' ? parsed.documentName : 'Untitled',
      directory: typeof parsed.directory === 'string' ? parsed.directory : null,
      manifest: parsed.manifest,
    }
  } catch {
    // A snapshot that cannot be read is not a snapshot; the caller treats this as "none".
    return null
  }
}

export async function clearRecovery(fs: ProjectFileSystem, directory: string): Promise<void> {
  await fs.remove(recoveryPath(directory))
}
