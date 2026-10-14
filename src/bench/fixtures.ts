/**
 * Frozen, versioned fixtures for the Phase 1 renderer spike (issue #15).
 *
 * These fixtures are document-shaped on purpose: the same data drives the
 * renderer benchmark now and the editor's renderer later. Nodes carry stable ids,
 * a local transform, a style, and geometry only — no renderer handles and no React
 * state. Generation is deterministic so repeated runs measure identical work.
 *
 * This module stays dependency-free and erasable-syntax only so `node --test` can
 * import it directly.
 */

export const FIXTURE_VERSION = 1

export type FixtureSize = 'empty' | 'representative' | 'stress'
export type FixtureContent = 'primitives' | 'text' | 'images' | 'groups'

export type FixtureTransform = { x: number; y: number; scale: number }
export type FixtureStyle = { fill: string; stroke: string | null; strokeWidth: number }

export type PrimitiveNode = {
  kind: 'rect' | 'ellipse'
  id: string
  transform: FixtureTransform
  width: number
  height: number
  style: FixtureStyle
  /** Polyline resolution used to build the shape path, so cost stays comparable to Phase 0. */
  segments: number
}

export type TextNode = {
  kind: 'text'
  id: string
  transform: FixtureTransform
  text: string
  fontSize: number
  fill: string
}

export type ImageNode = {
  kind: 'image'
  id: string
  transform: FixtureTransform
  width: number
  height: number
  /** Content-addressed key: many nodes may reference the same decoded bytes. */
  asset: string
}

export type GroupNode = {
  kind: 'group'
  id: string
  transform: FixtureTransform
  children: FixtureNode[]
}

export type FixtureNode = PrimitiveNode | TextNode | ImageNode | GroupNode

export type Fixture = {
  version: number
  content: FixtureContent
  size: FixtureSize
  /** Stable shared byte sources referenced by image nodes. */
  assets: Array<{ id: string; width: number; height: number }>
  roots: FixtureNode[]
}

/**
 * Leaf counts per content and size. Image leaves stay lower than geometry leaves
 * because decoded pixels, not node count, dominate their cost.
 */
const leafCounts: Record<FixtureContent, Record<FixtureSize, number>> = {
  primitives: { empty: 0, representative: 1_000, stress: 10_000 },
  text: { empty: 0, representative: 1_000, stress: 10_000 },
  images: { empty: 0, representative: 100, stress: 1_000 },
  groups: { empty: 0, representative: 1_000, stress: 10_000 },
}

/** Edge length of every generated fixture bitmap, in pixels. */
export const FIXTURE_PIXEL_SIZE = 128

/** Shared bitmap sources; eight distinct assets prove shared-byte handling. */
export const FIXTURE_ASSETS = Array.from({ length: 8 }, (_, index) => ({
  id: `asset-${index}`,
  width: FIXTURE_PIXEL_SIZE,
  height: FIXTURE_PIXEL_SIZE,
}))

export function leafCount(content: FixtureContent, size: FixtureSize) {
  return leafCounts[content][size]
}

