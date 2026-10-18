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
import { Button } from '../ui/components/Button.tsx'
import { Tab } from '../ui/components/Tab.tsx'
import { DOCK_WIDTH } from '../ui/theme.ts'
import { workspaceStore, type PanelId } from '../../state/workspaceStore.ts'
import { PANEL_LABELS } from '../../state/workspaceStore.ts'
import type { EditorActionId } from '../actions.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { AppearancePanel } from './AppearancePanel.tsx'
import { AlignPanel } from './AlignPanel.tsx'
import { TransformPanel } from './TransformPanel.tsx'
import { ColorPanel } from './ColorPanel.tsx'
import { LayersPanel } from './LayersPanel.tsx'
import { PropertiesPanel } from './PropertiesPanel.tsx'

/** The commands each panel group's flyout offers, following Illustrator's panel menus. */
const GROUP_FLYOUT: Record<string, EditorActionId[]> = {
  'group.layers': [
    'layer.new',
    'object.duplicate',
    'object.group',
    'object.ungroup',
    'object.showAll',
    'object.unlockAll',
  ],
  'group.style': [],
  'group.arrange': [],
}

function PanelBody({ panel }: { panel: PanelId }) {
  switch (panel) {
    case 'layers':
      return <LayersPanel />
    case 'properties':
      return <PropertiesPanel />
    case 'align':
      return <AlignPanel />
    case 'transform':
      return <TransformPanel />
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
      className="flex shrink-0 flex-col overflow-hidden border-l border-hairline bg-chrome-panel shadow-[-1px_0_0_rgba(0,0,0,0.22)]"
      style={{ width: DOCK_WIDTH }}
    >
      {groups.map((group) => {
        const tabs = group.tabs.filter((tab) => workspace.visible[tab])
        return (
          <section key={group.id} className="flex min-h-0 flex-col border-b border-hairline bg-chrome">
            <div className="flex items-stretch border-b border-hairline bg-chrome-raised shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]" role="tablist">
              {tabs.map((tab) => (
                <Tab
                  key={tab}
                  label={PANEL_LABELS[tab]}
                  selected={!group.collapsed && group.active === tab}
                  expanded={!group.collapsed}
                  title={
                    !group.collapsed && group.active === tab
                      ? `Collapse ${PANEL_LABELS[tab]}`
                      : `Show ${PANEL_LABELS[tab]}`
                  }
                  onClick={() => workspaceStore.togglePanel(tab)}
                />
              ))}
              <PanelFlyout label={PANEL_LABELS[group.active]} items={GROUP_FLYOUT[group.id] ?? []} />
              <Button
                variant="icon"
                label={
                  group.collapsed
                    ? `Expand ${PANEL_LABELS[group.active]} group`
                    : `Collapse ${PANEL_LABELS[group.active]} group`
                }
                title={group.collapsed ? 'Expand panel group' : 'Collapse panel group'}
                icon={<IconChevron size={12} className={group.collapsed ? '-rotate-90' : undefined} />}
                onClick={() => workspaceStore.toggleGroup(group.id)}
              />
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
