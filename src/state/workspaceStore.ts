/**
 * Workspace store (issue #28).
 *
 * Panel layout, the canvas size the View commands need, and the About dialog are
 * interface state, not document state, so they live in their own store. Keeping
 * them out of the document store also fixes an honest wart recorded during slice
 * 2: a viewport change used to notify every document subscriber, including the
 * layer list. Layout changes now only wake the shell.
 */

import { DEFAULT_SHAPE_PARAMS, type ShapeKind, type ShapeParams } from '../doc/document.ts'

export type PanelId = 'layers' | 'properties' | 'align' | 'transform' | 'appearance' | 'color'
/** Illustrator groups panels into tabbed stacks; so does the dock. */
export type PanelGroup = {
  id: string
  tabs: PanelId[]
  active: PanelId
  collapsed: boolean
}

export type CanvasSize = { width: number; height: number }

/** Why the unsaved-changes dialog is open; the copy adapts, the guard does not. */
export type UnsavedKind = 'close' | 'new' | 'open'

/**
 * What a new object is drawn with. Illustrator's tool options set what the *next* object looks
 * like, so these are the values the shape and text tools read when they create something.
 */
export type CreationDefaults = {
  /** The member of the shape group that the palette and the options bar show. */
  shapeTool: ShapeKind
  /** Geometry and colour every shape tool draws with, from the tool options bar. */
  shape: ShapeParams
  textFill: string
  textFontSize: number
  textAlign: 'left' | 'center' | 'right'
}

export const INITIAL_CREATION_DEFAULTS: CreationDefaults = {
  shapeTool: 'rect',
  shape: { ...DEFAULT_SHAPE_PARAMS },
  textFill: '#1e1e23',
  textFontSize: 16,
  textAlign: 'left',
}

export type PendingPrompt = {
  kind: UnsavedKind
  documentName: string
  /** True while an async choice (Save) is in flight, so the dialog can disable its buttons. */
  busy: boolean
}

export type WorkspaceState = {
  groups: PanelGroup[]
  visible: Record<PanelId, boolean>
  canvas: CanvasSize
  aboutOpen: boolean
  /** Set when work would be lost; the dialog resolves it and the action continues or stops. */
  pendingPrompt: PendingPrompt | null
  /** Set when the last session died with a recovery copy waiting; the crash dialog resolves it. */
  crashPrompt: CrashPrompt | null
  /** Whether the Preferences dialog is open. */
  preferencesOpen: boolean
  /** What the shape and text tools draw with, and which shape member is showing. */
  creationDefaults: CreationDefaults
  /** The artboard the status bar, Fit Artboard, and new objects use; null means the first one. */
  activeArtboardId: string | null
  /** The group being edited in isolation mode, or null (session state, issue #71). */
  isolatedGroupId: string | null
  /** The anchor Direct Selection last picked; arrow keys nudge it (Phase 5.3). */
  activeAnchor: { nodeId: string; index: number } | null
  /** View chrome: rulers, grid, and guides are session state (issue #67). */
  showRulers: boolean
  showGrid: boolean
  showGuides: boolean
  /** Smart Guides: snap drags to page and object edges (session state, issue #68). */
  smartGuides: boolean
}

/** What the crash dialog needs to say which file came back and from when. */
export type CrashPrompt = {
  documentName: string
  savedAt: string
  directory: string | null
}

export const PANEL_LABELS: Record<PanelId, string> = {
  layers: 'Layers',
  properties: 'Properties',
  align: 'Align',
  transform: 'Transform',
  appearance: 'Appearance',
  color: 'Color',
}

/** Panel ids in docking order, so the Window menu and the dock cannot disagree. */
export const PANEL_IDS: PanelId[] = ['layers', 'properties', 'align', 'transform', 'appearance', 'color']

export const PANEL_GROUPS: PanelGroup[] = [
  { id: 'group.layers', tabs: ['layers'], active: 'layers', collapsed: false },
  { id: 'group.style', tabs: ['properties', 'appearance', 'color'], active: 'properties', collapsed: false },
  { id: 'group.arrange', tabs: ['align', 'transform'], active: 'align', collapsed: false },
]

function initialVisible(): Record<PanelId, boolean> {
  return { layers: true, properties: true, align: true, transform: true, appearance: true, color: true }
}
export class WorkspaceStore {
  private state: WorkspaceState
  private readonly listeners = new Set<() => void>()

  constructor(groups: PanelGroup[] = PANEL_GROUPS.map((group) => ({ ...group, tabs: [...group.tabs] }))) {
    this.state = {
      groups,
      visible: initialVisible(),
      canvas: { width: 0, height: 0 },
      aboutOpen: false,
      pendingPrompt: null,
      crashPrompt: null,
      preferencesOpen: false,
      creationDefaults: { ...INITIAL_CREATION_DEFAULTS },
      activeArtboardId: null,
      isolatedGroupId: null,
  activeAnchor: null,
      showRulers: true,
      showGrid: false,
      showGuides: true,
      smartGuides: true,
    }
  }

