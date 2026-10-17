/**
 * Color panel (issue #28, made functional in issue #16).
 *
 * Vectr's own palette plus the fills the document uses. Clicking a swatch applies it as the
 * fill of every selected shape or text object, through one `setStyle` command per node in one
 * transaction, so a color change is one undo step. The spectrum picker and the swatch library
 * are still planned.
 */

import { documentStore } from '../../state/documentStore.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { findNode, paintOrder } from '../../doc/document.ts'
import { supportsFill, type Document } from '../../doc/types.ts'

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

/** Applies a fill to the selection as one undo step. */
export function applyFill(color: string): void {
  const document = documentStore.getState().document
  const targets = documentStore
    .getState()
    .selection.map((id) => findNode(document, id))
    .filter((node) => node !== null && supportsFill(node))
  if (targets.length === 0) return

  documentStore.beginTransaction('apply fill')
  let changed = false
  for (const node of targets) {
    if (node === null || !supportsFill(node) || node.style.fill === color) continue
    const result = documentStore.dispatch(
      { type: 'setStyle', nodeId: node.id, style: { ...node.style, fill: color } },
      'apply fill',
    )
    if (result.ok) changed = true
  }
  if (changed) documentStore.commitTransaction()
  else documentStore.abortTransaction()
}

function SwatchList({
  title,
  entries,
  onPick,
}: {
  title: string
  entries: Array<{ name: string; color: string }>
  onPick: (color: string) => void
}) {
  return (
    <div className="px-2 py-1">
      <div className="pb-1 text-ui-xs text-ink-faint">{title}</div>
      <div className="grid grid-cols-6 gap-1">
        {entries.map((entry) => (
          <button
            key={`${title}-${entry.color}`}
            type="button"
            title={`${entry.name} ${entry.color}`}
            aria-label={`Apply ${entry.name} ${entry.color}`}
            className="h-5 w-full rounded-ui border border-hairline hover:border-accent"
            style={{ background: entry.color }}
            onClick={() => onPick(entry.color)}
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
  const hasSelection = state.selection.length > 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1">
      <SwatchList title="Vectr palette" entries={VECTR_PALETTE} onPick={applyFill} />
      {entries.length > 0 && (
        <SwatchList title={`In this document (${entries.length})`} entries={entries} onPick={applyFill} />
      )}
      <p className="border-t border-hairline px-2 pt-2 text-ui-xs text-ink-faint">
        {hasSelection
          ? 'Click a swatch to set the fill of the selection.'
          : 'Select a shape or text object, then click a swatch to set its fill.'}
      </p>
    </div>
  )
}

