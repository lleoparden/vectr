/**
 * React binding for the editor store (issue #18).
 *
 * `useSyncExternalStore` reads the store's snapshot directly; nothing is copied
 * into component state, so the document has exactly one owner.
 */

import { useSyncExternalStore } from 'react'
import { documentStore, type EditorState } from './documentStore.ts'

export function useEditorState(): EditorState {
  return useSyncExternalStore(documentStore.subscribe, documentStore.getState, documentStore.getState)
}

export { documentStore }
