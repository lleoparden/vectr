/**
 * React binding for the settings store (owner spec: the autosave interval is the user's choice).
 *
 * Same pattern as `useWorkspaceState`: `useSyncExternalStore`, so no component keeps a copy.
 */

import { useSyncExternalStore } from 'react'
import { settingsStore, type Settings } from './settingsStore.ts'

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState, settingsStore.getState)
}

export { settingsStore }
