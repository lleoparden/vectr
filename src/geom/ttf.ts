/**
 * Minimal TrueType outline reading (Phase 6.9).
 *
 * Skia's CanvasKit exposes glyph metrics but not outlines, so Create Outlines parses the bundled
 * font directly: cmap for character→glyph, loca/glyf for contours, hmtx for advances, and the
 * quadratic curves are converted to the cubic handles `PathAnchor` stores. Variation axes (gvar) are
 * not applied - outlines use the font's default master, which is what the editor draws today.
 */

export type TtfPoint = { x: number; y: number; onCurve: boolean }
export type TtfContour = TtfPoint[]

type Table = { offset: number; length: number }

export type TrueTypeFont = {
  bytes: Uint8Array
  view: DataView
  tables: Map<string, Table>
  unitsPerEm: number
  longLoca: boolean
  glyphCount: number
  ascender: number
  descender: number
  glyphOffsets: number[]
  advanceWidths: number[]
  cmap: Map<number, number>
}

function tag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}

function readTables(view: DataView, bytes: Uint8Array): { tables: Map<string, Table>; font: TrueTypeFont } {
  const numTables = view.getUint16(4)
  const tables = new Map<string, Table>()
  for (let index = 0; index < numTables; index += 1) {
    const record = 12 + index * 16
    tables.set(tag(view, record), {
      offset: view.getUint32(record + 8),
      length: view.getUint32(record + 12),
    })
  }
  const head = tables.get('head')
  const hhea = tables.get('hhea')
  const maxp = tables.get('maxp')
  if (head === undefined || hhea === undefined || maxp === undefined) {
    throw new Error('font is missing head, hhea, or maxp')
  }
  const unitsPerEm = view.getUint16(head.offset + 18)
  const longLoca = view.getInt16(head.offset + 50) === 1
  const glyphCount = view.getUint16(maxp.offset + 4)
  const ascender = view.getInt16(hhea.offset + 4)
  const descender = view.getInt16(hhea.offset + 6)
  const loca = tables.get('loca')
  const glyf = tables.get('glyf')
  const hmtx = tables.get('hmtx')
  if (loca === undefined || glyf === undefined || hmtx === undefined) {
    throw new Error('font is missing loca, glyf, or hmtx')
  }
  const glyphOffsets: number[] = []
  for (let index = 0; index < glyphCount; index += 1) {
    glyphOffsets.push(longLoca ? view.getUint32(loca.offset + index * 4) : view.getUint16(loca.offset + index * 2) * 2)
  }
  const advanceWidths: number[] = []
  for (let index = 0; index < glyphCount; index += 1) {
    advanceWidths.push(view.getUint16(hmtx.offset + index * 4))
  }
  const cmap = readCmap(view, tables.get('cmap'))
  const font: TrueTypeFont = {
    bytes,
    view,
    tables,
    unitsPerEm,
    longLoca,
    glyphCount,
    ascender,
    descender,
    glyphOffsets,
    advanceWidths,
    cmap,
  }
  return { tables, font }
}

function readCmap(view: DataView, table: Table | undefined): Map<number, number> {
  const map = new Map<number, number>()
  if (table === undefined) return map
  const count = view.getUint16(table.offset + 2)
  let format4 = -1
  let format12 = -1
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 4 + index * 8
    const platform = view.getUint16(record)
    const encoding = view.getUint16(record + 2)
    const offset = table.offset + view.getUint32(record + 4)
    const format = view.getUint16(offset)
    if (format === 4 && (platform === 3 || platform === 0) && encoding !== 10) format4 = offset
    if (format === 12) format12 = offset
  }
  if (format12 >= 0) {
    const groups = view.getUint32(format12 + 12)
    for (let index = 0; index < groups; index += 1) {
      const record = format12 + 16 + index * 12
      const start = view.getUint32(record)
      const end = view.getUint32(record + 4)
      const startGlyph = view.getUint32(record + 8)
      for (let code = start; code <= end && code - start < 0x10000; code += 1) {
        map.set(code, startGlyph + (code - start))
      }
    }
    return map
  }
  if (format4 >= 0) {
    const segments = view.getUint16(format4 + 6) / 2
    const endCodes = format4 + 14
    const startCodes = endCodes + segments * 2 + 2
    const idDeltas = startCodes + segments * 2
    const idRangeOffsets = idDeltas + segments * 2
    for (let index = 0; index < segments; index += 1) {
      const end = view.getUint16(endCodes + index * 2)
      const start = view.getUint16(startCodes + index * 2)
      const delta = view.getInt16(idDeltas + index * 2)
      const rangeOffset = view.getUint16(idRangeOffsets + index * 2)
      for (let code = start; code <= end && code !== 0xffff; code += 1) {
        let glyph: number
        if (rangeOffset === 0) {
          glyph = (code + delta) & 0xffff
        } else {
          const address = idRangeOffsets + index * 2 + rangeOffset + (code - start) * 2
          glyph = (view.getUint16(address) + delta) & 0xffff
        }
        if (glyph !== 0) map.set(code, glyph)
      }
    }
  }
  return map
}

