/**
 * Layers panel (issue #28, made interactive in issue #20).
 *
 * The document's spine, in Illustrator's row form: a disclosure triangle, the visibility eye,
 * the lock, a thumbnail slot, then the layer name. Issue #20 makes it behave like
 * Illustrator's: drag a row to reorder or drop into a group, double-click (or F2) to rename in
 * place, Shift-click for a range selection, right-click for the object menu, and the eye and
 * lock dispatch the real `setFlags` command.
 *
 * The locate column, live thumbnails (top-level and nested), and dragging a layer into a group all
 * ship; a row whose bucket is shared is refused a preview rather than shown a misleading one.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { findNode, worldBounds } from '../../doc/document.ts'
import type { NodeId } from '../../doc/types.ts'
import { ContextMenu, type ContextMenuState } from '../canvas/ContextMenu.tsx'
import { layerRowContextItems } from '../menus/contextMenus.ts'
import {
  IconDelete,
  IconDisclosureClosed,
  IconDisclosureOpen,
  IconDuplicate,
  IconEye,
  IconEyeOff,
  IconLock,
  IconNewLayer,
  IconUnlock,
} from '../ui/icons.tsx'
import { expandedGroupIds, layerRows, rowDescription, type LayerRow } from './layerRows.ts'
import { placementFor } from '../editing/layerDrag.ts'
import { Button } from '../ui/components/Button.tsx'
import { ListItem } from '../ui/components/ListItem.tsx'
import { RowControl } from '../ui/components/RowControl.tsx'
import { locateRowIds } from '../editing/locate.ts'
import { LAYER_INDENT, LAYER_ROW_HEIGHT, ROW_TOGGLE_SIZE } from '../ui/theme.ts'
import { canRunAction, deleteUnlockedSelection, runEditorAction, runLayerDrop } from '../actions.ts'
import { documentStore } from '../../state/documentStore.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { getActiveRenderer } from '../../render/activeRenderer.ts'

type DragState = {
  /** Rows being dragged, in the order they sit in the tree. */
  ids: NodeId[]
  /** Where the pointer currently means to drop, for the indicator. */
  over: { rowId: NodeId; ratio: number } | null
}

/** Thumbnail size in CSS pixels, and how many rows are previewed (a panel's worth). */
const THUMBNAIL_SIZE = 28
const THUMBNAIL_LIMIT = 12

