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
import { ToolFlyoutCorner, ToolMemberRow, ToolSlot } from '../ui/components/ToolSlot.tsx'
import { MenuSurface } from '../ui/components/Menu.tsx'
import { runEditorAction } from '../actions.ts'
import {
  IconArc,
  IconDirectSelect,
  IconEllipse,
  IconLasso,
  IconLine,
  IconPen,
  IconShapeBuilder,
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
  pen: IconPen,
  shapeBuilder: IconShapeBuilder,
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
            <ToolSlot
              icon={Icon}
              label={chord === null ? label : `${label} (${chord})`}
              active={active}
              size={TOOL_BUTTON_SIZE}
              slotId={group.id}
              onClick={() => runEditorAction(member.action)}
              onContextMenu={(event) => {
                if (!hasFlyout) return
                event.preventDefault()
                setOpenGroup(openGroup === group.id ? null : group.id)
              }}
            />
            {hasFlyout && (
              <ToolFlyoutCorner
                label={`${group.label} options`}
                open={openGroup === group.id}
                slotId={group.id}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenGroup(openGroup === group.id ? null : group.id)
                }}
              />
            )}
            {openGroup === group.id && (
              <MenuSurface label={group.label} className="left-full top-0 ml-[3px] min-w-[176px]">
                {group.members.map((candidate) => {
                  const MemberIcon = ICONS[candidate.tool]
                  const memberChord = shortcutLabel(candidate.action)
                  return (
                    <ToolMemberRow
                      key={candidate.tool}
                      icon={MemberIcon}
                      label={candidate.label}
                      chord={memberChord}
                      checked={candidate.tool === display}
                      toolId={candidate.tool}
                      onClick={() => {
                        runEditorAction(candidate.action)
                        setOpenGroup(null)
                      }}
                    />
                  )
                })}
              </MenuSurface>
            )}
          </div>
        )
      })}
    </div>
  )
}
