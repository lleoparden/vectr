/**
 * Panel dock (issue #28).
 *
 * Illustrator docks its panels on the right as collapsible tabbed groups, and the
 * Layers panel sits at the top of the stack, so that is what this is: one column of
 * groups, each with a tab strip, each tab a real panel. Clicking the tab that is
 * already on top collapses the group, which is the Illustrator gesture for putting a
 * panel group away.
 *
 * The dock is a fixed width in this slice; a draggable splitter and floating panels
 * are recorded as not built yet in `docs/DECISIONS.md`.
 */

import { IconChevron } from '../ui/icons.tsx'
import { PanelFlyout } from '../shell/PanelFlyout.tsx'
import { DOCK_WIDTH } from '../ui/theme.ts'
import { workspaceStore, type PanelId } from '../../state/workspaceStore.ts'
import { PANEL_LABELS } from '../../state/workspaceStore.ts'
import type { EditorActionId } from '../actions.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { AppearancePanel } from './AppearancePanel.tsx'
import { ColorPanel } from './ColorPanel.tsx'
import { LayersPanel } from './LayersPanel.tsx'
import { PropertiesPanel } from './PropertiesPanel.tsx'

/** The commands each panel group's flyout offers, following Illustrator's panel menus. */
const GROUP_FLYOUT: Record<string, EditorActionId[]> = {
  'group.layers': [
    'object.hideSelection',
    'object.showAll',
    'object.lockSelection',
    'object.unlockAll',
  ],
  'group.style': [],
}

function PanelBody({ panel }: { panel: PanelId }) {
  switch (panel) {
    case 'layers':
      return <LayersPanel />
    case 'properties':
      return <PropertiesPanel />
    case 'appearance':
      return <AppearancePanel />
    case 'color':
      return <ColorPanel />
  }
}

export function PanelDock() {
  const workspace = useWorkspaceState()
  const groups = workspace.groups.filter((group) => group.tabs.some((tab) => workspace.visible[tab]))

  return (
    <aside
      aria-label="Panels"
      className="flex shrink-0 flex-col overflow-hidden border-l border-hairline bg-chrome"
      style={{ width: DOCK_WIDTH }}
    >
      {groups.map((group) => {
        const tabs = group.tabs.filter((tab) => workspace.visible[tab])
        return (
          <section key={group.id} className="flex min-h-0 flex-col border-b border-hairline">
            <div className="flex items-stretch border-b border-hairline bg-chrome-raised" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={!group.collapsed && group.active === tab}
                  aria-expanded={!group.collapsed}
                  title={
                    !group.collapsed && group.active === tab
                      ? `Collapse ${PANEL_LABELS[tab]}`
                      : `Show ${PANEL_LABELS[tab]}`
                  }
                  className={`flex-1 px-2 py-[5px] text-ui-xs ${
                    !group.collapsed && group.active === tab
                      ? 'bg-chrome text-ink'
                      : 'text-ink-faint hover:bg-chrome-active hover:text-ink-muted'
                  }`}
                  onClick={() => workspaceStore.togglePanel(tab)}
                >
                  {PANEL_LABELS[tab]}
                </button>
              ))}
              <PanelFlyout label={PANEL_LABELS[group.active]} items={GROUP_FLYOUT[group.id] ?? []} />
              <button
                type="button"
                aria-label={
                  group.collapsed
                    ? `Expand ${PANEL_LABELS[group.active]} group`
                    : `Collapse ${PANEL_LABELS[group.active]} group`
                }
                title={group.collapsed ? 'Expand panel group' : 'Collapse panel group'}
                className="px-1 text-ink-faint hover:text-ink"
                onClick={() => workspaceStore.toggleGroup(group.id)}
              >
                <IconChevron size={12} className={group.collapsed ? '-rotate-90' : undefined} />
              </button>
            </div>
            {!group.collapsed && (
              <div className="flex min-h-0 flex-1 flex-col">
                <PanelBody panel={group.active} />
              </div>
            )}
          </section>
        )
      })}
      {groups.length === 0 && (
        <p className="px-3 py-4 text-ui-xs text-ink-faint">
          Every panel is closed. Open one from the Window menu.
        </p>
      )}
    </aside>
  )
}
