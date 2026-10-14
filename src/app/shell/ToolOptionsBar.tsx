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
  setToolShapeFill,
  setToolShapeMember,
  setToolTextAlign,
  setToolTextFill,
  setToolTextSize,
} from '../actions.ts'
import { ACTION_LABELS } from '../actions.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { useWorkspaceState } from '../../state/useWorkspaceState.ts'
import { toolOptionsModel, type ToolOptionControl } from '../ui/toolOptions.ts'
import { TOOL_OPTIONS_HEIGHT } from '../ui/theme.ts'

const SEGMENT_CLASS =
  'rounded-ui border px-2 py-[1px] text-ui-xs transition-colors disabled:opacity-40'
const ACTION_CLASS =
  'rounded-ui border border-hairline bg-chrome px-2 py-[1px] text-ui-xs text-ink hover:bg-chrome-active disabled:opacity-40 disabled:hover:bg-chrome'

function onSegmented(id: string, value: string) {
  if (id === 'shape.tool') setToolShapeMember(value === 'ellipse' ? 'ellipse' : 'rect')
  if (id === 'text.align') setToolTextAlign(value === 'center' ? 'center' : value === 'right' ? 'right' : 'left')
}

function onSwatches(id: string, color: string) {
  if (id === 'shape.fill') setToolShapeFill(color)
  if (id === 'text.fill') setToolTextFill(color)
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
        <span role="group" className="flex items-center gap-[2px]">
          {control.options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.active}
              title={option.title}
              className={`${SEGMENT_CLASS} ${
                option.active
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-hairline bg-chrome text-ink-muted hover:bg-chrome-active'
              }`}
              onClick={() => onSegmented(control.id, option.value)}
            >
              {option.label}
            </button>
          ))}
        </span>
      )
    case 'number':
      return (
        <label className="flex items-center gap-1 text-ui-xs text-ink-faint">
          {control.label}
          <input
            type="number"
            min={control.min}
            max={control.max}
            step={control.step}
            value={control.value}
            className="w-14 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
            onChange={(event) => setToolTextSize(Number(event.currentTarget.value))}
          />
        </label>
      )
    case 'swatches':
      return (
        <span role="group" aria-label={control.id === 'shape.fill' ? 'Fill colour' : 'Text colour'} className="flex items-center gap-[3px]">
          {control.colors.map((color) => (
            <button
              key={`${control.id}-${color}`}
              type="button"
              aria-pressed={control.active.toLowerCase() === color.toLowerCase()}
              title={color}
              aria-label={`${control.id === 'shape.fill' ? 'Fill' : 'Text colour'} ${color}`}
              className="h-4 w-4 rounded-ui border border-hairline"
              style={{
                background: color,
                outline: control.active.toLowerCase() === color.toLowerCase() ? '1px solid var(--color-accent)' : 'none',
                outlineOffset: '1px',
              }}
              onClick={() => onSwatches(control.id, color)}
            />
          ))}
        </span>
      )
    case 'action':
      return (
        <button
          type="button"
          disabled={!control.enabled}
          title={ACTION_LABELS[control.id]}
          className={ACTION_CLASS}
          onClick={() => runEditorAction(control.id)}
        >
          {ACTION_LABELS[control.id]}
        </button>
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
      className="flex shrink-0 items-center gap-2 overflow-hidden border-b border-hairline bg-chrome px-2"
      style={{ height: TOOL_OPTIONS_HEIGHT }}
    >
      {controls.map((control, index) => (
        <Control key={`${control.kind}-${index}`} control={control} />
      ))}
    </div>
  )
}
