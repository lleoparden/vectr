/**
 * Editor store (issue #18).
 *
 * One store owns the document, the selection, the tool, the viewport, and history.
 * It has exactly one mutation entry point, `dispatch`, which the UI, keyboard
 * shortcuts, and — later — the MCP surface and the built-in agent all use. React
 * reads it through `useSyncExternalStore` (see `useEditorState.ts`), so the
 * document is never copied into component state.
 *
 * Memory rules: state updates replace the top-level object only, the document keeps
 * structural sharing, and history stores inverse commands rather than snapshots.
 */

import { applyCommand, type Command, type CommandResult } from '../doc/commands.ts'
import { History } from '../doc/history.ts'
import { createDocument, paintOrder } from '../doc/document.ts'
import { isGroup, type Document, type NodeId } from '../doc/types.ts'

export type Tool = 'select' | 'rect' | 'ellipse'
export type Viewport = { zoom: number; panX: number; panY: number }
export type CommandError = { code: string; message: string; command: Command }

export type EditorState = {
  document: Document
  selection: NodeId[]
  tool: Tool
  viewport: Viewport
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
  /** Last rejected command, surfaced to the user instead of failing silently. */
  lastError: CommandError | null
}

/** Caps selection bookkeeping so a runaway marquee cannot grow unbounded. */
export const SELECTION_CAP = 10_000

export class DocumentStore {
  private state: EditorState
  private readonly listeners = new Set<() => void>()
  private readonly history = new History()
  private transaction: ReturnType<History['begin']> | null = null
  private transactionLabel = 'edit'

  constructor(document: Document = createDocument()) {
    this.state = {
      document,
      selection: [],
      tool: 'select',
      viewport: { zoom: 1, panX: 0, panY: 0 },
      canUndo: false,
      canRedo: false,
      undoDepth: 0,
      redoDepth: 0,
      lastError: null,
    }
  }

  getState = (): EditorState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private update(patch: Partial<EditorState>) {
    this.state = {
      ...this.state,
      ...patch,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      undoDepth: this.history.undoDepth(),
      redoDepth: this.history.redoDepth(),
    }
    for (const listener of this.listeners) listener()
  }

  /** Keeps only ids that still exist, so a delete cannot leave stale selection. */
  private pruneSelection(document: Document, selection: NodeId[]): NodeId[] {
    const alive = new Set(paintOrder(document))
    const pruned = selection.filter((id) => alive.has(id))
    return pruned.length === selection.length ? selection : pruned
  }

  /**
   * Applies a command through the validated command path. Inside a transaction the
   * change folds into one history entry; outside one it records immediately.
   */
  dispatch(command: Command, label: string = command.type): CommandResult {
    const result = applyCommand(this.state.document, command)
    if (!result.ok) {
      this.update({ lastError: { code: result.code, message: result.message, command } })
      return result
    }
    if (this.transaction !== null) {
      this.transaction.push(command, result.inverse)
      this.update({
        document: result.document,
        selection: this.pruneSelection(result.document, this.state.selection),
        lastError: null,
      })
      return result
    }
    this.history.record({ label, command, inverse: result.inverse })
    this.update({
      document: result.document,
      selection: this.pruneSelection(result.document, this.state.selection),
      lastError: null,
    })
    return result
  }

  /** Starts a bounded transaction, so a whole drag becomes one history entry. */
  beginTransaction(label = 'edit') {
    this.transaction = this.history.begin()
    this.transactionLabel = label
  }

  /** Commits the transaction if anything changed; safe to call with none open. */
  commitTransaction() {
    const transaction = this.transaction
    this.transaction = null
    if (transaction === null) return
    transaction.commit(this.transactionLabel)
    this.update({})
  }

  /** Drops the open transaction without recording history. */
  abortTransaction() {
    this.transaction?.abort()
    this.transaction = null
    this.update({})
  }

  inTransaction(): boolean {
    return this.transaction !== null
  }

  undo() {
    const result = this.history.undo(this.state.document)
    if (result === null) return
    this.update({
      document: result.document,
      selection: this.pruneSelection(result.document, this.state.selection),
      lastError: null,
    })
  }

  redo() {
    const result = this.history.redo(this.state.document)
    if (result === null) return
    this.update({
      document: result.document,
      selection: this.pruneSelection(result.document, this.state.selection),
      lastError: null,
    })
  }

  setSelection(ids: NodeId[]) {
    this.update({ selection: ids.slice(0, SELECTION_CAP) })
  }

  toggleSelection(id: NodeId) {
    const selection = this.state.selection.includes(id)
      ? this.state.selection.filter((current) => current !== id)
      : [...this.state.selection, id]
    this.update({ selection: selection.slice(0, SELECTION_CAP) })
  }

  clearSelection() {
    this.update({ selection: [] })
  }

  /** Top-level, visible, unlocked ids in paint order. */
  selectAll() {
    const ids = this.state.document.root.children
      .filter((node) => !node.hidden && !node.locked)
      .map((node) => node.id)
    this.update({ selection: ids.slice(0, SELECTION_CAP) })
  }

  setTool(tool: Tool) {
    this.update({ tool })
  }

  setViewport(next: Partial<Viewport>) {
    this.update({ viewport: { ...this.state.viewport, ...next } })
  }

  /** Replaces the document for new/open; history and selection are cleared. */
  replaceDocument(document: Document) {
    this.history.clear()
    this.transaction = null
    this.update({ document, selection: [], lastError: null })
  }

  clearError() {
    if (this.state.lastError === null) return
    this.update({ lastError: null })
  }

  /** True when the id names a group in the current document. */
  isGroupId(id: NodeId): boolean {
    const node = this.state.document.root.children.find((child) => child.id === id) ?? null
    return node !== null && isGroup(node)
  }
}

/** The editor's single store instance; slice #19 wires new/open to it. */
export const documentStore = new DocumentStore()
