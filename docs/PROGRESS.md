# Progress


## UI pass, second half — Appearance, Color, status bar, Control panel (2026-10-17)

The rest of the shell now matches the Properties rebuild.

- **Appearance** edits the selection's fill, stroke colour and weight, opacity, and blend mode live, using
  the same actions as Properties — a view of one appearance model, not a second one.
- **Color** opens with the same live colour control (wheel, hex, recents), then the named Vectr palette and
  the colours this document already uses, with the active colour marked by a pressed state and a check.
- **Status bar** rebuilt: the tool is named in words (Direct Selection, not `directSelect`), separation is
  visual, the saved/unsaved state has a dot, the zoom readout is clickable and prints its chord, and the
  **isolation chip is back** — a merge resolution had dropped it while leaving the variable behind.
- **Control panel** reads as chrome instead of text: labelled controls, readouts in chips with tabular
  numbers, and the tool switch as one segmented control.

**Evidence:** `npm run typecheck` and `npm run build` clean; `npm test` **214/214**; packaged run **113
steps across seven reports**, `[vectr-ui]` **14/14** with two new steps — the Color panel lists its palette
and applying a swatch changes the fill, and the Appearance panel's opacity slider updates the object live.



## UI pass — live Properties, a real colour control, and a layout that stays put (2026-10-17)

The owner asked for a Properties panel that updates in real time, a colour control with more options, and a
UI that looks and behaves better. This is that pass.

- **Everything is live.** Typing a number, dragging the opacity slider, and turning the colour wheel all
  reach the document on the change itself — no blur required. The edit session is the undo unit: focusing a
  field opens a transaction and blurring closes it, so a wheel drag is still one step to undo.
- **A colour control with options.** The swatch opens a popover holding the platform **wheel**, a **hex**
  field that accepts `#abc`, `abcdef`, or `#abcdef`, the **document's own colours**, a fixed twelve-colour
  **palette**, and **recently used** colours. Swatches show a check on the active colour and stay readable
  via Rec. 709 luma.
- **Shared field primitives** (`ui/fields.tsx`): one height, radius, focus ring, and label column for every
  input, a switch for toggles, a slider for opacity, and consistent buttons — so the panel reads as one
  surface instead of a pile of inputs.
- **Layout fixed.** Sections with headers, a fixed label column, controls that shrink, and
  `overflow-x-hidden` on every panel body: Properties scrolls vertically only. Scrollbars, range thumbs,
  colour swatches, number spinners, and keyboard focus are styled once in `styles.css`.

**Evidence:** `npm run typecheck` and `npm run build` clean; `npm test` **214/214** (5 new in
`tests/fields.test.ts`: hex forms, RGB/readability, the gradient-angle round trip, a live session as one
undo entry, and a focus that changes nothing recording no history); packaged run **111 steps across seven
reports**, `[vectr-ui]` 12/12 with three new steps — the colour popover opens with wheel/hex/swatches,
clicking a swatch applies it immediately, typing in a number field updates the object **before blur with
focus kept**, and the panel's `scrollWidth` never exceeds its `clientWidth`.



## Phase 2 — exit audit (2026-10-17)

Every slice of Phase 2 has shipped a pull request with its own branch, tests, typecheck, build, packaged
evidence, catalog update, and self-review. This audit checks the epic's exit criteria against what is
actually on `main`, and names the gaps instead of rounding them up.

### Slice by slice

| Slice | Issue | Merged | Verified |
| --- | --- | --- | --- |
| 2.1 selection modes | #64 | #75 | 156 tests · packaged 94 steps · lasso rule follow-up #76 |
| lasso encloses like Illustrator | #64 follow-up | #76 | 156 tests · unit cases for enclosed vs crossing |
| 2.2 transforms (move/scale) | #65 | #77 | 165 tests · packaged 101 steps · rotate/reflect/shear recorded as remaining |
| 2.3 align, distribute, clipboard | #66 | #78 | 173 tests · packaged 100 steps · packaged run caught two wrong assertions first |
| 2.4 artboards | #67 | #80 (contract #79) | 177 tests · packaged 102 steps · no artboard tool, rulers, grid, or guides yet |
| 2.5 snapping | #68 | #83 (contract #81) | 186 tests · packaged 105 steps · drags only |
| 2.6 paint (fill, weight, colour, opacity, caps, joins, dashes) | #69 | #82, #84, #85, #88, #91 | 206 tests at #91 · packaged 107 steps · stroke alignment and width profiles remain |
| 2.7 gradients and blend modes | #70 | #90, #92 | 209 tests · packaged 107 steps · linear two-stop gradients and six blend modes; radial, multi-stop editor, stroke blending remain |
| 2.8 isolation and clipping | #71 | #86, #89 (contract #87) | 200 tests at #89 · packaged 107 steps · one clip per shape, sampled curves |

### The epic's exit statement, honestly

Phase 2's stated exit is *"users can create polished layered vector artwork with standard tools"*. On
`main` today a user can: draw seven shape kinds; select objects, nested leaves, lasso-enclosed sets, and
drill into groups; move, scale, nudge, align, and distribute; copy, cut, and paste; work across multiple
artboards; snap to pages and objects with Smart Guides; edit fill, gradient, stroke weight, colour, caps,
joins, dashes, opacity, and blend mode; isolate a group; and clip a group to one of its objects — with
every edit one undo entry, saved and reopened byte-stably, at format version 4.

**That is substantially the exit, with five named gaps rather than silent ones:**

1. **No rotation, reflect, or shear.** `SEL-02` stays `building`: the scene builder carries no rotation and
   the hit test is axis-aligned, so those need a rotation slice (scene matrix, inverse-rotation hit test,
   rotated bounds and outline) before a control can be honest.
2. **No artboard tool, rulers, grid, or placeable guides.** `CAN-01` stays `building`; pages exist and are
   editable from Properties, but the precision-canvas surface is not there.
3. **Gradients are linear and two-stop in the UI.** `PAINT-03` stays `building`; the model accepts up to
   eight stops and the compiler will want them, but the panel offers start/end plus an angle.
4. **Blend modes apply to fills only**, and only six of them (`APP-01` `building`). Stroke and text blending
   need an isolation group.
5. **No swatch libraries, CMYK, or spot colours.** `PAINT-02` is still `planned`: colours are hex strings.

### Recorded limits a user can run into

- Marquee and lasso ignore clipping masks (a click does not): selecting by area can catch a clipped-away
  object, while clicking its hidden part selects nothing.
- One clip is in force per shape: an inner clipped group replaces an outer clip instead of intersecting.
- Clip curves are sampled (ellipse 64 points, four per rounded corner), and text/image clips use the box.
- A nested node inside a *scaled* group would scale in local units; nothing can create such a group yet.
- Snapshots and budgets are unchanged from Phase 1: 600 MiB idle, 1,200 MiB stress, Windows-only testing.

### Verification of the audit itself

Read from `main` at `5d0fffe` with `npm test` (**209/209**), `npm run typecheck`, and `npm run build` clean.
The packaged run each slice cited is the `electron . --smoke=stress` pass recorded in its pull request; the
most recent is **107 steps across seven reports**, `[vectr-smoke]` 39/39.




## Phase 2.1 — selection modes, lasso, and a live corner radius (2026-10-17, issue #64)

Phase 2 is under way. The owner's instruction was to start it, ship each issue as its own pull
request, and merge what has been reviewed properly. This is the first slice of the dependency order
in `docs/PLAN.md`; it needs none of the four open Phase 2 decisions.

**What now works**

- **Direct Selection (`A`)** selects the deepest leaf under the pointer, and its marquee selects
  leaves rather than whole groups. Selection (`V`) still returns the top-level object. The two share
  Illustrator's black/white arrow palette slot with a flyout.
- **Double-click nests one level at a time.** `hierarchySelection` walks the top-level-to-leaf chain
  and descends one step, so a second double-click reaches the child and a leaf stops. A double-click
  that lands on a text object still opens the inline editor.
- **Lasso (`Q`)** selects every visible, unlocked object its freehand path touches — corner inside
  the path, path vertex inside the object, or an edge crossing — with Shift adding to the selection.
  Its own palette slot, its own preview, and Illustrator's own key.