export function parseTrueType(bytes: Uint8Array): TrueTypeFont {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return readTables(view, bytes).font
}

export function glyphFor(font: TrueTypeFont, character: string): number {
  return font.cmap.get(character.codePointAt(0) ?? 0) ?? 0
}

export function advanceFor(font: TrueTypeFont, glyph: number): number {
  return font.advanceWidths[glyph] ?? font.unitsPerEm / 2
}

/** Glyph contours in font units (y up), including composite glyphs. */
export function glyphContours(font: TrueTypeFont, glyph: number, depth = 0): TtfContour[] {
  if (glyph < 0 || glyph >= font.glyphCount || depth > 4) return []
  const view = font.view
  const start = font.glyphOffsets[glyph]
  const end = font.glyphOffsets[glyph + 1] ?? start
  if (end <= start) return []
  const offset = font.tables.get('glyf')?.offset ?? 0
  const base = offset + start
  const numberOfContours = view.getInt16(base)
  if (numberOfContours >= 0) return simpleContours(font, base, numberOfContours)
  return compositeContours(font, base, depth)
}

function simpleContours(font: TrueTypeFont, base: number, numberOfContours: number): TtfContour[] {
  const view = font.view
  if (numberOfContours === 0) return []
  const endPoints: number[] = []
  for (let index = 0; index < numberOfContours; index += 1) {
    endPoints.push(view.getUint16(base + 10 + index * 2))
  }
  const pointCount = endPoints[endPoints.length - 1] + 1
  let cursor = base + 10 + numberOfContours * 2
  const instructionLength = view.getUint16(cursor)
  cursor += 2 + instructionLength
  const flags: number[] = []
  while (flags.length < pointCount) {
    const flag = view.getUint8(cursor)
    cursor += 1
    flags.push(flag)
    if ((flag & 0x08) !== 0) {
      const repeat = view.getUint8(cursor)
      cursor += 1
      for (let index = 0; index < repeat; index += 1) flags.push(flag)
    }
  }
  const xs: number[] = []
  let x = 0
  for (const flag of flags) {
    if ((flag & 0x02) !== 0) {
      const delta = view.getUint8(cursor)
      cursor += 1
      x += (flag & 0x10) !== 0 ? delta : -delta
    } else if ((flag & 0x10) === 0) {
      x += view.getInt16(cursor)
      cursor += 2
    }
    xs.push(x)
  }
  const ys: number[] = []
  let y = 0
  for (const flag of flags) {
    if ((flag & 0x04) !== 0) {
      const delta = view.getUint8(cursor)
      cursor += 1
      y += (flag & 0x20) !== 0 ? delta : -delta
    } else if ((flag & 0x20) === 0) {
      y += view.getInt16(cursor)
      cursor += 2
    }
    ys.push(y)
  }
  const contours: TtfContour[] = []
  let start = 0
  for (const endPoint of endPoints) {
    const contour: TtfContour = []
    for (let index = start; index <= endPoint; index += 1) {
      contour.push({ x: xs[index], y: ys[index], onCurve: (flags[index] & 0x01) !== 0 })
    }
    contours.push(contour)
    start = endPoint + 1
  }
  return contours
}

function compositeContours(font: TrueTypeFont, base: number, depth: number): TtfContour[] {
  const view = font.view
  let cursor = base + 10
  const contours: TtfContour[] = []
  let flags = 0
  do {
    flags = view.getUint16(cursor)
    const glyph = view.getUint16(cursor + 2)
    cursor += 4
    let dx: number
    let dy: number
    if ((flags & 0x0001) !== 0) {
      dx = view.getInt16(cursor)
      dy = view.getInt16(cursor + 2)
      cursor += 4
    } else {
      dx = view.getInt8(cursor)
      dy = view.getInt8(cursor + 1)
      cursor += 2
    }
    let a = 1
    let b = 0
    let c = 0
    let d = 1
    if ((flags & 0x0008) !== 0) {
      a = d = view.getInt16(cursor) / 16384
      cursor += 2
    } else if ((flags & 0x0040) !== 0) {
      a = view.getInt16(cursor) / 16384
      d = view.getInt16(cursor + 2) / 16384
      cursor += 4
    } else if ((flags & 0x0080) !== 0) {
      a = view.getInt16(cursor) / 16384
      b = view.getInt16(cursor + 2) / 16384
      c = view.getInt16(cursor + 4) / 16384
      d = view.getInt16(cursor + 6) / 16384
      cursor += 8
    }
    const children = glyphContours(font, glyph, depth + 1)
    for (const contour of children) {
      contours.push(
        contour.map((point) => ({
          x: point.x * a + point.y * c + dx,
          y: point.x * b + point.y * d + dy,
          onCurve: point.onCurve,
        })),
      )
    }
  } while ((flags & 0x0020) !== 0)
  return contours
}

