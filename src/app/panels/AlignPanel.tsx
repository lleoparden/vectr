/**
 * The Align panel (Phase 4.4).
 *
 * Illustrator's six alignments and two distributions, where an Illustrator user reaches for them. The
 * buttons run the existing commands and are disabled exactly when those commands cannot act; the caption
 * states the reference the commands actually use (the selection's own box), because there is no key object
 * yet and a panel must not imply one.
 */

import { runEditorAction } from '../actions.ts'
import { alignAvailability } from '../editing/alignAvailability.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { ButtonRow, Section } from '../ui/components/fields.tsx'
import { Button } from '../ui/components/Button.tsx'

const ALIGN_BUTTONS: Array<{ action: 'object.alignLeft' | 'object.alignCenterH' | 'object.alignRight' | 'object.alignTop' | 'object.alignCenterV' | 'object.alignBottom'; label: string }> = [
  { action: 'object.alignLeft', label: 'Align left' },
  { action: 'object.alignCenterH', label: 'Align horizontal centres' },
  { action: 'object.alignRight', label: 'Align right' },
  { action: 'object.alignTop', label: 'Align top' },
  { action: 'object.alignCenterV', label: 'Align vertical centres' },
  { action: 'object.alignBottom', label: 'Align bottom' },
]

const DISTRIBUTE_BUTTONS: Array<{ action: 'object.distributeH' | 'object.distributeV'; label: string }> = [
  { action: 'object.distributeH', label: 'Distribute horizontal centres' },
  { action: 'object.distributeV', label: 'Distribute vertical centres' },
]

export function AlignPanel() {
  const state = useEditorState()
  const availability = alignAvailability(state.document, state.selection)
  return (
    <div data-panel-body="align" className="flex flex-col gap-2 p-2">
      <Section title="Align">
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_BUTTONS.map((button) => (
            <Button
              key={button.action}
              label={button.label}
              disabled={!availability.align}
              onClick={() => runEditorAction(button.action)}
              >
              {button.label.replace('Align ', '')}
            </Button>
          ))}
        </div>
      </Section>
      <Section title="Distribute">
        <ButtonRow>
          {DISTRIBUTE_BUTTONS.map((button) => (
            <Button
              key={button.action}
              aria-label={button.label}
              disabled={!availability.distribute}
              onClick={() => runEditorAction(button.action)}
            >
              {button.label.replace('Distribute ', '')}
            </Button>
          ))}
        </ButtonRow>
      </Section>
      <p className="px-2 text-[10px] leading-snug text-ink-faint">
        Aligns inside the selection's own box. A key object and aligning to the artboard come with the
        boolean slice; the commands here never claim them.
      </p>
    </div>
  )
}
