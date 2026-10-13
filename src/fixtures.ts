export type FixtureKind = 'empty' | 'representative' | 'stress'

export type Layer = {
  id: string
  d: string
  fill: string
}

const fixtureCounts: Record<FixtureKind, number> = {
  empty: 0,
  representative: 1_000,
  stress: 10_000,
}

function pathFor(index: number, segments: number) {
  const x = (index * 17) % 1200
  const y = (index * 29) % 800
  let d = `M ${x} ${y}`
  for (let segment = 1; segment <= segments; segment += 1) {
    d += ` L ${x + segment * 2} ${y + ((index + segment) % 11)}`
  }
  return d
}

export function createFixture(kind: FixtureKind): Layer[] {
  const segments = kind === 'stress' ? 10 : 4
  return Array.from({ length: fixtureCounts[kind] }, (_, index) => ({
    id: `${kind}-${index}`,
    d: pathFor(index, segments),
    fill: `hsl(${index % 360} 60% 55%)`,
  }))
}
