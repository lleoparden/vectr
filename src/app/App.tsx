/**
 * Vectr editor shell (issue #18, restructured in issue #28).
 *
 * The workspace an Illustrator user expects: a menu bar across the top, the tool
 * palette docked on the left, the canvas in the middle, the panel dock with Layers
 * and the style panels on the right, and a status bar carrying the zoom level. One
 * window, one document, one store — the benchmark harness from Phase 1 stays
 * reachable with `?benchmark` so recorded evidence can still be reproduced.
 */

import { useEffect } from 'react'
import { AboutDialog } from './shell/AboutDialog.tsx'
import { CanvasView } from './canvas/CanvasView.tsx'
import { handleBeforeClose, RECOVERY_INTERVAL_MS, refreshRecoveryState, writeRecoverySnapshot } from './files/fileActions.ts'
import { MenuBar } from './shell/MenuBar.tsx'
import { StatusBar } from './shell/StatusBar.tsx'
import { ToolPalette } from './shell/ToolPalette.tsx'
import { PanelDock } from './panels/PanelDock.tsx'
import { useEditorShortcuts } from './menus/useEditorShortcuts.ts'

export function App() {
  useEditorShortcuts()

  useEffect(() => {
    // Recovery (issue #19): offer a snapshot from a previous session, keep one rolling snapshot
    // while the document is dirty, and take a last one before the window unloads.
    void refreshRecoveryState()
    const api = window.vectrFiles
    api?.onBeforeClose(() => {
      void handleBeforeClose()
    })
    const timer = window.setInterval(() => {
      void writeRecoverySnapshot()
    }, RECOVERY_INTERVAL_MS)
    const onUnload = () => {
      void writeRecoverySnapshot()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  return (
    <>
      <div className="grid h-screen grid-rows-[auto_1fr_auto] bg-pasteboard text-ink">
        <MenuBar />
        <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
          <ToolPalette />
          <CanvasView />
          <PanelDock />
        </div>
        <StatusBar />
      </div>
      <AboutDialog />
    </>
  )
}
