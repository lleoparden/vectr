/**
 * Autosave and recovery decisions (owner spec after Phase 1).
 *
 * The pieces that decide *what* to snapshot, *how often*, and *what to say* are pure, so the rules
 * the owner asked for are pinned here rather than discovered by waiting ten minutes.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  MAX_AUTOSAVE_INTERVAL_MINUTES,
  MIN_AUTOSAVE_INTERVAL_MINUTES,
  clampIntervalMinutes,
  intervalMilliseconds,
  shouldWriteSnapshot,
} from '../src/app/files/autosavePolicy.ts'
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SettingsStore,
  parseSettings,
  serializeSettings,
} from '../src/state/settingsStore.ts'
import { clockTime, crashRecoveryCopy, recoveryStatusText } from '../src/app/files/recoveryPrompt.ts'

test('autosave only touches a document that already has a file', () => {
  // The owner's rule: autosave works once the file is saved, not before.
  assert.equal(
    shouldWriteSnapshot({ reason: 'interval', hasFilePath: false, isDirty: true, enabled: true }),
    false,
    'an untitled document is not autosaved',
  )
  assert.equal(
    shouldWriteSnapshot({ reason: 'interval', hasFilePath: true, isDirty: true, enabled: true }),
    true,
    'a saved document with unsaved changes is',
  )
  assert.equal(
    shouldWriteSnapshot({ reason: 'interval', hasFilePath: true, isDirty: false, enabled: true }),
    false,
    'and only while it is dirty',
  )
  assert.equal(
    shouldWriteSnapshot({ reason: 'interval', hasFilePath: true, isDirty: true, enabled: false }),
    false,
    'turning autosave off stops it',
  )
  // The close path is a different net: it fires as unsaved work is dropped, so it covers an
  // untitled document too, and it does not care whether the interval is enabled.
  assert.equal(
    shouldWriteSnapshot({ reason: 'close', hasFilePath: false, isDirty: true, enabled: false }),
    true,
    'discarding unsaved work still snapshots it',
  )
  assert.equal(
    shouldWriteSnapshot({ reason: 'close', hasFilePath: false, isDirty: false, enabled: true }),
    false,
    'but a clean document has nothing to snapshot',
  )
})

test('the interval is the user\u2019s choice and stays inside its range', () => {
  assert.equal(DEFAULT_AUTOSAVE_INTERVAL_MINUTES, 10, 'Illustrator ships ten minutes')
  assert.equal(clampIntervalMinutes(0), MIN_AUTOSAVE_INTERVAL_MINUTES)
  assert.equal(clampIntervalMinutes(-5), MIN_AUTOSAVE_INTERVAL_MINUTES)
  assert.equal(clampIntervalMinutes(999), MAX_AUTOSAVE_INTERVAL_MINUTES)
  assert.equal(clampIntervalMinutes(7.6), 8, 'a typed fraction becomes whole minutes')
  assert.equal(clampIntervalMinutes(Number.NaN), DEFAULT_AUTOSAVE_INTERVAL_MINUTES)
  assert.equal(intervalMilliseconds(DEFAULT_AUTOSAVE_INTERVAL_MINUTES), 600_000)
  assert.equal(intervalMilliseconds(0), 60_000, 'the timer can never be set to zero')
})

test('settings survive a restart and refuse foreign data', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS, 'nothing stored means the defaults')
  assert.deepEqual(parseSettings('not json'), DEFAULT_SETTINGS)
  assert.deepEqual(parseSettings('{"autosaveEnabled":"yes"}'), DEFAULT_SETTINGS, 'wrong types are ignored')
  const parsed = parseSettings('{"autosaveEnabled":false,"autosaveIntervalMinutes":45}')
  assert.deepEqual(parsed, { autosaveEnabled: false, autosaveIntervalMinutes: 45 })
  assert.deepEqual(
    parseSettings('{"autosaveIntervalMinutes":900}'),
    { autosaveEnabled: true, autosaveIntervalMinutes: MAX_AUTOSAVE_INTERVAL_MINUTES },
    'a stored value outside the range is clamped instead of trusted',
  )
  assert.equal(JSON.parse(serializeSettings(parsed)).autosaveIntervalMinutes, 45, 'round trip')

  const written = new Map<string, string>()
  const storage = { getItem: (key: string) => written.get(key) ?? null, setItem: (key: string, value: string) => written.set(key, value) }
  const store = new SettingsStore(storage)
  assert.deepEqual(store.getState(), DEFAULT_SETTINGS)
  let notifications = 0
  store.subscribe(() => (notifications += 1))
  store.setAutosaveIntervalMinutes(25)
  assert.equal(store.getState().autosaveIntervalMinutes, 25, 'the store applies the change')
  assert.equal(written.get(SETTINGS_KEY)?.includes('25'), true, 'and persists it')
  assert.equal(notifications, 1)
  store.setAutosaveIntervalMinutes(25.2)
  assert.equal(notifications, 1, 'setting the same value again notifies nobody')
  store.setAutosaveEnabled(false)
  assert.equal(notifications, 2)
  // A restart reads what was written.
  assert.deepEqual(new SettingsStore(storage).getState(), { autosaveEnabled: false, autosaveIntervalMinutes: 25 })
})

test('the crash dialog says Vectr closed in the wrong way and names the file', () => {
  const copy = crashRecoveryCopy({
    documentName: 'Poster',
    savedAt: '2026-10-14T14:32:00.000Z',
    directory: '/projects/Poster.vectr',
  })
  assert.equal(copy.title, 'Vectr closed unexpectedly')
  assert.match(copy.body, /did not shut down cleanly/)
  assert.match(copy.body, /Poster/, 'the document is named')
  assert.match(copy.body, /never saved/, 'and it says the work is unsaved')
  assert.match(copy.detail, /\/projects\/Poster\.vectr/, 'the file it belongs to is named')
  assert.equal(copy.restore, 'Restore the recovery copy')

  const untitled = crashRecoveryCopy({ documentName: '', savedAt: 'nonsense', directory: null })
  assert.match(untitled.body, /Untitled/)
  assert.match(untitled.body, /an unknown time/, 'an unusable timestamp is admitted, not faked')
  assert.match(untitled.detail, /never been saved/)

  assert.equal(clockTime('2026-10-14T14:32:00.000Z').length > 0, true)
  assert.equal(clockTime('nope'), 'an unknown time')
  assert.equal(recoveryStatusText(null), 'No recovery copy is waiting.')
  assert.match(recoveryStatusText('2026-10-14T14:32:00.000Z'), /recovery copy from/)
})
