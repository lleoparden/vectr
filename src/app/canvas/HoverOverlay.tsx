/**
 * The hover outline (Phase 4.3).
 *
 * Illustrator outlines the object a click would select, which is the cheapest way to answer "what am
 * I about to hit". It uses the tools' own hit test, so it cannot disagree with the selection.
 */

export type HoverOverlayProps = {
  box: { x: number; y: number; width: number; height: number }
  rotation: number
  zoom: number
  panX: number
  panY: number
}

export function HoverOverlay({ box, rotation, zoom, panX, panY }: HoverOverlayProps) {
  const left = box.x * zoom + panX
  const top = box.y * zoom + panY
  const width = Math.max(1, box.width * zoom)
  const height = Math.max(1, box.height * zoom)
  const centreX = left + width / 2
  const centreY = top + height / 2
  return (
    <div className="pointer-events-none absolute inset-0" data-hover-outline aria-hidden="true">
      <div
        className="absolute border border-accent/60"
        style={{
          left,
          top,
          width,
          height,
          transform: rotation === 0 ? undefined : `rotate(${rotation}deg)`,
          transformOrigin: `${centreX - left}px ${centreY - top}px`,
        }}
      />
    </div>
  )
}
