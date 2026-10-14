/**
 * Toolbar (issue #18): tools, history, and destructive actions.
 *
 * Every button dispatches through the store's single `dispatch` path; nothing here
 * touches the document directly.
 */

import { documentStore, type Tool } from '../state/documentStore.ts'
import { useEditorState } from '../state/useEditorState.ts'

const TOOLS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: 'select', label: 'Select', hint: 'V' },
  { id: 'rect', label: 'Rectangle', hint: 'R' },
  { id: 'ellipse', label: 'Ellipse', hint: 'E' },
]

export function Toolbar() {
  const state = useEditorState()
  const hasSelection = state.selection.length > 0

  return (
    <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-4 py-2">
      <div className="flex items-center gap-3">
        <strong className="text-sm tracking-tight">Vectr</strong>
        <span className="text-xs text-neutral-500">{state.document.name}</span>
      </div>
      <div className="flex items-center gap-1" role="toolbar" aria-label="Tools">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-pressed={state.tool === tool.id}
            title={`${tool.label} (${tool.hint})`}
            className={`rounded border px-2.5 py-1 text-xs ${
              state.tool === tool.id ? 'border-violet-400 text-violet-200' : 'border-neutral-700 text-neutral-300'
            }`}
            onClick={() => documentStore.setTool(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1" role="toolbar" aria-label="Edit">
        <button
          type="button"
          className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 disabled:opacity-40"
          disabled={!state.canUndo}
          title="Undo (Ctrl+Z)"
          onClick={() => documentStore.undo()}
        >
          Undo{state.undoDepth > 0 ? ` (${state.undoDepth})` : ''}
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 disabled:opacity-40"
          disabled={!state.canRedo}
          title="Redo (Ctrl+Shift+Z)"
          onClick={() => documentStore.redo()}
        >
          Redo{state.redoDepth > 0 ? ` (${state.redoDepth})` : ''}
        </button>
        <button
          type="button"
          className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 disabled:opacity-40"
          disabled={!hasSelection}
          title="Delete selection (Delete)"
          onClick={() => {
            documentStore.dispatch({ type: 'removeNodes', nodeIds: state.selection }, 'delete')
            documentStore.clearSelection()
          }}
        >
          Delete
        </button>
      </div>
    </header>
  )
}
