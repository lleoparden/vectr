/**
 * Artboard chrome (UI pass): the page's name and size, plus the Artboard tool's resize handles.
 *
 * The renderer paints the page itself; this overlay labels it and, when the Artboard tool is active,
 * offers the three edges a page can grow from. A page cannot grow left or upward because its placed
 * corner is the anchor — Illustrator allows either, but Vectr's layout only needs the two growable
 * directions, and offering an edge that silently does nothing would be the lie the UI rule forbids.
 */

import type { ArtboardRect } from '../../doc/artboards.ts'

export type ArtboardOverlayProps = {
  pages: ArtboardRect[]
  activeId: string | null
  zoom: number
  panX: number
  panY: number
}

const HANDLE = 8

export function ArtboardOverlay({
  pages,
  activeId,
  zoom,
  panX,
  panY,
}: ArtboardOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
          </div>
        )
      })}
    </div>
  )
}
