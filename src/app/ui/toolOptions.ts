/**
 * Tool groups and the tool options model (owner request after Phase 1).
 *
 * Illustrator's tools are grouped: the Rectangle tool and the Ellipse tool are two members of one
 * palette slot with a flyout, and the horizontal bar under the menu bar changes with the active
 * tool — the Control panel. Both ideas live here as data, so the palette and the bar cannot
 * disagree about which tools exist, what a group is called, or which controls a tool shows.
 *
 * The model is pure: given the active tool, the selection, the document, and the creation defaults,
 * it returns the list of controls to render. The component only draws them, which keeps this
 * testable without a browser.
 */

import type { EditorActionId } from '../actions.ts'
import { worldBounds } from '../../doc/document.ts'
import { isGroup, isText, type Document, type NodeId } from '../../doc/types.ts'
import type { CreationDefaults } from '../../state/workspaceStore.ts'

export type ToolId = 'select' | 'rect' | 'ellipse' | 'text'
export type ToolGroupId = 'select' | 'shape' | 'text'

export type ToolMember = { tool: ToolId; label: string; action: EditorActionId }

export type ToolGroup = {
  id: ToolGroupId
  /** The group's own name, which the palette tooltip uses when it has several members. */
  label: string
  members: ToolMember[]
}

/**
 * The palette, grouped. Rectangle and Ellipse share one slot the way Illustrator's shape tools do:
 * the button shows one member and its flyout offers the rest, and the options bar carries the same
 * switch as a segmented control.
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'select',
    label: 'Selection Tool',
    members: [{ tool: 'select', label: 'Selection Tool', action: 'tool.select' }],
  },
  {
    id: 'shape',
    label: 'Shape Tool',
    members: [
      { tool: 'rect', label: 'Rectangle Tool', action: 'tool.rect' },
      { tool: 'ellipse', label: 'Ellipse Tool', action: 'tool.ellipse' },
    ],
  },
  { id: 'text', label: 'Type Tool', members: [{ tool: 'text', label: 'Type Tool', action: 'tool.text' }] },
]

export function groupFor(tool: ToolId): ToolGroup {
  const group = TOOL_GROUPS.find((candidate) => candidate.members.some((member) => member.tool === tool))
  if (group === undefined) throw new Error(`No tool group holds ${tool}`)
  return group
}

export function memberFor(tool: ToolId): ToolMember {
  const member = groupFor(tool).members.find((candidate) => candidate.tool === tool)
  if (member === undefined) throw new Error(`No member matches ${tool}`)
  return member
}

/**
 * Which member a group's palette button shows. An active group shows the tool in use; an inactive
 * group shows the member it remembers, which is how Illustrator keeps the shape you last picked.
 */
export function displayToolFor(group: ToolGroup, activeTool: ToolId, defaults: CreationDefaults): ToolId {
  if (group.members.some((member) => member.tool === activeTool)) return activeTool
  if (group.id === 'shape') return defaults.shapeTool
  return group.members[0].tool
}

export type ToolOptionControl =
  | { kind: 'label'; text: string }
  | { kind: 'hint'; text: string }
  | { kind: 'separator' }
  | {
      kind: 'segmented'
      id: string
      options: Array<{ value: string; label: string; title: string; active: boolean }>
    }
  | { kind: 'number'; id: string; label: string; value: number; min: number; max: number; step: number }
  | { kind: 'readout'; label: string; value: string }
  | { kind: 'swatches'; id: string; colors: string[]; active: string }
  | { kind: 'action'; id: EditorActionId; enabled: boolean }

/** The quick colours the bar offers, so the shape and text controls cannot drift apart. */
export const TOOL_SWATCHES = ['#1e1e23', '#ffffff', '#4f7cff', '#7c6cf5', '#2fbf9f', '#e8a33d', '#e2665c']

export type ToolOptionsInput = {
  tool: ToolId
  selection: NodeId[]
  document: Document
  defaults: CreationDefaults
  canRun: (id: EditorActionId) => boolean
}

