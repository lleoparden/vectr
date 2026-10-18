/**
 * Artboard chrome (UI pass): the page's name and size, plus the Artboard tool's resize handles.
 *
 * The renderer paints the page itself; this overlay labels it and, when the Artboard tool is active,
 * offers the three edges a page can grow from. A page cannot grow left or upward because its placed
 * corner is the anchor — Illustrator allows either, but Vectr's layout only needs the two growable
 * directions, and offering an edge that silently does nothing would be the lie the UI rule forbids.
 */

import type { ArtboardRect } from '../../doc/artboards.ts'
import type { ResizeEdge } from '../editing/artboardDrag.ts'

export type ArtboardOverlayProps = {
  pages: ArtboardRect[]
  activeId: string | null
  zoom: number
  panX: number
  panY: number
  /** True when the Artboard tool is active, which shows resize handles on the active page. */
  resizing: boolean
  toScene: (event: { clientX: number; clientY: number }) => { x: number; y: number }
  onResizeStart: (edge: ResizeEdge, point: { x: number; y: number }) => void
  onResizeMove: (edge: ResizeEdge, point: { x: number; y: number }) => void
  onResizeEnd: () => void
}

const HANDLE = 8
const EDGES: ResizeEdge[] = ['e', 's', 'se']

export function ArtboardOverlay({
  pages,
  activeId,
  zoom,
  panX,
  panY,
  resizing,
  toScene,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: ArtboardOverlayProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {pages.map((page) => {
        const left = page.x * zoom + panX
        const top = page.y * zoom + panY
        const width = page.width * zoom
        const height = page.height * zoom
        const active = page.id === activeId
        if (left + width < -40 || top + height < -40) return null
        if (left > window.innerWidth + 40 || top > window.innerHeight + 40) return null
        return (
          <div key={page.id} className="pointer-events-none absolute" style={{ left, top, width, height }}>
            <span
              className={
                'absolute -top-[18px] left-0 flex max-w-full items-center gap-1 truncate text-[10px] leading-none ' +
                (active ? 'text-accent-ink' : 'text-ink-faint')
              }
              data-artboard-label={page.id}
            >
              <span className={active ? 'font-medium' : ''}>{page.name}</span>
              <span className="tabular-nums text-ink-faint/70">
                {page.width}×{page.height}
              </span>
            </span>
            {active && (
              <span className="pointer-events-none absolute inset-0 border border-accent/40" data-artboard-active={page.id} />
            )}
            {active &&
              resizing &&
              EDGES.map((edge) => {
                const style: React.CSSProperties =
                  edge === 'e'
                    ? { left: width - HANDLE / 2, top: height / 2 - HANDLE / 2 }
                    : edge === 's'
                      ? { left: width / 2 - HANDLE / 2, top: height - HANDLE / 2 }
                      : { left: width - HANDLE / 2, top: height - HANDLE / 2 }
                return (
                  <div
                    key={edge}
                    role="button"
                    tabIndex={-1}
                    aria-label={`Resize artboard from its ${edge === 'e' ? 'right' : edge === 's' ? 'bottom' : 'corner'} edge`}
                    data-artboard-handle={edge}
                    className="pointer-events-auto absolute rounded-[1px] border border-accent bg-chrome-panel"
                    style={{ ...style, width: HANDLE, height: HANDLE, cursor: edge === 'e' ? 'ew-resize' : edge === 's' ? 'ns-resize' : 'nwse-resize' }}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      onResizeStart(edge, toScene(event))
                    }}
                    onPointerMove={(event) => {
                      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                      onResizeMove(edge, toScene(event))
                    }}
                    onPointerUp={(event) => {
                      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                      event.currentTarget.releasePointerCapture(event.pointerId)
                      onResizeEnd()
                    }}
                    onPointerCancel={() => onResizeEnd()}
                  />
                )
              })}
          </div>
        )
      })}
    </div>
  )
}
