/**
 * The Vectr project format (issue #19).
 *
 * A project is a directory — `<name>.vectr` — holding `manifest.json` and an `assets/`
 * directory of content-addressed byte files:
 *
 * ```
 * MyDrawing.vectr/
 *   manifest.json      versioned, deterministic, no timestamps, no base64
 *   metadata.json      when and by what the project was last written (not part of the format)
 *   assets/<key>.png   bytes, keyed by the digest the document already references
 * ```
 *
 * The manifest is canonical JSON with sorted keys, so saving an unchanged document twice
 * produces byte-identical output. Anything that changes on its own — a timestamp, a host name —
 * lives in `metadata.json` instead, precisely so the manifest cannot drift.
 */

import type { Artboard, AssetRef, Document, GroupNode } from '../doc/types.ts'
import type { Guide, Swatch } from '../doc/types.ts'

export const PROJECT_EXTENSION = '.vectr'
export const MANIFEST_NAME = 'manifest.json'
export const METADATA_NAME = 'metadata.json'
export const ASSET_DIRECTORY = 'assets'
/** Bumped only when the manifest's own shape changes; migrations key off it. */
export const MANIFEST_VERSION = 1

export type Manifest = {
  manifestVersion: number
  /** The document's own format version, kept separate so both can evolve. */
  formatVersion: number
  documentRevision: number
  id: string
  name: string
  artboards: Artboard[]
  assets: AssetRef[]
  /** Guide lines (issue #67); absent in manifests written before guides existed. */
  guides?: Guide[]
  /** Named colours (issue #69); absent in older manifests. */
  swatches?: Swatch[]
  root: GroupNode
}

export type ProjectMetadata = {
  savedAt: string
  app: string
  manifestVersion: number
  formatVersion: number
}

/** A directory name for a document, with everything a filesystem may dislike removed. */
export function projectFileName(name: string): string {
  const base = name.trim() === '' ? 'Untitled' : name.trim()
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.+$/, '')
  return `${safe === '' ? 'Untitled' : safe}${PROJECT_EXTENSION}`
}

/** The asset file name for a content key, keeping the original extension. */
export function assetFileName(asset: AssetRef): string {
  const extension = asset.mimeType === 'image/png' ? 'png' : 'jpg'
  const key = asset.id.startsWith('sha256-') ? asset.id.slice('sha256-'.length) : asset.id
  return `${key}.${extension}`
}

export function assetDirectoryPath(projectDirectory: string): string {
  return `${projectDirectory}/${ASSET_DIRECTORY}`
}

export function manifestPath(projectDirectory: string): string {
  return `${projectDirectory}/${MANIFEST_NAME}`
}

export function assetPath(projectDirectory: string, asset: AssetRef): string {
  return `${assetDirectoryPath(projectDirectory)}/${assetFileName(asset)}`
}

/** Deterministic JSON: object keys sorted, two-space indent, trailing newline. */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )
  const sorted: Record<string, unknown> = {}
  for (const [key, entry] of entries) sorted[key] = sortKeys(entry)
  return sorted
}

/** The manifest for a document. Pure: same document in, same text out. */
export function manifestFor(document: Document): Manifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    formatVersion: document.formatVersion,
    documentRevision: document.revision,
    id: document.id,
    name: document.name,
    artboards: document.artboards,
    guides: document.guides ?? [],
    swatches: document.swatches ?? [],
    // Sorted by key so the manifest does not depend on placement order.
    assets: [...document.assets].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
    root: document.root,
  }
}

export function metadataFor(now: string): ProjectMetadata {
  return { savedAt: now, app: 'Vectr', manifestVersion: MANIFEST_VERSION, formatVersion: 1 }
}