export type OutlineAnchor = { x: number; y: number; inX: number; inY: number; outX: number; outY: number; smooth: boolean }

/**
 * Converts font contours to canvas-space anchors: scale to the font size, flip y (fonts are y-up),
 * and turn each quadratic run into a cubic segment with the standard 2/3 control conversion.
 */
export function contoursToAnchors(
  contours: TtfContour[],
  scale: number,
  offsetX: number,
  offsetY: number,
): OutlineAnchor[][] {
  const result: OutlineAnchor[][] = []
  for (const contour of contours) {
    const points: TtfPoint[] = []
    // Make the sequence alternate on/off by inserting the implied midpoints between two off-curves
    // and rotating so it starts on-curve.
    const source = contour.slice()
    let firstOn = source.findIndex((point) => point.onCurve)
    if (firstOn === -1) {
      firstOn = 0
    }
    for (let index = 0; index < source.length; index += 1) {
      const point = source[(firstOn + index) % source.length]
      const previous = points[points.length - 1]
      if (previous !== undefined && !previous.onCurve && !point.onCurve) {
        points.push({ x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2, onCurve: true })
      }
      points.push(point)
    }
    if (points[0] !== undefined && !points[0].onCurve) {
      points.unshift({ ...points[points.length - 1], onCurve: true })
    }
    if (points.length < 2) continue
    const anchors: OutlineAnchor[] = []
    const at = (point: TtfPoint): OutlineAnchor => ({
      x: point.x * scale + offsetX,
      y: -point.y * scale + offsetY,
      inX: 0,
      inY: 0,
      outX: 0,
      outY: 0,
      smooth: false,
    })
    let current = at(points[0])
    anchors.push(current)
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const next = points[index + 1]
      if (next.onCurve) {
        current = at(next)
        anchors.push(current)
        continue
      }
      const control = next
      const end = points[(index + 2) % points.length]
      current.outX = (2 / 3) * (control.x - from.x) * scale
      current.outY = (2 / 3) * (control.y - from.y) * -scale
      const endAnchor = at(end)
      endAnchor.inX = (2 / 3) * (control.x - end.x) * scale
      endAnchor.inY = (2 / 3) * (control.y - end.y) * -scale
      anchors.push(endAnchor)
      current = endAnchor
      index += 1
    }
    // Drop a duplicated closing anchor; the path is closed.
    if (anchors.length > 1) {
      const first = anchors[0]
      const last = anchors[anchors.length - 1]
      if (Math.hypot(first.x - last.x, first.y - last.y) < 0.01) {
        first.inX = last.inX
        first.inY = last.inY
        anchors.pop()
      }
    }
    if (anchors.length >= 3) result.push(anchors)
  }
  return result
}

/** The outline anchors of one string laid out on a baseline, in the text's local space. */
export function textOutlineContours(
  font: TrueTypeFont,
  content: string,
  fontSize: number,
  lineHeight: number,
  align: 'left' | 'center' | 'right',
  boxWidth: number,
): OutlineAnchor[][] {
  const scale = fontSize / font.unitsPerEm
  const ascent = (font.ascender * fontSize) / font.unitsPerEm
  const lines = content.split('\n')
  const outlines: OutlineAnchor[][] = []
  const widths = lines.map((line) =>
    Array.from(line).reduce((sum, character) => sum + advanceFor(font, glyphFor(font, character)) * scale, 0),
  )
  const maxWidth = Math.max(1, ...widths)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const baseline = lineIndex * lineHeight + ascent
    const startX =
      align === 'center' ? (boxWidth - widths[lineIndex]) / 2 : align === 'right' ? boxWidth - widths[lineIndex] : 0
    let penX = startX
    for (const character of Array.from(lines[lineIndex])) {
      const glyph = glyphFor(font, character)
      const contours = glyphContours(font, glyph)
      for (const contour of contoursToAnchors(contours, scale, penX, baseline)) outlines.push(contour)
      penX += advanceFor(font, glyph) * scale
    }
    void maxWidth
  }
  return outlines
}

/** Approximate advance width of a string in scene units, without kerning. */
export function textAdvanceWidth(font: TrueTypeFont, text: string, fontSize: number, previous = 0): number {
  const scale = fontSize / font.unitsPerEm
  return (
    previous +
    Array.from(text).reduce((sum, character) => sum + advanceFor(font, glyphFor(font, character)) * scale, 0)
  )
}
