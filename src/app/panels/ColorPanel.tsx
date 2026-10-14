/**
 * Color panel (issue #28).
 *
 * Vectr's own starting palette, plus the fills the document actually uses, so the
 * panel is useful while the picker and swatch editing wait for a later slice. The
 * colors are Vectr's; nothing here is sampled from another product.
 *
 * Not built yet: applying a color, the swatch library, and the spectrum picker.
 */

import { paintOrder, findNode } from '../../doc/document.ts'
import { isShape, type Document } from '../../doc/types.ts'
import { useEditorState } from '../../state/useEditorState.ts'

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
    if (node !== null && isShape(node)) seen.add(node.style.fill)
  }
  return [...seen]
}

function SwatchList({ title, entries }: { title: string; entries: Array<{ name: string; color: string }> }) {
  return (
    <div className="px-2 py-1">
      <div className="pb-1 text-ui-xs text-ink-faint">{title}</div>
      <div className="grid grid-cols-6 gap-1">
        {entries.map((entry) => (
          <span
            key={`${title}-${entry.color}`}
            title={`${entry.name} ${entry.color}`}
            className="h-5 w-full rounded-ui border border-hairline"
            style={{ background: entry.color }}
          />
        ))}
      </div>
    </div>
  )
}

export function ColorPanel() {
  const state = useEditorState()
  const used = usedFillColors(state.document)
  const entries = used.map((color) => ({ name: 'In document', color }))

  return (
    <div className="min-h-0 flex-1 overflow-auto py-1">
      <SwatchList title="Vectr palette" entries={VECTR_PALETTE} />
      {entries.length > 0 && <SwatchList title={`In this document (${entries.length})`} entries={entries} />}
      <p className="border-t border-hairline px-2 pt-2 text-ui-xs text-ink-faint">
        Applying color needs the style commands and arrives in a later slice.
      </p>
    </div>
  )
}
