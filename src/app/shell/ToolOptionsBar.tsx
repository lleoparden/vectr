/**
 * Tool options bar (owner request after Phase 1).
 *
 * Illustrator's horizontal Control panel under the menu bar, in Vectr's own chrome: it changes with
 * the active tool, so the shape tool shows its member switch and the fill for the next shape, the
 * Type tool shows size, alignment and colour, and the Selection tool shows the object's numbers and
 * the commands that act on it. The contents come from `toolOptionsModel`, which is pure and tested;
 * this component only draws them and calls the matching handler.
 */

import {
  canRunAction,
  runEditorAction,
  setSelectionCornerRadius,
  setToolShapeFill,
  setToolShapeMember,
  setToolShapeParam,
  setToolTextAlign,
  setToolTextFill,
  setToolTextSize,
} from '../actions.ts'
import { ACTION_LABELS } from '../actions.ts'
import { SegmentButton } from '../ui/components/SegmentButton.tsx'
import { SwatchTile } from '../ui/components/SwatchTile.tsx'
import { NumberField } from '../ui/components/fields.tsx'
import { Button } from '../ui/components/Button.tsx'
import { useEditorState } from '../../state/useEditorState.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { toolOptionsModel, groupFor, type ToolOptionControl } from '../ui/toolOptions.ts'
import type { ShapeKind } from '../../doc/document.ts'
import { TOOL_OPTIONS_HEIGHT } from '../ui/theme.ts'
import { IconImage } from '../ui/icons.tsx'

const SEGMENT_CLASS =
  'rounded-ui border px-2 py-[1px] text-ui-xs transition-colors disabled:opacity-40'
const ACTION_CLASS =
  'rounded-ui border border-hairline bg-chrome px-2 py-[1px] text-ui-xs text-ink hover:bg-chrome-active disabled:opacity-40 disabled:hover:bg-chrome'

function onSegmented(id: string, value: string) {
  if (id === 'shape.tool') {
    // Every shape member activates through the same path, so the palette slot, the flyout, and
    // the keyboard shortcuts all agree about which shape is in use.
    const member = groupFor('rect').members.find((candidate) => candidate.tool === value)
    if (member === undefined) return
    setToolShapeMember(member.tool as ShapeKind)
  }
  if (id === 'text.align') setToolTextAlign(value === 'center' ? 'center' : value === 'right' ? 'right' : 'left')
}

function onSwatches(id: string, color: string) {
  if (id === 'shape.fill') setToolShapeFill(color)
  if (id === 'text.fill') setToolTextFill(color)
}

/** The shape row's numeric fields and switches, all of them setting what the next shape draws. */
function onShapeNumber(id: string, value: number) {
  switch (id) {
    case 'shape.cornerRadius':
      setToolShapeParam({ cornerRadius: value })
      return
    case 'shape.sides':
      setToolShapeParam({ sides: value })
      return
    case 'shape.points':
      setToolShapeParam({ points: value })
      return
    case 'shape.innerRadius':
      // The field shows a percentage; the model stores the fraction.
      setToolShapeParam({ innerRadius: value / 100 })
      return
    case 'shape.strokeWidth':
      setToolShapeParam({ strokeWidth: value })
      return
    case 'shape.startAngle':
      setToolShapeParam({ startAngle: value })
      return
    case 'shape.sweepAngle':
      setToolShapeParam({ sweepAngle: value })
      return
    case 'selection.cornerRadius':
      // The selected rectangle's live corner, not the next shape's (issue #64).
      setSelectionCornerRadius(value)
      return
    default:
      setToolTextSize(value)
  }
}

function onToggle(id: string, active: boolean) {
  if (id === 'shape.pie') setToolShapeParam({ pie: !active })
}

function Control({ control }: { control: ToolOptionControl }) {
  switch (control.kind) {
    case 'label':
      return <span className="text-ui-xs text-ink-muted">{control.text}</span>
    case 'hint':
      return <span className="text-ui-xs text-ink-faint">{control.text}</span>
    case 'separator':
      return <span aria-hidden="true" className="mx-1 h-4 w-px bg-hairline" />
    case 'readout':
      return (
        <span data-tool-readout={control.label} className="text-ui-xs text-ink-faint">
          {control.label} <span className="text-ink-muted">{control.value}</span>
        </span>
      )
    case 'segmented':
      return (
        <span role="group" className="flex shrink-0 items-center gap-[2px] rounded-ui bg-chrome-sunken p-[2px]">
          {control.options.map((option) => (
            <SegmentButton
              key={option.value}
              active={option.active}
              title={option.title}
              onClick={() => onSegmented(control.id, option.value)}
            >
              {option.label}
            </SegmentButton>
          ))}
        </span>
      )
    case 'number':
      return (
        <label className="flex items-center gap-1 text-ui-xs text-ink-faint">
          {control.label}
          <NumberField
            inline
            label={control.label}
            min={control.min}
            max={control.max}
            step={control.step}
            value={control.value}
            onChange={(value) => onShapeNumber(control.id, value)}
          />
        </label>
      )
    case 'toggle':
      return (
        <SegmentButton active={control.active} onClick={() => onToggle(control.id, control.active)}>
          {control.label}
        </SegmentButton>
      )
    case 'swatches':
      return (
        <span role="group" aria-label={control.id === 'shape.fill' ? 'Fill colour' : 'Text colour'} className="flex items-center gap-[3px]">
          {control.colors.map((color) => (
            <span key={`${control.id}-${color}`} className="w-4">
              <SwatchTile
                color={color}
                label={`${control.id === 'shape.fill' ? 'Fill' : 'Text colour'} ${color}`}
                title={color}
                size="sm"
                selected={control.active.toLowerCase() === color.toLowerCase()}
                onPick={() => onSwatches(control.id, color)}
              />
            </span>
          ))}
        </span>
      )
    case 'action':
      return (
        <SegmentButton
          disabled={!control.enabled}
          title={ACTION_LABELS[control.id]}
          onClick={() => runEditorAction(control.id)}
        >
          {ACTION_LABELS[control.id]}
        </SegmentButton>
      )
  }
}

export function ToolOptionsBar() {
  const state = useEditorState()
  const workspace = useWorkspaceState()
  const controls = toolOptionsModel({
    tool: state.tool,
    selection: state.selection,
    document: state.document,
    defaults: workspace.creationDefaults,
    canRun: (id) => canRunAction(id, state),
  })

  return (
    <div
      role="toolbar"
      aria-label="Tool options"
      data-tool-options={state.tool === 'rect' || state.tool === 'ellipse' ? 'shape' : state.tool}
      className="flex shrink-0 items-center gap-2 overflow-hidden border-b border-hairline bg-chrome-raised px-2 shadow-[0_1px_0_rgba(0,0,0,0.24)]"
      style={{ height: TOOL_OPTIONS_HEIGHT }}
    >
      {controls.map((control, index) => (
        <Control key={`${control.kind}-${index}`} control={control} />
      ))}
      <span className="ml-auto flex items-center" role="group" aria-label="Place image">
        <Button
          variant="dialog"
          data={{ 'data-place-image': '' }}
          title="Place embedded image"
          icon={<IconImage size={14} />}
          className="rounded-r-none rounded-l-ui"
          onClick={() => runEditorAction('file.place')}
        >
          Place image
        </Button>
        <Button
          variant="dialog"
          data={{ 'data-place-linked-image': '' }}
          title="Place linked image"
          className="-ml-px rounded-l-none rounded-r-ui"
          onClick={() => runEditorAction('file.placeLinked')}
        >
          Link
        </Button>
      </span>
    </div>
  )
}
