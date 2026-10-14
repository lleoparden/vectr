/**
 * Layers panel (issue #28).
 *
 * The document's spine, in Illustrator's row form: a disclosure triangle, then the
 * visibility eye, then the lock, then a thumbnail slot, then the layer name. Rows are
 * keyboard reachable, the eye and lock dispatch the real `setFlags` command, and the
 * triangle only changes how the tree is displayed.
 *
 * Not built in this slice, and recorded as such: dragging to reorder, group/ungroup,
 * renaming, and the target/locate column. Issue #20 owns the interactive tree.
 */

import { useMemo, useRef, useState } from 'react'
import { isGroup, type NodeId } from '../../doc/types.ts'
import {
  IconDisclosureClosed,
  IconDisclosureOpen,
  IconEye,
  IconEyeOff,
  IconLock,
  IconUnlock,
} from '../icons.tsx'
import { expandedGroupIds, layerRows, rowDescription, type LayerRow } from '../layerRows.ts'
import { LAYER_INDENT, LAYER_ROW_HEIGHT, ROW_TOGGLE_SIZE } from '../theme.ts'
import { documentStore } from '../../state/documentStore.ts'
import { useEditorState } from '../../state/useEditorState.ts'

export function LayersPanel() {
  const state = useEditorState()
  const layers = state.document.root.children
  const [expanded, setExpanded] = useState<Set<NodeId>>(() => new Set(expandedGroupIds(layers)))
  const listRef = useRef<HTMLUListElement>(null)
  const rows = useMemo(() => layerRows(layers, expanded), [layers, expanded])

  function toggleExpanded(id: NodeId) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function nameButtons(): HTMLButtonElement[] {
    return Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-layer-name]') ?? [])
  }

  // Arrow keys walk the tree the way Illustrator's Layers panel does.
  function onKeyDown(event: React.KeyboardEvent) {
    if (!(event.target instanceof HTMLElement)) return
    const buttons = nameButtons()
    const current = buttons.indexOf(event.target as HTMLButtonElement)
    if (current === -1) return
    const row = rows[current]
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      buttons[Math.min(buttons.length - 1, current + 1)]?.focus()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[Math.max(0, current - 1)]?.focus()
      return
    }
    if (row === undefined || !row.hasChildren) return
    if (event.key === 'ArrowRight' && !row.expanded) {
      event.preventDefault()
      toggleExpanded(row.id)
      return
    }
    if (event.key === 'ArrowLeft' && row.expanded) {
      event.preventDefault()
      toggleExpanded(row.id)
    }
  }

  const flagDispatch = (
    id: NodeId,
    locked: boolean,
    hidden: boolean,
    label: string,
  ) => documentStore.dispatch({ type: 'setFlags', nodeId: id, locked, hidden }, label)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {layers.length === 0 ? (
        <p className="px-3 py-4 text-ui-xs text-ink-faint">
          No layers yet. Choose the Rectangle tool (M) or the Ellipse tool (L) and drag on the canvas.
        </p>
      ) : (
        <ul
          ref={listRef}
          role="tree"
          aria-label="Layers"
          className="min-h-0 flex-1 overflow-auto py-1"
          onKeyDown={onKeyDown}
        >
          {rows.map((row) => (
            <LayerRowItem
              key={row.id}
              row={row}
              selected={state.selection.includes(row.id)}
              dimmed={row.hidden || row.inheritedHidden}
              onToggleExpanded={toggleExpanded}
              onToggleFlag={flagDispatch}
            />
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-hairline px-2 py-1 text-ui-xs text-ink-faint">
        <span>{layers.length} at top level</span>
        <span>{state.selection.length} selected</span>
      </div>
    </div>
  )
}

type RowItemProps = {
  row: LayerRow
  selected: boolean
  dimmed: boolean
  onToggleExpanded: (id: NodeId) => void
  onToggleFlag: (id: NodeId, locked: boolean, hidden: boolean, label: string) => void
}

/** One layer row: tri, eye, lock, thumbnail slot, name — Illustrator's column order. */
function LayerRowItem({ row, selected, dimmed, onToggleExpanded, onToggleFlag }: RowItemProps) {
  const toggleClass = 'flex shrink-0 items-center justify-center hover:text-ink'
  return (
    <li
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      style={{ paddingLeft: row.depth * LAYER_INDENT }}
      className={`flex items-center gap-[2px] pr-1 ${selected ? 'bg-accent-soft' : ''}`}
    >
      {row.hasChildren ? (
        <button
          type="button"
          aria-label={row.expanded ? `Collapse ${row.node.name}` : `Expand ${row.node.name}`}
          title={row.expanded ? 'Collapse group' : 'Expand group'}
          className={`${toggleClass} text-ink-faint`}
          style={{ width: ROW_TOGGLE_SIZE, height: LAYER_ROW_HEIGHT }}
          onClick={() => onToggleExpanded(row.id)}
        >
          {row.expanded ? <IconDisclosureOpen size={10} /> : <IconDisclosureClosed size={10} />}
        </button>
      ) : (
        <span className="shrink-0" style={{ width: ROW_TOGGLE_SIZE }} aria-hidden="true" />
      )}
      <button
        type="button"
        aria-pressed={row.hidden}
        aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.node.name}`}
        title={row.hidden ? `Show ${row.node.name}` : `Hide ${row.node.name}`}
        className={`${toggleClass} ${row.hidden ? 'text-ink-faint' : 'text-ink-muted'}`}
        style={{ width: ROW_TOGGLE_SIZE, height: LAYER_ROW_HEIGHT }}
        onClick={() => onToggleFlag(row.id, row.node.locked, !row.node.hidden, row.hidden ? 'show layer' : 'hide layer')}
      >
        {row.hidden ? <IconEyeOff size={12} /> : <IconEye size={12} />}
      </button>
      <button
        type="button"
        aria-pressed={row.locked}
        aria-label={`${row.locked ? 'Unlock' : 'Lock'} ${row.node.name}`}
        title={row.locked ? `Unlock ${row.node.name}` : `Lock ${row.node.name}`}
        className={`${toggleClass} ${row.locked || row.inheritedLocked ? 'text-ink-muted' : 'text-ink-faint'}`}
        style={{ width: ROW_TOGGLE_SIZE, height: LAYER_ROW_HEIGHT }}
        onClick={() => onToggleFlag(row.id, !row.node.locked, row.node.hidden, row.locked ? 'unlock layer' : 'lock layer')}
      >
        {row.locked ? <IconLock size={12} /> : <IconUnlock size={12} />}
      </button>
      <span
        aria-hidden="true"
        title="Thumbnails arrive with the render work in a later slice"
        className={`shrink-0 rounded-ui border border-hairline ${isGroup(row.node) ? 'bg-chrome-raised' : 'bg-chrome-sunken'}`}
        style={{ width: 14, height: 14 }}
      />
      <button
        type="button"
        data-layer-name
        aria-label={`${row.node.name}, ${rowDescription(row)}`}
        title={`${row.node.name}, ${rowDescription(row)}`}
        className={`flex-1 truncate px-1 text-left text-ui-xs ${
          selected ? 'text-accent-ink' : dimmed ? 'text-ink-faint' : 'text-ink-muted'
        }`}
        style={{ height: LAYER_ROW_HEIGHT }}
        onClick={(event) => {
          if (event.shiftKey || event.metaKey || event.ctrlKey) documentStore.toggleSelection(row.id)
          else documentStore.setSelection([row.id])
        }}
      >
        {row.node.name}
      </button>
    </li>
  )
}

