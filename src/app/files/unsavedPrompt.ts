/**
 * Unsaved-changes prompt copy (issue: UI enhancement after Phase 1).
 *
 * Vectr draws this dialog itself rather than handing it to the operating system, because the
 * interface is Vectr's own and a native message box would be the one surface that does not look
 * like the product. The wording is pure data so it can be reviewed and tested without a browser,
 * and one dialog serves all three ways work can be lost: closing the window, starting a new
 * document, and opening another one.
 */

import type { UnsavedKind } from '../../state/workspaceStore.ts'

export type UnsavedCopy = {
  title: string
  message: string
  detail: string
  confirmLabel: string
  discardLabel: string
  cancelLabel: string
}

const ACTIONS: Record<UnsavedKind, { title: string; message: string; detail: string }> = {
  close: {
    title: 'Save changes before closing?',
    message: 'Your changes to “{name}” are not saved.',
    detail: 'If you don’t save, a recovery snapshot is kept and Vectr offers it the next time it starts.',
  },
  new: {
    title: 'Save changes before starting a new document?',
    message: 'Your changes to “{name}” are not saved.',
    detail: 'Starting a new document discards them. Save first to keep them.',
  },
  open: {
    title: 'Save changes before opening another document?',
    message: 'Your changes to “{name}” are not saved.',
    detail: 'Opening another document discards them. Save first to keep them.',
  },
}

export function unsavedCopy(kind: UnsavedKind, documentName: string): UnsavedCopy {
  const action = ACTIONS[kind]
  const name = documentName.trim() === '' ? 'Untitled' : documentName.trim()
  return {
    title: action.title,
    message: action.message.replace('{name}', name),
    detail: action.detail,
    confirmLabel: 'Save',
    // Illustrator says "Don't Save"; the apostrophe is a typographic one to match the dialog.
    discardLabel: 'Don’t Save',
    cancelLabel: 'Cancel',
  }
}

/** Whether an action needs the dialog at all: only unsaved work can be lost. */
export function needsUnsavedPrompt(isDirty: boolean): boolean {
  return isDirty
}

/** What the dialog's buttons mean, kept separate from what each one then does. */
export function promptChoiceFor(button: 'confirm' | 'discard' | 'cancel'): 'save' | 'discard' | 'cancel' {
  return button === 'confirm' ? 'save' : button
}
