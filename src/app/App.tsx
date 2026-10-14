/**
 * Vectr editor shell (issue #18).
 *
 * One window, one document, one store. The benchmark harness from Phase 1 stays
 * reachable with `?benchmark` so recorded evidence and candidate comparisons can
 * still be reproduced without shipping two apps.
 */

import { CanvasView } from './CanvasView.tsx'
import { LayerList } from './LayerList.tsx'
import { Toolbar } from './Toolbar.tsx'
import { useEditorShortcuts } from './useEditorShortcuts.ts'
import { useEditorState } from '../state/useEditorState.ts'

export function App() {
  const state = useEditorState()
  useEditorShortcuts()
  const selectionLabel =
    state.selection.length === 0
      ? 'no selection'
      : state.selection.length === 1
        ? '1 layer selected'
        : `${state.selection.length} layers selected`

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] bg-neutral-950 text-neutral-100">
      <Toolbar />
      <div className="grid min-h-0 grid-cols-[1fr_260px]">
        <CanvasView />
        <LayerList />
      </div>
      <footer className="flex items-center justify-between border-t border-neutral-800 px-4 py-1 text-[10px] text-neutral-400">
        <span>
          tool: {state.tool} · {selectionLabel} · revision {state.document.revision}
        </span>
        <span>
          {state.document.artboards[0].name} {state.document.artboards[0].width}×
          {state.document.artboards[0].height}
        </span>
      </footer>
    </div>
  )
}
