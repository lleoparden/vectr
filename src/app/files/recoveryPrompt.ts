/**
 * Recovery dialog copy (owner spec: after a crash the app must "bring up the old file saying it
 * closed in a wrong way").
 *
 * Pure text, like `unsavedPrompt.ts`: the dialog renders it, and a test asserts the wording says
 * what actually happened instead of being generic.
 */

export type CrashRecoveryCopy = {
  title: string
  body: string
  /** Says which file and when, so the choice is informed rather than blind. */
  detail: string
  restore: string
  discard: string
}

/** `14:32` from an ISO timestamp, or an honest fallback when it is unusable. */
export function clockTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'an unknown time'
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function crashRecoveryCopy(input: {
  documentName: string
  savedAt: string
  directory: string | null
}): CrashRecoveryCopy {
  const name = input.documentName.trim() === '' ? 'Untitled' : input.documentName
  return {
    title: 'Vectr closed unexpectedly',
    body: `Vectr did not shut down cleanly while “${name}” was open. The last recovery copy is from ${clockTime(input.savedAt)}, and it contains work that was never saved.`,
    detail:
      input.directory === null
        ? 'That document had never been saved to a file.'
        : `It belongs to ${input.directory}; restoring reopens it there, so Save writes back to your file.`,
    restore: 'Restore the recovery copy',
    discard: 'Discard it',
  }
}

/** The one-line status the File menu and the preferences dialog both use. */
export function recoveryStatusText(savedAt: string | null): string {
  if (savedAt === null) return 'No recovery copy is waiting.'
  return `A recovery copy from ${clockTime(savedAt)} is waiting.`
}
