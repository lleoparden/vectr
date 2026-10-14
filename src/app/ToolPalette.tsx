/**
 * Tool palette (issue #28).
 *
 * Illustrator's docked left column, one tool per row, with the tool's letter as its
 * tooltip so the keyboard map is discoverable in the same place Illustrator puts it.
 * Only the tools that exist are listed; the palette does not reserve greyed slots
 * for tools Vectr has not built.
 */

import { runEditorAction, type EditorActionId } from './actions.ts'
import { IconEllipse, IconRect, IconSelect } from './icons.tsx'
import { shortcutLabel } from './shortcuts.ts'
import { PALETTE_WIDTH, TOOL_BUTTON_SIZE } from './theme.ts'
import { useEditorState } from '../state/useEditorState.ts'

type PaletteTool = { action: EditorActionId; label: string; Icon: typeof IconSelect; tool: 'select' | 'rect' | 'ellipse' }

export const PALETTE_TOOLS: PaletteTool[] = [
  { action: 'tool.select', label: 'Selection Tool', Icon: IconSelect, tool: 'select' },
  { action: 'tool.rect', label: 'Rectangle Tool', Icon: IconRect, tool: 'rect' },
  { action: 'tool.ellipse', label: 'Ellipse Tool', Icon: IconEllipse, tool: 'ellipse' },
]

export function ToolPalette() {
  const state = useEditorState()

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col items-center gap-[2px] border-r border-hairline bg-chrome py-1"
      style={{ width: PALETTE_WIDTH }}
    >
      {PALETTE_TOOLS.map(({ action, label, Icon, tool }) => {
        const active = state.tool === tool
        const chord = shortcutLabel(action)
        return (
          <button
            key={action}
            type="button"
            aria-pressed={active}
            aria-label={chord === null ? label : `${label} (${chord})`}
            title={chord === null ? label : `${label} (${chord})`}
            onClick={() => runEditorAction(action)}
            className={`flex items-center justify-center rounded-ui ${
              active ? 'bg-accent text-white' : 'text-ink-muted hover:bg-chrome-active hover:text-ink'
            }`}
            style={{ width: TOOL_BUTTON_SIZE, height: TOOL_BUTTON_SIZE }}
          >
            <Icon size={16} />
          </button>
        )
      })}
      <div className="mt-auto text-ui-xs text-ink-faint" aria-hidden="true">
        {state.tool === 'select' ? 'V' : state.tool === 'rect' ? 'M' : 'L'}
      </div>
    </div>
  )
}
