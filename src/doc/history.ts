/**
 * Bounded undo/redo history (issue #18, aggregate inverses added in issue #34).
 *
 * History stores inverse commands, never document snapshots.
 *
 * A transaction is one history entry. When its steps all touch the same node with the
 * same command type — a drag, a live transform, a repeated flag change — the entry keeps
 * two commands only (the first inverse and the last command): re-applying the last
 * command supersedes the earlier ones and the first inverse restores the pre-gesture
 * value, so a 200-step drag does not retain 200 commands. When a transaction touches
 * different nodes or different kinds of change, the entry is an aggregate: a batch of
 * every command, with a batch of the inverses in reverse order as its inverse. That is
 * what lets a multi-node Hide be one undo step, which Illustrator does and the first
 * transaction design could not.
 */

import { applyCommand, batchCommand, type Command } from './commands.ts'
import type { Document } from './types.ts'

export type HistoryEntry = { label: string; command: Command; inverse: Command }

export const DEFAULT_HISTORY_LIMIT = 200

/**
 * Command types that can repeat on one node inside a transaction without needing an
 * aggregate: each one sets a value rather than moving structure, so the last command
 * plus the first inverse describe the whole gesture.
 */
const REPEATABLE_ON_ONE_NODE = new Set(['setTransform', 'setStyle', 'setFlags', 'renameNode'])

function collapsesToCompact(commands: Command[]): boolean {
  const first = commands[0]
  if (!REPEATABLE_ON_ONE_NODE.has(first.type)) return false
  if (!('nodeId' in first)) return false
  return commands.every(
    (command) => command.type === first.type && 'nodeId' in command && command.nodeId === first.nodeId,
  )
}

/**
 * Builds the entry a finished transaction records: plain for one step, compact for a
 * repeated single-node gesture, and an aggregate batch otherwise.
 */
export function transactionEntry(label: string, commands: Command[], inverses: Command[]): HistoryEntry {
  if (commands.length === 1) return { label, command: commands[0], inverse: inverses[0] }
  if (collapsesToCompact(commands)) {
    return { label, command: commands[commands.length - 1], inverse: inverses[0] }
  }
  return {
    label,
    command: batchCommand(commands),
    inverse: batchCommand([...inverses].reverse()),
  }
}

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
  private transaction: { commands: Command[]; inverses: Command[] } | null = null

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

  /** The entry undo would revert; the Edit menu labels its command with this. */
  peekUndo(): HistoryEntry | null {
    return this.undoStack.length === 0 ? null : this.undoStack[this.undoStack.length - 1]
  }

  /** The entry redo would re-apply. */
  peekRedo(): HistoryEntry | null {
    return this.redoStack.length === 0 ? null : this.redoStack[this.redoStack.length - 1]
  }

  /** Starts a transaction. A fresh command commits into it and clears redo on commit. */
  begin(): Transaction {
    const state = { commands: [] as Command[], inverses: [] as Command[] }
    this.transaction = state
    return {
      push: (command, inverse) => {
        state.commands.push(command)
        state.inverses.push(inverse)
      },
      commit: (label: string) => {
        this.transaction = null
        if (state.commands.length === 0) return null
        const entry = transactionEntry(label, state.commands, state.inverses)
        this.record(entry)
        return entry
      },
      abort: () => {
        this.transaction = null
      },
      steps: () => state.commands.length,
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
