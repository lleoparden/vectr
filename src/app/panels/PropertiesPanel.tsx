/**
 * Properties panel (issue #28).
 *
 * Read-only for now: it reports what is selected and where it is, using the document
 * model's own world bounds. Editing values needs new commands that arrive with the
 * transform work in #20 and later, and the UI direction prefers an honest read-only
 * panel over inert-looking editable fields.
 */

import { findNode, worldBounds } from '../../doc/document.ts'
import { isGroup, isImage, isText, nodeSize } from '../../doc/types.ts'
import { documentStore } from '../../state/documentStore.ts'
import { assetRegistry } from '../../state/assetRegistry.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { DEFAULT_FONT_FAMILY } from '../../doc/document.ts'
import { formatByteLength } from '../../doc/assets.ts'
import { artboardList, relinkImageFromDialog, runEditorAction, setActiveArtboard, setActiveArtboardSize, setImageMaskFromDialog, setSelectionBounds, setSelectionCornerRadius, setSelectionFill, setSelectionStroke } from '../actions.ts'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-2 py-[3px]">
      <span className="text-ui-xs text-ink-faint">{label}</span>
      <span className="truncate text-ui-xs text-ink-muted">{value}</span>
    </div>
  )
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function CropInput({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-ui-xs text-ink-faint">
      {label}
      <input
        type="number"
        min={0}
        max={1}
        step={0.01}
        defaultValue={round(value)}
        className="w-12 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
        onBlur={(event) => onCommit(Number(event.currentTarget.value))}
      />
    </label>
  )
}

/** One editable X/Y/W/H field; committing on blur keeps a typed value from being one edit per keystroke. */
function BoxField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-ui-xs text-ink-faint">
      {label}
      <input
        type="number"
        step={1}
        defaultValue={round(value)}
        aria-label={`${label} of the selection`}
        className="w-14 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
        onBlur={(event) => onCommit(Number(event.currentTarget.value))}
      />
    </label>
  )
}

