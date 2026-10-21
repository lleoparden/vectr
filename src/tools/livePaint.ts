/**
 * Live Paint Bucket (Phase 5.4, issue #140).
 *
 * Illustrator's Live Paint paints the regions an arrangement of paths encloses. Vectr's first version
 * is the bucket, and says so: clicking inside an overlap creates a filled path for exactly that face,
 * on top of the artwork, while the paths underneath stay editable. Edges are not painted yet, and
 * each region becomes its own path rather than a live-paint group.
 */

import type { Tool, ToolHost, ToolPoint } from './types.ts'

export function createLivePaintTool(cursor: string): Tool {
  return {
    id: 'livePaint',
    cursor,
    onPointerDown(host: ToolHost, point: ToolPoint): void {
      host.paintRegion(point.scene)
    },
    onPointerMove(): void {},
    onPointerUp(): void {},
    cancel(): void {},
  }
}
