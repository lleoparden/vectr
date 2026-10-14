/**
 * Image import (issue #17).
 *
 * Picking a file is the only platform-specific part, so it is isolated here: Electron opens a
 * real dialog through the preload bridge, and a browser build falls back to a file input. The
 * rest of the flow — limits, content key, decode, and the `placeImage` command — is shared and
 * tested.
 */

import { importAsset, mimeTypeForName, type AssetImportResult } from '../doc/assets.ts'

export type PickedImageFile = { name: string; mimeType: string; bytes: Uint8Array }

/** Opens the platform file dialog; returns null when the user cancels. */
export async function pickImageFile(): Promise<PickedImageFile | null> {
  const api = typeof window === 'undefined' ? undefined : window.vectrFiles
  if (api !== undefined) {
    const picked = await api.openImage()
    if (picked === null) return null
    return { name: picked.name, mimeType: picked.mimeType, bytes: new Uint8Array(picked.bytes) }
  }
  return pickImageWithInput()
}

/** Browser fallback for development and for a future web build. */
function pickImageWithInput(): Promise<PickedImageFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg'
    input.onchange = () => {
      void (async () => {
        const file = input.files?.[0]
        if (file === undefined) {
          resolve(null)
          return
        }
        const mimeType = file.type !== '' ? file.type : (mimeTypeForName(file.name) ?? '')
        resolve({ name: file.name, mimeType, bytes: new Uint8Array(await file.arrayBuffer()) })
      })()
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** The pixel size of an encoded image, or null when it cannot be decoded. */
export async function measureImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType })
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

/** The full import path for dropped or picked bytes: limits, key, then the asset. */
export async function importImageBytes(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
  existingAssets: number,
): Promise<AssetImportResult> {
  const size = await measureImage(bytes, mimeType)
  if (size === null) {
    return { ok: false, code: 'corrupt', message: `${name} could not be decoded as an image.` }
  }
  return importAsset({ name, mimeType, bytes, width: size.width, height: size.height }, existingAssets)
}
