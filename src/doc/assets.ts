/**
 * Content-addressed image assets (issue #17).
 *
 * An asset is identified by a digest of its bytes, so the same file placed twice is stored
 * once and two documents can share it. The rules are pure and live here: what may be imported,
 * how large it may be, and how its key is derived. The bytes themselves live in the runtime
 * registry (`src/state/assetRegistry.ts`) until issue #19 persists them next to the document.
 *
 * An `AssetRef` in the document holds no bytes at all — only the key, the MIME type, the byte
 * length, and the pixel size — which is what keeps the document serializable and small.
 */

import type { AssetRef } from './types.ts'

/** Only these formats may be imported; the plan names PNG and JPEG. */
export const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg'])

/** Per-asset caps, so one bad file cannot exhaust memory. */
export const MAX_ASSET_BYTES = 20 * 1024 * 1024
export const MAX_ASSET_PIXELS = 40_000_000
export const MAX_ASSETS = 512

/** Import failure reasons, surfaced to the user instead of failing silently. */
export type AssetRejection = 'unsupported-type' | 'too-large' | 'too-many-pixels' | 'corrupt' | 'too-many-assets'

export type ImportedAsset = {
  ref: AssetRef
  bytes: Uint8Array
  name: string
}

export type AssetImportResult =
  | { ok: true; asset: ImportedAsset }
  | { ok: false; code: AssetRejection; message: string }

/** The key an asset is stored under: `sha256-<hex>` over its bytes. */
export async function assetKeyFor(bytes: Uint8Array): Promise<string> {
  // A copy makes the digest independent of the caller's view, and the cast bridges TypeScript's
  // ArrayBuffer/SharedArrayBuffer union in the DOM typing of `subtle.digest`.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy as unknown as BufferSource)
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `sha256-${hex}`
}

/** Checks the declared type, byte size, and pixel size before anything is decoded. */
export function checkAssetLimits(
  mimeType: string,
  byteLength: number,
  width: number,
  height: number,
  existing: number,
): AssetImportResult | null {
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
    return {
      ok: false,
      code: 'unsupported-type',
      message: `Vectr imports PNG and JPEG images; ${mimeType} is not supported.`,
    }
  }
  if (byteLength <= 0 || byteLength > MAX_ASSET_BYTES) {
    return {
      ok: false,
      code: 'too-large',
      message: `The image is ${Math.round(byteLength / 1024)} KiB; the limit is ${MAX_ASSET_BYTES / (1024 * 1024)} MiB.`,
    }
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, code: 'corrupt', message: 'The image has no usable pixel size.' }
  }
  if (width * height > MAX_ASSET_PIXELS) {
    return {
      ok: false,
      code: 'too-many-pixels',
      message: `${width}×${height} pixels exceeds the ${MAX_ASSET_PIXELS / 1_000_000} megapixel limit.`,
    }
  }
  if (existing >= MAX_ASSETS) {
    return {
      ok: false,
      code: 'too-many-assets',
      message: `A document may hold ${MAX_ASSETS} images; remove one before placing another.`,
    }
  }
  return null
}

/**
 * Builds the asset for a file: limits first, then the content key, then the reference the
 * document stores.
 */
export async function importAsset(
  input: { name: string; mimeType: string; bytes: Uint8Array; width: number; height: number },
  existingAssets: number,
): Promise<AssetImportResult> {
  const rejected = checkAssetLimits(input.mimeType, input.bytes.byteLength, input.width, input.height, existingAssets)
  if (rejected !== null) return rejected
  const id = await assetKeyFor(input.bytes)
  return {
    ok: true,
    asset: {
      name: input.name,
      bytes: input.bytes,
      ref: {
        id,
        mimeType: input.mimeType,
        byteLength: input.bytes.byteLength,
        width: input.width,
        height: input.height,
      },
    },
  }
}

/** MIME type for a file name, or null when the extension is not an importable image. */
export function mimeTypeForName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

/** Human-readable asset size, used by the Properties panel. */
export function formatByteLength(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}
