/**
 * Number-field arithmetic (Phase 4.6).
 *
 * Illustrator's numeric fields accept small expressions ("120+30", "(2+2)*10") and can be scrubbed with the
 * pointer. Both behaviours are pure functions here so they can be tested without a canvas or a DOM.
 */

/**
 * Evaluates a small arithmetic expression: numbers, + - * /, parentheses, and a leading unary sign.
 * Returns null for anything else - no identifiers, no units, no exponent forms with letters.
 */
export function evaluateExpression(text: string): number | null {
  const source = text.replace(/\s+/g, '')
  if (source.length === 0) return null
  let index = 0

  const parseExpression = (): number | null => {
    let value = parseTerm()
    if (value === null) return null
    while (index < source.length && (source[index] === '+' || source[index] === '-')) {
      const operator = source[index]
      index += 1
      const right = parseTerm()
      if (right === null) return null
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const parseTerm = (): number | null => {
    let value = parseFactor()
    if (value === null) return null
    while (index < source.length && (source[index] === '*' || source[index] === '/')) {
      const operator = source[index]
      index += 1
      const right = parseFactor()
      if (right === null) return null
      if (operator === '/' && right === 0) return null
      value = operator === '*' ? value * right : value / right
    }
    return value
  }

  const parseFactor = (): number | null => {
    if (source[index] === '+') return (index += 1), parseFactor()
    if (source[index] === '-') {
      index += 1
      const value = parseFactor()
      return value === null ? null : -value
    }
    if (source[index] === '(') {
      index += 1
      const value = parseExpression()
      if (value === null || source[index] !== ')') return null
      index += 1
      return value
    }
    const start = index
    while (index < source.length && /[0-9.]/.test(source[index])) index += 1
    if (start === index) return null
    const parsed = Number(source.slice(start, index))
    return Number.isFinite(parsed) ? parsed : null
  }

  const result = parseExpression()
  return index === source.length && result !== null && Number.isFinite(result) ? result : null
}

/** How far one pixel of a horizontal scrub moves a value: two pixels per step, twenty when fine. */
export function scrubValue(
  start: number,
  deltaPixels: number,
  step: number,
  fine: boolean,
  min?: number,
  max?: number,
): number {
  const perPixel = step / (fine ? 20 : 2)
  let next = start + deltaPixels * perPixel
  if (min !== undefined) next = Math.max(min, next)
  if (max !== undefined) next = Math.min(max, next)
  // Integers stay integers unless the step itself is fractional.
  return step >= 1 ? Math.round(next) : Math.round(next * 100) / 100
}
