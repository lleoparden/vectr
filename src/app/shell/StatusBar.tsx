/**
 * Status bar (issue #28).
 *
 * Illustrator puts the current zoom level and the artboard at the bottom of the
 * document window, so the same facts live here: the tool, the selection count, the
 * artboard, and the zoom. The zoom readout is also the hint for `Ctrl+0`, which
 * brings the whole artboard back.
 */

import { zoomPercent } from '../canvas/viewportOps.ts'
import { artboardRect } from '../../doc/artboards.ts'
import { isolationLabel } from '../editing/isolation.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'

export function StatusBar() {
  const state = useEditorState()
  const workspace = useWorkspaceState()
  const isolated = isolationLabel(state.document, workspace.isolatedGroupId)
  const artboard = artboardRect(state.document, workspace.activeArtboardId) ?? state.document.artboards[0]
  const selection =
    state.selection.length === 0
      ? 'no selection'
      : state.selection.length === 1
        ? '1 object selected'
        : `${state.selection.length} objects selected`

  return (
    <footer className="flex h-[22px] shrink-0 items-center justify-between border-t border-hairline bg-chrome px-2 text-ui-xs text-ink-faint">
      <span className="flex items-center gap-3">
        <span className="capitalize text-ink-muted">{state.tool}</span>
        <span>{selection}</span>
        {state.lastError !== null && (
          <span role="status" className="text-danger">
            Rejected {state.lastError.code}
          </span>
        )}
      </span>
      <span className="flex items-center gap-3">
        <span>
          {artboard.name} {artboard.width}×{artboard.height}
        </span>
        <span title={state.filePath ?? 'This document has not been saved yet'}>
          {state.filePath ?? 'unsaved'}
        </span>
        <span className="text-ink-muted">
          {state.document.revision !== state.savedRevision ? 'unsaved changes' : 'saved'}
        </span>
        <span title="Fit Artboard in Window (Ctrl+0)" className="text-ink-muted">
          {zoomPercent(state.viewport.zoom)}
        </span>
      </span>
    </footer>
  )
}
