/**
 * Shape tests (owner request after Phase 1: line, polygon, star, arc, and rounded corners were
 * missing, the ellipse preview drew a rectangle, and Shift did not constrain a drag).
 *
 * The geometry, the drag math, the new node kinds, their validation, and their round trip are all
 * pure decisions, so they are testable in node without a browser or a GPU.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SHAPE_PARAMS,
  createArc,
  createDocument,
  createLine,
  createPolygon,
  createRect,
  createShape,
  createStar,
  findNode,
  shapeLabel,
} from '../src/doc/document.ts'
import {
  arcPoints,
  clampCornerRadius,
  lineEndpoints,
  outlinePoints,
  polygonPoints,
  starPoints,
} from '../src/geom/shapeGeometry.ts'
import { boxFor, constrainEnd, dragIsBigEnough, lineFrom, snapTo45 } from '../src/app/canvas/shapeDrag.ts'
import { validateDocument } from '../src/doc/validate.ts'
import { buildScene, sceneRootIds } from '../src/render/scene.ts'
import { deserializeDocument, serializeDocument } from '../src/file/serialize.ts'
import { documentStore } from '../src/state/documentStore.ts'
import { marqueeHitTest } from '../src/doc/hitTest.ts'
import type { Document, LayerNode } from '../src/doc/types.ts'

const insert = (nodes: LayerNode[], parentId = 'root'): LayerNode[] => {
  const parent = documentStore.getState().document.root
  const index = parentId === 'root' ? parent.children.length : 0
  const result = documentStore.dispatch({ type: 'insertNodes', parentId, index, nodes })
  assert.equal(result.ok, true, result.ok ? '' : `${result.code}: ${result.message}`)
  return nodes
}

test('arc sampling follows Illustrator angle conventions', () => {
  const box = { width: 100, height: 100 }
  const quarter = arcPoints(box, 0, 90)
  assert.equal(Math.round(quarter[0].x), 100, '0 degrees is the +x axis')
  assert.equal(Math.round(quarter[0].y), 50)
  assert.equal(Math.round(quarter[quarter.length - 1].x), 50, '90 degrees is the top, counterclockwise')
  assert.equal(Math.round(quarter[quarter.length - 1].y), 0)
  assert.ok(arcPoints(box, 0, 90).length >= 30, 'a quarter arc is sampled at about 3 degrees per step')

  const pie = outlinePoints({ kind: 'arc', width: 100, height: 100, startAngle: 0, sweepAngle: 90, pie: true })
  assert.notEqual(pie, null)
  assert.deepEqual(pie?.[pie.length - 1], { x: 50, y: 50 }, 'a pie closes through the centre')

  const negative = arcPoints(box, 0, -90)
  assert.equal(Math.round(negative[negative.length - 1].y), 100, 'a negative sweep runs clockwise')
})

test('lines, corners, and the preview outline agree with the node box', () => {
  assert.deepEqual(lineEndpoints({ width: 10, height: 20 }), [
    { x: 0, y: 0 },
    { x: 10, y: 20 },
  ])
  assert.deepEqual(lineEndpoints({ width: 10, height: 20 }, 'top-right'), [
    { x: 10, y: 0 },
    { x: 0, y: 20 },
  ])
  assert.equal(clampCornerRadius(100, 40, 30), 20, 'a corner radius cannot exceed half the shorter side')
  assert.equal(clampCornerRadius(100, 40, 0), 0)
  assert.equal(outlinePoints({ kind: 'rect', width: 10, height: 10 }), null, 'a rect has its own primitive')

  const starPreview = outlinePoints({ kind: 'star', width: 10, height: 10, points: 5, innerRadius: 0.5 })
  assert.deepEqual(starPreview, starPoints({ width: 10, height: 10 }, 5, 0.5), 'the preview uses the drawn geometry')
})

test('the drag math constrains, normalises, and clamps', () => {
  const start = { x: 10, y: 10 }
  // Shift makes a square from the larger distance, keeping the direction of the drag.
  assert.deepEqual(constrainEnd(start, { x: 60, y: 30 }, 'rect', true), { x: 60, y: 60 })
  assert.deepEqual(constrainEnd(start, { x: 40, y: 90 }, 'ellipse', true), { x: 90, y: 90 })
  assert.deepEqual(
    constrainEnd(start, { x: -30, y: 40 }, 'polygon', true),
    { x: -30, y: 50 },
    'the side is the larger distance, measured from the drag origin',
  )
  assert.deepEqual(constrainEnd(start, { x: 60, y: 30 }, 'rect', false), { x: 60, y: 30 }, 'without Shift nothing is forced')

  // A line snaps to 45 degree steps instead of becoming a square.
  const snapped = snapTo45(start, { x: 100, y: 12 })
  assert.equal(Math.round(snapped.y), Math.round(start.y), 'a nearly horizontal drag snaps to horizontal')
  assert.equal(Math.round(snapped.x), 100, 'and keeps its length')
  const diagonal = constrainEnd(start, { x: 100, y: 96 }, 'line', true)
  assert.equal(Math.round(diagonal.x - start.x), Math.round(diagonal.y - start.y), 'a diagonal stays at 45 degrees')

  // Boxes are normalised, and a line's flat axis is clamped so the node stays valid.
  assert.deepEqual(boxFor({ x: 80, y: 90 }, { x: 30, y: 20 }, 'star'), { x: 30, y: 20, width: 50, height: 70 })
  assert.deepEqual(boxFor({ x: 0, y: 0 }, { x: 40, y: 0 }, 'line'), { x: 0, y: 0, width: 40, height: 1 })

  assert.equal(lineFrom({ x: 0, y: 0 }, { x: 10, y: 10 }), 'top-left')
  assert.equal(lineFrom({ x: 10, y: 0 }, { x: 0, y: 10 }), 'top-right')

  assert.equal(dragIsBigEnough({ x: 0, y: 0 }, { x: 40, y: 0 }, 'line', 4), true, 'a flat line is a line')
  assert.equal(dragIsBigEnough({ x: 0, y: 0 }, { x: 40, y: 0 }, 'rect', 4), false, 'a flat box is not a box')
})

test('every shape tool creates a valid node with its own parameters', () => {
  const box = { x: 10, y: 20, width: 100, height: 80 }
  const params = { ...DEFAULT_SHAPE_PARAMS, cornerRadius: 12, sides: 7, points: 9, innerRadius: 0.4 }

  const rect = createShape('rect', 'Rectangle 1', box, params)
  assert.equal(rect.type, 'rect')
  assert.equal(rect.type === 'rect' ? rect.cornerRadius : -1, 0, 'the plain rectangle never rounds')

  const rounded = createShape('roundedRect', 'Rounded Rectangle 1', box, params)
  assert.equal(rounded.type === 'rect' ? rounded.cornerRadius : -1, 12)

  const polygon = createShape('polygon', 'Polygon 1', box, params)
  assert.equal(polygon.type === 'polygon' ? polygon.sides : -1, 7)

  const star = createShape('star', 'Star 1', box, params)
  assert.equal(star.type === 'star' ? star.points : -1, 9)
  assert.equal(star.type === 'star' ? star.innerRadius : -1, 0.4)

  const line = createShape('line', 'Line 1', box, params, 'top-right')
  assert.equal(line.type === 'line' ? line.from : '', 'top-right')
  assert.deepEqual(line.type === 'line' ? line.style.stroke : null, { color: params.fill, width: params.strokeWidth })

  const arc = createShape('arc', 'Arc 1', box, { ...params, pie: true })
  assert.equal(arc.type === 'arc' ? arc.pie : null, true)

  assert.equal(shapeLabel('roundedRect'), 'Rounded Rectangle')
  assert.equal(shapeLabel('line'), 'Line')
})

test('shape parameters are validated at the document boundary', () => {
  const document = createDocument('Shapes')
  // The creators clamp what a gesture passes, so the invalid nodes here are hand-built the way a
  // corrupt or hand-edited file would arrive.
  const raw = (node: LayerNode, patch: Record<string, unknown>) => ({ ...node, ...patch }) as LayerNode
  const cases: Array<[string, LayerNode]> = [
    ['sides too low', raw(createPolygon('P', 0, 0, 50, 50, 6), { sides: 2 })],
    ['sides too high', raw(createPolygon('P', 0, 0, 50, 50, 6), { sides: 99 })],
    ['points too low', raw(createStar('S', 0, 0, 50, 50, 5, 0.5), { points: 2 })],
    ['inner radius out of range', raw(createStar('S', 0, 0, 50, 50, 5, 0.5), { innerRadius: 1.5 })],
    ['zero sweep', raw(createArc('A', 0, 0, 50, 50, 0, 90, false), { sweepAngle: 0 })],
    ['non-finite angle', raw(createArc('A', 0, 0, 50, 50, 0, 90, false), { startAngle: Number.NaN })],
    ['corner radius beyond half the side', raw(createRect('R', 0, 0, 40, 40, '#ffffff', 0), { cornerRadius: 30 })],
    ['unknown line corner', raw(createLine('L', 0, 0, 40, 40, { color: '#000000', width: 1 }), { from: 'sideways' })],
  ]
  for (const [name, node] of cases) {
    const built: Document = { ...document, root: { ...document.root, children: [node] } }
    assert.equal(validateDocument(built).ok, false, `${name} must be refused`)
  }

  // The creators clamp what the tools pass, so a shape that came from a gesture is always valid.
  const clamped = createPolygon('P', 0, 0, 50, 50, 900)
  assert.equal(clamped.type === 'polygon' ? clamped.sides : -1, 60)
  const clampedStar = createStar('S', 0, 0, 50, 50, 5, 2)
  assert.equal(clampedStar.type === 'star' ? clampedStar.innerRadius : -1, 0.95)
})

test('polygon and star geometry is exact', () => {
  const box = { width: 100, height: 100 }
  const hexagon = polygonPoints(box, 6)
  assert.equal(hexagon.length, 6)
  // Illustrator inscribes a polygon in the drag box: the first vertex touches the top edge and
  // the horizontal extent is the chord, not the box, which is what a hexagon of radius 50 gives.
  assert.equal(Math.round(hexagon[0].x), 50)
  assert.equal(Math.round(hexagon[0].y), 0)
  assert.equal(Math.round(Math.max(...hexagon.map((point) => point.x))), 93)
  assert.equal(Math.round(Math.min(...hexagon.map((point) => point.x))), 7)

  const fiveStar = starPoints(box, 5, 0.5)
  assert.equal(fiveStar.length, 10, 'a five-pointed star has ten vertices')
  assert.equal(Math.round(fiveStar[0].y), 0, 'the first tip is at the top')
  const radiusOf = (point: { x: number; y: number }) => Math.round(Math.hypot(point.x - 50, point.y - 50))
  assert.equal(radiusOf(fiveStar[0]), 50)
  assert.equal(radiusOf(fiveStar[1]), 25, 'the valley sits at half the radius')

  // Out-of-range parameters are clamped rather than producing a broken shape.
  assert.equal(polygonPoints(box, 2).length, 3)
  assert.equal(polygonPoints(box, 900).length, 60)
  assert.equal(starPoints(box, 5, 0).length, 10)
})

test('new shape kinds reach the scene, hit testing, and the file', () => {
  documentStore.replaceDocument(createDocument('Shape kinds'))
  const nodes = insert([
    createLine('Line 1', 0, 0, 60, 40, { color: '#123456', width: 3 }, 'top-right'),
    createPolygon('Polygon 1', 80, 0, 60, 60, 8),
    createStar('Star 1', 0, 100, 60, 60, 6, 0.35),
    createArc('Arc 1', 80, 100, 60, 60, 45, 180, true),
    createRect('Rounded', 0, 200, 60, 60, '#abcdef', 10),
  ])
  const document = documentStore.getState().document

  const scene = buildScene(document)
  assert.deepEqual(sceneRootIds(scene), nodes.map((node) => node.id), 'paint order follows the tree')
  const byKind = new Map(scene.shapes.map((shape) => [shape.kind, shape]))
  assert.equal(byKind.get('line')?.lineFrom, 'top-right')
  assert.equal(byKind.get('line')?.stroke?.width, 3, 'a line carries its stroke into the scene')
  assert.equal(byKind.get('polygon')?.sides, 8)
  assert.equal(byKind.get('star')?.sides, 6, 'a star reports its tips as its sides')
  assert.equal(byKind.get('star')?.innerRadius, 0.35)
  assert.equal(byKind.get('arc')?.startAngle, 45)
  assert.equal(byKind.get('arc')?.pie, true)
  assert.equal(byKind.get('rect')?.cornerRadius, 10, 'rounded corners reach the renderer instead of being dropped')

  // Marquee selection is box-based for every leaf, so the new kinds select like any other shape.
  const marquee = marqueeHitTest(document, { x: -10, y: -10, width: 200, height: 90 })
  assert.deepEqual(marquee, [nodes[0].id, nodes[1].id], 'the marquee takes the line and the polygon in paint order')

  // The file round trip keeps every parameter, and a reopen is byte-identical.
  const first = serializeDocument(document).manifest
  const parsed = deserializeDocument(first)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.document.formatVersion, 9)
  const reopened = findNode(parsed.document, nodes[3].id)
  assert.equal(reopened?.type === 'arc' ? reopened.pie : null, true, 'the reopened arc is still a pie')
  const reopenedStar = findNode(parsed.document, nodes[2].id)
  assert.equal(reopenedStar?.type === 'star' ? reopenedStar.innerRadius : null, 0.35)
  assert.equal(serializeDocument(parsed.document).manifest, first, 'resaving is byte-identical')
})

test('creating a shape is one undo entry and undo removes it', () => {
  documentStore.replaceDocument(createDocument('Undo'))
  const depth = documentStore.getState().undoDepth
  const [star] = insert([createStar('Star 1', 0, 0, 50, 50, 5, 0.5)])
  assert.equal(documentStore.getState().document.root.children.length, 1)
  assert.ok(documentStore.getState().document.root.children.some((node) => node.id === star.id))
  documentStore.undo()
  assert.equal(
    documentStore.getState().document.root.children.length,
    0,
    'undo takes the created shape away in one step',
  )
  assert.equal(documentStore.getState().undoDepth, depth)
})

