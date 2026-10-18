/**
 * Properties panel (issue #28, rebuilt in the UI pass).
 *
 * The panel the user lives in, so it is the one that has to feel immediate: every field writes to the
 * document as you type or drag, and a whole edit session is still one undo entry (the field opens a
 * transaction on focus and closes it on blur — see `ui/fields.tsx`).
 *
 * Layout rules that keep it from scrolling sideways: one fixed label column, controls that shrink
 * (`min-w-0`), and no element with an intrinsic width wider than the dock. The body is a vertical
 * scroll area only.
 */

import { findNode, worldBounds, DEFAULT_FONT_FAMILY } from '../../doc/document.ts'
import { ARTBOARD_PRESETS, presetByName, presetFor } from '../../doc/artboards.ts'
import { isGroup, isImage, isText, nodeSize } from '../../doc/types.ts'
import type { BlendMode } from '../../doc/types.ts'
import { documentStore } from '../../state/documentStore.ts'
import { assetRegistry } from '../../state/assetRegistry.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import { formatByteLength } from '../../doc/assets.ts'
import {
  artboardList,
  linearGradientFrom,
  relinkImageFromDialog,
  runEditorAction,
  setActiveArtboard,
  setActiveArtboardSize,
  setImageMaskFromDialog,
  setSelectionBlendMode,
  setSelectionBounds,
  setSelectionRotation,
  setSelectionCornerRadius,
  setSelectionFill,
  addGradientStop,
  removeGradientStop,
  setGradientStop,
  setSelectionGradient,
  setSelectionGradientTarget,
  setSelectionGradientType,
  setSelectionOpacity,
  setSelectionStroke,
  setSelectionStrokeAlign,
  gradientAngle,
} from '../actions.ts'
import {
  ButtonRow,
  ColorField,
  NumberField,
  PanelButton,
  PercentField,
  Readout,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from '../ui/fields.tsx'

const CAPS = ['butt', 'round', 'square'] as const
const JOINS = ['miter', 'round', 'bevel'] as const
const BLENDS: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']

const BODY = 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'

/** The rotation shown in the field: the selection's common rotation, else zero. */
function selectionRotation(state: { document: Parameters<typeof findNode>[0]; selection: string[] }): number {
  const rotations: number[] = []
  for (const id of state.selection) {
    const node = findNode(state.document, id)
    if (node === null || node.type === 'group') continue
    rotations.push(((node.transform.rotation % 360) + 360) % 360)
  }
  if (rotations.length === 0) return 0
  return rotations.every((value) => value === rotations[0]) ? rotations[0] : 0
}

function round(value: number): number {
  return Number.isInteger(value) ? value : Math.round(value * 100) / 100
}

/** The document's own colours, offered first in every colour popover. */
function documentColors(assetsDocument: ReturnType<typeof useEditorState>['document']): string[] {
  const colors: string[] = []
  const walk = (nodes: typeof assetsDocument.root.children) => {
    for (const node of nodes) {
      if (node.type === 'group') {
        walk(node.children)
        continue
      }
      colors.push(node.style.fill)
      if (node.style.stroke !== null) colors.push(node.style.stroke.color)
    }
  }
  walk(assetsDocument.root.children)
  return colors
}

export function PropertiesPanel() {
  const state = useEditorState()
  const id = state.selection[0]
  const node = id === undefined ? null : findNode(state.document, id)
  const rotation = selectionRotation(state)
  const bounds = id === undefined ? null : worldBounds(state.document, id)

  if (node === null || id === undefined) {
    // With nothing selected the panel shows the document's pages (Phase 2.4, issue #67). Illustrator
    // keeps them in their own Artboards panel; Vectr puts them here for now, a recorded divergence.
    const pages = artboardList()
    const active = pages.find((page) => page.active) ?? pages[0]
    return (
      <div className={BODY} data-panel-body="properties">
        <Section title="Document">
          <p className="text-ui-xs text-ink-muted">Nothing selected.</p>
          <p className="text-ui-xs text-ink-faint">Click an object, or a layer in the Layers panel.</p>
        </Section>
        <Section title="Artboards">
          <div className="flex flex-col gap-0.5">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                aria-pressed={page.active}
                onClick={() => setActiveArtboard(page.id)}
                className={
                  'flex min-w-0 items-center justify-between gap-2 rounded-ui px-1.5 py-1 text-left text-ui-xs transition-colors ' +
                  (page.active
                    ? 'bg-accent-soft text-ink shadow-[inset_2px_0_0_var(--color-accent)]'
                    : 'text-ink-muted hover:bg-chrome-hover hover:text-ink')
                }
              >
                <span className="min-w-0 flex-1 truncate">{page.name}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-ink-faint">
                  {page.width}×{page.height}
                </span>
              </button>
            ))}
          </div>
          {active !== undefined && (
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="flex min-w-0 items-center gap-2">
                <span className="w-14 shrink-0 truncate text-ui-xs text-ink-faint">Size</span>
                <select
                  aria-label="Artboard size preset"
                  value={presetFor(active.width, active.height)}
                  className="h-6 min-w-0 flex-1 rounded-ui border border-hairline bg-chrome-sunken px-1.5 text-ui-xs text-ink outline-none hover:border-chrome-active focus:border-accent"
                  onChange={(event) => {
                    const preset = presetByName(event.currentTarget.value)
                    if (preset !== null) setActiveArtboardSize({ width: preset.width, height: preset.height })
                  }}
                >
                  {ARTBOARD_PRESETS.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
              <NumberField label="W" value={active.width} min={1} onChange={(width) => setActiveArtboardSize({ width })} />
                <NumberField label="H" value={active.height} min={1} onChange={(height) => setActiveArtboardSize({ height })} />
              </div>
            </div>
          )}
          <ButtonRow>
            <PanelButton tone="accent" onClick={() => runEditorAction('artboard.new')}>
              New artboard
            </PanelButton>
            <PanelButton disabled={pages.length <= 1} onClick={() => runEditorAction('artboard.delete')}>
              Delete
            </PanelButton>
          </ButtonRow>
        </Section>
      </div>
    )
  }

  const size = nodeSize(node)
  const leaf = !isGroup(node)
  const stroke = leaf ? node.style.stroke : null
  const gradient = leaf ? (node.style.gradient ?? null) : null
  const colors = documentColors(state.document)

  return (
    <div className={BODY} data-panel-body="properties">
      <Section title={node.name}>
        <Readout label="Kind" value={isText(node) ? 'text' : isGroup(node) ? `group of ${node.children.length}` : node.type} />
      </Section>

      <Section title="Transform">
        {bounds === null ? (
          <>
            <Readout label="X" value="—" />
            <Readout label="Y" value="—" />
            <Readout label="W" value={String(round(size.width))} />
            <Readout label="H" value={String(round(size.height))} />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="X" value={bounds.x} onChange={(x) => setSelectionBounds({ x })} />
            <NumberField label="Y" value={bounds.y} onChange={(y) => setSelectionBounds({ y })} />
            <NumberField label="W" value={bounds.width} min={1} onChange={(width) => setSelectionBounds({ width })} />
            <NumberField label="H" value={bounds.height} min={1} onChange={(height) => setSelectionBounds({ height })} />
          <NumberField
            label="Rotation"
            value={Math.round(rotation)}
            min={-360}
            max={360}
            step={15}
            suffix="°"
            onChange={(degrees) => setSelectionRotation(degrees)}
          />
          </div>
        )}
        {node.type === 'rect' && (
          <NumberField
            label="Corners"
            value={node.cornerRadius}
            min={0}
            max={Math.min(node.width, node.height) / 2}
            onChange={(radius) => setSelectionCornerRadius(radius)}
          />
        )}
        <Readout label="Scale" value={`${round(node.transform.scaleX)} × ${round(node.transform.scaleY)}`} />
      </Section>

      {leaf && (
        <Section title="Fill">
          <ColorField
            label="Fill"
            value={node.style.fill}
            suggestions={colors}
            onChange={(color) => setSelectionFill(color)}
          />
          <ToggleField
            label="Linear gradient"
            checked={gradient !== null}
            onChange={(checked) =>
              setSelectionGradient(checked ? linearGradientFrom(90, node.style.fill, '#ffffff') : null)
            }
          />
          {gradient !== null && (
            <>
              <SelectField
                label="Type"
                value={gradient.type}
                options={['linear' as const, 'radial' as const]}
                onChange={(type) => setSelectionGradientType(type)}
              />
              <SelectField
                label="On"
                value={node.style.gradientTarget ?? 'fill'}
                options={['fill' as const, 'stroke' as const, 'both' as const]}
                onChange={(target) => setSelectionGradientTarget(target)}
              />
              {gradient.type === 'linear' && (
                <NumberField
                  label="Angle"
                  value={gradientAngle(gradient)}
                  min={-360}
                  max={360}
                  step={15}
                  suffix="°"
                  onChange={(angle) =>
                    setSelectionGradient(
                      linearGradientFrom(angle, gradient.stops[0]?.color ?? node.style.fill, gradient.stops[gradient.stops.length - 1]?.color ?? '#ffffff'),
                    )
                  }
                />
              )}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">Stops</span>
                {gradient.stops.map((stop, index) => (
                  <div key={index} className="flex min-w-0 items-center gap-1">
                    <input
                      type="color"
                      aria-label={'Gradient stop ' + (index + 1) + ' colour'}
                      value={stop.color}
                      onChange={(event) => setGradientStop(index, { color: event.currentTarget.value })}
                      className="h-5 w-7 shrink-0 rounded-[2px] border border-hairline"
                    />
                    <NumberField
                      inline
                      label={'Gradient stop ' + (index + 1) + ' position'}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      value={Math.round(stop.offset * 100)}
                      onChange={(percent) => setGradientStop(index, { offset: percent / 100 })}
                    />
                    <button
                      type="button"
                      aria-label={'Remove gradient stop ' + (index + 1)}
                      disabled={gradient.stops.length <= 2}
                      onClick={() => removeGradientStop(index)}
                      className="ml-auto shrink-0 rounded-ui px-1 text-[11px] text-ink-faint hover:bg-chrome-hover hover:text-danger disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={gradient.stops.length >= 8}
                  onClick={() => addGradientStop(0.5, '#ffffff')}
                  className="h-6 rounded-ui border border-hairline text-ui-xs text-ink-muted hover:bg-chrome-hover hover:text-ink disabled:opacity-40"
                >
                  Add stop
                </button>
              </div>
            </>
          )}
          <PercentField label="Opacity" value={node.style.opacity} onChange={(percent) => setSelectionOpacity(percent / 100)} />
          <SelectField label="Blend" value={node.style.blendMode ?? 'normal'} options={BLENDS} onChange={(mode) => setSelectionBlendMode(mode)} />
        </Section>
      )}

      {leaf && (
        <Section title="Stroke">
          <ColorField
            label="Colour"
            value={stroke === null ? node.style.fill : stroke.color}
            suggestions={colors}
            onChange={(color) => setSelectionStroke({ color })}
          />
          <NumberField
            label="Weight"
            value={stroke === null ? 0 : stroke.width}
            min={0}
            max={100}
            step={0.5}
            onChange={(width) => setSelectionStroke({ width })}
          />
          <SelectField
            label="Align"
            value={stroke?.align ?? 'center'}
            options={['center' as const, 'inside' as const, 'outside' as const]}
            onChange={(align) => setSelectionStrokeAlign(align)}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <SelectField label="Cap" value={stroke?.cap ?? 'butt'} options={CAPS} onChange={(cap) => setSelectionStroke({ cap })} />
            <SelectField label="Join" value={stroke?.join ?? 'miter'} options={JOINS} onChange={(join) => setSelectionStroke({ join })} />
          </div>
          <TextField
            label="Dashes"
            value={(stroke?.dash ?? []).join(' ')}
            placeholder="solid"
            onChange={(value) =>
              setSelectionStroke({
                dash: value
                  .split(/[ ,]+/)
                  .filter((part) => part.length > 0)
                  .map(Number)
                  .filter((entry) => Number.isFinite(entry) && entry > 0),
              })
            }
          />
        </Section>
      )}

      {isText(node) && (
        <Section title="Type">
          <Readout label="Font" value={node.fontFamily} />
          <NumberField
            label="Size"
            value={node.fontSize}
            min={1}
            max={1000}
            onChange={(fontSize) => {
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
          <SelectField
            label="Align"
            value={node.align}
            options={['left' as const, 'center' as const, 'right' as const]}
            onChange={(align) =>
              documentStore.dispatch(
                {
                  type: 'setTextStyle',
                  nodeId: node.id,
                  fontSize: node.fontSize,
                  fontFamily: node.fontFamily,
                  align,
                  lineHeight: node.lineHeight,
                },
                'align text',
              )
            }
          />
          <Readout label="Lines" value={String(node.text.split('\n').length)} />
          {node.fontFamily.toLowerCase() !== DEFAULT_FONT_FAMILY.toLowerCase() && (
            <p role="status" className="rounded-ui bg-danger/15 px-1.5 py-1 text-[10px] leading-snug text-danger">
              {node.fontFamily} is not installed; {DEFAULT_FONT_FAMILY} is drawn instead.
            </p>
          )}
        </Section>
      )}

      {isImage(node) && (
        <Section title="Image">
          {(() => {
            const asset = state.document.assets.find((entry) => entry.id === node.assetId) ?? null
            return (
              <>
                <Readout label="Asset" value={asset === null ? node.assetId.slice(0, 16) + '…' : asset.id.slice(10, 26)} />
                <Readout label="Type" value={asset?.mimeType ?? 'missing'} />
                <Readout label="Size" value={asset === null ? '—' : formatByteLength(asset.byteLength)} />
                <Readout label="Pixels" value={asset === null ? '—' : `${asset.width} × ${asset.height}`} />
                <Readout label="Storage" value={asset?.sourcePath === undefined ? 'Embedded' : 'Linked'} />
                {asset?.sourcePath !== undefined && <Readout label="Link" value={asset.sourcePath} />}
                {asset?.sourcePath !== undefined && !assetRegistry.has(asset.id) && (
                  <p role="status" className="rounded-ui bg-danger/15 px-1.5 py-1 text-[10px] leading-snug text-danger">
                    The linked file is missing or changed. Relink to restore pixels.
                  </p>
                )}
                <ButtonRow>
                  <PanelButton onClick={() => void relinkImageFromDialog(node.id)}>Relink…</PanelButton>
                  <PanelButton onClick={() => void setImageMaskFromDialog(node.id)}>
                    {node.maskAssetId === null ? 'Add mask…' : 'Replace mask…'}
                  </PanelButton>
                  {node.maskAssetId !== null && (
                    <PanelButton
                      onClick={() =>
                        documentStore.dispatch({ type: 'setImageMask', nodeId: node.id, maskAssetId: null }, 'remove image mask')
                      }
                    >
                      Remove mask
                    </PanelButton>
                  )}
                </ButtonRow>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <NumberField
                      key={key}
                      label={key === 'width' ? 'Crop W' : key === 'height' ? 'Crop H' : `Crop ${key.toUpperCase()}`}
                      value={node.crop[key]}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(value) =>
                        documentStore.dispatch(
                          { type: 'setImageCrop', nodeId: node.id, crop: { ...node.crop, [key]: value } },
                          'crop image',
                        )
                      }
                    />
                  ))}
                </div>
                {asset === null && (
                  <p role="status" className="rounded-ui bg-danger/15 px-1.5 py-1 text-[10px] leading-snug text-danger">
                    This image is not linked to an asset in the document.
                  </p>
                )}
              </>
            )
          })()}
        </Section>
      )}

      <Section title="Layer">
        <Readout label="Flags" value={[node.hidden ? 'hidden' : '', node.locked ? 'locked' : ''].filter(Boolean).join(', ') || 'none'} />
        {state.selection.length > 1 && <Readout label="Also" value={`${state.selection.length - 1} more selected`} />}
      </Section>
    </div>
  )
}
