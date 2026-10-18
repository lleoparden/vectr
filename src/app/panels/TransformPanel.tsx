/**
 * The Transform panel (Phase 4.4).
 *
 * X, Y, W, H, and rotation for the selection, on the same commands the Properties panel uses. The values
 * are live: a typed number applies while it is typed, and one field session is one undo entry.
 */

import { NumberField, Section } from '../ui/fields.tsx'
import { setSelectionBounds, setSelectionRotation } from '../actions.ts'
import { selectionTransform } from '../editing/selectionTransform.ts'
import { useEditorState } from '../../state/useEditorState.ts'

export function TransformPanel() {
  const state = useEditorState()
  const { box, rotation } = selectionTransform(state.document, state.selection)
  if (box === null) {
    return (
      <div data-panel-body="transform" className="p-2">
        <p className="text-ui-xs text-ink-faint">Nothing selected.</p>
      </div>
    )
  }
  return (
    <div data-panel-body="transform" className="flex flex-col gap-2 p-2">
      <Section title="Position">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="X" value={box.x} onChange={(x) => setSelectionBounds({ x })} />
          <NumberField label="Y" value={box.y} onChange={(y) => setSelectionBounds({ y })} />
        </div>
      </Section>
      <Section title="Size">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="W" value={box.width} min={1} onChange={(width) => setSelectionBounds({ width })} />
          <NumberField label="H" value={box.height} min={1} onChange={(height) => setSelectionBounds({ height })} />
        </div>
      </Section>
      <Section title="Rotate">
        <NumberField
          label="Angle"
          value={Math.round(rotation)}
          min={-360}
          max={360}
          step={15}
          suffix="°"
          onChange={(degrees) => setSelectionRotation(degrees)}
        />
      </Section>
    </div>
  )
}
