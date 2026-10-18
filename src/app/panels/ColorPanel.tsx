/**
 * Color panel (issue #28, made functional in #16, rebuilt in the UI pass).
 *
 * Three ways to set a colour, in the order people reach for them: an arbitrary colour (the same
 * control Properties uses, with the platform wheel, hex, and recent picks), the named Vectr palette,
 * and the colours this document already uses. Every pick is one undo step and applies live.
 */

import { findNode, paintOrder } from '../../doc/document.ts'
import { BRAND } from '../ui/brand.ts'
import { isLeaf, isText, supportsFill, type Document } from '../../doc/types.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { addCmykSwatch, addSwatchFromSelection, applySwatch, removeSwatch, setSelectionFill } from '../actions.ts'
import { isLightColor, normalizeHex } from '../../geom/color.ts'
import { ColorField, NumberField, Section } from '../ui/components/fields.tsx'
import { Button } from '../ui/components/Button.tsx'
import { ListItem } from '../ui/components/ListItem.tsx'
import { SwatchTile } from '../ui/components/SwatchTile.tsx'
import { useState } from 'react'

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
          <SwatchTile
            key={`${entry.name}-${entry.color}`}
            color={entry.color}
            label={labelFor(entry)}
            title={`${entry.name} · ${entry.color}`}
            selected={selected}
            onPick={() => onPick(entry.color)}
          />
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
          value={active ?? BRAND.roseVale}
          suggestions={used}
          onChange={(color) => setSelectionFill(color)}
        />
      </Section>

      <SwatchesSection swatches={state.document.swatches ?? []} />

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

/**
 * Named swatches (issue #69): the document's own colours, each with a name, the CMYK values a person
 * entered (or the conversion of the RGB), and an optional spot flag. Applying one sets the fill; the
 * colours already on objects are untouched by deleting a swatch, which is what deleting a *name* should
 * mean.
 */
function SwatchesSection({ swatches }: { swatches: Array<{ id: string; name: string; color: string; cmyk?: { c: number; m: number; y: number; k: number }; spot?: boolean }> }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'fill' | 'cmyk'>('fill')
  const [spot, setSpot] = useState(false)
  const [cmyk, setCmyk] = useState({ c: 0, m: 60, y: 100, k: 0 })

  const add = () => {
    if (name.trim().length === 0) return
    if (mode === 'fill') addSwatchFromSelection(name)
    else addCmykSwatch(name, cmyk, spot)
    setName('')
  }

  return (
    <Section title={swatches.length > 0 ? 'Swatches · ' + swatches.length : 'Swatches'}>
      {swatches.length > 0 && (
        <div className="flex flex-col gap-0.5" role="list" aria-label="Named swatches">
          {swatches.map((swatch) => (
            <div key={swatch.id} role="listitem" className="flex min-w-0 items-center gap-1">
              <ListItem label={'Apply swatch ' + swatch.name} onClick={() => applySwatch(swatch.id)}>
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-[2px] border border-black/40" style={{ background: swatch.color }} />
                <span className="min-w-0 flex-1 truncate">{swatch.name}</span>
                {swatch.spot === true && <span className="shrink-0 rounded-full bg-accent-soft px-1 text-[9px] text-accent-ink">spot</span>}
                {swatch.cmyk !== undefined && (
                  <span className="shrink-0 tabular-nums text-[9px] text-ink-faint">
                    {swatch.cmyk.c}/{swatch.cmyk.m}/{swatch.cmyk.y}/{swatch.cmyk.k}
                  </span>
                )}
              </ListItem>
              <Button
                variant="danger"
                label={'Remove swatch ' + swatch.name}
                title="Remove swatch (objects keep their colour)"
                onClick={() => removeSwatch(swatch.id)}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 pt-1">
        <div className="flex min-w-0 items-center gap-1">
          <input
            type="text"
            aria-label="Swatch name"
            placeholder="New swatch name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') add()
            }}
            className="h-6 min-w-0 flex-1 rounded-ui border border-hairline bg-chrome-sunken px-1.5 text-ui-xs text-ink outline-none focus:border-accent"
          />
          <select
            aria-label="Swatch colour model"
            value={mode}
            onChange={(event) => setMode(event.currentTarget.value === 'cmyk' ? 'cmyk' : 'fill')}
            className="h-6 shrink-0 rounded-ui border border-hairline bg-chrome-sunken px-1 text-ui-xs text-ink outline-none focus:border-accent"
          >
            <option value="fill">From fill</option>
            <option value="cmyk">CMYK</option>
          </select>
        </div>
        {mode === 'cmyk' && (
          <div className="flex items-center gap-1">
            {(['c', 'm', 'y', 'k'] as const).map((key) => (
              <NumberField
                key={key}
                inline
                label={'Swatch ' + key.toUpperCase()}
                min={0}
                max={100}
                step={1}
                value={cmyk[key]}
                onChange={(value) => setCmyk({ ...cmyk, [key]: value })}
              />
            ))}
            <label className="flex shrink-0 items-center gap-1 text-[10px] text-ink-faint">
              <input type="checkbox" checked={spot} onChange={(event) => setSpot(event.currentTarget.checked)} />
              spot
            </label>
          </div>
        )}
        <Button variant="primary" disabled={name.trim().length === 0} onClick={add}>
          Add swatch
        </Button>
      </div>
    </Section>
  )
}
