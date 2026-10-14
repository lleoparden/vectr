/**
 * Failure-safe project writes (issue #19).
 *
 * The order is deliberate: new asset bytes are written and flushed first, then the manifest is
 * written to a temporary file and renamed into place. The rename is the only step that can
 * replace the previous manifest, so an interrupted save leaves the previous project complete and
 * loadable — the worst case is an extra asset file that no manifest references.
 *
 * The filesystem is injected so the policy is testable in memory, including the failure case.
 */

import type { AssetRef } from '../doc/types.ts'
import { ASSET_DIRECTORY, METADATA_NAME, MANIFEST_NAME, assetFileName, canonicalJson, metadataFor } from './format.ts'

export type ProjectFileSystem = {
  makeDirectory(path: string): Promise<void>
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  readFile(path: string): Promise<Uint8Array | null>
  exists(path: string): Promise<boolean>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
  list(path: string): Promise<string[]>
}

export type AssetPayload = { ref: AssetRef; bytes: Uint8Array }

export type WriteReport = {
  writtenAssets: number
  /** Assets already present under the same content key, which were not written again. */
  reusedAssets: number
  manifestPath: string
}

/** Writes a project: assets first, then the manifest through a temporary file and a rename. */
export async function writeProject(
  fs: ProjectFileSystem,
  directory: string,
  manifest: string,
  assets: AssetPayload[],
  usedAssetIds: Set<string>,
  now: string,
): Promise<WriteReport> {
  await fs.makeDirectory(directory)
  const assetDirectory = `${directory}/${ASSET_DIRECTORY}`
  await fs.makeDirectory(assetDirectory)

  let written = 0
  let reused = 0
  for (const asset of assets) {
    if (!usedAssetIds.has(asset.ref.id)) continue
    const path = `${assetDirectory}/${assetFileName(asset.ref)}`
    if (await fs.exists(path)) {
      // Content-addressed, so an existing file with this key is already the right bytes.
      reused += 1
      continue
    }
    await fs.writeFile(path, asset.bytes)
    written += 1
  }

  const temporary = `${directory}/${MANIFEST_NAME}.tmp`
  await fs.writeFile(temporary, manifest)
  await fs.rename(temporary, `${directory}/${MANIFEST_NAME}`)
  // Metadata is separate precisely so the manifest stays byte-stable across saves.
  await fs.writeFile(`${directory}/${METADATA_NAME}`, canonicalJson(metadataFor(now)))
  return { writtenAssets: written, reusedAssets: reused, manifestPath: `${directory}/${MANIFEST_NAME}` }
}

/** Removes asset files the document no longer references, so saves do not grow forever. */
export async function pruneAssets(
  fs: ProjectFileSystem,
  directory: string,
  keep: Set<string>,
): Promise<string[]> {
  const assetDirectory = `${directory}/${ASSET_DIRECTORY}`
  if (!(await fs.exists(assetDirectory))) return []
  const removed: string[] = []
  for (const name of await fs.list(assetDirectory)) {
    const key = name.replace(/\.[a-z]+$/i, '')
    if (keep.has(`sha256-${key}`) || keep.has(key)) continue
    await fs.remove(`${assetDirectory}/${name}`)
    removed.push(name)
  }
  return removed
}
