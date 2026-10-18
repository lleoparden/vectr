/**
 * Tool palette (issue #28, grouped by owner request after Phase 1).
 *
 * Illustrator's docked left column, one *group* per slot, with the tool's letter as its tooltip so
 * the keyboard map is discoverable where Illustrator puts it. The Rectangle and Ellipse tools now
 * share one slot the way Illustrator's shape tools do: the button shows the member in use (or the
 * one last picked) and a corner flyout offers the others, the same affordance the shape row of the
 * tool options bar provides. Only tools that exist are listed; the palette does not reserve greyed
 * slots for tools Vectr has not built.
 */

import { useEffect, useRef, useState } from 'react'
import { runEditorAction } from '../actions.ts'
import {
  IconArc,
  IconDirectSelect,
  IconEllipse,
  IconLasso,
  IconLine,
  IconPolygon,
  IconRect,
  IconRoundedRect,
  IconSelect,
  IconStar,
  IconType,
  IconHand,
  IconZoom,
} from '../ui/icons.tsx'
import { shortcutLabel } from '../menus/shortcuts.ts'
import { PALETTE_WIDTH, TOOL_BUTTON_SIZE } from '../ui/theme.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { TOOL_GROUPS, displayToolFor, memberFor, type ToolId } from '../ui/toolOptions.ts'

const ICONS: Record<ToolId, typeof IconSelect> = {
  select: IconSelect,
  directSelect: IconDirectSelect,
  lasso: IconLasso,
  rect: IconRect,
  roundedRect: IconRoundedRect,
  ellipse: IconEllipse,
  polygon: IconPolygon,
  star: IconStar,
  line: IconLine,
  arc: IconArc,
  text: IconType,
  hand: IconHand,
  zoom: IconZoom,
}

export function ToolPalette() {
  const state = useEditorState()
  const workspace = useWorkspaceState()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openGroup === null) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenGroup(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroup(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openGroup])

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="flex shrink-0 flex-col items-center gap-[3px] border-r border-hairline bg-chrome-sunken py-2 shadow-[1px_0_0_rgba(0,0,0,0.2)]"
      style={{ width: PALETTE_WIDTH }}
    >
      {TOOL_GROUPS.map((group) => {
        const display = displayToolFor(group, state.tool, workspace.creationDefaults)
        const member = memberFor(display)
        const Icon = ICONS[display]
        const active = state.tool === display
        const chord = shortcutLabel(member.action)
        const hasFlyout = group.members.length > 1
        const label = hasFlyout ? `${group.label}: ${member.label}` : member.label
        return (
          <div key={group.id} className="relative">
            <button
              type="button"
              data-tool-slot={group.id}
              aria-pressed={active}
              aria-label={chord === null ? label : `${label} (${chord})`}
              title={chord === null ? label : `${label} (${chord})`}
              onClick={() => runEditorAction(member.action)}
              onContextMenu={(event) => {
                if (!hasFlyout) return
                event.preventDefault()
                setOpenGroup(openGroup === group.id ? null : group.id)
              }}
              className={`flex items-center justify-center rounded-ui ${
                active ? 'bg-accent text-white shadow-[0_1px_5px_rgba(124,108,245,0.38)]' : 'text-ink-muted hover:bg-chrome-hover hover:text-ink'
              }`}
              style={{ width: TOOL_BUTTON_SIZE, height: TOOL_BUTTON_SIZE }}
            >
              <Icon size={16} />
            </button>
            {hasFlyout && (
              <button
                type="button"
                data-tool-flyout={group.id}
                aria-haspopup="menu"
                aria-expanded={openGroup === group.id}
                aria-label={`${group.label} options`}
                title={`${group.label} options`}
                className="absolute bottom-0 right-0 flex h-[10px] w-[10px] items-end justify-end pr-[1px] text-ink-muted hover:text-ink"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenGroup(openGroup === group.id ? null : group.id)
                }}
              >
                <span
                  aria-hidden="true"
                  className="block h-0 w-0 border-b-[4px] border-l-[4px] border-b-current border-l-transparent"
                />
              </button>
            )}
            {openGroup === group.id && (
              <div
                role="menu"
                aria-label={group.label}
                className="absolute left-full top-0 z-40 ml-[3px] min-w-[176px] rounded-ui border border-hairline bg-chrome-raised py-1 shadow-lg shadow-black/40"
              >
                {group.members.map((candidate) => {
                  const MemberIcon = ICONS[candidate.tool]
                  const memberChord = shortcutLabel(candidate.action)
                  return (
                    <button
                      key={candidate.tool}
                      type="button"
                      role="menuitemradio"
                      data-tool-member={candidate.tool}
                      aria-checked={candidate.tool === display}
                      className="flex w-full items-center justify-between gap-4 px-2 py-[3px] text-left text-ui-xs text-ink hover:bg-accent-soft"
                      onClick={() => {
                        runEditorAction(candidate.action)
                        setOpenGroup(null)
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <MemberIcon size={14} />
                        {candidate.label}
                      </span>
                      {memberChord !== null && <span className="text-ui-xs text-ink-faint">{memberChord}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
