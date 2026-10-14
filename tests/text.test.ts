/**
 * Plain-text tests (issue #16).
 *
 * Text is a document object like a shape: a node type with a measured box, commands with
 * inverses, validation, hit testing, scene order, and one-undo-step editing. The measurement
 * estimate is pure, so bounds are testable without a GPU.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand, isLocked } from '../src/doc/commands.ts'
import {
  createDocument,
  createRect,
  createText,
  estimateTextSize,
  findNode,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  MAX_TEXT_LENGTH,
} from '../src/doc/document.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { hitTest, marqueeHitTest } from '../src/doc/hitTest.ts'
import { buildScene } from '../src/render/scene.ts'
import { EDITOR_BORDER, MIN_EDITOR_WIDTH, editorSizeFor } from '../src/app/canvas/textEditorBox.ts'
import { documentStore } from '../src/state/documentStore.ts'
import { runEditorAction, nextFontSize } from '../src/app/actions.ts'
import type { Document, LayerNode, NodeId, TextNode } from '../src/doc/types.ts'

function insert(document: Document, nodes: LayerNode[], parentId: NodeId = 'root'): Document {
  const parent = findNode(document, parentId)
  const index = parent !== null && parent.type === 'group' ? parent.children.length : 0
  const result = applyCommand(document, { type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : result.message)
  return result.ok ? result.document : document
}

function apply(document: Document, command: Parameters<typeof applyCommand>[1]) {
  const result = applyCommand(document, command)
  assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
  if (!result.ok) throw new Error(result.message)
  return result
}

function textNode(document: Document, id: NodeId): TextNode {
  const node = findNode(document, id)
  assert.ok(node !== null && node.type === 'text', 'expected a text node')
  return node as TextNode
}

test('a new text object carries the documented defaults and an estimated box', () => {
  const node = createText('Title', 10, 20, 'Hello\nWorld')
  assert.equal(node.type, 'text')
  assert.equal(node.fontFamily, DEFAULT_FONT_FAMILY)
  assert.equal(node.fontSize, DEFAULT_FONT_SIZE)
  assert.equal(node.align, 'left')
  assert.equal(node.lineHeight, DEFAULT_FONT_SIZE * 1.2)
  const box = estimateTextSize('Hello\nWorld', node.fontSize, node.lineHeight)
  assert.equal(node.width, box.width)
  assert.equal(node.height, box.height, 'two lines are two line heights tall')
  assert.equal(node.transform.x, 10)
})

test('the text editor grows with its content and stays clickable when empty', () => {
  const line = 19.2
  // The editor never shrinks below a clickable minimum, plus one pixel per border side so the
  // text lines up with the box the canvas draws.
  const empty = editorSizeFor({ width: 8.8, height: line }, line)
  assert.equal(empty.width, MIN_EDITOR_WIDTH + EDITOR_BORDER)
  assert.equal(empty.height, Math.round(line) + EDITOR_BORDER)

  const oneLine = editorSizeFor({ width: 40, height: line }, line)
  assert.equal(oneLine.width, 42, 'a measured box is used as-is plus the border')
  assert.equal(oneLine.height, Math.round(line) + EDITOR_BORDER)

  // Longer text is wider; another line is taller. This is the owner's report: the box has to grow.
  const long = editorSizeFor({ width: 220, height: line }, line)
  assert.ok(long.width > oneLine.width, 'typing more widens the editor')
  const twoLines = editorSizeFor({ width: 220, height: line * 2 }, line)
  assert.ok(twoLines.height > long.height, 'a second line makes the editor taller')

  // Sizes are whole pixels, so the caret cannot sit on a half pixel.
  assert.equal(editorSizeFor({ width: 10.4, height: line }, line).width % 1, 0)
})

test('the measurement estimate grows with text, size, and lines', () => {
  const one = estimateTextSize('abcd', 10, 12)
  const longer = estimateTextSize('abcdefgh', 10, 12)
  const bigger = estimateTextSize('abcd', 20, 24)
  const twoLines = estimateTextSize('abcd\nefgh', 10, 12)
  assert.ok(longer.width > one.width)
  assert.ok(bigger.width > one.width)
  assert.equal(twoLines.height, 24)
  assert.equal(one.height, 12)
  assert.ok(estimateTextSize('', 10, 12).width > 0, 'an empty text object still has a box to click')
})

test('setText replaces the content, keeps the box in step, and inverts exactly', () => {
  const text = createText('Body', 0, 0, 'one')
  const document = insert(createDocument(), [text])
  const edit = apply(document, { type: 'setText', nodeId: text.id, text: 'one\ntwo' })
  const edited = textNode(edit.document, text.id)
  assert.equal(edited.text, 'one\ntwo')
  assert.equal(edited.height, estimateTextSize('one\ntwo', edited.fontSize, edited.lineHeight).height)

  const back = apply(edit.document, edit.inverse)
  const restored = textNode(back.document, text.id)
  assert.equal(restored.text, 'one')
  assert.equal(restored.width, text.width)
  assert.equal(restored.height, text.height)
})

test('setText refuses a non-text node, a missing node, a locked one, and an oversized string', () => {
  const rect = createRect('Rect', 0, 0, 10, 10)
  const text = createText('Body', 0, 0, 'one')
  let document = insert(createDocument(), [rect, text])

  const wrongKind = applyCommand(document, { type: 'setText', nodeId: rect.id, text: 'nope' })
  assert.equal(wrongKind.ok ? '' : wrongKind.code, 'invalid-parent')

  const missing = applyCommand(document, { type: 'setText', nodeId: 'missing', text: 'nope' })
  assert.equal(missing.ok ? '' : missing.code, 'absent-node')

  const locked = applyCommand(document, { type: 'setFlags', nodeId: text.id, locked: true, hidden: false })
  assert.equal(locked.ok, true)
  if (!locked.ok) return
  document = locked.document
  const blocked = applyCommand(document, { type: 'setText', nodeId: text.id, text: 'nope' })
  assert.equal(blocked.ok ? '' : blocked.code, 'locked')
  assert.equal(isLocked(document, text.id), true)

  const unlocked = applyCommand(document, { type: 'setFlags', nodeId: text.id, locked: false, hidden: false })
  assert.equal(unlocked.ok, true)
  if (!unlocked.ok) return
  const huge = applyCommand(unlocked.document, {
    type: 'setText',
    nodeId: text.id,
    text: 'x'.repeat(MAX_TEXT_LENGTH + 1),
  })
  assert.equal(huge.ok ? '' : huge.code, 'invalid-index')
  assert.match(huge.ok ? '' : huge.message, /longer than/)
})

test('setTextStyle validates size, leading, alignment, and family', () => {
  const text = createText('Body', 0, 0, 'one')
  const document = insert(createDocument(), [text])
  const style = {
    nodeId: text.id,
    fontSize: 24,
    fontFamily: 'Inter',
    align: 'center' as const,
    lineHeight: 30,
  }
  const styled = apply(document, { type: 'setTextStyle', ...style })
  const node = textNode(styled.document, text.id)
  assert.equal(node.fontSize, 24)
  assert.equal(node.align, 'center')
  assert.equal(node.height, estimateTextSize('one', 24, 30).height)

  const restored = textNode(apply(styled.document, styled.inverse).document, text.id)
  assert.equal(restored.fontSize, text.fontSize)
  assert.equal(restored.align, 'left')
  assert.equal(restored.lineHeight, text.lineHeight)

  const badSize = applyCommand(document, { type: 'setTextStyle', ...style, fontSize: 0 })
  assert.equal(badSize.ok ? '' : badSize.code, 'non-finite')
  const badLeading = applyCommand(document, { type: 'setTextStyle', ...style, lineHeight: Number.NaN })
  assert.equal(badLeading.ok ? '' : badLeading.code, 'non-finite')
  const badAlign = applyCommand(document, {
    type: 'setTextStyle',
    ...style,
    align: 'justify' as unknown as 'left',
  })
  assert.equal(badAlign.ok ? '' : badAlign.code, 'invalid-index')
  const badFamily = applyCommand(document, { type: 'setTextStyle', ...style, fontFamily: '   ' })
  assert.equal(badFamily.ok ? '' : badFamily.code, 'invalid-index')
})

test('a text node with corrupt metrics fails document validation', () => {
  const text = createText('Body', 0, 0, 'one')
  const document = insert(createDocument(), [text])
  assert.equal(validateDocument(document).ok, true)

  const broken: Document = {
    ...document,
    root: {
      ...document.root,
      children: [{ ...text, fontSize: 0 }],
    },
  }
  const result = validateDocument(broken)
  assert.equal(result.ok, false)
  assert.equal(result.ok ? '' : result.issue.code, 'non-finite')
})

test('text is hit by its box, marquee-selectable, and in scene paint order', () => {
  const text = createText('Label', 100, 100, 'Hi', { fontSize: 20 })
  const rect = createRect('Rect', 0, 0, 50, 50)
  const document = insert(createDocument(), [rect, text])

  assert.equal(hitTest(document, { x: 101, y: 101 }), text.id, 'a click inside the text box hits it')
  assert.equal(hitTest(document, { x: 100 + text.width + 4, y: 101 }), null, 'outside the box, nothing')
  assert.deepEqual(marqueeHitTest(document, { x: 90, y: 90, width: 200, height: 200 }), [text.id])
  assert.deepEqual(
    buildScene(document).shapes.map((shape) => [shape.kind, shape.id]),
    [
      ['rect', rect.id],
      ['text', text.id],
    ],
  )
  const sceneText = buildScene(document).shapes[1].text
  assert.equal(sceneText?.content, 'Hi')
  assert.equal(sceneText?.fontFamily, 'Inter')
  assert.equal(sceneText?.fontSize, 20)
})

test('text edits, size changes, and alignment changes are one undo step each', () => {
  const text = createText('Label', 0, 0, 'one')
  documentStore.replaceDocument(insert(createDocument(), [text]))
  documentStore.setSelection([text.id])
  const before = documentStore.getState().undoDepth

  documentStore.dispatch({ type: 'setText', nodeId: text.id, text: 'one two' }, 'edit text')
  assert.equal(documentStore.getState().undoDepth, before + 1)
  assert.equal(textNode(documentStore.getState().document, text.id).text, 'one two')

  runEditorAction('type.sizeUp')
  assert.equal(documentStore.getState().undoDepth, before + 2, 'a size change is one entry')
  assert.equal(textNode(documentStore.getState().document, text.id).fontSize, 18, '16 steps up to 18')

  runEditorAction('type.sizeDown')
  assert.equal(textNode(documentStore.getState().document, text.id).fontSize, 16)

  runEditorAction('type.alignRight')
  assert.equal(textNode(documentStore.getState().document, text.id).align, 'right')
  assert.equal(documentStore.getState().undoDepth, before + 4)

  documentStore.undo()
  assert.equal(textNode(documentStore.getState().document, text.id).align, 'left', 'one undo restores alignment')
  assert.equal(documentStore.getState().undoDepth, before + 3)
})

test('the size stepping list matches Illustrator and the Type actions need text selected', () => {
  assert.equal(nextFontSize(16, 1), 18)
  assert.equal(nextFontSize(16, -1), 14)
  assert.equal(nextFontSize(12, -1), 11)
  assert.ok(Math.abs(nextFontSize(144, 1) - 172.8) < 1e-9, 'past the list it grows by 20%')
  assert.equal(nextFontSize(6, -1), 5, 'below the list it shrinks by 20%')

  const rect = createRect('Rect', 0, 0, 10, 10)
  documentStore.replaceDocument(insert(createDocument(), [rect]))
  documentStore.setSelection([rect.id])
  runEditorAction('type.alignRight')
  assert.equal(
    documentStore.getState().undoDepth,
    0,
    'alignment does nothing when no text is selected (Illustrator greys the command)',
  )
})

