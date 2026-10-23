/**
 * Area-text line breaking (Phase 6.2).
 *
 * Pure so the wrapping rule is testable without a canvas: the caller supplies `measure`, which the
 * renderer backs with the real font. Paragraph breaks are honoured, words are kept whole where they
 * fit, and a word wider than the frame is broken by characters rather than overflowing silently
 * (Illustrator's area text wraps long words too).
 */

export function wrapText(text: string, maxWidth: number, measure: (line: string) => number): string[] {
  const width = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : 0
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of paragraph.split(' ')) {
      const candidate = current.length === 0 ? word : `${current} ${word}`
      if (width === 0 || measure(candidate) <= width) {
        current = candidate
        // A single word wider than the frame: break it by characters.
        if (current.length > 0 && measure(current) > width) {
          let piece = ''
          for (const character of current) {
            if (piece.length > 0 && measure(piece + character) > width) {
              lines.push(piece)
              piece = character
            } else {
              piece += character
            }
          }
          current = piece
        }
        continue
      }
      if (current.length > 0) lines.push(current)
      current = word
      if (measure(current) > width) {
        let piece = ''
        for (const character of current) {
          if (piece.length > 0 && measure(piece + character) > width) {
            lines.push(piece)
            piece = character
          } else {
            piece += character
          }
        }
        current = piece
      }
    }
    lines.push(current)
  }
  return lines
}
