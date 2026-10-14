/**
 * Settings (owner spec after Phase 1: "the user can change the interval on the settings").
 *
 * Preferences are not document state and not layout state, so they get their own store. They are
 * persisted in `localStorage`, which Electron keeps inside the app's user-data directory, so the
 * interval survives a restart. The store mirrors `workspaceStore`: a plain object, a subscribe
 * function, and `useSyncExternalStore` in React.
 *
 * The values are one flat record on purpose — a real Preferences file arrives with the rest of the
 * preference surface (units, undo levels), and this slice only needs the autosave interval to be
 * the user's choice instead of a constant.
 */

import {
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  clampIntervalMinutes,
} from '../app/files/autosavePolicy.ts'

export type Settings = {
  /** Illustrator: "Automatically Save Recovery Data Every: N minutes". */
  autosaveEnabled: boolean
  autosaveIntervalMinutes: number
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveEnabled: true,
  autosaveIntervalMinutes: DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
}

/** Versioned key: a future shape change can migrate instead of guessing at foreign data. */
export const SETTINGS_KEY = 'vectr.settings.v1'

/** A storage the settings can be read from; `localStorage` in the app, a fake in tests. */
export type SettingsStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** Anything unreadable falls back to the default rather than throwing away the whole record. */
export function parseSettings(text: string | null): Settings {
  if (text === null) return { ...DEFAULT_SETTINGS }
  let raw: Partial<Settings>
  try {
    raw = JSON.parse(text) as Partial<Settings>
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  return {
    autosaveEnabled: typeof raw.autosaveEnabled === 'boolean' ? raw.autosaveEnabled : DEFAULT_SETTINGS.autosaveEnabled,
    autosaveIntervalMinutes: clampIntervalMinutes(
      typeof raw.autosaveIntervalMinutes === 'number'
        ? raw.autosaveIntervalMinutes
        : DEFAULT_SETTINGS.autosaveIntervalMinutes,
    ),
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({
    autosaveEnabled: settings.autosaveEnabled,
    autosaveIntervalMinutes: clampIntervalMinutes(settings.autosaveIntervalMinutes),
  })
}

function defaultStorage(): SettingsStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // A blocked origin can throw on access; preferences then live for the session only.
    return null
  }
}

export class SettingsStore {
  private state: Settings
  private listeners = new Set<() => void>()
  private storage: SettingsStorage | null

  constructor(storage: SettingsStorage | null = defaultStorage()) {
    this.storage = storage
    this.state = parseSettings(storage?.getItem(SETTINGS_KEY) ?? null)
  }

  getState = (): Settings => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Only a real change notifies and only a real change is written. */
  private update(patch: Partial<Settings>): void {
    const next: Settings = {
      autosaveEnabled: patch.autosaveEnabled ?? this.state.autosaveEnabled,
      autosaveIntervalMinutes: clampIntervalMinutes(
        patch.autosaveIntervalMinutes ?? this.state.autosaveIntervalMinutes,
      ),
    }
    if (
      next.autosaveEnabled === this.state.autosaveEnabled &&
      next.autosaveIntervalMinutes === this.state.autosaveIntervalMinutes
    ) {
      return
    }
    this.state = next
    try {
      this.storage?.setItem(SETTINGS_KEY, serializeSettings(next))
    } catch {
      // A full or blocked storage must not break editing; the value still applies this session.
    }
    for (const listener of this.listeners) listener()
  }

  setAutosaveIntervalMinutes(minutes: number): void {
    this.update({ autosaveIntervalMinutes: minutes })
  }

  setAutosaveEnabled(enabled: boolean): void {
    this.update({ autosaveEnabled: enabled })
  }

  resetToDefaults(): void {
    this.update({ ...DEFAULT_SETTINGS })
  }
}

export const settingsStore = new SettingsStore()
