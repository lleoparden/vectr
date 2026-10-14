/**
 * Properties panel (issue #28).
 *
 * Read-only for now: it reports what is selected and where it is, using the document
 * model's own world bounds. Editing values needs new commands that arrive with the
 * transform work in #20 and later, and the UI direction prefers an honest read-only
 * panel over inert-looking editable fields.
 */

import { findNode, worldBounds } from '../../doc/document.ts'
import { isGroup, nodeSize } from '../../doc/types.ts'
import { useEditorState } from '../../state/useEditorState.ts'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-2 py-[3px]">
      <span className="text-ui-xs text-ink-faint">{label}</span>
      <span className="truncate text-ui-xs text-ink-muted">{value}</span>
    </div>
  )
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function PropertiesPanel() {
  const state = useEditorState()
  const id = state.selection[0]
  const node = id === undefined ? null : findNode(state.document, id)
  const bounds = id === undefined ? null : worldBounds(state.document, id)

  if (node === null || id === undefined) {
    return (
      <p className="px-3 py-4 text-ui-xs text-ink-faint">
        No selection. Click a layer on the canvas or in the Layers panel.
      </p>
    )
  }

  const size = nodeSize(node)
  return (
    <div className="min-h-0 flex-1 overflow-auto py-1">
      <Row label="Name" value={node.name} />
      <Row label="Kind" value={isGroup(node) ? `group of ${node.children.length}` : node.type} />
      <Row label="Id" value={id} />
      <Row label="X" value={bounds === null ? '—' : round(bounds.x)} />
      <Row label="Y" value={bounds === null ? '—' : round(bounds.y)} />
      <Row label="W" value={bounds === null ? '—' : round(bounds.width > 0 ? bounds.width : size.width)} />
      <Row label="H" value={bounds === null ? '—' : round(bounds.height > 0 ? bounds.height : size.height)} />
      <Row label="Rotation" value={`${round(node.transform.rotation)}°`} />
      <Row label="Scale" value={`${round(node.transform.scaleX)} × ${round(node.transform.scaleY)}`} />
      <Row label="Flags" value={`${node.hidden ? 'hidden ' : ''}${node.locked ? 'locked' : ''}`.trim() || 'none'} />
      {state.selection.length > 1 && <Row label="Also selected" value={`${state.selection.length - 1} more`} />}
    </div>
  )
}