export function LayersPanel() {
  const state = useEditorState()
  const layers = state.document.root.children
  const [expanded, setExpanded] = useState<Set<NodeId>>(() => new Set(expandedGroupIds(layers)))
  const [renaming, setRenaming] = useState<NodeId | null>(null)
  const [menu, setMenu] = useState<ContextMenuState>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [thumbnails, setThumbnails] = useState<Map<NodeId, string>>(() => new Map())
  const [thumbnailTick, setThumbnailTick] = useState(0)
  const lastClicked = useRef<NodeId | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const renderedThumbnails = useRef<{ revision: number; map: Map<NodeId, string> }>({ revision: -1, map: new Map() })
  const rows = useMemo(() => layerRows(layers, expanded), [layers, expanded])
  const located = useMemo(() => locateRowIds(state.document, state.selection), [state.document, state.selection])

  // Thumbnails are real renders, not placeholders: the renderer draws the layer's recorded picture
  // into a small surface and hands back a PNG, which is why they only appear for top-level layers
  // and only for the first `THUMBNAIL_LIMIT` of them. A one-second tick retries until they exist,
  // because the renderer arrives a moment after launch.
  useEffect(() => {
    const timer = window.setInterval(() => setThumbnailTick((value) => value + 1), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const renderer = getActiveRenderer()
    if (renderer === null) return
    const current = renderedThumbnails.current
    // Nested rows get previews too: the renderer refuses a shared bucket rather than drawing the wrong one.
  const wanted = rows.slice(0, THUMBNAIL_LIMIT).map((row) => row.node)
    const upToDate =
      current.revision === state.document.revision && wanted.every((node) => current.map.has(node.id) || node.type === 'group' && node.children.length === 0)
    if (upToDate) return

    const next = new Map<NodeId, string>()
    for (const node of wanted) {
      const bounds = worldBounds(state.document, node.id)
      if (bounds === null) continue
      const dataUrl = renderer.renderThumbnail(node.id, THUMBNAIL_SIZE, bounds)
      if (dataUrl !== null) next.set(node.id, dataUrl)
    }
    renderedThumbnails.current = { revision: state.document.revision, map: next }
    setThumbnails(next)
  }, [state.document.revision, thumbnailTick, layers])

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

  // Shift-click selects the range between the previous click and this one, as Illustrator does.
  function selectRow(rowId: NodeId, event: { shiftKey: boolean; metaKey?: boolean; ctrlKey?: boolean }) {
    const anchor = lastClicked.current
    if (event.shiftKey && anchor !== null && anchor !== rowId) {
      const order = rows.map((row) => row.id)
      const from = order.indexOf(anchor)
      const to = order.indexOf(rowId)
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from]
        documentStore.setSelection(order.slice(start, end + 1))
        return
      }
    }
    if (event.metaKey === true || event.ctrlKey === true) documentStore.toggleSelection(rowId)
    else documentStore.setSelection([rowId])
    lastClicked.current = rowId
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
    if (row === undefined) return
    if (event.key === 'F2') {
      event.preventDefault()
      documentStore.setSelection([row.id])
      setRenaming(row.id)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      documentStore.dispatch({ type: 'removeNodes', nodeIds: [row.id] }, 'delete')
      return
    }
    if (!row.hasChildren) return
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

  // Drag to reorder or to drop into a group. The pointer is tracked on the window so a fast
  // drag does not lose the row, and the row under the pointer is found by hit testing.
  useEffect(() => {
    if (drag === null) return
    const onMove = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const rowElement = element instanceof HTMLElement ? element.closest<HTMLElement>('[data-layer-row]') : null
      if (rowElement === null) {
        setDrag((current) => (current === null ? current : { ...current, over: null }))
        return
      }
      const box = rowElement.getBoundingClientRect()
      const ratio = box.height === 0 ? 0.5 : (event.clientY - box.top) / box.height
      const rowId = rowElement.dataset.layerRow ?? ''
      setDrag((current) => (current === null ? current : { ...current, over: { rowId, ratio } }))
    }
    const onUp = () => {
      setDrag((current) => {
        if (current !== null && current.over !== null) {
          runLayerDrop(rows, current.ids, current.over.rowId, current.over.ratio)
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, rows])

  function commitRename(id: NodeId, name: string) {
    setRenaming(null)
    const trimmed = name.trim()
    const node = findNode(documentStore.getState().document, id)
    if (node === null || trimmed === '' || trimmed === node.name) return
    documentStore.dispatch({ type: 'renameNode', nodeId: id, name: trimmed }, 'rename layer')
  }

  const flagDispatch = (id: NodeId, locked: boolean, hidden: boolean, label: string) =>
    documentStore.dispatch({ type: 'setFlags', nodeId: id, locked, hidden }, label)

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
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1"
          onKeyDown={onKeyDown}
        >
          {rows.map((row) => (
            <LayerRowItem
              key={row.id}
              row={row}
              selected={state.selection.includes(row.id)}
              dimmed={row.hidden || row.inheritedHidden}
              dragging={drag !== null && drag.ids.includes(row.id)}
              dropHint={drag?.over?.rowId === row.id ? placementFor(drag.over.ratio, row) : null}
              renaming={renaming === row.id}
              thumbnail={thumbnails.get(row.id) ?? null}
              locate={located.has(row.id)}
              onLocate={(id) => documentStore.setSelection([id])}
              onSelect={selectRow}
              onToggleExpanded={toggleExpanded}
              onToggleFlag={flagDispatch}
              onRenameStart={(id) => setRenaming(id)}
              onRenameCommit={commitRename}
              onRenameCancel={() => setRenaming(null)}
              onContextMenu={(rowId, x, y) => {
                if (!documentStore.getState().selection.includes(rowId)) documentStore.setSelection([rowId])
                setMenu({ x, y, items: layerRowContextItems(() => setRenaming(rowId)) })
              }}
              onDragStart={(rowId, additive) => {
                const selection = documentStore.getState().selection
                const ids = !additive && selection.includes(rowId) ? selection : [rowId]
                if (!selection.includes(rowId)) documentStore.setSelection([rowId])
                lastClicked.current = rowId
                setDrag({ ids: [...ids], over: null })
              }}
            />
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-hairline px-2 py-1">
        <span className="truncate text-ui-xs text-ink-faint">
          {layers.length} at top level · {state.selection.length} selected
        </span>
        {/* Illustrator's Layers panel foot: New Layer, Duplicate Selection, Delete Selection. */}
        <span className="flex shrink-0 items-center gap-[2px]">
          <Button
            variant="icon"
            label="New Layer"
            icon={<IconNewLayer size={13} />}
            onClick={() => runEditorAction('layer.new')}
          />
          <Button
            variant="icon"
            label="Duplicate Selection"
            icon={<IconDuplicate size={13} />}
            disabled={!canRunAction('object.duplicate', state)}
            onClick={() => runEditorAction('object.duplicate')}
          />
          <Button
            variant="icon"
            label="Delete Selection"
            icon={<IconDelete size={13} />}
            disabled={state.selection.length === 0}
            onClick={() => deleteUnlockedSelection()}
          />
        </span>
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

type RowItemProps = {
  row: LayerRow
  selected: boolean
  dimmed: boolean
  dragging: boolean
  dropHint: 'before' | 'inside' | 'after' | null
  renaming: boolean
  thumbnail: string | null
  /** True when this row contains the selection and offers the locate pointer. */
  locate: boolean
  onSelect: (id: NodeId, event: { shiftKey: boolean; metaKey?: boolean; ctrlKey?: boolean }) => void
  onToggleExpanded: (id: NodeId) => void
  onToggleFlag: (id: NodeId, locked: boolean, hidden: boolean, label: string) => void
  onRenameStart: (id: NodeId) => void
  onRenameCommit: (id: NodeId, name: string) => void
  onRenameCancel: () => void
  onContextMenu: (id: NodeId, x: number, y: number) => void
  onDragStart: (id: NodeId, additive: boolean) => void
  onLocate: (id: NodeId) => void
}

/** One layer row: triangle, eye, lock, thumbnail slot, name — Illustrator's column order. */
function LayerRowItem({
  row,
  selected,
  dimmed,
  dragging,
  dropHint,
  renaming,
  thumbnail,
  locate,
  onSelect,
  onToggleExpanded,
  onToggleFlag,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onContextMenu,
  onDragStart,
  onLocate,
}: RowItemProps) {
  const toggleClass = 'flex shrink-0 items-center justify-center hover:text-ink'
  const hintClass =
    dropHint === 'before'
      ? 'border-t-2 border-t-accent'
      : dropHint === 'after'
        ? 'border-b-2 border-b-accent'
        : dropHint === 'inside'
          ? 'bg-accent-soft'
          : ''
  const selectedClass = selected ? 'bg-accent-soft' : ''

  return (
    <li
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      data-layer-row={row.id}
      style={{ paddingLeft: row.depth * LAYER_INDENT }}
      className={`flex items-center gap-[2px] pr-1 ${selectedClass} ${hintClass} ${dragging ? 'opacity-50' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(row.id, event.clientX, event.clientY)
      }}
    >
      {locate ? (
        <RowControl
          label={`Select parent of ${row.node.name}`}
          title={`Select ${row.node.name}, which contains the selection`}
          data={{ 'data-locate': row.id }}
          accent
          width={ROW_TOGGLE_SIZE}
          height={LAYER_ROW_HEIGHT}
          icon={<span aria-hidden="true" className="block h-[6px] w-[6px] rounded-[1px] bg-accent" />}
          onClick={() => onLocate(row.id)}
        />
      ) : (
        <span className="shrink-0" style={{ width: ROW_TOGGLE_SIZE }} aria-hidden="true" />
      )}
      {row.hasChildren ? (
        <RowControl
          label={row.expanded ? `Collapse ${row.node.name}` : `Expand ${row.node.name}`}
          title={row.expanded ? 'Collapse group' : 'Expand group'}
          expanded={row.expanded}
          width={ROW_TOGGLE_SIZE}
          height={LAYER_ROW_HEIGHT}
          icon={row.expanded ? <IconDisclosureOpen size={10} /> : <IconDisclosureClosed size={10} />}
          onClick={() => onToggleExpanded(row.id)}
        />
      ) : (
        <span className="shrink-0" style={{ width: ROW_TOGGLE_SIZE }} aria-hidden="true" />
      )}
      <RowControl
        label={`${row.hidden ? 'Show' : 'Hide'} ${row.node.name}`}
        title={row.hidden ? `Show ${row.node.name}` : `Hide ${row.node.name}`}
        pressed={row.hidden}
        width={ROW_TOGGLE_SIZE}
        height={LAYER_ROW_HEIGHT}
        icon={row.hidden ? <IconEyeOff size={12} /> : <IconEye size={12} />}
        onClick={() => onToggleFlag(row.id, row.node.locked, !row.node.hidden, row.hidden ? 'show layer' : 'hide layer')}
      />
      <RowControl
        label={`${row.locked ? 'Unlock' : 'Lock'} ${row.node.name}`}
        title={row.locked ? `Unlock ${row.node.name}` : `Lock ${row.node.name}`}
        pressed={row.locked}
        width={ROW_TOGGLE_SIZE}
        height={LAYER_ROW_HEIGHT}
        className={row.locked || row.inheritedLocked ? 'text-ink-muted' : ''}
        icon={row.locked ? <IconLock size={12} /> : <IconUnlock size={12} />}
        onClick={() => onToggleFlag(row.id, !row.node.locked, row.node.hidden, row.locked ? 'unlock layer' : 'lock layer')}
      />
      <span
        aria-hidden="true"
        title={
          thumbnail !== null
            ? 'A live preview of this layer'
            : 'No preview: this layer shares a render bucket, so a picture would be misleading'
        }
        className={`shrink-0 overflow-hidden rounded-ui border border-hairline ${
          row.node.type === 'group' ? 'bg-chrome-raised' : 'bg-chrome-sunken'
        }`}
        style={{ width: 14, height: 14 }}
      >
        {thumbnail !== null && (
          <img src={thumbnail} alt="" data-layer-thumbnail={row.id} className="h-full w-full object-contain" />
        )}
      </span>
      {renaming ? (
        <input
          autoFocus
          defaultValue={row.node.name}
          aria-label={`Rename ${row.node.name}`}
          className="flex-1 rounded-ui border border-accent bg-chrome-sunken px-1 text-ui-xs text-ink"
          style={{ height: LAYER_ROW_HEIGHT - 4 }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onRenameCommit(row.id, event.currentTarget.value)
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              onRenameCancel()
            }
          }}
          onBlur={(event) => onRenameCommit(row.id, event.currentTarget.value)}
        />
      ) : (
        <ListItem
          label={`${row.node.name}, ${rowDescription(row)}`}
          active={selected}
          height={LAYER_ROW_HEIGHT}
          className={`truncate px-1 ${dimmed ? 'text-ink-faint' : ''}`}
          data={{ 'data-layer-name': '' }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            onDragStart(row.id, event.metaKey || event.ctrlKey)
          }}
          onClick={(event) => onSelect(row.id, event)}
          onDoubleClick={() => onRenameStart(row.id)}
        >
          {row.node.name}
        </ListItem>
      )}
    </li>
  )
}


