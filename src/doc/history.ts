/**
 * Bounded undo/redo history (issue #18).
 *
 * History stores inverse commands, never document snapshots. A drag or a text edit
 * is one transaction: the transaction keeps the first inverse (which restores the
 * pre-gesture state) and the latest command (which is what redo re-applies), so a
 * 200-move drag still costs one entry.
 */

import { applyCommand, type Command } from './commands.ts'
import type { Document } from './types.ts'

export type HistoryEntry = { label: string; command: Command; inverse: Command }

export const DEFAULT_HISTORY_LIMIT = 200

export type Transaction = {
  /** Records one step of an in-progress gesture. */
  push: (command: Command, inverse: Command) => void
  /** Commits the gesture as a single history entry, if anything changed. */
  commit: (label: string) => HistoryEntry | null
  /** Drops the gesture without touching history. */
  abort: () => void
  /** Steps recorded so far, for throttling work during a drag. */
  steps: () => number
}

export class History {
  private readonly limit: number

  constructor(limit = DEFAULT_HISTORY_LIMIT) {
    this.limit = limit
  }

  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private transaction: { first: [Command, Command] | null; last: [Command, Command] | null; steps: number } | null =
    null

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  undoDepth(): number {
    return this.undoStack.length
  }

  redoDepth(): number {
    return this.redoStack.length
  }

  /** Newest-first labels, so the UI can show what undo would revert. */
  labels(): string[] {
    return this.undoStack.map((entry) => entry.label)
  }

  /** Starts a transaction. A fresh command commits into it and clears redo on commit. */
  begin(): Transaction {
    const state = { first: null as [Command, Command] | null, last: null as [Command, Command] | null, steps: 0 }
    this.transaction = state
    return {
      push: (command, inverse) => {
        if (state.first === null) state.first = [command, inverse]
        state.last = [command, inverse]
        state.steps += 1
      },
      commit: (label: string) => {
        this.transaction = null
        if (state.first === null || state.last === null) return null
        const entry: HistoryEntry = { label, command: state.last[0], inverse: state.first[1] }
        this.record(entry)
        return entry
      },
      abort: () => {
        this.transaction = null
      },
      steps: () => state.steps,
    }
  }

  /** Records a completed entry, clearing redo and trimming the oldest entry first. */
  record(entry: HistoryEntry) {
    this.undoStack.push(entry)
    this.redoStack = []
    if (this.undoStack.length > this.limit) {
      this.undoStack.splice(0, this.undoStack.length - this.limit)
    }
  }

  /** Undoes the newest entry and returns the new document, or null when empty. */
  undo(document: Document): { document: Document; label: string } | null {
    const entry = this.undoStack.pop()
    if (entry === undefined) return null
    const result = applyCommand(document, entry.inverse)
    if (!result.ok) {
      // A stale inverse must never leave a partial mutation; restore the entry.
      this.undoStack.push(entry)
      return null
    }
    this.redoStack.push(entry)
    return { document: result.document, label: entry.label }
  }

  /** Redoes the newest undone entry and returns the new document, or null. */
  redo(document: Document): { document: Document; label: string } | null {
    const entry = this.redoStack.pop()
    if (entry === undefined) return null
    const result = applyCommand(document, entry.command)
    if (!result.ok) {
      this.redoStack.push(entry)
      return null
    }
    this.undoStack.push(entry)
    return { document: result.document, label: entry.label }
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
    this.transaction = null
  }
}
