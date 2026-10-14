/**
 * Appearance panel (issue #28).
 *
 * Shows the fill, stroke, and opacity of the selected shape. Read-only in this
 * slice: changing appearance needs style commands, and shipping editable controls
 * that silently do nothing would break the honesty rule the UI direction sets.
 */

import { findNode } from '../../doc/document.ts'
import { isLeaf, isText } from '../../doc/types.ts'
import { useEditorState } from '../../state/useEditorState.ts'

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 rounded-ui border border-hairline"
      style={{ background: color }}
    />
  )
}

export function AppearancePanel() {
  const state = useEditorState()
  const id = state.selection[0]
  const node = id === undefined ? null : findNode(state.document, id)

  if (node === null || !isLeaf(node)) {
    return (
      <p className="px-3 py-4 text-ui-xs text-ink-faint">
        Select a shape or a text object to inspect its fill, stroke, and opacity. Groups do not carry appearance yet.
      </p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto py-1">
      <div className="flex items-center justify-between gap-3 px-2 py-[3px]">
        <span className="text-ui-xs text-ink-faint">{isText(node) ? 'Text color' : 'Fill'}</span>
        <span className="flex items-center gap-2 text-ui-xs text-ink-muted">
          <Swatch color={node.style.fill} />
          {node.style.fill}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-2 py-[3px]">
        <span className="text-ui-xs text-ink-faint">Stroke</span>
        <span className="flex items-center gap-2 text-ui-xs text-ink-muted">
          {node.style.stroke === null ? (
            'None'
          ) : (
            <>
              <Swatch color={node.style.stroke.color} />
              {node.style.stroke.color} · {node.style.stroke.width} px
            </>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-2 py-[3px]">
        <span className="text-ui-xs text-ink-faint">Opacity</span>
        <span className="text-ui-xs text-ink-muted">{Math.round(node.style.opacity * 100)}%</span>
      </div>
      <p className="border-t border-hairline px-2 pt-2 text-ui-xs text-ink-faint">
        Editing stroke and opacity arrives with a later slice; the color swatches apply a fill.
      </p>
    </div>
  )
}
