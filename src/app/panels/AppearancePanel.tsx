/**
 * Appearance panel (issue #28, rebuilt in the UI pass).
 *
 * The same values Properties edits, gathered the way Illustrator's Appearance panel gathers them: the
 * fill, the stroke, and the transparency of the selection in one stack, editing live. It is not a
 * second appearance model — every control calls the same actions Properties does, so the two panels
 * cannot disagree.
 */

import { findNode } from '../../doc/document.ts'
import { isImage, isLeaf, isText } from '../../doc/types.ts'
import type { BlendMode } from '../../doc/types.ts'
import { useEditorState } from '../../state/useEditorState.ts'
import {
  linearGradientFrom,
  setSelectionBlendMode,
  setSelectionFill,
  setSelectionGradient,
  setSelectionOpacity,
  setSelectionStroke,
} from '../actions.ts'
import { ColorField, NumberField, PercentField, Readout, Section, SelectField, ToggleField } from '../ui/fields.tsx'

const BLENDS: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']

export function AppearancePanel() {
  const state = useEditorState()
  const id = state.selection[0]
  const node = id === undefined ? null : findNode(state.document, id)

  if (node === null || !isLeaf(node)) {
    return (
      <p className="px-3 py-4 text-ui-xs leading-relaxed text-ink-faint">
        Select a shape or text object. Groups carry appearance through their children, and an image&apos;s
        appearance is its pixels.
      </p>
    )
  }

  if (isImage(node)) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Section title="Image">
          <Readout label="Fill" value="none" />
          <PercentField
            label="Opacity"
            value={node.style.opacity}
            onChange={(percent) => setSelectionOpacity(percent / 100)}
          />
          <p className="text-[10px] leading-snug text-ink-faint">
            An image&apos;s appearance is its pixels; its asset and crop live in Properties.
          </p>
        </Section>
      </div>
    )
  }

  const gradient = node.style.gradient ?? null
  const stroke = node.style.stroke

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <Section title="Fill">
        <ColorField label="Colour" value={node.style.fill} onChange={(color) => setSelectionFill(color)} />
        <ToggleField
          label="Linear gradient"
          checked={gradient !== null}
          onChange={(checked) =>
            setSelectionGradient(checked ? linearGradientFrom(90, node.style.fill, '#ffffff') : null)
          }
        />
      </Section>

      <Section title="Stroke">
        <ColorField
          label="Colour"
          value={stroke === null ? node.style.fill : stroke.color}
          onChange={(color) => setSelectionStroke({ color })}
        />
        <NumberField
          label="Weight"
          value={stroke === null ? 0 : stroke.width}
          min={0}
          max={100}
          step={0.5}
          suffix="px"
          onChange={(width) => setSelectionStroke({ width })}
        />
      </Section>

      <Section title="Transparency">
        <PercentField
          label="Opacity"
          value={node.style.opacity}
          onChange={(percent) => setSelectionOpacity(percent / 100)}
        />
        <SelectField
          label="Blend"
          value={node.style.blendMode ?? 'normal'}
          options={BLENDS}
          onChange={(mode) => setSelectionBlendMode(mode)}
        />
      </Section>

      {isText(node) && (
        <Section title="Type">
          <Readout label="Font" value={node.fontFamily} />
          <Readout label="Size" value={`${node.fontSize} px`} />
          <Readout label="Align" value={node.align} />
        </Section>
      )}
    </div>
  )
}
