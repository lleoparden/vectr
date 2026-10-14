/**
 * React binding for the workspace store (issue #28).
 *
 * Same pattern as `useEditorState`: the store is read through
 * `useSyncExternalStore`, so no component keeps a copy of the layout.
 */

import { useSyncExternalStore } from 'react'
import { workspaceStore, type WorkspaceState } from './workspaceStore.ts'

export function useWorkspaceState(): WorkspaceState {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getState, workspaceStore.getState)
}

export { workspaceStore }