- **The corner radius is now editable on an existing rectangle.** `setCornerRadius` is a document
  command with an exact inverse; the Control panel's `Corners` field and a new Properties field edit
  it, both clamped to half the shorter side. A locked rectangle, a non-finite value, a negative one,
  and one past the clamp are all refused by the command with their own codes.

**Evidence**

- `npm run typecheck` clean, `npm run build` clean, `npm test` **156/156** (11 new in
  `tests/selection.test.ts`: polygon containment including a concave path, the lasso's touched-bounds
  rule with deep/collapsed/locked/hidden cases, hierarchy drilling at four depths, the radius command
  with every refusal and an exact inverse, the clamp-and-undo control path, the palette grouping, the
  two chords, and the radius field's presence/absence rules).
- Packaged `electron . --smoke=stress` on the production bundle, with `ELECTRON_RUN_AS_NODE` cleared:
  **94 steps across seven reports, all passing** — `[vectr-smoke]` 26/26 (five new: direct selection
  reaches a nested leaf, double-click drills one level, the lasso selects what its path touches,
  corner radius clamps as one entry, undo restores the previous radius), `[vectr-file]` 20/20 (new:
  reopen restores the edited corner radius 24), `[vectr-text]` 12/12, `[vectr-ui]` 8/8 (the palette
  slot assertion now expects four slots and the Lasso's `Q`), `[vectr-path]` 9/9, `[vectr-memory]`
  11/11, `[vectr-stress]` 8/8.
- The run also settles the environment question from the records correction: `npm run smoke` does
  work here once `ELECTRON_RUN_AS_NODE=1` is cleared; the earlier attempt was Electron running as
  Node, and a second attempt without that flag had simply not finished before it was sampled.

**Recorded limits** (also in `docs/DECISIONS.md` and `PATH-02`): no anchor-level selection or Group
Selection tool, no corner widget on the canvas, and the lasso's rule is the touched-bounds test
rather than Illustrator's enclosed-path test.

## Records corrected: stale Phase 1 statements, and no more divergence counting (2026-10-17, docs)

The owner asked for a read-through of the rules, plans, and progress records. Reading them against
the code found six statements that had drifted; this pass corrects the record only. No product
code, document format, command, or behavior changed.

1. **The UI-01 entry said the shell refinement was still unmerged** — "normal/high-DPI desktop
   inspection remains required before the slice is merged". It was merged as PR #63. The entry now
   records the merge, the checks that actually ran at the branch head, and the one check that did
   **not** run: the desktop visual pass PR #63 itself lists as unavailable.
2. **The "Known issues" block was Phase-1-era.** It claimed nothing was persisted, the layer tree
   was read-only, `cornerRadius` was modelled but not drawn, and the File menu was absent; all four
   had shipped. It is rewritten to the product's actual limits, split into what is not built yet,
   verification gaps, and accepted limits.
3. **`README.md` advertised 119 unit tests and a 37-step smoke run.** `npm test` is 145/145 as of
   this pass, and the hard-coded smoke step count is gone: it changes whenever a slice adds a step,
   and the README is not where that number is maintained.
4. **The catalog** listed `duplicate` as still planned on `SEL-03` although `object.duplicate` ships
   from four surfaces as one undo step, and recorded `Escape` as a deselect after the conformance
   pass made it a cancel key.
5. **`DOC-01` still said format version 2 was current.** `FORMAT_VERSION` is 3 after IMAGE-01 added
   the link mode, normalized crop, and mask reference; documents at v1, v2, and v3 all open.
6. **Divergence counts contradicted each other** — sixteen in `DECISIONS.md`, nineteen in the
   catalog, fourteen and eighteen in different parts of this file. Rather than compute a seventh
   number that would drift the same way, the catalog, this record, and the decision log now point
   at the per-slice lists in `docs/DECISIONS.md` as the authority.

**Verification.** `npm run typecheck`, `npm run build`, and `npm test` (**145/145**) all passed in
this session on this branch's tree. `npm run smoke` was
attempted and **did not complete**: `ELECTRON_RUN_AS_NODE=1` is set in this shell, so `electron .`
ran as plain Node, and with that cleared the app launched and rendered but had not finished the run
after several minutes here. No packaged evidence is claimed. The README now documents the
`ELECTRON_RUN_AS_NODE` trap and no longer quotes a step count.

## Autosave, crash recovery, preferences, and the memory budget (2026-10-14, owner spec)

The owner set the autosave rules, delegated the memory number, and approved the next capability
slices. This is the first of them (`feat/recovery-preferences`, issue #56).

**The rules, as implemented**

| Owner's rule | What it means here |
| --- | --- |
| "should save as .vectr folder in the user folder for recovery" | The snapshot is `userData/recovery.vectr/`: `manifest.json` + the content-addressed `assets/` + a `recovery.json` sidecar. Written with the same failure-safe write a normal save uses, outside any project. |
| "if vectr crashes it brings up the old file saying it closed in a wrong way" | An orderly quit writes a clean-exit marker; a crash cannot. At launch, a snapshot with no marker opens a dialog: "Vectr closed unexpectedly", the document's name, when the copy was taken, and Restore / Discard. Restoring reopens the document **at its own path**, so Save goes back to the user's file, and restores the revision the file matched so the recovered work is correctly dirty. |
| "auto save should only work when a file is already saved" | `shouldWriteSnapshot`: an interval snapshot needs a dirty document that already has a file. An untitled document is never autosaved. The close path is a different net — it fires as unsaved work is dropped, so it covers an untitled document too. |
| "the user can change the interval on the settings" | `settingsStore` persists `autosaveEnabled` and `autosaveIntervalMinutes` (1–60, default 10 minutes like Illustrator) in `localStorage`; Edit ▸ Preferences… (Ctrl+K) edits them; the timer follows the setting. |

**Why the folder matters, not just the shape of it:** the old snapshot held only the manifest, so a
crashed document with placed images would have come back with empty frames. The snapshot now carries
the bytes, and restoring refills the asset registry from the manifest's own references.

**The memory budget is decided (the owner delegated it).** Whole-app working set, all processes:
**600 MiB** for an idle editor (measured **369.1 MiB** with nothing open in this run; ~453 MiB in the
Phase 1 audit) and **1,200 MiB** for 1,000 shapes + 48 images (measured **703.5 MiB** peak, 0 decoded
images after close). Both are asserted in the packaged `[vectr-memory]` report, alongside "decoded
images back to 0 and registry empty after close". The reasoning and the two honest limits — budgets
apply to a fresh window and a single peak, and CanvasKit does not return its WASM/GPU memory promptly
(703.4 MiB after close in the same session) — are in `docs/DECISIONS.md`. **The idle budget was
originally asserted in the wrong place** (after a stress document, where it read 680 MiB and failed);
the run's own failure caught that, and it is now measured where "idle" means something.

**Evidence**

- **143/143 unit tests**, including a new `tests/autosave.test.ts`: the autosave rule (saved vs
  untitled, dirty, enabled, close-vs-interval), the interval range and clamping, settings persistence
  and foreign-data refusal, and the crash copy (it says it closed unexpectedly, names the document and
  the file, and admits an unusable timestamp rather than faking one). The recovery suite now proves a
  folder snapshot carries asset bytes, that what the manifest references is what comes back, and that
  a manifest without a sidecar, a corrupt sidecar, or a missing manifest all count as **no** snapshot.
- **`[vectr-file]` grew to 19 steps** with four new ones, all passing in the packaged app: the
  snapshot is a project folder carrying the document's assets; an unclean exit is reported as a crash
  *by name* (the dialog is real DOM, `data-crash-dialog`); restoring brings the work back **and keeps
  it attached to its file**; and an interval snapshot is refused for a document that has not been
  saved yet.
- **`[vectr-memory]` grew to 11 steps**: the idle budget, the stress budget, the bounded decoded-asset
  cache, and an explicit record of the post-close working set so the high-water mark is neither
  presented as idle behavior nor mistaken for a leak.
- Packaged totals: **87 steps across seven reports**, all passing.


## The inline text editor now grows as you type (2026-10-14, owner report)

"I told you the text box that appears when you click for the first time [should] expand when you
write more, as it's too small and nothing fits in it." Correct, and this is what was wrong: the
editor was sized from the node's **stored** box — the text's size at its last commit — so a new empty
object started at 32 px and stayed there, clipping everything after the first glyphs.

**Fixed** (`fix/text-editor-grows`, issue #54):

- `src/app/canvas/textEditorBox.ts` (new, pure, unit-tested): the sizing rule — measured size, a
  32 px × one-line minimum so an empty object is still clickable, 2 px for the border that sits inside
  the box, whole pixels.
- `TextEditor` takes a `measure` callback and re-measures on **every** keystroke with the same
  function the commit uses, so the box you type in is the box the canvas stores and draws.
- `wrap="off"` + `white-space: pre` + the node's font family: the canvas never wraps text, so the
  editor must not either.

**Evidence:** one new unit test (138 total, all passing) and five new packaged steps in
`[vectr-text]` (12 there now, 79 across the seven reports) that measure the real textarea's bounding
rect: the editor was **34 px** wide on the first click and **312 px** after a long line was typed,
grew **19 px → 36 px** tall when a second line was added, and the committed object stores the box the
editor had grown to (354×38 document units at that zoom).

Still a documented difference: the canvas underneath shows the previous box until you commit, because
a text edit must stay **one** undo step (issue #16) rather than issuing a command per keystroke.


## Shape tools complete, honest drag previews, and autosave/recovery answered (2026-10-14, owner request)

The owner reported that an ellipse drag previewed a rectangle, that Shift did nothing, and that
"line, polygon, star, arc, rounded corners they are all missing" from the phase table's PATH-01 row.
All three are closed, and the rest of the owner's list is answered below with its real status.

**What changed (issue #52, `feat/path-shapes`)**

- **The preview is now the shape.** `src/doc/shapeGeometry.ts` is the single source for every
  outline; the renderer builds its Skia path from it and the canvas builds the drag preview from the
  same points, so a preview can no longer disagree with what gets drawn. The old overlay was a
  bordered `<div>`, which is exactly why an ellipse looked like a rectangle.
- **Shift constrains** (`src/app/canvas/shapeDrag.ts`): square for rectangle/rounded rectangle/
  polygon/star, circle for ellipse/arc, 45° snap for a line, read on every move.
- **The missing shapes exist**: `line`, `polygon` (3–60 sides), `star` (3–60 tips + inner radius),
  `arc` (start, sweep, pie), and `rect.cornerRadius` is now **drawn** rather than only modelled. Each
  has its own tool in the shape slot, which now holds seven members behind one flyout (Rectangle `M`,
  Rounded Rectangle, Ellipse `L`, Polygon, Star, Line Segment `\`, Arc).
- **The options bar follows the member**: Corner radius, Sides, Points + Inner radius, Stroke weight,
  Start angle + Sweep + Pie — each setting what the next shape draws.
- **Format version 2** with `[1, 2]` supported: old files still open, no migration needed, and the
  validation boundary checks the new parameters (sides, tips, inner radius, sweep, corner radius,
  line corner) so a hand-edited file is refused with a reason.

**Evidence**

- **137/137 unit tests**, including a new `tests/shapes.test.ts` (geometry exactness, arc angle
  conventions, corner clamping, drag constraints and normalisation, creator parameters, boundary
  validation of all six shape kinds, scene parameters, marquee selection, a byte-identical v2 round
  trip, and one-entry undo of a created shape) plus a v1-manifest test proving old files still open.
- **New packaged report `[vectr-path]`, 9 steps**, driving the real palette, the real options bar, and
  real pointer drags: the flyout lists seven members; an ellipse drag previews an `<ellipse>` element
  and creates an ellipse; Shift draws a 137×137 circle; Polygon 8 sides; Star 7 points at 30% inner
  radius; Rounded Rectangle radius 24 reaching the scene; a Shift line segment snapping to a 45° step
  with the stroke weight set; a 180° pie arc.
- Packaged totals are now **74 steps across seven reports** (smoke 21, file 15, text 7, ui 7,
  path 9, memory 7, stress 8).
- The report caught a real defect on its first run: the shape switch in the options bar still
  hardcoded `rect`/`ellipse`, so picking Polygon/Star/Line/Arc activated Rectangle. Fixed, and now
  proven per member.

**The owner's question: "auto save and crash recovery — how are they?"**

They are implemented and evidenced. This is exactly what exists (`DOC-04`, issue #19):

| Behavior | Status |
| --- | --- |
| Rolling recovery snapshot while the document is dirty | **Yes** — every 30 s (`RECOVERY_INTERVAL_MS`), written only when `isDirty()` |
| Snapshot before the window unloads | **Yes** — `beforeunload` handler |
| Snapshot before unsaved work is discarded (close → discard, New, Open) | **Yes** — taken before the old document is dropped |
| Recovery data kept outside the project, so a failed save cannot corrupt it | **Yes** — `userData/recovery` |
| Checked at launch and offered in the File menu | **Yes** — `File > Recover Unsaved Work`, enabled only when a snapshot exists |
| Consumed once used | **Yes** — cleared after a successful recover or save |
| Proven end to end | **Yes** — `[vectr-file]` writes a snapshot, refreshes availability, recovers the unsaved rename, and asserts it clears |

Not yet built, stated plainly: an autosave that writes **into the open project** (Illustrator does not
do this either — its "Automatically Save Recovery Data" writes recovery data and Save stays manual),
a Preferences UI for the interval (30 s is a constant), and a visible "recovery available" badge
beyond the File menu item. If the owner wants an in-place autosave or a preferences control, that is a
small slice — it needs a decision on the interval and on whether writing into the user's file without
an explicit Save is acceptable.

**The rest of the owner's list, with its real status** (the phase table's own wording is quoted):

| ID | Expected at phase exit | Real status |
| --- | --- | --- |
| PERF-01 | verified, or blocked with recorded evidence | **Open, gate amended, not met.** CanvasKit recorded-picture measured; no candidate meets 33 ms on 10,000 loose primitives. The budget still needs an owner decision. |
| DOC-01 | verified | **building.** Model, ids, ordered tree, artboards, revision, and now format v2 are implemented and tested; `verified` needs the save/reopen + platform recording that `DOC-04`'s evidence partly supplies. |
| DOC-02 | verified | **building.** Tree, nesting, lock/hide with inheritance, drag reorder, group/ungroup, Arrange, duplicate, thumbnails. Missing: isolate mode, the target/locate column, nested thumbnails, layer-into-layer drag. |
| DOC-03 | verified | **building.** One validated command path, transactions, undo/redo with exact inverses, refusal codes. Nothing known is missing; it lacks the acceptance fixture that `verified` requires. |
| DOC-04 | verified, or partial with recorded limits | **building, close to partial.** Save/open/recover/save-as, asset portability, autosave snapshots, and crash recovery all work and are evidenced; missing an explicit limits statement and the in-place autosave question above. |
| PATH-01 | building (rectangle and ellipse) | **building, now the full list** — rectangle, ellipse, line, polygon, star, arc, and drawn rounded corners. Missing: spiral, grid, flare, and live corner reshaping. |
| SEL-01 | building (pointer and keyboard object selection) | **building.** Click, shift-click, marquee, select-all, Escape, inherited locks. Missing: direct selection, lasso, anchor-level selection. |
| SEL-03 | building (reorder, group, ungroup) | **building.** Reorder, group, ungroup, arrange, duplicate, new layer, locked-aware delete. Missing: **distribute, copy/paste, and global edit**. |
| TYPE-01 | building (plain point text) | **building.** Point text with exact-inverse commands, a measured box, alignment, size, colour. Missing: **area text, text on a path, threaded text**, and typography UI beyond the options bar. |
| IMAGE-01 | building (place, embed, link, relink, crop, masks) | **building.** PNG/JPEG Place and Place Linked, content-addressed embedded assets, external linked sources, missing-link placeholder/relink, non-destructive crop, and raster alpha masks with exact-inverse commands. Still missing: clipping masks, tracing, generic mask editing, and colour management. |

The honest summary: the phase table is accurate about what was expected, and PATH-01 was the only row
on the owner's list whose content was actually absent; the others are missing *parts* of rows already
marked `building`. The largest genuinely unbuilt items are area/threaded text, link/relink and masks,
distribute and copy/paste, isolate mode, and the PERF-01 budget decision — each needs an approved
slice, and none of them is a one-file change.

**Next, in the order I would take them** (each still wants the owner's approval before it starts):

1. `SEL-03`: copy/paste (Ctrl+C/X/V, with Illustrator's paste offset) and distribute.
2. `TYPE-01`: area text (a box that wraps), then threaded text between boxes.
3. `IMAGE-01`: link/relink (a link is already content-addressed, so relink is a swap) and a crop
   rectangle that clips an image.
4. `DOC-02`: isolate mode and the target/locate column, which the Layers panel still lacks.
5. `PERF-01`: the memory budget decision, which is the only Phase 1 item that cannot be closed by work.

## Tool options bar and the grouped shape tool (2026-10-14, owner request)

The owner asked for a small horizontal bar that changes with every tool, "like the one in
Illustrator", and for the rectangle and the ellipse to be one shape tool. Both are Illustrator
conventions, and both are now in the shell (`feat/tool-options-bar`, issue #50).

**What was built**

- `src/app/ui/toolOptions.ts` (new, pure): `TOOL_GROUPS` — the palette as three slots
  (Selection, Shape, Type) with Rectangle and Ellipse as two members of the shape slot — plus
  `displayToolFor` (the slot shows the member in use, or the one last picked),
  `hasSelectedText`, and `toolOptionsModel(tool, selection, document, defaults, canRun)`, which
  returns the bar's controls as data.
- `src/app/shell/ToolOptionsBar.tsx` (new): Illustrator's Control panel in Vectr's chrome, under
  the menu bar. Selection tool → X/Y/W/H readouts and the object commands the state allows; shape
  tool → the Rectangle/Ellipse switch, the next shape's fill, a Stroke readout; Type tool → size,
  horizontal alignment, colour, and a hint saying whether they apply to the selection or the next
  text object.
- `src/app/shell/ToolPalette.tsx`: rewritten around the groups, with the corner-triangle flyout
  (also on right-click) listing the members and their `M` / `L` keys.
- `workspaceStore.creationDefaults`: the shape the slot shows and the fill, size, alignment, and
  colour the tools draw with, so the bar's controls actually mean something.
- `setToolShapeMember`, `setToolShapeFill`, `setToolTextFill`, `setToolTextSize`,
  `setToolTextAlign` in `src/app/actions.ts`: each edits the selection when it can take the change
  (one undo entry, like any style or text edit) and otherwise sets what the next object uses.
  `tool.rect` / `tool.ellipse` route through `setToolShapeMember`, so the palette, the flyout, the
  bar's switch, and the keyboard shortcuts always leave the slot showing the same tool.
- `createRect` / `createEllipse` take the fill to draw with, and `CanvasView` reads the defaults
  when it creates a shape or a text object.

**Evidence**

- 129/129 unit tests pass, including three new cases: the group table and member memory, the bar's
  per-tool model (empty state, shape row, type row, selection row, gated commands), and that
  picking a member anywhere remembers it.
- New packaged report `[vectr-ui]`, 7/7 steps: the palette shows three slots with a shape flyout,
  clicking the Type slot changes the bar, the Type tool draws with size 42 / centre / `#7c6cf5`,
  the bar's switch activates the member it names, a drag draws one ellipse with the chosen fill, the
  Selection row reports X/Y/W/H and enables Duplicate, and the flyout switches members.
- Total packaged evidence is now **65 steps across six reports**.

**Two things the work exposed, both fixed**

1. `runEditorAction('tool.ellipse')` set the tool but not the remembered member, so picking Ellipse
   from the flyout and then switching tools made the shape slot fall back to Rectangle. Every tool
   entry point now goes through `setToolShapeMember`.
2. The new smoke report first failed because its synthetic drag used `pointerId: 2`;
   `setPointerCapture` rejects an id that is not an active pointer, so the gesture never started.
   A mouse is pointer id 1, and the harness now drags as one — the same class of lesson as the Type
   tool bug: a scripted event is only evidence when it goes through the browser's real path.

**Divergences** are recorded in `docs/DECISIONS.md` (read-only geometry readouts, no
Appearance/Align/Transform sections, no corner-radius control because the renderer does not draw
rounded corners, stroke as a readout, and a fixed quick-fill palette).


## Phase 1 — exit audit (2026-10-14, after the owner asked whether it is really done)

The owner asked for the epic's exit criteria to be checked one by one rather than taken on trust.
Each criterion below was verified against evidence produced on `main`, and the two shortfalls found
were closed in the same session (`fix/phase-1-exit-evidence`).

| Epic exit criterion | Verdict | Evidence |
| --- | --- | --- |
| A user can create, edit, save, reopen, and recover a layered document with rectangles, ellipses, groups, text, and **images** | **Met** | `[vectr-file]` 11/11 saves and reopens a document containing a nested group, text and a placed image, then resaves it byte-identically; images shipped as issue #17 (`IMAGE-01`) and are drawn from their asset in `[vectr-stress]` |
| Every visible edit is one bounded transaction, and no failed command leaves a partial mutation | **Met** | `[vectr-smoke]` asserts one-entry drag, group, text edit; `runPlan` rolls back a refused plan; the command path returns a code without mutating |
| Save/reopen preserves stable IDs, layer order, nesting, and asset bytes | **Met** | Round-trip fidelity test over every node kind; asset bytes verified by content hash on open; `[vectr-file]` resave is byte-identical |
| Canvas paint order equals layer-tree order at every moment | **Met** | `buildScene` walks the tree once; tests assert scene order equals tree order after grouping and arranging |
| The spike records total-process, JS, WASM, and GPU memory plus redraw, resize, **zoom**, replacement, and repeated load/unload, with an explicit verdict | **Met (verdict: amended, not met)** | `.ecc/benchmarks/phase-one/summary.json`: working set 817 MiB, private 995 MiB, **GPU 280 MiB**, `wasmBytes` 7.3 MB, `maxHeapBytes` per entry, scenarios `fixture`/`resize`/`replace`/`unload`, leak verdict "retained scene objects returned to zero". **Zoom was missing** and is now recorded in `[vectr-memory]`: 0.25× 7.6 ms · 1× 1.0 ms · 2× 0.6 ms · 4× 0.1 ms |
| Memory behavior on representative **and stress** documents is recorded | **Met, budget undefined** | Representative: 453.5 MiB (`[vectr-file]`). Stress: **792.6 MiB working set** with 1,000 shapes + 48 distinct images (157 KiB of PNG bytes, ~27 MiB decoded), 795.6 MiB after save, 799.8 MiB after reopen, 799.3 MiB after close with **0 decoded images held**. No owner-approved budget exists to test against (see below) |
| Catalog entries and `docs/PROGRESS.md` are updated in the same pull request as each behavior change | **Met** | Every slice PR carried its catalog and progress update |

**The two shortfalls, now closed:**

1. **Zoom had no recorded evidence** in any run, although the criterion names it. `[vectr-memory]`
   now draws the stress scene at four zoom levels and records each time.
2. **The decoded-asset cache was unbounded per asset id.** The epic's own architecture constraint
   says renderer caches must be "derived, bounded, and explicitly disposed", and a session that
   opened several documents would have accumulated their pixels. `EditorRenderer.retainAssets()`
   now releases every decoded image the current document does not need, the canvas calls it whenever
   the asset set changes, and `RenderStats.decodedAssets` makes the bound observable — the packaged
   run asserts it returns to 0 when the document is closed.

**One owner decision is still open, and it is not something I should invent: there is no approved
memory budget.** `docs/DECISIONS.md` records that "the exact budgets need owner approval in the
benchmark", and no approval is on file. The numbers above are therefore recorded against an
undefined target. Measured behavior worth deciding against:

- An empty editor with a small document sits at ~**453 MiB** whole-app working set.
- The stress document (1,000 shapes + 48 images) adds ~**340 MiB**, reaching ~**793 MiB**.
- Closing the document releases the decoded cache (48 → 0 images, registry empty) but the process
  working set does **not** fall back to the baseline within the measured window (~799 MiB): CanvasKit's
  WASM and GPU allocations are not returned to the operating system promptly. A fresh window starts
  clean, which is why this is recorded as a behavior to budget around rather than a leak — the
  leak check in the spike verdict passes, and retained scene objects return to zero.


## Phase 1 — complete

**Product statement, demonstrated on the packaged Windows build: a user can create, edit, save,
reopen, and recover a layered document.**

All six approved slices are merged to `main` — editable shapes (#18), layers and groups (#20),
plain text (#16), images (#17), durable local documents (#19) — on top of the renderer spike (#15,
optimized in #23) and the workspace shell (#28), with the aggregate-inverse command work (#34) that
makes a composed gesture one undo step and a UI conformance pass (#36).

Exit evidence, all produced in this session on `main`:

- `npm run typecheck` clean, `npm run build` clean, `npm test` **119/119**.
- `electron . --smoke=stress` on the production bundle passes **37/37** recorded steps across three
  reports:
  - `[vectr-smoke]` **18/18** — create, select, drag as one history entry, undo/redo, marquee, a
    rejected command, delete with selection pruning, group as one entry, undo-ungroups, text
    creation and one-entry editing, an invalid text style rejected, and a missing font retired.
  - `[vectr-file]` **11/11** — save, dirty-state clearing, an edit after save, reopen restoring the
    layer tree, geometry, text and the image, a byte-identical resave (3208 bytes), a clean
    reopened document, recovery snapshot written, recovery restoring unsaved work, recovery
    cleared, and a memory record of **453.5 MiB whole app** with one image asset.
  - `[vectr-stress]` **8/8** — a real PNG imported and drawn from its asset, undo/redo of the
    placement, an unavailable font reported rather than silently drawn, and **1,004 shapes in 16
    buckets at render p95 1.0–1.3 ms over 60 frames** against the 33 ms interaction target.

Exit criteria from the epic, with where each is proven:

| Criterion | Evidence |
| --- | --- |
| One authoritative versioned document with stable ids and an ordered tree | `DOC-01`; 119 tests; manifest round trip |
| One validated, serializable, undoable command path for every mutation | `DOC-03`; every rejection has a code; `batch`/transaction history |
| Bounded transactional undo/redo, a drag or text edit as one entry | `DOC-03`; the smoke's one-entry steps |
| Layer list, multi-selection, reorder, group/ungroup, nesting, paint order | `DOC-02`/`SEL-03`; the smoke's group steps; paint-order tests |
| Plain text with content, position, size, color, multiline, missing-font behavior | `TYPE-01`; the substitution report in the smoke |
| Images into content-addressed assets that join selection, movement, ordering, history | `IMAGE-01`; the smoke's import/undo/redo/draw steps |
| New/open/save/save-as, manifest plus asset directory, validation, dirty state, failure-safe writes | `DOC-04`; the `[vectr-file]` report and the file tests |
| Crash recovery offered explicitly, discarding the only lossy path | `DOC-04`; one rolling snapshot, tested |
| No JSON-embedded base64 assets and no whole-document undo snapshots | Asserted by test; history stores inverses |
| Memory recorded for a stress document after save, reopen, and close | `[vectr-memory]` 6/6: 792.6 MiB stress working set, 799.8 MiB after reopen, 799.3 MiB after close with 0 decoded images held — see the exit audit above |

Recorded gaps and limitations, so Phase 2 starts from an honest baseline:

- **Platform coverage is Windows only.** macOS and Linux build and launch are still unverified, which
  is why the catalog entries stay `building` rather than `verified`.
- **No GUI automation.** Drag, the inline text editor's overlay, the native dialogs, and the window
  close guard are verified by their pure logic, by the store-level steps, and by construction — not
  by driving the real window.
- Documented divergences from Illustrator remain (`docs/DECISIONS.md`), including read-only
  geometry/stroke fields, no rulers/guides/workspaces, no isolation mode, no duplicate/copy-paste,
  no vector clipping masks or image tracing, no area text or character styles, and Layers thumbnails.
- One editor window and one document at a time; no tabs or multiple documents.
- The recovery snapshot keeps one rolling copy with no merge, so a crash after a long unsaved
  session can lose the state from before that session's last snapshot.
- **The renderer gate is not fully closed.** `PERF-01` stays open with the recorded numbers: the
  frozen 1,000-shape stress document renders at p95 1.0–1.3 ms, but the #25 comparison's
  **10,000 loose primitives** case still misses the 33 ms target at 89.8 ms for CanvasKit
  (and 125.6 ms for the Vello candidate). That is a Phase 2 decision with revisit triggers
  (wasm threads with COOP/COEP, a retained-scene renderer, or a different runtime), not something
  this phase resolved.

Phase 2 inherits a versioned document with stable ids, a single validated command path, a measured
renderer, a working layer tree, and a project format the compiler can read.

## Done

- Documentation-only repository setup.
- Agent rules, planning record, decision log, and GitHub templates prepared.
- Stack-neutral agent roles, hooks, and planning/tracing workflows prepared.
- Agent-first delivery, branch naming, and progress-tracking policies recorded.
- Private GitHub repository created and configured as `origin`; the initial
  governance and planning branches were pushed. Later planning changes are
  currently local and unpushed.
- Master delivery plan revised: core reconstruction first; compiler next; MCP,
  cloud services, and proposal extensions afterward.
- Core architecture constraints for future MCP and built-in-agent support
  recorded before implementation begins.
- IDE work explicitly deferred beyond core parity, compiler, known extras, and
  future owner-selected expansion.
- Mandatory catalog and progress-update rules recorded for every capability
  change and handoff.
- Phase 0 direction approved pending a bounded renderer/memory benchmark:
  Electron + React + TypeScript, Windows-first testing, early macOS/Linux
  launch checks, renderer-independent document/command model, and TSX/Tailwind
  compiler contract.
- Memory efficiency elevated to a product requirement and future release gate.
- Repository stays private until the main Illustrator/compiler project is
  complete; no visibility change is authorized before then.
- Independent architecture review conditionally supports Electron, subject to
  the renderer/memory benchmark; no benchmark measurement or platform launch
  has been completed.
- Parity catalog v1 created with stable capability IDs, status definitions,
  minimum acceptance behavior, compiler support states, and the first proposed
  implementation slice.
- Phase 0 planning, catalog, and the benchmark harness were consolidated into
  `main`; Phase 0 itself remains open until the blocked benchmark produces
  evidence for the Electron/SVG decision.
- Benchmark harness started on `chore/renderer-memory-benchmark`: source test
  and UI production build pass. An initial Electron Builder runtime-packaging
  stall was repaired before the packaged Windows evidence run.
- Packaging was repaired and five packaged Windows synthetic-renderer runs
  completed. They show full-document SVG misses the stress interaction target;
  they do not verify real edited-document save/reopen, undo/redo, or recovery.
- Tauri comparison setup reached Rust, WebView2, Vite, and Cargo dependency
  compilation. It cannot yet produce an executable because the benchmark
  machine has no MSVC `link.exe`; two approved Build Tools installation attempts
  exited without registering Build Tools or installing that linker.
- Phase 0 platform decision completed after independent review: Electron +
  React + TypeScript + Tailwind + Vite is the development baseline; the
  full-document SVG renderer is rejected. CanvasKit/Skia is the next renderer
  candidate and must pass a bounded measured spike before editor work.
- Agent completion rule added: owner review/testing happens only after agents
  complete the approved outcome and their planned validation.
- Issue and pull-request workflow adopted (PR #21): every phase owns an epic
  issue created up front (#1–#14), sub-issues are generated when a phase starts,
  agents choose the phase's pull-request strategy, and the owner reviews, tests,
  and decides every merge. Phase 1 sub-issues #15–#20 are linked to epic #3.
- Tailwind installed as approved; `npm run typecheck` added; the Phase 0 harness
  identity is scheduled to move to the Vectr app identity in slice 2.
- Phase 1 slice 1 delivered (issue #15, branch `feat/canvaskit-renderer-spike`):
  frozen document-shaped fixtures for primitives, text, images, and nested groups
  at empty/representative/stress sizes; a WebGL CanvasKit renderer with retained
  objects, shared content-addressed fixture assets, and explicit disposal; a
  defined interaction methodology; and five packaged runs recorded in
  `.ecc/benchmarks/phase-one/`.
- Bundled Inter (SIL OFL 1.1, license included) because `canvaskit-wasm@0.42`
  exposes only `FontMgr.FromData` and no system font manager.
- Renderer spike verdict: **FAIL** — worst stress interaction p95 99.9 ms against
  the retained 33 ms target, with draw submission alone at 74.6 ms. Leak check
  passed (retained paths/images/paragraphs returned to zero after 10
  build/draw/release cycles); peak whole-app working set 817 MiB, private bytes
  995 MiB, GPU process 280 MiB across four processes. Full numbers and the gate
  definition are in `docs/PARITY_CATALOG.md` ("Renderer evidence (PERF-01)").
- Phase 1 slice 1b delivered (issue #23, branch `enhance/renderer-picture-replay`):
  a recorded-picture draw path (at most 16 Skia pictures over buckets of
  consecutive top-level roots), per-bucket invalidation for edits, cached paints
  with batch eviction, an edit scenario in the suite, per-mode verdicts, and a
  `--directory=`/`--contents=` runner for scoped evidence runs and quick checks.
  Renderer diagnostics now forward to stdout so a failed or hung run is visible.
- Optimization verdict: still **FAIL**, but the worst stress interaction dropped
  from 99.9 ms to 82.2 ms across five packaged runs. Nested groups at 10,000
  leaves now pass (34.8 → 21.4 ms), text at 1,000 nodes 32.2 → 12.4 ms, images
  3.6 → 2.5 ms, 1,000 primitives 7.5 → 7.3 ms. Text at 10,000 nodes is marginal
  (35.0 ms); 10,000 loose primitives remain the failing case. The remaining cost
  is GPU-side per-draw overhead across roughly 20,000 anti-aliased path draws per
  frame, not JS-to-WASM work. Edit cost (re-record one bucket): 1–7 ms at 1,000
  nodes, 22 ms at 10,000 text nodes, 54–61 ms at 10,000 loose primitives. Leak
  check passed in both modes; peak whole-app working set 861 MiB across four
  processes.
- The workflow and renderer stack merged into `main`: #21 (workflow), #22 (slice 1,
  `8c8f72c`), #24 (slice 1b, `325508e`), #26 (slice 1c comparison, `601c32e`), and
  #27 (small-vs-big merge policy plus mandatory self-review, `c0613de`).
- Phase 1 slice 2 delivered (issue #18, PR #30, branch `feat/document-command-core`):
  versioned document model with structural sharing (`src/doc/types.ts`,
  `document.ts`), stable rejection codes (`validate.ts`), one validated command
  path with inverse commands (`commands.ts`), bounded history with single-entry
  drag transactions (`history.ts`), pure hit testing (`hitTest.ts`), a
  paint-order scene builder (`src/render/scene.ts`), the editor renderer on the
  accepted recorded-picture path with per-bucket invalidation
  (`src/render/EditorRenderer.ts`), the editor store with one `dispatch` entry
  point (`src/state/documentStore.ts`), and the editor shell (toolbar, canvas with
  rect/ellipse tools, marquee, drag transactions, zoom/pan, layer list, shortcuts).
- The app identity is now `vectr` / `Vectr` / `com.vectr.app`, the benchmark
  runner targets `Vectr.exe`, and the Phase 1 benchmark harness stays reachable
  with `?benchmark` inside the same app.
- Slice 2 evidence: `electron . --smoke=stress` passes all nine command-path steps
  and measures 1,001 shapes in 16 recorded buckets at **render p95 1.10 ms** over
  60 frames (scene build 4.4 ms), with 48 unit tests passing and clean typecheck
  and build.
- Bugs found and fixed while building the slice: `replaceNode` never matched the
  document root (root-level inserts silently did nothing); `History` used a
  TypeScript parameter property that Node strip-only mode rejects; a locked group
  did not lock its subtree in hit testing; and a PowerShell rewrite of
  `package.json` added a UTF-8 BOM that broke the Vite build.
- Phase 1 slice 2b, the UI shell alignment (issue #28, PR #33, branch
  `feat/ui-shell-alignment`, stacked on #18): the shell is now a modern Illustrator
  rather than a placeholder — menu bar with Illustrator's menu structure
  (`src/app/MenuBar.tsx`, `menuModel.ts`), docked left tool palette with V/M/L and
  original icons (`ToolPalette.tsx`, `icons.tsx`), right panel dock with collapsible
  tabbed groups (`src/app/panels/PanelDock.tsx`), Layers panel with disclosure, eye,
  lock, and a reserved thumbnail slot (`panels/LayersPanel.tsx`), read-only
  Properties, Appearance, and Color panels, status bar, theme tokens
  (`src/styles.css` `@theme` plus `src/app/theme.ts`), one action table shared by
  menus, palette, and keyboard (`src/app/actions.ts`), an Illustrator-default
  shortcut map (`src/app/shortcuts.ts`), pure viewport arithmetic
  (`src/app/viewportOps.ts`), and workspace state split out of the document store
  (`src/state/workspaceStore.ts`) so layout changes stop waking document subscribers.
- Slice 2b evidence: `electron . --smoke=stress` passes all nine command-path steps on
  the new shell and measures 1,001 shapes in 16 recorded buckets at **render p95
  1.10 ms** over 60 frames (scene build 3.5 ms), WebGL; 64 unit tests pass (16 new
  shell tests) with clean typecheck and build.
- Slice 2b bug found and fixed by the new tests: Hide/Lock over several selected nodes
  first shared one transaction, and a transaction keeps only the first inverse, so
  undo restored one layer and left the others hidden. Flag changes now record one
  entry per node, and the aggregate-inverse fix is logged as a follow-up instead of
  changing the command model inside a UI slice.
- Phase 1 slice 2c, the aggregate inverse (issue #34, branch `feat/aggregate-inverse`):
  a transaction may contain many commands and undo/redo as one history entry. New
  `batch` command variant with an atomic fold and an inverse of the step inverses in
  reverse order (`src/doc/commands.ts`), `transactionEntry()` choosing plain, compact,
  or aggregate entries with `peekUndo()`/`peekRedo()` for the Edit menu and tests
  (`src/doc/history.ts`), and multi-object Hide/Lock back to one transaction
  (`src/app/actions.ts`) so they are one undo step as they are in Illustrator.
- Slice 2c evidence: `electron . --smoke=stress` passes 9/9 command-path steps with the
  drag still one entry and 1,001 shapes in 16 buckets at render p95 1.00 ms over 60
  frames (scene build 3.5 ms); 74 unit tests pass (10 new aggregate-inverse tests);
  clean typecheck and build.
- UI conformance pass (branch `enhance/ui-conformance`), after the owner's direction that the
  shell was drifting from Illustrator: Electron's default application menu is removed so the
  window has one menu bar instead of two, Alt+letter opens menus by mnemonic with the letter
  underlined in the title, Escape cancels instead of deselecting (Deselect stays
  Ctrl+Shift+A), panel groups gained Illustrator's flyout menu (the Layers flyout runs the
  object commands), the tool palette's invented corner letter and the status bar's revision
  counter are gone, and panel tabs are sentence case. Sixteen divergences remain live, all of
  them features Vectr does not have yet rather than styling chosen differently.
- Phase 1 slice 3, layers, groups, and ordering (issue #20, branch `feat/layers-groups`,
  PR #37): Group, Ungroup, the four Arrange commands, and Layers-panel drags are plans
  composed from `insertNodes`/`moveNode`/`removeNodes` (`src/app/arrange.ts`,
  `src/app/layerDrag.ts`), so no document command was added and each gesture is one undo step
  through the #34 aggregate inverse. The Layers panel became interactive (drag reorder and
  drop-into-group with Illustrator's before/inside/after targets, Shift range selection,
  double-click/F2 rename, Delete, arrow-key navigation) and both the canvas and a layer row
  gained Illustrator's right-click object menu (`src/app/ContextMenu.tsx`,
  `contextMenus.ts`). Object and Type menus gained a real submenu (Object > Arrange). The
  deferred `locked` validation code now exists and is inherited from ancestors, so a locked
  layer refuses transform, style, move, delete, and drops into it; `isLocked` replaces the
  `invalid-parent` wart recorded in #18.
- Phase 1 slice 4, plain text (issue #16, branch `feat/plain-text`, PR #38): `TextNode` is a
  fourth node kind with content, a stored measured box, font family, size, alignment, and
  leading (`src/doc/types.ts`, `document.ts`), reached through two new commands (`setText`,
  `setTextStyle`) with exact inverses and validation, plus `estimateTextSize` as the pure
  fallback measurement. The renderer loads the bundled Inter face once
  (`Typeface.MakeTypefaceFromData`), caches one Skia font per family/size, measures lines from
  glyph advances, draws multiline text with alignment, and reports any unavailable family as a
  substitution instead of failing silently (`[vectr-font]` on the console,
  `RenderStats.substitutedFonts` in the canvas notice, a warning row in Properties, and a
  packaged smoke step). The Type tool (T) places and edits text in place through a real labelled
  textarea; double-clicking a text object edits it; the Type menu (align L/C/R, size up/down),
  the Properties font-size field, and clickable Color swatches that apply a fill to shapes and
  text all ship with it.
- Phase 1 slice 5, images (issue #17, branch `feat/images`, PR #39): an `ImageNode` holds only
  a content-addressed `assetId` and its box; the bytes live in a runtime asset registry
  (`src/state/assetRegistry.ts`) keyed by `sha256-<hex>`, and the document carries an `AssetRef`
  in its existing `assets` list. Import rules (PNG/JPEG, ≤ 20 MiB, ≤ 40 MP, ≤ 512 assets) run
  before anything is decoded or dispatched and report a reason through a new
  `documentStore.reportError`. `placeImage` inserts the node and registers the asset in one
  undoable step whose inverse removes both as a batch (and leaves a shared asset alone);
  `addAsset`/`removeAsset` cover the other direction and `removeAsset` refuses an asset an image
  still uses. The scene carries the asset id, the renderer decodes once per asset, draws with
  `drawImageRect`, and reports an asset it never received through `RenderStats.missingAssets`.
  `File > Place…` (Ctrl+Shift+P) opens the platform dialog through the preload bridge — the main
  process reads the file — and dropping image files on the canvas places them too.
- Slice 5 evidence: `electron . --smoke=stress` passes **25/25** steps, including `image
  imported` (8×8 pixels, 89 bytes, content key `sha256-ab57fee…`), `image undo removes node and
  asset`, `image redo restores both`, and `image drawn from its asset`, with 1,004 shapes at
  render p95 1.30 ms; 107 unit tests pass (10 new) with clean typecheck and build.
- Bug fix, owner-reported: **the Type tool did nothing.** A real mouse-down ran the browser's default
  focus change after the canvas handler, blurring the inline text editor the same click had just
  opened; its blur committed empty text and the empty-object rule discarded it. Fixed at the source
  (`preventDefault` on the canvas pointer-down for the Text tool) plus a one-shot stray-blur recovery
  in the editor. The gap that let this ship: the text tests covered commands and saving but never the
  interaction, and a first DOM-level test passed misleadingly because `dispatchEvent` does not run
  browser default actions. A packaged `[vectr-text]` report now drives the real canvas, blurs the
  editor the way a real click does, and proves typing works. Evidence: 126 unit tests and 58 packaged
  steps across five reports.
- UI enhancement, owner-requested, after Phase 1 (branch `feat/layers-thumbnails`): Layers rows now
  show **live thumbnails** rendered by the real renderer from its recorded picture (no approximation,
  so a preview cannot disagree with the canvas). Deliberate limits, each asserted in the packaged run:
  top-level layers only, the first 12 rows, and a refusal when a bucket holds several roots rather
  than a preview that would show a layer's neighbours. Evidence: 51 packaged smoke steps across four
  reports, including `layer thumbnail renders a real preview` (144 bytes of PNG), `the thumbnail
  decodes as a 28×28 image`, and `a chunked bucket refuses a misleading thumbnail`.
- UI enhancement, owner-requested, after Phase 1 (branch `feat/layers-panel-actions`): the Layers
  panel gained the foot Illustrator has — New Layer, Duplicate Selection, and Delete Selection —
  reachable from the panel foot, the Layers flyout, and the row context menu. `duplicateSubtree`
  deep-copies with fresh ids while sharing content-addressed image assets, and delete now uses one
  shared locked-aware policy everywhere. Thumbnails followed in their own branch (see the entry above). Evidence: 126 unit tests (5 new) and 48
  packaged smoke steps across four reports.
- UI enhancement, owner-requested, after Phase 1 (branch `feat/unsaved-changes-dialog`): the
  unsaved-changes warning is now Vectr's own modal instead of a native operating-system message box
  (`src/app/shell/UnsavedChangesDialog.tsx` with the copy in `src/app/files/unsavedPrompt.ts`,
  `aria-modal`, focus on Save, Tab kept inside, Escape cancels, buttons disabled while saving), and
  the same dialog now guards **New** and **Open**, which previously discarded unsaved work without
  asking — a real data-loss bug. Cancelling a save keeps the prompt open; discarding on close still
  writes the recovery snapshot first. Evidence: 121 unit tests (2 new) and 45 packaged smoke steps
  across four reports, including two new steps proving the guard raises the prompt and keeps the work.
- Phase 1 slice 6, durable local documents (issue #19, branch `feat/durable-documents`, PR #40):
  the project format (`src/file/format.ts`, `serialize.ts`, `validate.ts`, `atomicWrite.ts`,
  `recovery.ts`) — a `<name>.vectr/` directory with a canonical, byte-stable `manifest.json`, a
  separate `metadata.json`, and content-addressed `assets/<key>.<ext>` files, with no base64 in
  the manifest. `serializeDocument`/`deserializeDocument` are pure and round-trip exactly;
  `verifyAssets` checks presence, byte length, and content hash on open; version, foreign-file,
  JSON, and document-validation failures are refused with a code and never a partial load; saves
  write assets first and rename the manifest into place, so an interrupted save leaves the
  previous project intact, and prune unreferenced assets. New, Open, Save, Save As, and Recover
  Unsaved Work ship with Illustrator's chords, a dirty marker, status-bar state, and a native
  close guard; recovery is one rolling snapshot (30 s while dirty and before unload, no merge,
  newest wins, cleared on save).
- Slice 6 evidence: the packaged `[vectr-file]` run passes **11/11** steps on the real
  filesystem — `save writes a project`, `saving clears the dirty state`, `an edit after save is
  dirty`, `reopen restores the layer tree`, `reopen restores geometry, text, and the image`,
  `a reopened document resaves byte-identically` (3208 bytes), `reopened document is clean`,
  `recovery snapshot is written`, `recovery restores the unsaved work`, `recovery clears after it
  is consumed`, and `memory recorded after save and reopen` (**453.5 MiB** whole app with one image
  asset); 119 unit tests pass (12 new) with clean typecheck and build.
- Repository structure cleanup, on the owner's request (PRs #43 and the `chore/src-app-structure`
  follow-up): the proposal page and the wordmark moved out of the root into `docs/`, generated logs
  were deleted, scratch (`.ecc/tmp/`, `.ecc/issues/`, `tools` build output) is ignored, the missing
  root `README.md` and a `docs/README.md` index were added, an `npm run smoke` script exposes the
  evidence run, and `src/app/` was regrouped by role into `shell/`, `canvas/`, `menus/`, `panels/`,
  `editing/`, `files/`, and `ui/` with the benchmark window moved to `src/bench/`. Nothing was
  renamed and no behavior changed: 99 import specifiers rewritten, identical bundle hash, 119/119
  tests, and 37/37 packaged smoke steps. The audit and the layout decision are in `docs/PLAN.md`
  and `docs/DECISIONS.md`.

## Next

- **Phase 1 is complete** (see the section at the top of this file). Phase 2 now has an ECC-derived,
  dependency-ordered planning set: issues #64-#71 under epic #5 and the proposed plan in
  `docs/PLAN.md`. They are not agent-ready: multi-artboard coordinates, clipboard scope, RGB paint
  scope/initial blend modes, and vector clipping representation need owner decisions before any
  implementation starts. The one carry-over decision is the renderer: `PERF-01` stays open for the
  10,000-loose-primitives case recorded in issue #25.

### Older next-step notes, kept for context

- **Renderer gate amended by measurement (issue #25).** A candidate comparison ran
  end to end with criteria frozen before measurement, five packaged runs per
  candidate, on the same fixtures and protocol:
  - CanvasKit recorded-picture: 1,000 live layers 5.7 ms (pass), 10,000-leaf nested
    groups 19.2 ms (pass), 10,000 loose primitives 89.8 ms (**fail**); peak working
    set 861 MiB with a 271 MiB GPU process.
  - `vello_cpu` 0.3.0 built for wasm32 with SIMD128 (VectorCraft's rasterizer):
    1,000 live layers 8.3 ms (pass), 10,000-leaf groups 39.3 ms (fail), 10,000 loose
    primitives 125.6 ms (**fail**); peak working set 727 MiB; leak-clean.
  - VectorCraft's own native bench on this machine: 37.2 ms for 20,000 simpler
    shapes at 2880×1800 with worker threads (their README claims ~27 ms).
  - Not measured, not claimed: resvg-wasm/tiny-skia and CanvasKit WebGPU.
  - Outcome: no measured candidate meets 33 ms on 10,000 loose always-visible
    primitives, so the gate is **amended, not met**; CanvasKit recorded-picture is
    accepted with published limits and `PERF-01` stays open with revisit triggers.
    Evidence: `.ecc/benchmarks/renderer-comparison/`.

### Superseded next-step notes (everything listed here shipped during Phase 1)

- **Owner action: review and merge the aggregate-inverse pull request** (issue #34):
  a transaction may now contain many commands and undo/redo as one entry, and
  multi-object Hide/Lock are one undo step again. Classified big: it changes the
  command/undo model. Merged already: #21, #22, #24, #26, #27, #29, #31, #32, #30
  (slice 2), #33 (UI shell alignment).
- The UI shell alignment is merged (issue #28, PR #33), so the menu bar, tool palette,
  panel dock, theme tokens, and Illustrator-default shortcut map are the shell Phase 2
  builds into. `UI-01` stays `building` until save/reopen and platform coverage exist
  (#19) and the eighteen live divergences shrink.
- After #34: Phase 1 continues in order: #20 (layers and groups: interactive tree,
  reorder, group/ungroup, rename — composed edits are now one undo step), #16 (plain
  text), #17 (images), #19 (durable local documents, which also retires the missing
  File menu).
- If #34 is declined, the fallback is the #28 behavior: one history entry per node for
  multi-object flag changes, which is correct but diverges from Illustrator.
- **UI direction recorded and enforced (PRs #29 and #31).** Vectr's interface is a
  modern Illustrator (`AGENTS.md`, Product identity; `docs/DECISIONS.md`, 2026-10-14;
  catalog `UI-01`). Interface work must state its Illustrator mapping in its issue and
  pull request, divergence needs a recorded reason, and Adobe or VectorCraft assets,
  screenshots, or branding are never used.
- Issue #28 owns the shell alignment (menu bar, left tool palette, right panel dock,
  theme tokens, Illustrator-default shortcuts) and must land before Phase 2 adds
  tools, so no tool is built twice. Issue #20 must build the Illustrator-style Layers
  panel, docked in the same layout, with per-row visibility and lock.
- After #18 merges, Phase 1 continues in order: #20 (layers and groups), #16 (plain
  text), #17 (images), #19 (durable local documents) — one branch and one pull
  request each, with the UI mapping recorded for the slices that have an interface.
- `PERF-01` revisit triggers: wasm threads with COOP/COEP isolation, Phase 4
  profiling with culling and retained regions on realistic documents, or an
  owner-approved revision of the 10,000-loose-primitive limit.

## Known issues

The shipped product's current limits. Each is either a capability Vectr does not have yet or a
verification gap; none is a silent failure.

**Not built yet**

- Rulers, guides, grids, snapping, Smart Guides, and multiple artboards (`CAN-01`, `CAN-02`;
  Phase 2).
- Direct selection, lasso, anchor-level editing, and pen/Bézier paths (`SEL-01`, `PATH-02`).
- Object transforms — move, scale, rotate, reflect, shear, and numeric X/Y/W/H editing — plus
  align and distribute (`SEL-02`, `SEL-03`). The clipboard is absent: Ctrl+C / Ctrl+X / Ctrl+V
  and Ctrl+D are unbound, so copy, cut, paste, and Illustrator's paste offset do not exist.
  Duplicate does exist — the Layers panel foot, its flyout, the canvas and row context menus, and
  the Control panel's Selection row — but with no Object-menu item and no chord, since
  Illustrator's Ctrl+D is Transform Again.
- Appearance beyond a fill and the Line tool's stroke weight: stroke alignment, caps, joins,
  dashes, opacity, blend modes, gradients, and named swatches (`PAINT-01`–`PAINT-03`,
  `APP-01`). Properties and Appearance therefore report geometry and stroke as read-only values
  rather than offering controls that would change nothing.
- Isolation mode, vector clipping masks, compound paths, and Pathfinder-style booleans
  (`DOC-02`, `APP-02`, `PATH-04`, `BOOL-01`).
- Area text, text on a path, threaded text, and character/paragraph styles (`TYPE-01`–`TYPE-03`).
- Compiled React/Tailwind output itself: `COMP-01` and `COMP-02` are deferred until the core
  parity gate, although the document model is already the compiler's intended input.

**Verification gaps**

- No external GUI automation harness. Interaction evidence comes from `npm run smoke`, which
  drives the real DOM with scripted pointer and key events; native dialogs, true OS-level input,
  and the window close guard are covered by their pure logic and by construction rather than by
  driving the window.
- Platform coverage is Windows only. macOS and Linux build and launch are unverified, which is
  why catalog rows stay `building` rather than `verified`.
- No knowledge graph exists (`graphify-out/graph.json` is absent), so graph-first source
  exploration is unavailable until one is generated.
- The deferred Tauri comparison still cannot build on this machine (no MSVC linker). It is
  non-blocking and its temporary harness sits outside the repository.

**Accepted limits, recorded so they are not mistaken for defects**

- `PERF-01` is amended, not met: the frozen 1,000-shape document renders at p95 1.0–1.3 ms, but
  10,000 loose always-visible primitives run 82–90 ms against the 33 ms gate. Revisit triggers
  are recorded in `docs/PARITY_CATALOG.md`.
- CanvasKit does not return its WASM and GPU allocations promptly, so a session that closes a
  large document sits at its high-water mark until the window restarts. The recorded budgets
  (600 MiB idle, 1,200 MiB stress) are asserted in the packaged `[vectr-memory]` report, and the
  decoded-image cache is bounded and returns to 0 after close.
- Recovery keeps one rolling snapshot with no merge, so a crash after a long unsaved session can
  lose state from before that session's last snapshot.
- One editor window and one document at a time; no tabs.
- Deliberate Illustrator divergences are listed in `docs/DECISIONS.md`, one list per slice that
  added one. The record deliberately does not assert a running total: the counts stated here and
  in the catalog drifted every time a slice closed or opened a difference, so they now point at
  the lists instead of restating a number.
- `.ecc/tmp/*` scratch files and `.ecc/issues/*.md` (issue bodies used for creation) are
  untracked working files.

## UI-01 modern Illustrator shell refinement (2026-10-16, issue #62)

**Merged** as PR [#63](https://github.com/lleoparden/vectr/pull/63) (merge commit `7d849ed`).
The slice gave the existing editor a clearer modern-Illustrator hierarchy — layered chrome,
restrained hover/active/focus states, a quiet tool rail, and visibly separated dock tabs — without
changing the fixed shell geometry or any command behavior, and put a visible **Place image** /
**Link** pair in the Control panel that delegates to the existing embed and linked image flows
instead of pretending images are a persistent drawing tool.

**Evidence at the branch head:** `npm run typecheck`, `npm run build`, `npm test` (145/145), and
`npm run smoke` including the packaged UI steps for both image controls, plus `git diff --check`.

**Recorded verification gap:** normal- and high-DPI Windows desktop visual inspection was **not**
performed — the available UI-automation environment exposed no native desktop window to inspect.
The merge rested on the packaged smoke evidence, and a visual pass at the minimum supported desktop
width (contrast, and the new control pair not clipping) is still outstanding. It is recorded on the
pull request as well, so it is not mistaken for a completed check.
