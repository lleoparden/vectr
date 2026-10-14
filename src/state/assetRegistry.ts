/**
 * Runtime asset registry (issue #17).
 *
 * Holds the bytes that the document references by content key, and nothing else. The document
 * stays small and serializable; the registry is the runtime half that issue #19 will persist
 * next to the document file. Entries are keyed by digest, so placing the same file twice keeps
 * one copy in memory and one record in the document.
 */

import type { AssetRef } from '../doc/types.ts'

export type AssetRecord = { ref: AssetRef; bytes: Uint8Array; name: string }

export class AssetRegistry {
  private readonly records = new Map<string, AssetRecord>()

  /** Stores an asset if the key is new; returns the record either way. */
  put(record: AssetRecord): AssetRecord {
    const existing = this.records.get(record.ref.id)
    if (existing !== undefined) return existing
    this.records.set(record.ref.id, record)
    return record
  }

  get(assetId: string): AssetRecord | undefined {
    return this.records.get(assetId)
  }

  has(assetId: string): boolean {
    return this.records.has(assetId)
  }

  ids(): string[] {
    return [...this.records.keys()]
  }

  size(): number {
    return this.records.size
  }

  /** Drops every record whose key is not in `keep`, so closing a document frees its pixels. */
  prune(keep: Set<string>): string[] {
    const dropped: string[] = []
    for (const id of [...this.records.keys()]) {
      if (keep.has(id)) continue
      this.records.delete(id)
      dropped.push(id)
    }
    return dropped
  }

  clear(): void {
    this.records.clear()
  }
}

export const assetRegistry = new AssetRegistry()
