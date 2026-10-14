/**
 * In-place text editor (issue #16).
 *
 * Illustrator edits text on the canvas; so does this: a textarea is positioned over the text
 * object at its own size, weight, color, and alignment, so what the user types is what the
 * canvas will draw. Escape commits (Illustrator's Escape ends text editing), Ctrl+Enter
 * commits, and clicking away commits. It is a real labelled control, so the whole flow works
 * from the keyboard and with a screen reader.
 */

import { useEffect, useRef, useState } from 'react'
import type { TextAlign } from '../../doc/types.ts'

export type TextEditorBox = {
  left: number
  top: number
  width: number
  height: number
  fontSize: number
  lineHeight: number
}

export function TextEditor({
  initialText,
  box,
  color,
  align,
  onCommit,
  onCancel,
}: {
  initialText: string
  box: TextEditorBox
  color: string
  align: TextAlign
  onCommit: (text: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialText)
  const ref = useRef<HTMLTextAreaElement>(null)
  /** Whether the user has actually touched the text, as opposed to merely opening the editor. */
  const interacted = useRef(false)
  /** A stray blur is recovered from once; after that a blur means the user has left for good. */
  const recovered = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <textarea
      ref={ref}
      value={value}
      aria-label="Edit text"
      spellCheck={false}
      className="absolute z-40 resize-none overflow-hidden rounded-ui border border-accent bg-artboard/95 p-0"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        fontSize: box.fontSize,
        lineHeight: `${box.lineHeight}px`,
        color,
        textAlign: align,
      }}
      onChange={(event) => {
        interacted.current = true
        setValue(event.target.value)
      }}
      onKeyDown={(event) => {
        interacted.current = true
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCommit(value)
          return
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          onCommit(value)
          return
        }
        if (event.key === 'Tab') event.preventDefault()
      }}
      onBlur={() => {
        // A blur that arrives before the user has typed anything is the click that opened this
        // editor taking focus away, or some other stray focus change — not the user leaving. Taking
        // it as a commit would delete the object they were about to type into, so recover once and
        // keep the editor open.
        if (!interacted.current && value.trim() === '' && !recovered.current) {
          recovered.current = true
          ref.current?.focus()
          return
        }
        onCommit(value)
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    />
  )
}
