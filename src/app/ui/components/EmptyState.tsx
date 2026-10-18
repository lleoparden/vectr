/**
 * The one empty state (issue #133).
 *
 * Every panel that can have nothing to show says so the same way, at the same size, in the same colour.
 */

import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p data-ui-empty-state className="text-ui-xs text-ink-faint">
      {children}
    </p>
  )
}
