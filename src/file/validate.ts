/**
 * Open-time asset validation (issue #19).
 *
 * A manifest says which assets the document needs and how big they are and how they hash. On
 * open, every one of those claims is checked against the bytes that were actually found, so a
 * missing file, a truncated file, or a file that has been swapped for something else fails
 * loudly instead of drawing the wrong pixels.
 */

import { assetKeyFor } from '../doc/assets.ts'
import type { AssetRef, Document } from '../doc/types.ts'

export type AssetCheckCode = 'missing-asset' | 'length-mismatch' | 'hash-mismatch' | 'extra-assets'

export type AssetCheckResult =
  | { ok: true; used: AssetRef[] }
  | { ok: false; code: AssetCheckCode; message: string }

/** The assets the document's image nodes actually reference, in manifest order. */
export function requiredAssets(document: Document): AssetRef[] {
  const referenced = new Set<string>()
  const walk = (node: Document['root'] | Document['root']['children'][number]) => {
    if (node.type === 'image') referenced.add(node.assetId)
    else if (node.type === 'group') for (const child of node.children) walk(child)
  }
  for (const child of document.root.children) walk(child)
  return document.assets.filter((asset) => referenced.has(asset.id))
}

/** Checks the bytes found on disk against what the manifest claims. */
export async function verifyAssets(
  document: Document,
  found: Map<string, Uint8Array>,
): Promise<AssetCheckResult> {
  const used = requiredAssets(document)
  for (const asset of used) {
    const bytes = found.get(asset.id)
    if (bytes === undefined) {
      return { ok: false, code: 'missing-asset', message: `Asset ${asset.id} is missing from the project.` }
    }
    if (bytes.byteLength !== asset.byteLength) {
      return {
        ok: false,
        code: 'length-mismatch',
        message: `Asset ${asset.id} is ${bytes.byteLength} bytes on disk but ${asset.byteLength} bytes in the manifest.`,
      }
    }
    const key = await assetKeyFor(bytes)
    if (key !== asset.id) {
      return {
        ok: false,
        code: 'hash-mismatch',
        message: `Asset ${asset.id} does not match its content key; the file may have been replaced.`,
      }
    }
  }
  return { ok: true, used }
}