  getState = (): WorkspaceState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private update(patch: Partial<WorkspaceState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private mapGroup(panelId: PanelId, change: (group: PanelGroup) => PanelGroup): PanelGroup[] {
    return this.state.groups.map((group) => (group.tabs.includes(panelId) ? change(group) : group))
  }

  /** Opens a panel: its group expands and the tab becomes active. */
  activate(panelId: PanelId) {
    const groups = this.mapGroup(panelId, (group) => ({ ...group, active: panelId, collapsed: false }))
    this.update({ groups, visible: { ...this.state.visible, [panelId]: true } })
  }

  /**
   * The Window menu and the dock tabs share one rule, which is Illustrator's:
   * choosing the panel that is already showing on top collapses its group, and
   * choosing any other panel brings it forward.
   */
  togglePanel(panelId: PanelId) {
    const group = this.state.groups.find((candidate) => candidate.tabs.includes(panelId))
    if (group === undefined) return
    if (group.collapsed || group.active !== panelId) {
      this.activate(panelId)
      return
    }
    this.toggleGroup(group.id)
  }

  /** Collapses or expands a panel group without changing which tab is active. */
  toggleGroup(groupId: string) {
    const groups = this.state.groups.map((group) =>
      group.id === groupId ? { ...group, collapsed: !group.collapsed } : group,
    )
    this.update({ groups })
  }

  setPanelVisible(panelId: PanelId, visible: boolean) {
    const groups = visible
      ? this.state.groups
      : this.state.groups.map((group) =>
          group.active === panelId && group.tabs.length > 1
            ? { ...group, active: group.tabs.find((tab) => tab !== panelId) ?? group.active }
            : group,
        )
    this.update({ groups, visible: { ...this.state.visible, [panelId]: visible } })
  }

  /** The canvas reports its CSS size so Fit Artboard in Window can compute a zoom. */
  setCanvasSize(width: number, height: number) {
    const canvas = this.state.canvas
    if (canvas.width === width && canvas.height === height) return
    this.update({ canvas: { width, height } })
  }

  setAboutOpen(aboutOpen: boolean) {
    if (this.state.aboutOpen === aboutOpen) return
    this.update({ aboutOpen })
  }

  /** Opens the unsaved-changes dialog. Only the actions that can lose work call this. */
  promptFor(kind: UnsavedKind, documentName: string) {
    this.update({ pendingPrompt: { kind, documentName, busy: false } })
  }

  setPromptBusy(busy: boolean) {
    const pending = this.state.pendingPrompt
    if (pending === null || pending.busy === busy) return
    this.update({ pendingPrompt: { ...pending, busy } })
  }

  clearPrompt() {
    if (this.state.pendingPrompt === null) return
    this.update({ pendingPrompt: null })
  }

  /** Updates what the next drawn object uses; the tool options bar and the tools share this. */
  setCreationDefaults(patch: Partial<CreationDefaults>) {
    this.update({ creationDefaults: { ...this.state.creationDefaults, ...patch } })
  }

  /** Enters or leaves isolation mode; it is view state, so it is never persisted. */
  setActiveAnchor(activeAnchor: { nodeId: string; index: number } | null) {
    if (this.state.activeAnchor === activeAnchor) return
    this.update({ activeAnchor })
  }

  setIsolatedGroup(isolatedGroupId: string | null) {
    if (this.state.isolatedGroupId === isolatedGroupId) return
    this.update({ isolatedGroupId })
  }

  /** Toggles one piece of view chrome; never persisted, like the rest of the view. */
  setViewChrome(patch: Partial<Pick<WorkspaceState, 'showRulers' | 'showGrid' | 'showGuides'>>) {
    this.update(patch)
  }

  /** Turns snapping on or off for the session; never persisted. */
  setSmartGuides(smartGuides: boolean) {
    if (this.state.smartGuides === smartGuides) return
    this.update({ smartGuides })
  }

  /** Remembers which page the user is working on; it is session state, never persisted. */
  setActiveArtboard(activeArtboardId: string | null) {
    if (this.state.activeArtboardId === activeArtboardId) return
    this.update({ activeArtboardId })
  }

  /** Opens or closes the crash dialog; it has no other state. */
  setCrashPrompt(crashPrompt: CrashPrompt | null) {
    if (crashPrompt === null && this.state.crashPrompt === null) return
    this.update({ crashPrompt })
  }

  /** The Preferences dialog, opened from Edit ▸ Preferences. */
  setPreferencesOpen(preferencesOpen: boolean) {
    if (this.state.preferencesOpen === preferencesOpen) return
    this.update({ preferencesOpen })
  }
}

export const workspaceStore = new WorkspaceStore()
