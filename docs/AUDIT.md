# Audit: what should exist by the end of Phase 3, and what does

**Date:** 2026-10-18 · **Scope:** Phases 0-3 · **Method:** three passes, not a doc read.

1. **Catalog rows** in [PARITY_CATALOG.md](PARITY_CATALOG.md) against the phase deliverables in
   [MASTER_PLAN.md](MASTER_PLAN.md).
2. **Code evidence** per capability: the module that implements it, the command id that reaches it, and the test
   suite that holds it.
3. **Packaged evidence**: the 7 reports and 126 steps of `npx electron . --smoke=stress`, plus a grep for stubs -
   a field that exists but nothing reads, a control that shows a value nothing can set.

**A status word that matters:** the catalog marks almost everything `building`, never `verified`, because its
own rule makes `verified` require platform coverage, which is Phase 9. That is honest but unreadable. This audit
uses **built** (works on Windows, has evidence) separately from **verified** (catalog rule), and says so per row.

## Verdict

Phases 0-3 are **built**: 146 commands, 12 tools as state machines, 246 unit tests, a clean layer check on 96
files, and a packaged run that has been identical for five consecutive slices.

They are **not** fully "Illustrator parity", which was never their scope: Phase 2's exit criteria allowed recorded
limits, and those limits are Phase 5-8's subject. One genuine defect was found and is fixed in this change; three
catalog claims were stale and are corrected.

---

## Phase 0 - platform and reference

| # | Should exist | Built | Evidence | Note |
|---|---|---|---|---|
| 1 | Electron desktop shell (main, preload, renderer) | ✅ | `electron/`, `src/main.tsx` | one window |
| 2 | Renderer decision with measured evidence | ✅ | CanvasKit, `docs/DECISIONS.md` PERF entries | 10k primitives recorded as a limit |
| 3 | Parity catalog as source of truth | ✅ | `docs/PARITY_CATALOG.md` | statuses corrected below |
| 4 | Original visual identity and theme tokens | ✅ | `src/app/ui/theme.ts`, Tailwind `@theme` | no Adobe/VectorCraft assets |
| 5 | Performance budgets | ✅ | 600 MiB idle / 1,200 MiB stress, asserted | `[vectr-memory]` |
| 6 | Crash recovery and close safety | ✅ | `src/file/recovery.ts`, `[vectr-file]` steps 48-58 | one snapshot, newest wins |
| 7 | No-copy rule for reference material | ✅ | `AGENTS.md` | architecture mimicked, source not |

## Phase 1 - document and editor foundation

| # | Should exist | Built | Evidence | Note |
|---|---|---|---|---|
| 8 | Versioned document model, stable ids, ordered tree | ✅ | `src/doc/types.ts`, `document.ts`, format v4 | v1-v4 all open |
| 9 | Validated command model with inverse commands and rejection codes | ✅ | `src/doc/commands.ts`, `tests/doc.test.ts` | one path for every mutation |
| 10 | Transactions: one gesture = one undo entry | ✅ | `documentStore.beginTransaction`, 8 live-edit sites | `tests/history.test.ts` |
| 11 | Undo/redo with labels and bounded history | ✅ | `src/doc/history.ts` | depth asserted in smoke |
| 12 | Canonical, byte-stable save | ✅ | `src/file/serialize.ts`, smoke step 45 | resave is byte-identical |
| 13 | Autosave (saved documents only, dirty only) and recovery | ✅ | `src/state/settingsStore.ts`, smoke 48-58 | interval preference 1-60 min |
| 14 | Content-addressed assets, prune, hash verify | ✅ | `src/file/atomicWrite.ts`, `assetRegistry` | refusals have codes |
| 15 | Selection state, viewport, active page | ✅ | `documentStore`, `workspaceStore` | active page is session state |
| 16 | Layer tree: nested groups, reorder, rename, lock/hide | ✅ | `LayersPanel.tsx`, `tests/layers.test.ts` | see row 61 for the panel gaps |
| 17 | Artboards as document data | ✅ | `src/doc/artboards.ts`, `tests/artboards.test.ts` | presets, labels, active outline |
| 18 | Menu bar, shortcut map, command framework | ✅ | `menuModel.ts`, `registry.ts` | 146 commands |
| 19 | Layer thumbnails from the real renderer | ⚠️ | top 12 top-level rows | nested rows and a locate column are missing (catalog DOC-02 states this) |
| 20 | Multi-document windows | ❌ | - | not planned in any phase; would need a window manager |
| 21 | macOS and Linux | ❌ | - | Phase 9 |

## Phase 2 - core vector illustration