export function hslToHex(hue: number, saturation: number, lightness: number) {
  const hueNormal = ((hue % 360) + 360) % 360
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const sector = hueNormal / 60
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1))
  const base = lightness - chroma / 2
  const table: Array<[number, number, number]> = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ]
  const [red, green, blue] = table[Math.floor(sector) % 6]
  const channel = (value: number) => Math.round((value + base) * 255)
  return `#${[channel(red), channel(green), channel(blue)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}

export function createFixture(content: FixtureContent, size: FixtureSize): Fixture {
  const leaves = leafCount(content, size)
  const assets = content === 'images' && leaves > 0 ? FIXTURE_ASSETS : []
  const roots =
    content === 'groups'
      ? createGroupRoots(leaves)
      : Array.from({ length: leaves }, (_, index) => createLeaf(content, size, index))
  return { version: FIXTURE_VERSION, content, size, assets, roots }
}

function createLeaf(content: FixtureContent, size: FixtureSize, index: number): FixtureNode {
  const transform: FixtureTransform = {
    x: (index * 17) % 1200,
    y: (index * 29) % 800,
    scale: 1,
  }
  const id = `${content}-${size}-${index}`
  const fill = hslToHex(index % 360, 0.6, 0.55)

  if (content === 'text') {
    return {
      kind: 'text',
      id,
      transform,
      text: `Layer ${index % 97} text sample`,
      fontSize: 12 + (index % 5),
      fill,
    }
  }

  if (content === 'images') {
    return {
      kind: 'image',
      id,
      transform,
      width: 32 + (index % 4) * 8,
      height: 32 + (index % 3) * 8,
      asset: FIXTURE_ASSETS[index % FIXTURE_ASSETS.length].id,
    }
  }

  return {
    kind: index % 2 === 0 ? 'rect' : 'ellipse',
    id,
    transform,
    width: 24 + (index % 7) * 4,
    height: 18 + (index % 5) * 3,
    style: { fill, stroke: hslToHex(index % 360, 0.5, 0.3), strokeWidth: 1 },
    segments: size === 'stress' ? 10 : 4,
  }
}

/** Nested groups, branching three ways, until the requested leaf budget is met. */
function createGroupRoots(leaves: number): FixtureNode[] {
  if (leaves <= 0) return []
  const levels = Math.min(10, Math.max(1, Math.ceil(Math.log(leaves) / Math.log(3))))
  let produced = 0
  const createGroup = (depth: number, path: string): GroupNode => {
    const children: FixtureNode[] = []
    for (let branch = 0; branch < 3 && produced < leaves; branch += 1) {
      const childPath = `${path}.${branch}`
      if (depth + 1 < levels) {
        children.push(createGroup(depth + 1, childPath))
        continue
      }
      const leaf = createLeaf('primitives', 'representative', produced) as PrimitiveNode
      children.push({ ...leaf, id: `group-leaf-${childPath}` })
      produced += 1
    }
    return {
      kind: 'group',
      id: `group-${path}`,
      transform: { x: depth * 12, y: depth * 8, scale: 1 },
      children,
    }
  }
  return [createGroup(0, '0')]
}

/**
 * Local-space vertices for a primitive, in the exact order the renderers emit
 * them: the first vertex, then one vertex per segment. Both the CanvasKit
 * baseline and the comparison candidates build from this list, so geometry parity
 * is structural rather than a claim (issue #25).
 */
export function primitiveLocalPoints(node: PrimitiveNode): number[] {
  if (node.kind === 'ellipse') {
    const steps = Math.max(3, node.segments * 4)
    const radiusX = node.width / 2
    const radiusY = node.height / 2
    // The first vertex repeats the loop's opening angle, matching the baseline.
    const points = [radiusX, 0]
    for (let step = 1; step <= steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2 - Math.PI / 2
      points.push(radiusX + Math.cos(angle) * radiusX, radiusY + Math.sin(angle) * radiusY)
    }
    return points
  }
  const steps = Math.max(3, node.segments)
  const points = [0, 0]
  for (let step = 1; step <= steps; step += 1) {
    points.push((node.width * step) / steps, step % 2 === 0 ? 0 : node.height)
  }
  return points
}

export type FixtureSummary = {
  nodes: number
  leaves: number
  primitives: number
  texts: number
  images: number
  groups: number
  segments: number
  maxDepth: number
}

export function summarizeFixture(fixture: Fixture): FixtureSummary {
  const summary: FixtureSummary = {
    nodes: 0,
    leaves: 0,
    primitives: 0,
    texts: 0,
    images: 0,
    groups: 0,
    segments: 0,
    maxDepth: 0,
  }
  const walk = (nodes: FixtureNode[], depth: number) => {
    summary.maxDepth = Math.max(summary.maxDepth, depth)
    for (const node of nodes) {
      summary.nodes += 1
      if (node.kind === 'group') {
        summary.groups += 1
        walk(node.children, depth + 1)
        continue
      }
      summary.leaves += 1
      if (node.kind === 'text') summary.texts += 1
      if (node.kind === 'image') summary.images += 1
      if (node.kind === 'rect' || node.kind === 'ellipse') {
        summary.primitives += 1
        summary.segments += node.segments
      }
    }
  }
  walk(fixture.roots, 1)
  return summary
}

