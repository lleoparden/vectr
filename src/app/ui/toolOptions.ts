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
import { findNode, worldBounds, type ShapeKind } from '../../doc/document.ts'
import { isGroup, isText, type Document, type NodeId } from '../../doc/types.ts'
import type { CreationDefaults } from '../../state/workspaceStore.ts'

export type ToolId = ShapeKind | 'select' | 'directSelect' | 'lasso' | 'text' | 'hand' | 'artboard'
export type ToolGroupId = 'select' | 'lasso' | 'shape' | 'type' | 'hand' | 'artboard'

export type ToolMember = { tool: ToolId; label: string; action: EditorActionId }

export type ToolGroup = {
  id: ToolGroupId
  /** The group's own name, which the palette tooltip uses when it has several members. */
  label: string
  members: ToolMember[]
}

/**
 * The palette, grouped the way Illustrator's is. Rectangle, Rounded Rectangle, Ellipse, Line
 * Segment, Polygon, Star, and Arc share one slot: the button shows the member in use and the
 * flyout offers the rest. `M`, `L`, and `\` are Illustrator's own keys; Polygon, Star, and Arc
 * have no Illustrator defaults, so Vectr does not invent any.
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'select',
    label: 'Selection Tool',
    // Illustrator's top slot is the black/white arrow pair: Selection and Direct Selection share
    // one button with a flyout, and V/A are their keys.
    members: [
      { tool: 'select', label: 'Selection Tool', action: 'tool.select' },
      { tool: 'directSelect', label: 'Direct Selection Tool', action: 'tool.directSelect' },
    ],
  },
  // The Lasso keeps Illustrator's own palette slot and its Q key rather than joining the arrows.
  { id: 'lasso', label: 'Lasso Tool', members: [{ tool: 'lasso', label: 'Lasso Tool', action: 'tool.lasso' }] },
  {
    id: 'shape',
    label: 'Shape Tool',
    members: [
      { tool: 'rect', label: 'Rectangle Tool', action: 'tool.rect' },
      { tool: 'roundedRect', label: 'Rounded Rectangle Tool', action: 'tool.roundedRect' },
      { tool: 'ellipse', label: 'Ellipse Tool', action: 'tool.ellipse' },
      { tool: 'polygon', label: 'Polygon Tool', action: 'tool.polygon' },
      { tool: 'star', label: 'Star Tool', action: 'tool.star' },
      { tool: 'line', label: 'Line Segment Tool', action: 'tool.line' },
      { tool: 'arc', label: 'Arc Tool', action: 'tool.arc' },
    ],
  },
  { id: 'type', label: 'Type Tool', members: [{ tool: 'text', label: 'Type Tool', action: 'tool.text' }] },
  // Illustrator's Hand tool keeps its own slot and its H chord; Space reaches it temporarily.
  { id: 'hand', label: 'Hand Tool', members: [{ tool: 'hand', label: 'Hand Tool', action: 'tool.hand' }] },
  // Illustrator's Artboard tool keeps its own slot and its Shift+O chord.
  { id: 'artboard', label: 'Artboard Tool', members: [{ tool: 'artboard', label: 'Artboard Tool', action: 'tool.artboard' }] },
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
  | { kind: 'toggle'; id: string; label: string; active: boolean }
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

  if (tool === 'hand') {
    return [
      { kind: 'label', text: 'Hand Tool' },
      { kind: 'hint', text: 'Drag to move the view. Hold Space in any tool for the same hand.' },
    ]
  }

  if (tool === 'artboard') {
    return [
      { kind: 'label', text: 'Artboard Tool' },
      { kind: 'hint', text: 'Drag on the pasteboard to make a page; drag a handle on the active page to resize it.' },
    ]
  }

  if (tool === 'lasso') {
    return [
      { kind: 'label', text: 'Lasso Tool' },
      { kind: 'hint', text: 'Drag a freehand path to select every object it touches.' },
    ]
  }

  if (tool === 'select' || tool === 'directSelect') {
    const direct = tool === 'directSelect'
    const controls: ToolOptionControl[] = [{ kind: 'label', text: direct ? 'Direct Selection Tool' : 'Selection Tool' }]
    if (selection.length === 0) {
      controls.push({
        kind: 'hint',
        text: direct
          ? 'Nothing selected — click a nested object to select just it, or drag a marquee.'
          : 'Nothing selected — click an object, or drag a marquee.',
      })
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
      // Illustrator's Control panel offers the live corner radius of the selected rectangle, and
      // refuses to pretend an ellipse or a multi-selection has one (issue #64).
      const target = findNode(document, selection[0])
      if (target !== null && target.type === 'rect') {
        controls.push({
          kind: 'number',
          id: 'selection.cornerRadius',
          label: 'Corners',
          value: Math.round(target.cornerRadius),
          min: 0,
          max: Math.floor(Math.min(target.width, target.height) / 2),
          step: 1,
        })
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
    const shown = displayToolFor(group, tool, defaults) as ShapeKind
    const shortLabels: Record<ShapeKind, string> = {
      rect: 'Rectangle',
      roundedRect: 'Rounded',
      ellipse: 'Ellipse',
      polygon: 'Polygon',
      star: 'Star',
      line: 'Line',
      arc: 'Arc',
    }
    const controls: ToolOptionControl[] = [
      { kind: 'label', text: 'Shape Tool' },
      {
        kind: 'segmented',
        id: 'shape.tool',
        options: group.members.map((member) => ({
          value: member.tool,
          label: shortLabels[member.tool as ShapeKind],
          title: member.label,
          active: member.tool === shown,
        })),
      },
      { kind: 'separator' },
    ]
    // The controls the shown member actually uses, which is Illustrator's Control-panel habit:
    // the row changes with the tool, and every control changes what the next shape draws.
    const params = defaults.shape
    if (shown === 'roundedRect') {
      controls.push({
        kind: 'number',
        id: 'shape.cornerRadius',
        label: 'Corner radius',
        value: params.cornerRadius,
        min: 0,
        max: 500,
        step: 1,
      })
    }
    if (shown === 'polygon') {
      controls.push({ kind: 'number', id: 'shape.sides', label: 'Sides', value: params.sides, min: 3, max: 60, step: 1 })
    }
    if (shown === 'star') {
      controls.push({ kind: 'number', id: 'shape.points', label: 'Points', value: params.points, min: 3, max: 60, step: 1 })
      controls.push({
        kind: 'number',
        id: 'shape.innerRadius',
        label: 'Inner radius %',
        value: Math.round(params.innerRadius * 100),
        min: 5,
        max: 95,
        step: 5,
      })
    }
    if (shown === 'line') {
      controls.push({
        kind: 'number',
        id: 'shape.strokeWidth',
        label: 'Stroke weight',
        value: params.strokeWidth,
        min: 0.25,
        max: 100,
        step: 0.25,
      })
    }
    if (shown === 'arc') {
      controls.push({
        kind: 'number',
        id: 'shape.startAngle',
        label: 'Start angle',
        value: params.startAngle,
        min: -360,
        max: 360,
        step: 15,
      })
      controls.push({
        kind: 'number',
        id: 'shape.sweepAngle',
        label: 'Sweep',
        value: params.sweepAngle,
        min: -360,
        max: 360,
        step: 15,
      })
      controls.push({ kind: 'toggle', id: 'shape.pie', label: 'Pie', active: params.pie })
    }
    controls.push({ kind: 'separator' })
    controls.push({ kind: 'swatches', id: 'shape.fill', colors: TOOL_SWATCHES, active: params.fill })
    controls.push({ kind: 'hint', text: 'Shift constrains a square, a circle, or a 45° line.' })
    return controls
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

