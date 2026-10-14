/**
 * Workspace store (issue #28).
 *
 * Panel layout, the canvas size the View commands need, and the About dialog are
 * interface state, not document state, so they live in their own store. Keeping
 * them out of the document store also fixes an honest wart recorded during slice
 * 2: a viewport change used to notify every document subscriber, including the
 * layer list. Layout changes now only wake the shell.
 */

export type PanelId = 'layers' | 'properties' | 'appearance' | 'color'

/** Illustrator groups panels into tabbed stacks; so does the dock. */
export type PanelGroup = {
  id: string
  tabs: PanelId[]
  active: PanelId
  collapsed: boolean
}

export type CanvasSize = { width: number; height: number }

export type WorkspaceState = {
  groups: PanelGroup[]
  visible: Record<PanelId, boolean>
  canvas: CanvasSize
  aboutOpen: boolean
}

export const PANEL_LABELS: Record<PanelId, string> = {
  layers: 'Layers',
  properties: 'Properties',
  appearance: 'Appearance',
  color: 'Color',
}

/** Panel ids in docking order, so the Window menu and the dock cannot disagree. */
export const PANEL_IDS: PanelId[] = ['layers', 'properties', 'appearance', 'color']

export const PANEL_GROUPS: PanelGroup[] = [
  { id: 'group.layers', tabs: ['layers'], active: 'layers', collapsed: false },
  { id: 'group.style', tabs: ['properties', 'appearance', 'color'], active: 'properties', collapsed: false },
]

function initialVisible(): Record<PanelId, boolean> {
  return { layers: true, properties: true, appearance: true, color: true }
}

export class WorkspaceStore {
  private state: WorkspaceState
  private readonly listeners = new Set<() => void>()

  constructor(groups: PanelGroup[] = PANEL_GROUPS.map((group) => ({ ...group, tabs: [...group.tabs] }))) {
    this.state = { groups, visible: initialVisible(), canvas: { width: 0, height: 0 }, aboutOpen: false }
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
}

export const workspaceStore = new WorkspaceStore()
