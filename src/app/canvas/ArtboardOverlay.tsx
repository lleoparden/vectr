/**
 * Artboard chrome (UI pass): the page's name and size, drawn where Illustrator puts them.
 *
 * The renderer paints the page itself; this overlay labels it, so a user can see which sheet they are
 * on and how big it is without opening a panel. It is DOM rather than renderer text on purpose: a label
 * must stay the same size at every zoom, and it must not be recorded into a page's picture (labels have
 * no business in an exported layer).
 */

import type { ArtboardRect } from '../../doc/artboards.ts'

export type ArtboardOverlayProps = {
  pages: ArtboardRect[]
  activeId: string | null
  zoom: number
  panX: number
  panY: number
}

export function ArtboardOverlay({ pages, activeId, zoom, panX, panY }: ArtboardOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="false">
      {pages.map((page) => {
        const left = page.x * zoom + panX
        const top = page.y * zoom + panY
        const width = page.width * zoom
        const height = page.height * zoom
        const active = page.id === activeId
        // Skip pages entirely off screen, so a many-page document costs nothing to show.
        if (left + width < -40 || top + height < -40) return null
        const offRight = left > window.innerWidth + 40
        const offBottom = top > window.innerHeight + 40
        if (offRight || offBottom) return null
        return (
          <div key={page.id} className="absolute" style={{ left, top, width, height }}>
            <span
              className={
                'absolute -top-[18px] left-0 flex max-w-full items-center gap-1 truncate text-[10px] leading-none ' +
                (active ? 'text-accent-ink' : 'text-ink-faint')
              }
              data-artboard-label={page.id}
            >
              <span className={active ? 'font-medium' : ''}>{page.name}</span>
              <span className="text-ink-faint/70 tabular-nums">
                {page.width}×{page.height}
              </span>
            </span>
            {active && (
              <span
                className="pointer-events-none absolute inset-0 border border-accent/40"
                data-artboard-active={page.id}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
