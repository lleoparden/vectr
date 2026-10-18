/**
 * Rulers, guides, and their drag gestures (issue #67).
 *
 * The two strips across the top and the left, in scene units scaled by the view, plus the guide lines
 * they produce: drag off a ruler to place one, drag it to move it, double-click it to remove it. All of it
 * is view chrome and never enters the renderer's recording, so a guide cannot end up in an exported layer.
 */

import { useEffect, useRef, useState } from 'react'
import type { Guide } from '../../doc/types.ts'
import { beginLiveEdit, endLiveEdit, markLiveChanged } from '../ui/liveEdit.ts'

export type RulersOverlayProps = {
  guides: Guide[]
  showRulers: boolean
  showGuides: boolean
  zoom: number
  panX: number
  panY: number
  width: number
  height: number
  onAddGuide: (axis: 'x' | 'y', position: number) => string | null
  onMoveGuide: (guideId: string, position: number) => void
  onRemoveGuide: (guideId: string) => void
}

const RULER = 18
const TICK_SPACES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000]

/** Tick spacing that leaves about 60 screen pixels between labels at any zoom. */
function tickStep(zoom: number): number {
  for (const step of TICK_SPACES) {
    if (step * zoom >= 60) return step
  }
  return TICK_SPACES[TICK_SPACES.length - 1]
}

function Ticks({ length, pan, zoom, vertical }: { length: number; pan: number; zoom: number; vertical: boolean }) {
  const step = tickStep(zoom)
  const startScene = (0 - pan) / zoom
  const endScene = (length - pan) / zoom
  const ticks: Array<{ at: number; major: boolean; label: string | null }> = []
  const first = Math.floor(startScene / step) * step
  for (let value = first; value <= endScene; value += step) {
    const at = value * zoom + pan
    const major = Math.round(value / step) % 5 === 0
    ticks.push({ at, major, label: major ? String(Math.round(value)) : null })
  }
  return (
    <>
      {ticks.map((tick) => (
        <span key={(vertical ? 'v' : 'h') + tick.at}>
          <span
            aria-hidden="true"
            className="absolute bg-hairline"
            style={
              vertical
                ? { left: RULER - (tick.major ? 7 : 4), top: tick.at, width: tick.major ? 7 : 4, height: 1 }
                : { left: tick.at, top: RULER - (tick.major ? 7 : 4), height: tick.major ? 7 : 4, width: 1 }
            }
          />
          {tick.label !== null && (
            <span
              aria-hidden="true"
              className="absolute text-[9px] leading-none text-ink-faint"
              style={vertical ? { left: 2, top: tick.at + 1, writingMode: 'vertical-rl' } : { left: tick.at + 2, top: 2 }}
            >
              {tick.label}
            </span>
          )}
        </span>
      ))}
    </>
  )
}

export function RulersOverlay({
  guides,
  showRulers,
  showGuides,
  zoom,
  panX,
  panY,
  width,
  height,
  onAddGuide,
  onMoveGuide,
  onRemoveGuide,
}: RulersOverlayProps) {
  const [pending, setPending] = useState<{ axis: 'x' | 'y' } | null>(null)
  const createdGuide = useRef<string | null>(null)
  const draggingGuide = useRef<string | null>(null)

  const startFromRuler = (axis: 'x' | 'y') => {
    beginLiveEdit('add guide')
    markLiveChanged()
    const position = axis === 'x' ? (RULER - panX) / zoom : (RULER - panY) / zoom
    createdGuide.current = onAddGuide(axis, position)
    setPending({ axis })
  }

  useEffect(() => {
    if (pending === null) return
    const onMove = (event: PointerEvent) => {
      const id = createdGuide.current
      if (id === null) return
      const position = pending.axis === 'x' ? (event.clientX - RULER - panX) / zoom : (event.clientY - RULER - panY) / zoom
      markLiveChanged()
      onMoveGuide(id, position)
    }
    const onUp = () => {
      createdGuide.current = null
      setPending(null)
      endLiveEdit()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [pending, zoom, panX, panY, onMoveGuide])

  if (!showRulers && !showGuides) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {showRulers && (
        <>
          <div
            data-ruler="top"
            className="pointer-events-auto absolute left-0 top-0 cursor-row-resize border-b border-hairline bg-chrome-sunken/95"
            style={{ width, height: RULER }}
            onPointerDown={() => startFromRuler('y')}
          />
          <div
            data-ruler="left"
            className="pointer-events-auto absolute left-0 top-0 cursor-col-resize border-r border-hairline bg-chrome-sunken/95"
            style={{ width: RULER, height }}
            onPointerDown={() => startFromRuler('x')}
          />
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 border-b border-r border-hairline bg-chrome-panel"
            style={{ width: RULER, height: RULER }}
          />
          <div className="absolute left-0 top-0" style={{ width, height: RULER }}>
            <Ticks length={width} pan={panX} zoom={zoom} vertical={false} />
          </div>
          <div className="absolute left-0 top-0" style={{ width: RULER, height }}>
            <Ticks length={height} pan={panY} zoom={zoom} vertical />
          </div>
        </>
      )}

      {showGuides &&
        guides.map((guide) => {
          const at = guide.axis === 'x' ? panX + guide.position * zoom : panY + guide.position * zoom
          return (
            <div
              key={guide.id}
              role="separator"
              aria-label={(guide.axis === 'x' ? 'Vertical' : 'Horizontal') + ' guide at ' + Math.round(guide.position)}
              data-guide={guide.id}
              className="pointer-events-auto absolute bg-cyan-400/70 hover:bg-cyan-300"
              style={
                guide.axis === 'x'
                  ? { left: at, top: 0, width: 1, height, cursor: 'col-resize' }
                  : { left: 0, top: at, height: 1, width, cursor: 'row-resize' }
              }
              onDoubleClick={() => onRemoveGuide(guide.id)}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                draggingGuide.current = guide.id
                beginLiveEdit('move guide')
              }}
              onPointerMove={(event) => {
                if (draggingGuide.current !== guide.id) return
                const position =
                  guide.axis === 'x' ? (event.clientX - RULER - panX) / zoom : (event.clientY - RULER - panY) / zoom
                markLiveChanged()
                onMoveGuide(guide.id, position)
              }}
              onPointerUp={() => {
                draggingGuide.current = null
                endLiveEdit()
              }}
            />
          )
        })}

      {pending !== null && <span className="absolute inset-0 cursor-crosshair" />}
    </div>
  )
}
