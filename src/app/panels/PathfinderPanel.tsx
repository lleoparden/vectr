/**
 * Pathfinder panel (Phase 5.4, issue #140).
 *
 * Illustrator's Pathfinder panel is how most people combine shapes, so the four modes belong here as
 * buttons, not only under the Object menu. A button is disabled when fewer than two objects are
 * selected, because the commands refuse that case too - the panel does not offer a dead action.
 */

import { runEditorAction } from '../actions.ts'
import { Button } from '../ui/components/Button.tsx'
import { EmptyState } from '../ui/components/EmptyState.tsx'
import { Section } from '../ui/components/fields.tsx'
import { useEditorState } from '../../state/useEditorState.ts'

const MODES = [
  { action: 'path.unite', label: 'Unite', hint: 'Merge the selected shapes into one outline.' },
  { action: 'path.intersect', label: 'Intersect', hint: 'Keep only the area every shape covers.' },
  { action: 'path.subtract', label: 'Subtract', hint: 'Remove the front shapes from the back one.' },
  { action: 'path.exclude', label: 'Exclude', hint: 'Keep the area covered by an odd number of shapes.' },
] as const

export function PathfinderPanel() {
  const state = useEditorState()
  const enabled = state.selection.length >= 2
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden" data-panel-body="pathfinder">
      <Section title="Pathfinder">
        {!enabled && <EmptyState>Select two or more shapes to combine them.</EmptyState>}
        <div className="grid grid-cols-2 gap-1">
          {MODES.map((mode) => (
            <Button
              key={mode.action}
              variant="panel"
              block
              disabled={!enabled}
              title={mode.hint}
              onClick={() => runEditorAction(mode.action)}
            >
              {mode.label}
            </Button>
          ))}
        </div>
      </Section>
    </div>
  )
}