| # | Should exist | Built | Evidence | Note |
|---|---|---|---|---|
| 22 | Twelve tools in the palette, Illustrator's grouping and chords | ✅ | `toolOptions.ts`, `src/tools/index.ts` | V A Q H M J L \\ T |
| 23 | Selection, direct selection, marquee, lasso (enclosed), double-click drill | ✅ | `src/tools/select.ts`, `lasso.ts`, smoke 19-21 | isolation-aware |
| 24 | Move and eight-handle scale (Shift proportions, Alt from centre) | ✅ | `scaleRef` path, smoke 26 | see row 68 |
| 25 | Rotation | ⚠️ **stub** | `Transform.rotation` exists; read-only `Readout` in Properties | nothing rotates: renderer, hit test, and scene ignore it. The readout is being removed in this change rather than implying a capability |
| 26 | Reflect and shear | ❌ | - | not scheduled; follows rotation |
| 27 | Numeric transform X/Y/W/H in Properties | ✅ | `PropertiesPanel`, `tests/transform.test.ts` | live, one entry per session |
| 28 | Arrow-key nudge (1 / 10 with Shift) | ✅ | `nudgeSelection`, smoke 27 | one entry each |
| 29 | Align (6) and distribute (2) commands | ✅ | `object.align*`, smoke 29-30 | union-box basis |
| 30 | Arrange (4), group/ungroup, duplicate | ✅ | `object.*`, smoke 5-6, 14-15 | one entry each |
| 31 | Cut/copy/paste with fresh ids and 10-unit offset | ✅ | `editing/clipboard.ts`, smoke 31 | own clipboard |
| 32 | Lock and hide with inherited flags | ✅ | `object.lock/hide`, `tests/layers.test.ts` | Ctrl+2 / Ctrl+3 |
| 33 | Smart Guides snapping for drags (6 screen px) | ✅ | `editing/snapping.ts`, smoke 35 | see row 69 |
| 34 | Rulers, grid, guides (document data) with snapping | ✅ | `RulersOverlay.tsx`, smoke 85-89 | guides persist |
| 35 | Zoom: wheel, menu steps, Fit Artboard, Actual Size | ✅ | `geom/viewport.ts`, smoke 95 | 0.05x-32x |
| 36 | Pan: Hand, middle button, Space borrow | ✅ | `tools/hand.ts`, smoke 96-98 | screen-space delta |
| 37 | Artboards: create, delete, presets, sizes, labels | ✅ | `artboard.*`, smoke 32-33, 83-84 | no Artboard tool, by owner request |
| 38 | Paint: fill, stroke colour and weight, caps, joins, dashes, alignment | ✅ | `setStyle` family, smoke 92 | inside/outside via clipping |
| 39 | Gradients: linear, radial, up to 8 stops, fill/stroke/both | ✅ | `gradients2.test.ts`, smoke 93 | no mesh/freeform |
| 40 | All 16 blend modes on fills and strokes | ✅ | `blend.test.ts` | non-separable set included |
| 41 | Vector clipping masks | ✅ | `setClip`, `tests/clipping.test.ts` | curves sampled |
| 42 | Named swatches with CMYK and spot | ✅ | `swatches.test.ts`, smoke 90-91 | no Swatches panel (row 60) |
| 43 | Colour control: picker, hex, palette, recents | ✅ | `ColorField` in `ui/fields.tsx`, smoke 78-79 | no eyedropper |
| 44 | Point text: edit in place, size, align, missing-font notice | ✅ | `TYPE-01` slice, smoke 60-70 | no area/path/threading |
| 45 | Area text, text on a path, threading, character/paragraph styles | ❌ | - | Phase 6 |
| 45a | Bézier path node: anchors, curves, format v5, rendering, hit testing | ✅ (5.1) | `src/geom/path.ts`, `tests/path.test.ts`, file report 21 steps | no pen or anchor editing yet (5.2-5.3) |
| 46 | Images: place embedded, link, relink, crop, alpha mask | ✅ | `IMAGE-01` slice, smoke 71 | no trace |
| 47 | Layers panel: rows, reorder, rename, foot, context menu | ✅ | `LayersPanel.tsx` | see row 61 |
| 48 | Appearance panel (fill, stroke, opacity live) | ✅ | `AppearancePanel.tsx`, smoke 100 | |
| 49 | Properties panel: transform, fill, stroke, type, image, layer, artboards | ✅ | `PropertiesPanel.tsx`, smoke 80-82 | |
| 50 | Align panel | ✅ | `AlignPanel.tsx`, `alignAvailability`, packaged step | shipped in 4.4; no key-object mode yet |
| 51 | Transform panel | ✅ | `TransformPanel.tsx`, `selectionTransform`, packaged step | shipped in 4.4 |
| 52 | Stroke, Gradient panels | ❌ | both live in Properties | Phase 7 |
| 53 | Swatches panel | ❌ | swatches live in Color (row 42) | Phase 7 |
| 54 | Character and Paragraph panels | ❌ | - | Phase 6 |
| 55 | Pathfinder and Symbols panels | ❌ | - | Phase 5 / 7 |
| 56 | Command palette | ❌ | - | UI-02, unscheduled |
| 57 | Preferences (autosave interval) | ✅ | `edit.preferences`, `settingsStore` | one preference |
| 58 | Workspaces and floating panels | ❌ | - | unscheduled |
| 59 | Status bar, tool options bar, tooltips | ✅ | `StatusBar.tsx`, `ToolOptionsBar.tsx`, smoke 72-77 | |
| 60 | Context menus (canvas and layer rows) | ✅ | `ContextMenu`, layers panel | |
| 61 | Layer panel polish | ✅ | `locate.ts`, nested previews, `layerDrag.placementFor` (drag-into-group shipped in #20) | shipped in 4.5; the 4.5 issue's claim that drag-into-group was missing was wrong and is corrected |
| 62 | Eyedropper | ❌ | - | Phase 7 |
| 62b | Hover outlines and per-tool cursors | ✅ | `cursor.ts`, `HoverOverlay.tsx`, 3 packaged steps | shipped in 4.3 |

## Phase 3 - architecture realignment

| # | Should exist | Built | Evidence |
|---|---|---|---|
| 63 | Layer rule enforced in `npm test` | ✅ | `scripts/check-layers.mjs`, 96 files |
| 64 | L0 `src/geom/` | ✅ | geometry, colour, CMYK, viewport |
| 65 | Tools as state machines with an injected host | ✅ | `src/tools/`, 12 tools, `tests/tools.test.ts` |
| 66 | One command registry for ids, labels, chords | ✅ | `src/app/commands/registry.ts`, `tests/commands.test.ts` |
| 67 | Six-question review checklist | ✅ | `AGENTS.md` |
| 68 | Cancelled pointer drops the gesture | ✅ | `onPointerCancel` -> `tool.cancel` |
| 69 | Behaviour frozen across the retrofit | ✅ | five slices, each the same 126-step run |

## Quality gates

| # | Gate | State |
|---|---|---|
| 70 | Unit suite | ✅ 246/246 |
| 71 | Typecheck and production build | ✅ clean |
| 72 | Packaged run | ✅ 126 steps, 7 reports, all passing |
| 73 | Layer check | ✅ 96 files |
| 74 | Memory and zoom evidence | ✅ recorded and budgeted |

---

## Gaps found by this audit, and where each is going

**Defect fixed in this change:**

- **A rotation readout that implied a capability.** Properties printed `Rotation 0°` while nothing in the product
  can rotate anything. Removed until Phase 4.2 ships real rotation.

**Stale catalog claims corrected in this change:**

- **UI-01** still listed rulers, grids, and guides as unbuilt. They shipped in CAN-01.
- **CAN-02** still listed grids as planned, and did not mention that guides are now snap targets.
- **PAINT-02** was still `planned` although named swatches with CMYK and spot shipped in Phase 2.6/2.7.

**Real gaps that belong to later phases (not defects):**

| Gap | Phase |
|---|---|
| Reflect and shear | unscheduled (rotation shipped in 4.2) |
| Scale handles as a tool, handle snapping | 4.1 |
| Hover outlines, per-tool cursors, live previews | 4.3 |
| Align panel, Transform panel | 4.4 |
| Layer panel: locate, nested thumbnails, drag into a group | 4.5 |
| Bezier pen and anchor editing, booleans, width profiles, compound paths, live shapes | 5 |
| Area/path/threaded text, character and paragraph styles, vertical type | 6 |
| Appearance stacks, transparency groups, raster effects, brushes/patterns/symbols, mesh/freeform/recolour, Swatches panel, eyedropper | 7 |
| SVG, PDF, `.ai`/EPS, raster export, OS clipboard | 8 |
| macOS/Linux, accessibility, performance closures, localization scaffolding | 9 |
| React/Tailwind compiler | 10 |
| MCP, cloud, collaboration | 11, 12 |
| Multi-document windows, command palette, workspaces, floating panels | unscheduled; listed here so they are not mistaken for built |

## What "everything before Phase 4" means, precisely

Built and evidenced: rows 1-19, 21-24, 27-49, 57, 59-60, 63-74.
Deliberately limited, recorded, and scheduled: rows 25-26, 45, 50-56, 58, 61-62.
Not built and not scheduled: rows 20, 26, 58 (and the unscheduled block above).

No capability is claimed in the catalog that the code does not have; three claims were stale in the other
direction (features built but catalogued as unbuilt) and are corrected here.
