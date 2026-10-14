/**
 * Editor smoke run (issue #18).
 *
 * A scripted pass over the slice's acceptance flow at the store and command level,
 * so the packaged app can prove the editor path works without a human clicking.
 * Run with `electron . --smoke`; the result is logged as `[vectr-smoke] {...}` and
 * forwarded to stdout by the main process.
 *
 * This is a smoke check, not the test suite: the assertions live in
 * `tests/doc.test.ts` and `tests/editor.test.ts`.
 */

import { createEllipse, createRect, createText, findNode } from '../doc/document.ts'
import { marqueeHitTest } from '../doc/hitTest.ts'
import { getActiveRenderer } from '../render/activeRenderer.ts'
import { buildScene } from '../render/scene.ts'
import { planGroup } from '../app/arrange.ts'
import { runEditorAction } from '../app/actions.ts'
import type { DocumentStore } from '../state/documentStore.ts'

export type SmokeStep = { name: string; ok: boolean; detail: string }
export type SmokeReport = { passed: boolean; steps: SmokeStep[] }

export function runEditorSmoke(store: DocumentStore): SmokeReport {
  const steps: SmokeStep[] = []
  const record = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail })

  const rect = createRect('Smoke Rect', 40, 40, 160, 120)
  const ellipse = createEllipse('Smoke Ellipse', 280, 80, 120, 120)
  const inserted = store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [rect, ellipse] },
    'smoke insert',
  )
  record('create two shapes', inserted.ok, inserted.ok ? 'inserted rect + ellipse' : inserted.message)

  const scene = buildScene(store.getState().document)
  record('scene built', scene.shapes.length === 2, `${scene.shapes.length} shapes, ${scene.byRoot.length} roots`)

  store.setSelection([rect.id])
  record('selection', store.getState().selection.join(',') === rect.id, store.getState().selection.join(',') || 'none')

  const depthBeforeDrag = store.getState().undoDepth
  store.beginTransaction('smoke move')
  for (const x of [60, 90, 120]) {
    store.dispatch({ type: 'setTransform', nodeId: rect.id, transform: { x, y: 40, rotation: 0, scaleX: 1, scaleY: 1 } })
  }
  store.commitTransaction()
  const movedX = findNode(store.getState().document, rect.id)?.transform.x
  const depthAfterDrag = store.getState().undoDepth
  record(
    'drag is one entry',
    depthAfterDrag === depthBeforeDrag + 1 && movedX === 120,
    `depth ${depthBeforeDrag} -> ${depthAfterDrag}, x ${movedX}`,
  )

  store.undo()
  const undoneX = findNode(store.getState().document, rect.id)?.transform.x
  record('undo restores', undoneX === 40, `x ${undoneX}`)

  store.redo()
  const redoneX = findNode(store.getState().document, rect.id)?.transform.x
  record('redo re-applies', redoneX === 120, `x ${redoneX}`)

  const marquee = marqueeHitTest(store.getState().document, { x: 0, y: 0, width: 500, height: 400 })
  store.setSelection(marquee)
  record('marquee selects', marquee.length === 2, `${marquee.length} layers`)

  const rejected = store.dispatch({
    type: 'setTransform',
    nodeId: 'does-not-exist',
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  })
  const errorCode = store.getState().lastError?.code ?? 'none'
  record('invalid command rejected', !rejected.ok && errorCode === 'absent-node', errorCode)
  store.clearError()

  store.setSelection([ellipse.id])
  store.dispatch({ type: 'removeNodes', nodeIds: [ellipse.id] }, 'smoke delete')
  record('delete + prune selection', store.getState().selection.length === 0, `${store.getState().selection.length} selected`)

  // Issue #20: a second shape gives something to group, and grouping two layers is one
  // gesture, so it must be one history entry with the new group selected.
  const mate = createEllipse('Smoke Group Mate', 520, 200, 80, 80)
  const root = store.getState().document.root
  store.dispatch(
    { type: 'insertNodes', parentId: root.id, index: root.children.length, nodes: [mate] },
    'smoke group prep',
  )
  const orderBefore = store.getState().document.root.children.length
  store.setSelection(store.getState().document.root.children.map((node) => node.id))
  const groupPlan = planGroup(store.getState().document, store.getState().selection)
  record('group planned', groupPlan !== null, groupPlan === null ? 'no plan' : `${groupPlan.length} steps`)

  const depthBeforeGroup = store.getState().undoDepth
  runEditorAction('object.group')
  const grouped = store.getState().document.root.children
  const group = grouped[grouped.length - 1]
  record(
    'group is one entry',
    store.getState().undoDepth === depthBeforeGroup + 1 && grouped.length === orderBefore - 1,
    `depth ${depthBeforeGroup} -> ${store.getState().undoDepth}, ${orderBefore} -> ${grouped.length} top-level`,
  )
  record(
    'group selected and nested',
    store.getState().selection.length === 1 &&
      store.getState().selection[0] === group.id &&
      (group.type === 'group' ? group.children.length : -1) === orderBefore,
    `${store.getState().selection.length} selected, ${group.type} holds ${
      group.type === 'group' ? group.children.length : 0
    }`,
  )
  store.undo()
  record(
    'undo ungroups in one step',
    store.getState().document.root.children.length === orderBefore,
    `${store.getState().document.root.children.length} top-level again`,
  )

  // Issue #16: text is a document object like any other — created by a command, edited by one
  // command in one history entry, and validated like any other node.
  const text = createText('Smoke Text', 60, 240, 'Hello\nVectr')
  const textInsert = store.dispatch(
    { type: 'insertNodes', parentId: store.getState().document.root.id, index: 0, nodes: [text] },
    'smoke text',
  )
  record(
    'text created',
    textInsert.ok,
    textInsert.ok ? `${text.width.toFixed(0)}x${text.height.toFixed(0)} box, 2 lines` : textInsert.message,
  )

  const depthBeforeText = store.getState().undoDepth
  const edited = store.dispatch({ type: 'setText', nodeId: text.id, text: 'Hello again' }, 'edit text')
  const editedNode = findNode(store.getState().document, text.id)
  record(
    'text edit is one entry',
    edited.ok &&
      store.getState().undoDepth === depthBeforeText + 1 &&
      editedNode !== null &&
      editedNode.type === 'text' &&
      editedNode.text === 'Hello again',
    `depth ${depthBeforeText} -> ${store.getState().undoDepth}`,
  )
  store.undo()
  const restored = findNode(store.getState().document, text.id)
  record(
    'text undo restores content',
    restored !== null && restored.type === 'text' && restored.text === 'Hello\nVectr',
    restored !== null && restored.type === 'text' ? JSON.stringify(restored.text) : 'missing',
  )

  const badSize = store.dispatch(
    {
      type: 'setTextStyle',
      nodeId: text.id,
      fontSize: -4,
      fontFamily: 'Inter',
      align: 'left',
      lineHeight: 19,
    },
    'bad size',
  )
  record(
    'invalid text style rejected',
    !badSize.ok && store.getState().lastError?.code === 'non-finite',
    store.getState().lastError?.code ?? 'none',
  )
  store.clearError()

  // A family Vectr does not bundle is accepted and reported, not refused (slice 1's rule).
  const missingFont = store.dispatch(
    {
      type: 'setTextStyle',
      nodeId: text.id,
      fontSize: 20,
      fontFamily: 'Comic Sans MS',
      align: 'center',
      lineHeight: 24,
    },
    'missing font',
  )
  record('missing font is recorded, not refused', missingFont.ok, missingFont.ok ? 'set to Comic Sans MS' : missingFont.message)

  return { passed: steps.every((step) => step.ok), steps }
}

