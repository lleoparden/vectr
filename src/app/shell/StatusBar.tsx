/**
 * Status bar (issue #28, polished in the UI pass).
 *
 * The document's vitals, in the order Illustrator puts them: what tool you are in, what is selected,
 * which page you are on, whether the file is saved, and the zoom. Isolation mode gets a chip of its
 * own, because while it is on, "what you are editing" is the most important fact on screen.
 */

import { zoomPercent } from '../../geom/viewport.ts'
import { artboardRect } from '../../doc/artboards.ts'
import { isolationLabel } from '../editing/isolation.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'

/** Palette tools are camelCase ids; the status bar prints what the tool palette calls them. */
const TOOL_NAMES: Record<string, string> = {
  select: 'Selection',
  directSelect: 'Direct Selection',
  lasso: 'Lasso',
  rect: 'Rectangle',
  roundedRect: 'Rounded Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  polygon: 'Polygon',
  star: 'Star',
  arc: 'Arc',
  text: 'Type',
}

function Dot({ tone }: { tone: 'saved' | 'dirty' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 rounded-full ${tone === 'dirty' ? 'bg-amber-400' : 'bg-emerald-400/80'}`}
    />
  )
}

const SEPARATOR = <span aria-hidden="true" className="h-3 w-px bg-hairline" />

export function StatusBar() {
  const state = useEditorState()
  const workspace = useWorkspaceState()
  const isolated = isolationLabel(state.document, workspace.isolatedGroupId)
  const artboard = artboardRect(state.document, workspace.activeArtboardId) ?? state.document.artboards[0]
  const dirty = state.document.revision !== state.savedRevision
  const selection =
    state.selection.length === 0
      ? 'no selection'
      : state.selection.length === 1
        ? '1 object'
        : `${state.selection.length} objects`

  return (
    <footer className="flex h-[24px] shrink-0 items-center justify-between gap-3 border-t border-hairline bg-chrome px-2.5 text-ui-xs text-ink-faint">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-ink-muted">{TOOL_NAMES[state.tool] ?? state.tool}</span>
        {SEPARATOR}
        <span className="truncate">{selection}</span>
        {isolated !== null && (
          <>
            {SEPARATOR}
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-1.5 py-[1px] text-accent-ink"
              title="Isolation mode: Escape to exit"
            >
              Isolated · {isolated}
            </span>
          </>
        )}
        {state.lastError !== null && (
          <span role="status" className="shrink-0 rounded-full bg-danger/15 px-1.5 py-[1px] text-danger">
            Rejected · {state.lastError.code}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span className="truncate">
          {artboard.name}
          <span className="ml-1 tabular-nums text-ink-faint/80">
            {artboard.width}×{artboard.height}
          </span>
        </span>
        {SEPARATOR}
        <span className="flex items-center gap-1.5" title={state.filePath ?? 'This document has not been saved yet'}>
          <Dot tone={dirty ? 'dirty' : 'saved'} />
          <span className={dirty ? 'text-ink-muted' : 'text-ink-faint'}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        </span>
        {SEPARATOR}
        <button
          type="button"
          title="Fit artboard in window (Ctrl+0)"
          className="rounded-ui px-1 tabular-nums text-ink-muted hover:bg-chrome-hover hover:text-ink"
          onClick={() => {
            // The menu owns the action; the readout is also a shortcut to it, the way Illustrator's is.
            window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }))
          }}
        >
          {zoomPercent(state.viewport.zoom)}
        </button>
      </span>
    </footer>
  )
}
