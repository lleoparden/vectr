/**
 * The bucket content signature.
 *
 * The renderer records each root's shapes into a Skia picture and reuses the picture while its
 * signature is unchanged. The signature must therefore cover **everything that affects pixels** -
 * a field it forgets is a style edit that never repaints. The gradient used to be missing from it
 * (issue #156), so switching a fill to a gradient kept drawing the old solid picture.
 *
 * Kept pure and separate from the renderer so the rule is testable without a canvas.
 */

import type { SceneShape } from './scene.ts'

/** One shape's pixel-affecting state, as a string. */
function shapeSignature(shape: SceneShape): string {
  const gradient =
    shape.gradient === null
      ? '-'
      : `${shape.gradient.type}|${shape.gradient.from.x},${shape.gradient.from.y},${shape.gradient.to.x},${shape.gradient.to.y}|` +
        shape.gradient.stops.map((stop) => `${stop.offset}:${stop.color}`).join(',')
  let signature =
    `${shape.id},${shape.x},${shape.y},${shape.rotation},${shape.scaleX},${shape.scaleY},` +
    `${shape.width},${shape.height},${shape.kind},${shape.fill},${shape.opacity},` +
    `${gradient},${shape.gradientTarget ?? '-'},${shape.blendMode ?? '-'},` +
    `${shape.cornerRadius},${shape.lineFrom},${shape.sides},${shape.innerRadius},` +
    `${shape.startAngle},${shape.sweepAngle},${shape.pie},${JSON.stringify(shape.stroke)}`
  if (shape.assetId !== null) signature += `,${shape.assetId},${JSON.stringify(shape.crop)},${shape.maskAssetId ?? '-'}`
  if (shape.clip !== null) signature += `,clip:${shape.clip}`
  // Text content and metrics affect pixels exactly as geometry does.
  if (shape.text !== null) {
    signature += `,${shape.text.content},${shape.text.fontSize},${shape.text.fontFamily},${shape.text.align},${shape.text.lineHeight}`
  }
  return signature
}

/** The signature for every shape in a bucket, in draw order. */
export function contentSignature(shapes: SceneShape[]): string {
  return shapes.map(shapeSignature).join(';')
}
