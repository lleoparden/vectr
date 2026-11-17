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
  toggleSelectionShadow,
  updateSelectionShadow,
} from '../actions.ts'
import { ColorField, NumberField, PercentField, Readout, Section, SelectField, ToggleField } from '../ui/components/fields.tsx'
import { EmptyState } from '../ui/components/EmptyState.tsx'

const BLENDS: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']

export function AppearancePanel() {
  const state = useEditorState()
  const id = state.selection[0]
  const node = id === undefined ? null : findNode(state.document, id)

  if (node === null || !isLeaf(node)) {
    return (
      <EmptyState>{"\n        Select a shape or text object. Groups carry appearance through their children, and an image&apos;s\n        appearance is its pixels.\n      "}</EmptyState>
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
  const shadow = node.style.effects?.find((effect) => effect.type === 'dropShadow') ?? null

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

      <Section title="Effects">
        <ToggleField label="Drop shadow" checked={shadow !== null} onChange={() => toggleSelectionShadow()} />
        {shadow !== null && (
          <>
            <NumberField
              label="X"
              value={shadow.x}
              min={-200}
              max={200}
              step={1}
              suffix="px"
              onChange={(x) => updateSelectionShadow({ x })}
            />
            <NumberField
              label="Y"
              value={shadow.y}
              min={-200}
              max={200}
              step={1}
              suffix="px"
              onChange={(y) => updateSelectionShadow({ y })}
            />
            <NumberField
              label="Blur"
              value={shadow.blur}
              min={0}
              max={100}
              step={1}
              suffix="px"
              onChange={(blur) => updateSelectionShadow({ blur })}
            />
            <PercentField
              label="Opacity"
              value={shadow.opacity}
              onChange={(percent) => updateSelectionShadow({ opacity: percent / 100 })}
            />
            <ColorField label="Colour" value={shadow.color} onChange={(color) => updateSelectionShadow({ color })} />
          </>
        )}
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
