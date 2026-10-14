/**
 * Minimal layer list (issue #18). The interactive tree — reorder, group,
 * multi-select, virtualization — is slice #20; this list proves the store, the
 * tree order, and the flag commands end to end.
 */

import { documentStore } from '../state/documentStore.ts'
import { useEditorState } from '../state/useEditorState.ts'
import type { LayerNode } from '../doc/types.ts'

function Row({ node, depth }: { node: LayerNode; depth: number }) {
  const state = useEditorState()
  const selected = state.selection.includes(node.id)
  return (
    <li>
      <div
        className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
          selected ? 'bg-violet-500/20 text-violet-100' : 'text-neutral-300'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <button
          type="button"
          className="flex-1 truncate text-left"
          title={`Select ${node.name}`}
          onClick={(event) => {
            if (event.shiftKey || event.metaKey || event.ctrlKey) documentStore.toggleSelection(node.id)
            else documentStore.setSelection([node.id])
          }}
        >
          {node.name}
          <span className="ml-2 text-[10px] text-neutral-500">
            {node.type}
            {node.hidden ? ' · hidden' : ''}
            {node.locked ? ' · locked' : ''}
          </span>
        </button>
        <button
          type="button"
          className="text-[10px] text-neutral-400"
          title={node.hidden ? 'Show layer' : 'Hide layer'}
          onClick={() =>
            documentStore.dispatch(
              { type: 'setFlags', nodeId: node.id, locked: node.locked, hidden: !node.hidden },
              node.hidden ? 'show layer' : 'hide layer',
            )
          }
        >
          {node.hidden ? 'show' : 'hide'}
        </button>
        <button
          type="button"
          className="text-[10px] text-neutral-400"
          title={node.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={() =>
            documentStore.dispatch(
              { type: 'setFlags', nodeId: node.id, locked: !node.locked, hidden: node.hidden },
              node.locked ? 'unlock layer' : 'lock layer',
            )
          }
        >
          {node.locked ? 'unlock' : 'lock'}
        </button>
      </div>
      {'children' in node && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <Row key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function LayerList() {
  const state = useEditorState()
  const layers = state.document.root.children

  return (
    <aside className="flex min-h-0 flex-col border-l border-neutral-800" aria-label="Layers">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-medium text-neutral-300">Layers</span>
        <span className="text-[10px] text-neutral-500">{layers.length} at top level</span>
      </div>
      {layers.length === 0 ? (
        <p className="px-3 py-4 text-xs text-neutral-500">
          No layers yet. Pick the rectangle or ellipse tool and drag on the canvas.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto py-1">
          {layers.map((layer) => (
            <Row key={layer.id} node={layer} depth={0} />
          ))}
        </ul>
      )}
    </aside>
  )
}
