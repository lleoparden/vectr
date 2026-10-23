/**
 * Threaded text (Phase 6.4).
 *
 * A thread is a head frame that carries the whole story plus a link to the next area frame; each frame
 * stores the slice it shows. Distribution is pure so the rule (how many lines each frame takes) is
 * testable without a canvas; overflow past the last frame stays in the story and is not displayed yet.
 */

/** How many lines a frame shows: the frame height divided by the leading, rounded up like Illustrator. */
export function frameCapacity(height: number, lineHeight: number): number {
  if (!Number.isFinite(height) || !Number.isFinite(lineHeight) || lineHeight <= 0) return 1
  return Math.max(1, Math.ceil(height / lineHeight))
}

/** Split lines across frames in order; lines beyond the last frame are dropped from the display. */
export function distributeLines(lines: string[], capacities: number[]): string[][] {
  const slices: string[][] = []
  let index = 0
  for (const capacity of capacities) {
    slices.push(lines.slice(index, index + Math.max(1, capacity)))
    index += Math.max(1, capacity)
  }
  return slices
}
