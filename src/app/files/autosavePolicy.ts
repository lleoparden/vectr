/**
 * Autosave policy (owner spec after Phase 1: "autosave should only work when a file is already
 * saved, and the user can change the interval on the settings").
 *
 * Pure: what to snapshot, and how long between snapshots, decided from state rather than wired into
 * a timer. The interval timer itself lives in `App.tsx`; this module is what the tests pin down.
 */

export type AutosaveReason = 'interval' | 'close'

export type AutosaveInput = {
  reason: AutosaveReason
  /** Whether the document has a project directory on disk. */
  hasFilePath: boolean
  isDirty: boolean
  enabled: boolean
}

/**
 * Whether a recovery snapshot should be written right now.
 *
 * Autosave belongs to a document that already has a file: an untitled document has nothing to
 * belong to, which is the owner's rule. The close path is not autosave — it is the last net before
 * unsaved work is dropped — so it still snapshots an untitled document.
 */
export function shouldWriteSnapshot(input: AutosaveInput): boolean {
  if (!input.isDirty) return false
  if (input.reason === 'close') return true
  return input.enabled && input.hasFilePath
}

/** Illustrator's own default for "Automatically Save Recovery Data Every" is 10 minutes. */
export const DEFAULT_AUTOSAVE_INTERVAL_MINUTES = 10
export const MIN_AUTOSAVE_INTERVAL_MINUTES = 1
export const MAX_AUTOSAVE_INTERVAL_MINUTES = 60

/** Settings come from a text field, so anything unusable falls back to the range's near end. */
export function clampIntervalMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUTOSAVE_INTERVAL_MINUTES
  return Math.min(MAX_AUTOSAVE_INTERVAL_MINUTES, Math.max(MIN_AUTOSAVE_INTERVAL_MINUTES, Math.round(value)))
}

export function intervalMilliseconds(minutes: number): number {
  return clampIntervalMinutes(minutes) * 60_000
}
