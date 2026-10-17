/**
 * Live editing (UI pass): a field updates the document on every keystroke or wheel move, and the
 * whole edit session is still **one undo entry**.
 *
 * The trick is the transaction the command path already has: opening one on focus and closing it
 * on blur folds repeated `setStyle`/`setTransform` dispatches into a single compact entry. Nothing
 * new reaches the document — this is only about where the entry boundaries are.
 */

import { documentStore } from '../../state/documentStore.ts'

let changed = false

/** Opens a transaction for an edit session, unless one is already open. */
export function beginLiveEdit(label: string): void {
  if (documentStore.inTransaction()) return
  changed = false
  documentStore.beginTransaction(label)
}

/** Closes the session: commits if something changed, otherwise drops the empty transaction. */
export function endLiveEdit(): void {
  if (!documentStore.inTransaction()) return
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
  changed = false
}

/** Marks that the open session actually edited the document. */
export function markLiveChanged(): void {
  changed = true
}