export function PropertiesPanel() {
  const state = useEditorState()
  const id = state.selection[0]
  const node = id === undefined ? null : findNode(state.document, id)
  const bounds = id === undefined ? null : worldBounds(state.document, id)

  if (node === null || id === undefined) {
    // With nothing selected the panel shows the document's pages (Phase 2.4, issue #67). Illustrator
    // keeps them in their own Artboards panel; Vectr puts them here for now, a recorded divergence.
    const pages = artboardList()
    const active = pages.find((page) => page.active) ?? pages[0]
    return (
      <div className="min-h-0 flex-1 overflow-auto py-1">
        <p className="px-2 pb-1 text-ui-xs text-ink-faint">No selection.</p>
        <p className="px-2 py-[3px] text-ui-xs text-ink-muted">Artboards</p>
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            aria-pressed={page.active}
            onClick={() => setActiveArtboard(page.id)}
            className={"flex w-full items-center justify-between gap-2 px-2 py-[3px] text-left text-ui-xs " + (page.active ? "bg-accent-soft text-ink" : "text-ink-muted hover:bg-chrome-hover")}
          >
            <span className="truncate">{page.name}</span>
            <span className="text-ink-faint">
              {page.width}×{page.height}
            </span>
          </button>
        ))}
        {active !== undefined && (
          <div className="grid grid-cols-2 gap-1 px-2 py-1">
            <BoxField label="W" value={active.width} onCommit={(width) => setActiveArtboardSize({ width })} />
            <BoxField label="H" value={active.height} onCommit={(height) => setActiveArtboardSize({ height })} />
          </div>
        )}
        <div className="flex gap-2 px-2 py-1">
          <button
            type="button"
            className="rounded-ui border border-hairline px-2 py-1 text-ui-xs text-ink hover:bg-chrome-hover"
            onClick={() => runEditorAction('artboard.new')}
          >
            New Artboard
          </button>
          <button
            type="button"
            className="rounded-ui border border-hairline px-2 py-1 text-ui-xs text-ink hover:bg-chrome-hover disabled:opacity-40"
            disabled={pages.length <= 1}
            onClick={() => runEditorAction('artboard.delete')}
          >
            Delete Artboard
          </button>
        </div>
      </div>
    )
  }

  const size = nodeSize(node)
  return (
    <div className="min-h-0 flex-1 overflow-auto py-1">
      <Row label="Name" value={node.name} />
      <Row label="Kind" value={isText(node) ? 'text' : isGroup(node) ? `group of ${node.children.length}` : node.type} />
      <Row label="Id" value={id} />
      {bounds === null ? (
        <>
          <Row label="X" value="—" />
          <Row label="Y" value="—" />
          <Row label="W" value={round(size.width)} />
          <Row label="H" value={round(size.height)} />
        </>
      ) : (
        // Illustrator's Transform values, editable: position is a move and size is a scale about
        // the box's top-left corner (Phase 2.2, issue #65). One commit per field, one undo step.
        <div className="grid grid-cols-2 gap-1 px-2 py-1">
          <BoxField label="X" value={bounds.x} onCommit={(x) => setSelectionBounds({ x })} />
          <BoxField label="Y" value={bounds.y} onCommit={(y) => setSelectionBounds({ y })} />
          <BoxField label="W" value={bounds.width} onCommit={(width) => setSelectionBounds({ width })} />
          <BoxField label="H" value={bounds.height} onCommit={(height) => setSelectionBounds({ height })} />
        </div>
      )}
      <Row label="Rotation" value={`${round(node.transform.rotation)}°`} />
      <Row label="Scale" value={`${round(node.transform.scaleX)} × ${round(node.transform.scaleY)}`} />
      {!isGroup(node) && (
        <div className="grid grid-cols-2 gap-1 px-2 py-1">
          <label className="flex items-center gap-1 text-ui-xs text-ink-faint">
            Fill
            <input
              type="color"
              aria-label="Fill colour"
              defaultValue={node.style.fill}
              className="h-5 w-8 rounded-ui border border-hairline bg-chrome-sunken"
              onBlur={(event) => setSelectionFill(event.currentTarget.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-ui-xs text-ink-faint">
            Stroke
            <input
              type="color"
              aria-label="Stroke colour"
              defaultValue={node.style.stroke === null ? node.style.fill : node.style.stroke.color}
              className="h-5 w-8 rounded-ui border border-hairline bg-chrome-sunken"
              onBlur={(event) => setSelectionStroke({ color: event.currentTarget.value })}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              aria-label="Stroke weight"
              defaultValue={node.style.stroke === null ? 0 : node.style.stroke.width}
              className="w-12 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
              onBlur={(event) => setSelectionStroke({ width: Number(event.currentTarget.value) })}
            />
          </label>
        </div>
      )}

      {node.type === 'rect' && (
        // Illustrator's Properties panel edits the rectangle's live corner radius; Vectr offers
        // the same value here and in the Control panel, both clamped to half the shorter side.
        <div className="flex items-center justify-between gap-3 px-2 py-[3px]">
          <label className="text-ui-xs text-ink-faint" htmlFor="vectr-corner-radius">
            Corners
          </label>
          <input
            id="vectr-corner-radius"
            type="number"
            min={0}
            max={Math.min(node.width, node.height) / 2}
            step={1}
            value={round(node.cornerRadius)}
            className="w-16 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
            onChange={(event) => setSelectionCornerRadius(Number(event.currentTarget.value))}
          />
        </div>
      )}
      {isText(node) && (
        <>
          <Row label="Font" value={node.fontFamily} />
          <div className="flex items-center justify-between gap-3 px-2 py-[3px]">
            <label className="text-ui-xs text-ink-faint" htmlFor="vectr-font-size">
              Size
            </label>
            <input
              id="vectr-font-size"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={round(node.fontSize)}
              className="w-16 rounded-ui border border-hairline bg-chrome-sunken px-1 text-right text-ui-xs text-ink"
              onChange={(event) => {
                const fontSize = Number(event.currentTarget.value)
                const lineHeight = node.fontSize > 0 ? (node.lineHeight / node.fontSize) * fontSize : fontSize * 1.2
                documentStore.dispatch(
                  {
                    type: 'setTextStyle',
                    nodeId: node.id,
                    fontSize,
                    fontFamily: node.fontFamily,
                    align: node.align,
                    lineHeight,
                  },
                  'set font size',
                )
              }}
            />
          </div>
          <Row label="Align" value={node.align} />
          <Row label="Lines" value={String(node.text.split('\n').length)} />
          <Row label="Characters" value={String(node.text.length)} />
          {node.fontFamily.toLowerCase() !== DEFAULT_FONT_FAMILY.toLowerCase() && (
            <p role="status" className="px-2 pt-1 text-ui-xs text-danger">
              {node.fontFamily} is not installed; {DEFAULT_FONT_FAMILY} is drawn instead.
            </p>
          )}
        </>
      )}
      {isImage(node) &&
        (() => {
          const asset = state.document.assets.find((entry) => entry.id === node.assetId) ?? null
          return (
            <>
              <Row label="Asset" value={asset === null ? node.assetId : asset.id.slice(0, 23) + '…'} />
              <Row label="Type" value={asset?.mimeType ?? 'missing'} />
              <Row label="File size" value={asset === null ? '—' : formatByteLength(asset.byteLength)} />
              <Row label="Pixels" value={asset === null ? '—' : `${asset.width} × ${asset.height}`} />
              <Row label="Storage" value={asset?.sourcePath === undefined ? 'Embedded' : 'Linked'} />
              {asset?.sourcePath !== undefined && <Row label="Link" value={asset.sourcePath} />}
              {asset?.sourcePath !== undefined && !assetRegistry.has(asset.id) && (
                <p role="status" className="px-2 pt-1 text-ui-xs text-danger">
                  The linked file is missing or has changed. Relink it to restore pixels.
                </p>
              )}
              <div className="flex gap-2 px-2 py-1">
                <button className="rounded-ui border border-hairline px-2 py-1 text-ui-xs text-ink hover:bg-chrome-hover" onClick={() => void relinkImageFromDialog(node.id)}>
                  Relink…
                </button>
                <button className="rounded-ui border border-hairline px-2 py-1 text-ui-xs text-ink hover:bg-chrome-hover" onClick={() => void setImageMaskFromDialog(node.id)}>
                  {node.maskAssetId === null ? 'Add mask…' : 'Replace mask…'}
                </button>
                {node.maskAssetId !== null && (
                  <button className="rounded-ui border border-hairline px-2 py-1 text-ui-xs text-ink hover:bg-chrome-hover" onClick={() => documentStore.dispatch({ type: 'setImageMask', nodeId: node.id, maskAssetId: null }, 'remove image mask')}>
                    Remove mask
                  </button>
                )}
              </div>
              <div className="px-2 py-1">
                <p className="pb-1 text-ui-xs text-ink-faint">Crop</p>
                <div className="grid grid-cols-2 gap-1">
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <CropInput
                      key={key}
                      label={key === 'width' ? 'W' : key === 'height' ? 'H' : key.toUpperCase()}
                      value={node.crop[key]}
                      onCommit={(value) => documentStore.dispatch({ type: 'setImageCrop', nodeId: node.id, crop: { ...node.crop, [key]: value } }, 'crop image')}
                    />
                  ))}
                </div>
              </div>
              {asset === null && (
                <p role="status" className="px-2 pt-1 text-ui-xs text-danger">
                  This image is not linked to an asset in the document.
                </p>
              )}
            </>
          )
        })()}
      <Row label="Flags" value={`${node.hidden ? 'hidden ' : ''}${node.locked ? 'locked' : ''}`.trim() || 'none'} />
      {state.selection.length > 1 && <Row label="Also selected" value={`${state.selection.length - 1} more`} />}
    </div>
  )
}