/** True when a text object is selected, so the text controls edit it instead of the defaults. */
export function hasSelectedText(document: Document, selection: NodeId[]): boolean {
  const find = (nodes: Document['root']['children']): boolean =>
    nodes.some((node) => (selection.includes(node.id) && isText(node)) || (isGroup(node) && find(node.children)))
  return find(document.root.children)
}

/** The controls the bar shows for the active tool. */
export function toolOptionsModel(input: ToolOptionsInput): ToolOptionControl[] {
  const { tool, selection, document, defaults, canRun } = input
  const group = groupFor(tool)

  if (tool === 'select') {
    const controls: ToolOptionControl[] = [{ kind: 'label', text: 'Selection Tool' }]
    if (selection.length === 0) {
      controls.push({ kind: 'hint', text: 'Nothing selected — click an object, or drag a marquee.' })
      return controls
    }
    controls.push({
      kind: 'label',
      text: selection.length === 1 ? '1 object selected' : `${selection.length} objects selected`,
    })
    if (selection.length === 1) {
      const bounds = worldBounds(document, selection[0])
      if (bounds !== null) {
        const round = (value: number) => String(Math.round(value))
        controls.push({ kind: 'readout', label: 'X', value: round(bounds.x) })
        controls.push({ kind: 'readout', label: 'Y', value: round(bounds.y) })
        controls.push({ kind: 'readout', label: 'W', value: round(bounds.width) })
        controls.push({ kind: 'readout', label: 'H', value: round(bounds.height) })
      }
    }
    controls.push({ kind: 'separator' })
    for (const id of ['object.duplicate', 'object.group', 'object.ungroup'] as EditorActionId[]) {
      controls.push({ kind: 'action', id, enabled: canRun(id) })
    }
    controls.push({ kind: 'separator' })
    for (const id of ['object.arrangeFront', 'object.arrangeBack'] as EditorActionId[]) {
      controls.push({ kind: 'action', id, enabled: canRun(id) })
    }
    controls.push({ kind: 'separator' })
    for (const id of ['object.hideSelection', 'object.lockSelection', 'edit.clear'] as EditorActionId[]) {
      controls.push({ kind: 'action', id, enabled: canRun(id) })
    }
    return controls
  }

  if (group.id === 'shape') {
    // The switch marks the tool in use, or the member last picked while another tool is active.
    const shown = displayToolFor(group, tool, defaults)
    return [
      { kind: 'label', text: 'Shape Tool' },
      {
        kind: 'segmented',
        id: 'shape.tool',
        options: group.members.map((member) => ({
          value: member.tool,
          label: member.tool === 'rect' ? 'Rectangle' : 'Ellipse',
          title: member.label,
          active: member.tool === shown,
        })),
      },
      { kind: 'separator' },
      { kind: 'swatches', id: 'shape.fill', colors: TOOL_SWATCHES, active: defaults.shapeFill },
      { kind: 'readout', label: 'Stroke', value: 'none' },
    ]
  }

  const editingSelection = hasSelectedText(document, selection)
  return [
    { kind: 'label', text: 'Type Tool' },
    { kind: 'number', id: 'text.size', label: 'Size', value: defaults.textFontSize, min: 1, max: 1000, step: 1 },
    {
      kind: 'segmented',
      id: 'text.align',
      options: (['left', 'center', 'right'] as const).map((align) => ({
        value: align,
        label: align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right',
        title: `Horizontal Align ${align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}`,
        active: defaults.textAlign === align,
      })),
    },
    { kind: 'separator' },
    { kind: 'swatches', id: 'text.fill', colors: TOOL_SWATCHES, active: defaults.textFill },
    { kind: 'separator' },
    {
      kind: 'hint',
      text: editingSelection
        ? 'These settings apply to the selected text.'
        : 'These settings apply to the next text object.',
    },
  ]
}

