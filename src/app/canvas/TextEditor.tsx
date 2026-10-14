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
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
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
      onBlur={() => onCommit(value)}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    />
  )
}