/**
 * Adds 1,000 shapes and measures the renderer's own frame time, so the slice's
 * interaction criterion is recorded with numbers instead of an assumption.
 */
export async function runEditorStress(store: DocumentStore): Promise<SmokeReport> {
  const steps: SmokeStep[] = []
  const nodes = Array.from({ length: 1_000 }, (_, index) =>
    createRect(`Stress ${index}`, (index * 17) % 1200, (index * 29) % 800, 40, 30),
  )
  const root = store.getState().document.root
  const inserted = store.dispatch({ type: 'insertNodes', parentId: root.id, index: root.children.length, nodes }, 'smoke stress')

  if (!inserted.ok) {
    steps.push({ name: 'stress insert', ok: false, detail: inserted.message })
    return { passed: false, steps }
  }
  steps.push({ name: 'stress insert', ok: true, detail: `${nodes.length} rects` })

  // Let the shell rebuild the scene from the new document before measuring.
  await new Promise((resolve) => window.setTimeout(resolve, 750))
  const renderer = getActiveRenderer()
  if (renderer === null) {
    steps.push({ name: 'stress frames', ok: false, detail: 'no active renderer' })
    return { passed: false, steps }
  }

  const samples: number[] = []
  for (let index = 0; index < 60; index += 1) {
    samples.push(renderer.render({ zoom: 1 + (index % 5) * 0.01, panX: index, panY: index }, []))
  }
  const sorted = [...samples].sort((left, right) => left - right)
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]
  const stats = renderer.stats()
  steps.push({
    name: 'stress frames',
    ok: p95 <= 33,
    detail: `${stats.shapes} shapes, ${stats.buckets} buckets, render p95 ${p95.toFixed(2)} ms over 60 frames, build ${stats.lastBuildMs.toFixed(1)} ms`,
  })
  // Issue #16: the unavailable family set earlier must be reported, not silently drawn.
  steps.push({
    name: 'font substitution reported',
    ok: stats.substitutedFonts.includes('Comic Sans MS'),
    detail: stats.substitutedFonts.join(', ') || 'none reported',
  })
  return { passed: steps.every((step) => step.ok), steps }
}

