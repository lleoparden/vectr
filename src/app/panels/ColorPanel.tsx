/**
 * Color panel (issue #28, made functional in #16, rebuilt in the UI pass).
 *
 * Three ways to set a colour, in the order people reach for them: an arbitrary colour (the same
 * control Properties uses, with the platform wheel, hex, and recent picks), the named Vectr palette,
 * and the colours this document already uses. Every pick is one undo step and applies live.
 */

import { findNode, paintOrder } from '../../doc/document.ts'
import { isLeaf, isText, supportsFill, type Document } from '../../doc/types.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { setSelectionFill } from '../actions.ts'
import { isLightColor, normalizeHex } from '../ui/color.ts'
import { ColorField, Section } from '../ui/fields.tsx'

/** The palette Vectr ships with, named so swatches stay readable in tests and docs. */
export const VECTR_PALETTE: Array<{ name: string; color: string }> = [
  { name: 'Violet', color: '#7c6cf5' },
  { name: 'Indigo', color: '#4f7cff' },
  { name: 'Teal', color: '#2fbf9f' },
  { name: 'Amber', color: '#e8a33d' },
  { name: 'Coral', color: '#e2665c' },
  { name: 'Rose', color: '#d5518d' },
  { name: 'Slate', color: '#5b6472' },
  { name: 'Ink', color: '#1e1e23' },
  { name: 'Paper', color: '#ffffff' },
]

/** Fills used in the document, in paint order and without duplicates. */
export function usedFillColors(document: Document): string[] {
  const seen = new Set<string>()
  for (const id of paintOrder(document)) {
    const node = findNode(document, id)
    if (node !== null && supportsFill(node)) seen.add(node.style.fill)
  }
  return [...seen]
}

/** Applies a fill to the selection as one undo step; joins an open live-edit session if there is one. */
export function applyFill(color: string): void {
  setSelectionFill(color)
}

function SwatchGrid({
  entries,
  active,
  onPick,
  labelFor,
}: {
  entries: Array<{ name: string; color: string }>
  active: string | null
  onPick: (color: string) => void
  labelFor: (entry: { name: string; color: string }) => string
}) {
  return (
    <div className="grid grid-cols-5 gap-1" role="group" aria-label="Colour swatches">
      {entries.map((entry) => {
        const selected = active !== null && normalizeHex(active) === normalizeHex(entry.color)
        return (
          <button
            key={`${entry.name}-${entry.color}`}
            type="button"
            title={`${entry.name} · ${entry.color}`}
            aria-label={labelFor(entry)}
            aria-pressed={selected}
            className={
              'relative flex h-6 w-full items-center justify-center rounded-ui border text-[9px] transition-transform hover:scale-[1.06] ' +
              (selected
                ? 'border-accent ring-1 ring-accent'
                : 'border-black/40 hover:border-accent/70')
            }
            style={{ background: entry.color }}
            onClick={() => onPick(entry.color)}
          >
            {selected && <span className={isLightColor(entry.color) ? 'text-black' : 'text-white'}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ColorPanel() {
  const state = useEditorState()
  const used = usedFillColors(state.document)
  const selected = state.selection
    .map((id) => findNode(state.document, id))
    .find((node) => node !== null && isLeaf(node) && supportsFill(node))
  const active = selected !== undefined && selected !== null && supportsFill(selected) ? selected.style.fill : null
  const hasSelection = state.selection.length > 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <Section title={selected !== undefined && selected !== null && isText(selected) ? 'Text colour' : 'Selection colour'}>
        <ColorField
          label="Colour"
          value={active ?? '#7c6cf5'}
          suggestions={used}
          onChange={(color) => setSelectionFill(color)}
        />
      </Section>

      <Section title="Vectr palette">
        <SwatchGrid
          entries={VECTR_PALETTE}
          active={active}
          onPick={applyFill}
          labelFor={(entry) => `Apply ${entry.name} ${entry.color}`}
        />
      </Section>

      {used.length > 0 && (
        <Section title={`In this document · ${used.length}`}>
          <SwatchGrid
            entries={used.map((color) => ({ name: color, color }))}
            active={active}
            onPick={applyFill}
            labelFor={(entry) => `Apply document colour ${entry.color}`}
          />
        </Section>
      )}

      <p className="px-2 pb-2 text-[10px] leading-snug text-ink-faint">
        {hasSelection
          ? 'Click a swatch to fill the selection.'
          : 'Select a shape or text object, then click a swatch to fill it.'}
      </p>
    </div>
  )
}
