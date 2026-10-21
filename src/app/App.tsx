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
import { CrashRecoveryDialog } from './shell/CrashRecoveryDialog.tsx'
import { OffsetPathDialog } from './shell/OffsetPathDialog.tsx'
import { PreferencesDialog } from './shell/PreferencesDialog.tsx'
import { UnsavedChangesDialog } from './shell/UnsavedChangesDialog.tsx'
import { CanvasView } from './canvas/CanvasView.tsx'
import { handleBeforeClose, refreshRecoveryState, writeRecoverySnapshot } from './files/fileActions.ts'
import { intervalMilliseconds } from './files/autosavePolicy.ts'
import { useSettings } from '../state/useSettings.ts'
import { MenuBar } from './shell/MenuBar.tsx'
import { StatusBar } from './shell/StatusBar.tsx'
import { ToolOptionsBar } from './shell/ToolOptionsBar.tsx'
import { ToolPalette } from './shell/ToolPalette.tsx'
import { PanelDock } from './panels/PanelDock.tsx'
import { useEditorShortcuts } from './menus/useEditorShortcuts.ts'

export function App() {
  useEditorShortcuts()
  const settings = useSettings()

  useEffect(() => {
    // Recovery (issue #19): if the last session died with a copy waiting, say so and offer it back;
    // otherwise keep one rolling snapshot of a **saved** document on the user's interval, plus a
    // last one before the window unloads.
    void refreshRecoveryState()
    const api = window.vectrFiles
    api?.onBeforeClose(() => {
      void handleBeforeClose()
    })
  }, [])

  useEffect(() => {
    // The interval is a preference, so the timer follows the setting instead of a constant.
    if (!settings.autosaveEnabled) return
    const timer = window.setInterval(() => {
      void writeRecoverySnapshot({ reason: 'interval' })
    }, intervalMilliseconds(settings.autosaveIntervalMinutes))
    return () => window.clearInterval(timer)
  }, [settings.autosaveEnabled, settings.autosaveIntervalMinutes])

  useEffect(() => {
    const onUnload = () => {
      void writeRecoverySnapshot({ reason: 'close' })
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  return (
    <>
      <div className="grid h-screen grid-rows-[auto_auto_1fr_auto] bg-pasteboard text-ink">
        <MenuBar />
        <ToolOptionsBar />
        <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
          <ToolPalette />
          <CanvasView />
          <PanelDock />
        </div>
        <StatusBar />
      </div>
      <AboutDialog />
      <UnsavedChangesDialog />
      <CrashRecoveryDialog />
      <PreferencesDialog />
      <OffsetPathDialog />
    </>
  )
}
