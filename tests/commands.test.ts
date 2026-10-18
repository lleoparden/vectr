/** The command registry and its two readers (Phase 3.4). */
import test from "node:test"
import assert from "node:assert/strict"
import { ACTION_IDS, ACTION_LABELS, COMMANDS, chordFor, labelFor } from "../src/app/commands/registry.ts"
import { SHORTCUTS } from "../src/app/menus/shortcuts.ts"
import { MENU_BAR } from "../src/app/menus/menuModel.ts"
import type { MenuItem } from "../src/app/menus/menuModel.ts"

test("every command has one label and the registry covers every id", () => {
  assert.equal(COMMANDS.length, ACTION_IDS.length)
  for (const id of ACTION_IDS) {
    const label = labelFor(id)
    assert.ok(label.trim().length > 0, id + " has a label")
    assert.equal(COMMANDS.find((record) => record.id === id)?.label, label)
  }
})

test("every chord belongs to a real command, and no chord is claimed twice", () => {
  const byKey = new Map<string, string>()
  const byId = new Map<string, string>()
  for (const spec of SHORTCUTS) {
    assert.ok(ACTION_IDS.includes(spec.id), spec.id + " is a command")
    // Delete and Backspace are two spellings of one chord, so an id may appear twice.
    const key = [spec.chord.ctrl ? "ctrl" : "", spec.chord.shift ? "shift" : "", spec.chord.alt ? "alt" : "", spec.chord.key].join("+")
    if (!byId.has(spec.id)) {
      const claimed = byKey.get(key)
      assert.equal(claimed, undefined, key + " is claimed by two commands: " + String(claimed) + " and " + spec.id)
      byKey.set(key, spec.id)
      byId.set(spec.id, spec.chord.key)
      assert.deepEqual(chordFor(spec.id), spec.chord)
    }
  }
  for (const id of ACTION_IDS) {
    if (SHORTCUTS.some((spec) => spec.id === id)) continue
    assert.equal(chordFor(id), undefined, id + " has no chord and says so")
  }
})

test("a divergence from Illustrator must say why", () => {
  for (const spec of SHORTCUTS) {
    if (spec.illustratorDefault) continue
    assert.ok((spec.note ?? "").trim().length > 0, spec.id + " is a divergence and must carry a note")
  }
})

test("every menu command takes its label from the registry and appears once", () => {
  const seen = new Set<string>()
  const walk = (items: MenuItem[]) => {
    for (const item of items) {
      if (item.kind === "command") {
        assert.equal(item.label, labelFor(item.id), item.id + " uses the registry label")
        assert.equal(seen.has(item.id), false, item.id + " appears in the menus once")
        seen.add(item.id)
      } else if (item.kind === "submenu") {
        walk(item.items)
      }
    }
  }
  for (const menu of MENU_BAR) walk(menu.items)
  assert.ok(seen.size > 40, "the menus carry the commands: " + seen.size)
})

test("the registry keeps Illustrator's label wording for the tools", () => {
  assert.equal(labelFor("tool.select"), "Selection Tool")
  assert.equal(labelFor("tool.directSelect"), "Direct Selection Tool")
  assert.equal(labelFor("view.fitArtboard"), "Fit Artboard in Window")
  assert.equal(ACTION_LABELS["tool.rect"], "Rectangle Tool")
})
