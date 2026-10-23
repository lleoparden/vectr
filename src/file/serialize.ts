/**
 * Serialization and deserialization (issue #19).
 *
 * Pure: the document in, canonical manifest text out, and back again. The manifest holds the
 * whole tree — ids, order, nesting, transforms, styles, text, and asset references — because
 * the document model is JSON-safe by design; the asset bytes never appear in it.
 */

import { validateDocument } from '../doc/validate.ts'
import type { Guide } from '../doc/types.ts'
import { FORMAT_VERSION } from '../doc/types.ts'
import type { AssetRef, Document, GroupNode, LayerNode } from '../doc/types.ts'
import { MANIFEST_VERSION, canonicalJson, manifestFor, type Manifest } from './format.ts'

export type SerializeResult = { manifest: string; assets: AssetRef[] }

export function serializeDocument(document: Document): SerializeResult {
  const manifest = manifestFor(document)
  return { manifest: canonicalJson(manifest), assets: manifest.assets }
}

export type DeserializeFailure =
  | 'not-json'
  | 'not-a-manifest'
  | 'unsupported-manifest-version'
  | 'unsupported-format-version'
  | 'invalid-document'

export type DeserializeResult =
  | { ok: true; document: Document; manifest: Manifest }
  | { ok: false; code: DeserializeFailure; message: string }

/** Format versions this build can open, plus the hook later migrations plug into. */
export const SUPPORTED_FORMAT_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8]
export const MIGRATIONS: Record<number, (manifest: Manifest) => Manifest> = {}

/**
 * Reads a manifest. Every failure is a refusal with a reason: a future version, a foreign file,
 * broken JSON, or a document that fails the model's own validation. Nothing partial is returned.
 */
export function deserializeDocument(text: string): DeserializeResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return { ok: false, code: 'not-json', message: `The manifest is not valid JSON: ${message}` }
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, code: 'not-a-manifest', message: 'The manifest is not an object.' }
  }

  const raw = parsed as Partial<Manifest>
  if (typeof raw.manifestVersion !== 'number' || typeof raw.root !== 'object' || raw.root === null) {
    return { ok: false, code: 'not-a-manifest', message: 'The manifest is missing its version or node tree.' }
  }
  if (raw.manifestVersion > MANIFEST_VERSION) {
    return {
      ok: false,
      code: 'unsupported-manifest-version',
      message: `This project was written by a newer Vectr (manifest ${raw.manifestVersion}); this build reads ${MANIFEST_VERSION}.`,
    }
  }
  const migrate = MIGRATIONS[raw.manifestVersion]
  const migrated = migrate === undefined ? (raw as Manifest) : migrate(raw as Manifest)
  if (typeof migrated.formatVersion !== 'number' || !SUPPORTED_FORMAT_VERSIONS.includes(migrated.formatVersion)) {
    return {
      ok: false,
      code: 'unsupported-format-version',
      message: `Unsupported document format version ${String(migrated.formatVersion)}; expected one of ${SUPPORTED_FORMAT_VERSIONS.join(', ')}.`,
    }
  }

  const upgraded = migrated.formatVersion < 3 ? upgradeImages(migrated) : migrated
  const document: Document = {
    formatVersion: upgraded.formatVersion,
    revision: typeof upgraded.documentRevision === 'number' ? upgraded.documentRevision : 0,
    id: typeof upgraded.id === 'string' ? upgraded.id : 'document',
    name: typeof upgraded.name === 'string' ? upgraded.name : 'Untitled',
    artboards: Array.isArray(upgraded.artboards) ? upgraded.artboards : [],
    root: upgraded.root,
    assets: Array.isArray(upgraded.assets) ? upgraded.assets : [],
    guides: Array.isArray(upgraded.guides) ? upgraded.guides : [],
    swatches: Array.isArray(upgraded.swatches) ? upgraded.swatches : [],
  }

  const validation = validateDocument(document)
  if (!validation.ok) {
    return {
      ok: false,
      code: 'invalid-document',
      message: `The document is not valid (${validation.issue.code}): ${validation.issue.message}`,
    }
  }
  return { ok: true, document, manifest: upgraded }
}

/** v1/v2 images occupied their complete source asset; v3 makes that implicit state explicit. */
function upgradeImages(manifest: Manifest): Manifest {
  const upgrade = (node: LayerNode): LayerNode => {
    if (node.type === 'group') return { ...node, children: node.children.map(upgrade) } as GroupNode
    if (node.type !== 'image') return node
    return { ...node, crop: { x: 0, y: 0, width: 1, height: 1 }, maskAssetId: null }
  }
  return { ...manifest, formatVersion: FORMAT_VERSION, root: upgrade(manifest.root) as GroupNode }
}
