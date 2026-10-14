# Vectr parity catalog v1

## Purpose and baseline

This is the source of truth for the declared Illustrator/VectorCraft-class
surface. It tracks observable capabilities, not source-code structure. Vectr
will reproduce lawful, user-visible behavior with an original implementation
and identity; it will not copy source, brand assets, or protected artwork.

**Baseline date:** 2026-10-13. Reference evidence is public Adobe Illustrator
documentation and VectorCraft's published README/roadmap. Versioned captures,
fixtures, and behavior notes will be linked per capability before it moves to
`building`.

**Reference entry points:**

- [Adobe Illustrator User Guide](https://helpx.adobe.com/illustrator.html)
- [Adobe Illustrator text tools](https://helpx.adobe.com/illustrator/desktop/design-with-text/add-manage-text/add-text-illustrator-text-tools.html)
- [VectorCraft README](https://github.com/storytold/vectorcraft)
- [VectorCraft published roadmap](https://github.com/storytold/vectorcraft/blob/main/ROADMAP.md)

## Status and completion rules

| Status | Meaning |
| --- | --- |
| `planned` | Scoped in the catalog; no design/evidence fixture is ready. |
| `designed` | Behavior, exclusions, command/document impact, and acceptance fixture are approved. |
| `building` | Approved implementation is in progress on its own branch. |
| `verified` | Acceptance fixture, save/reopen, undo/redo, platform coverage, and compiler behavior are recorded. |
| `blocked` | A named dependency or decision prevents progress. |
| `deferred` | Explicitly outside the current milestone, with the reason recorded. |

A capability reaches `verified` only when its recorded fixture passes, it does
not silently lose document data, relevant accessibility/keyboard behavior is
checked, its platform status is recorded, and its compiler support is explicit.
“Supported” never means more than the linked evidence proves.

**Compiler values:** `not applicable`, `future`, `supported`, `partial`,
`SVG adjunct`, `raster fallback`, or `not exportable`.

## Catalog

All v1 entries are `planned` until a feature-specific plan supplies evidence,
unless explicitly marked `deferred` with its reason.
Platform coverage begins `Windows planned / macOS planned / Linux planned`.

| ID | Capability | Status | Compiler | Minimum acceptance behavior |
| --- | --- | --- | --- | --- |
| DOC-01 | Native document, artboards, metadata, and versioning | building | future | Versioned document model, stable ids, ordered tree, artboard metadata, and revision counter are implemented and unit-tested (Phase 1 slice 2); save/reopen evidence arrives with `DOC-04`. |
| DOC-02 | Layer tree, nested groups, lock, hide, isolate, and stacking | planned | future | Nested layer changes survive save/reopen and undo/redo. |
| DOC-03 | Validated commands, transactions, undo/redo, and recovery | building | not applicable | One validated command path with inverse commands, bounded history, single-entry drag transactions, and stable rejection codes are implemented and tested (Phase 1 slice 2); crash recovery arrives with `DOC-04`. |
| DOC-04 | Local files, autosave, crash recovery, and portable assets | planned | not applicable | Interrupted work can be recovered without silently discarding user data. |
| CAN-01 | Canvas, artboards, zoom, pan, rulers, grids, and guides | planned | not applicable | View navigation preserves document geometry and guide placement. |
| CAN-02 | Snapping, Smart Guides, measurement, and precision input | planned | not applicable | Configured snapping is predictable and keyboard-accessible. |
| SEL-01 | Selection, direct selection, marquee, lasso, and hierarchy selection | building | future | Pointer click, shift-click toggle, marquee, select-all, and Escape-clear are implemented against a pure hit-test module (Phase 1 slice 2), with locked subtrees unselectable; direct selection, lasso, and anchor selection remain planned. |
| SEL-02 | Transform, free transform, scale, rotate, reflect, shear, and align | planned | future | Numeric and pointer transforms preserve expected anchors and undo correctly. |
| SEL-03 | Distribute, arrange, group, duplicate, copy/paste, and global edit | planned | future | Reordering and duplicate operations retain layer identity and appearance. |
| PATH-01 | Rectangle, ellipse, line, polygon, star, arc, and rounded corners | building | SVG adjunct | Rectangles and ellipses are editable primitives created and moved through commands (Phase 1 slice 2); corner radius is modelled but not drawn yet, and line/polygon/star/arc remain planned. |
| PATH-02 | Pen, add/delete anchor, convert anchor, direct path editing, and curves | planned | SVG adjunct | Bézier anchors and handles round-trip without geometry loss. |
| PATH-03 | Pencil, smooth, eraser, shaper, blob brush, and join/average | planned | SVG adjunct | Freehand edits create predictable editable vector paths. |
| PATH-04 | Compound paths, offset/simplify, outline/expand, and path cleanup | planned | partial | Resulting paths remain valid, editable, and undoable. |
| BOOL-01 | Pathfinder, Shape Builder, Divide, and Live Paint | planned | SVG adjunct | Boolean results are geometrically correct and retain declared editability. |
| PAINT-01 | Fills, strokes, stroke alignment, caps, joins, dashes, and width profiles | planned | SVG adjunct | Appearance matches the saved document at normal zoom. |
| PAINT-02 | RGB, CMYK, spot colors, swatches, global colors, and color books | planned | partial | Named colors and color spaces survive save/reopen and export limitations are shown. |
| PAINT-03 | Linear, radial, freeform gradients, patterns, mesh, and recolor | planned | partial | Editable paint definitions retain stops, transforms, and references. |
| APP-01 | Appearance stacks, opacity, blend modes, and transparency | planned | partial | Stacked appearance is ordered, visible, and serialized deterministically. |
| APP-02 | Graphic styles, masks, clipping masks, and opacity masks | planned | partial | Mask relationships survive edit, save/reopen, and export with declared fidelity. |
| TYPE-01 | Point text, area text, text on a path, and threaded text | planned | partial | Text retains editable content, font intent, and container geometry. |
| TYPE-02 | Character, paragraph, OpenType, styles, tabs, and variable fonts | planned | partial | Style inheritance and fallback/missing-font reporting are explicit. |
| TYPE-03 | Touch Type, vertical text, bidirectional text, and multilingual layout | planned | partial | Individual glyph transforms and supported script direction survive reopen. |
| IMAGE-01 | Place, embed, link, relink, crop, and image masks | planned | raster fallback | Missing/changed links are visible and never silently replaced. |
| IMAGE-02 | Raster-to-vector tracing and image color management | deferred | raster fallback | Deferred until after core/editor compiler milestones. |
| EFFECT-01 | Live vector effects, distortions, blends, repeats, and envelopes | planned | partial | Effect parameters remain editable and render deterministically. |
| EFFECT-02 | Brushes, symbols/components, scatter/art/pattern brushes | planned | partial | Reusable definitions update intended instances only. |
| EFFECT-03 | 3D, materials, raster effects, and Effect Gallery | planned | raster fallback | Each effect declares preview/export limits before release. |
| FILE-01 | SVG/SVGZ import/export and fidelity diagnostics | planned | not applicable | Supported SVG opens, edits, and exports with documented warnings. |
| FILE-02 | PDF, print, marks, bleed, and PDF-compatible `.ai` interchange | planned | not applicable | Any editable round-trip claim is backed by fixtures and limitations. |
| FILE-03 | Raster export, EPS, DXF, EMF/WMF, PSD, templates, and package | planned | not applicable | Exported artifact and linked assets match documented options. |
| UI-01 | Illustrator-familiar workspace: menus, tools, panels, contextual controls | building | not applicable | Direction recorded 2026-10-14: a modern Illustrator — the same workspace logic (menu bar, left tool palette, canvas, right-docked panels, Layers as the document spine) with Vectr's own original identity, and no Adobe/VectorCraft assets or branding. Issue #28 delivers the shell: menu bar (Edit, Object, Select, View, Window, Help), tool palette, panel dock with collapsible tabbed groups (Layers, Properties, Appearance, Color), theme tokens, and an Illustrator-default shortcut map. Stays `building` rather than `verified` because the catalog's `verified` rule needs save/reopen and platform coverage (issue #19) and because sixteen live divergences remain (see `docs/DECISIONS.md`, UI shell alignment) — read-only panels, an unbuilt context-menu/ruler/workspace layer, and the missing File menu — all of them features Vectr does not have yet. Alt menu mnemonics, panel flyout menus, Escape-as-cancel, and sentence-case panel tabs now follow Illustrator, and Electron's default application menu was removed so the window has exactly one menu bar. |
| UI-02 | Shortcuts, command palette, workspaces, preferences, and localization | planned | not applicable | Keyboard paths follow Illustrator's defaults where the equivalent command exists; issue #28 ships the map (V/M/L, Ctrl+Z, Ctrl+Shift+Z, Delete, Ctrl+A, Ctrl+Shift+A, Ctrl+2/3, Ctrl+Alt+2/3, Ctrl+=/−, Ctrl+0, Ctrl+1, F6, Shift+F6, F7) with each divergence carrying a reason in `docs/DECISIONS.md`. The command palette, saved workspaces, preferences, and localization remain planned. |
| A11Y-01 | Keyboard access, focus, contrast, screen-reader labels, and input devices | planned | not applicable | Core workflows have an accessible path and known gaps are recorded. |
| PERF-01 | Large-document rendering, memory budgets, idle behavior, and recovery | building | not applicable | Candidate comparison (#25) measured CanvasKit recorded-picture and `vello_cpu` wasm on the frozen fixtures: no candidate meets 33 ms on 10,000 loose primitives, so the gate is amended rather than met. Accepted: CanvasKit recorded-picture with published limits (1,000 live layers 5.7 ms · 10,000-leaf nested groups 19.2 ms · 10,000 loose primitives 82–90 ms). Stays open with revisit triggers. See "Renderer evidence" below. |
| AUTO-01 | Account-scoped MCP and audit trail using normal document commands | deferred | not applicable | Deferred until after the core application and compiler. |
| COMP-01 | One readable React component per layer with stable names | deferred | supported | Deferred until core parity gate; supported layers export deterministic TSX. |
| COMP-02 | Tailwind mapping, inline SVG, assets, and fidelity diagnostics | deferred | SVG adjunct | Deferred until core parity gate; unsupported mappings are explicit. |

## Renderer evidence (PERF-01)

Phase 1 slice 1 (issue #15, branch `feat/canvaskit-renderer-spike`) measured
CanvasKit/Skia 0.42 in a packaged Windows build over five runs on an AMD Ryzen 5
9600X / 15.16 GiB Windows 11 Pro machine. Raw records and the aggregate are in
`.ecc/benchmarks/phase-one/`; the run method is
`npm run benchmark`.

**Gate definition.** `interactionMs` is one viewport change plus draw submission
and flush, excluding one-time fixture build work, React rendering, and the vsync
wait. `presentedMs` (with one presented frame) and `uiInteractionMs`
(React-driven) are recorded beside it. Phase 0's interaction number included a
two-frame wait, so the two definitions are not directly comparable, and the
current report states its own definition.

| Scenario (p95 across five runs) | build | draw | interaction (gate) | presented | React-driven |
| --- | --- | --- | --- | --- | --- |
| primitives / representative (1,000 layers) | 8 ms | 10.2 ms | 7.5 ms | 7.6 ms | 8.1 ms |
| primitives / stress (10,000 layers; 100,000 declared segments, ~250,000 rendered vertices) | 54 ms | 74.6 ms | **99.9 ms** | 93.4 ms | 18.4 ms |
| text / representative (1,000 text nodes) | 48 ms | 1.8 ms | 32.2 ms | 3.5 ms | 7.5 ms |
| text / stress (10,000 text nodes) | 202 ms | 32.6 ms | **60.7 ms** | 37.2 ms | 7.9 ms |
| images / representative (100 images) | 2 ms | 0.7 ms | 0.5 ms | 1.1 ms | 7.1 ms |
| images / stress (1,000 images) | 1 ms | 6.5 ms | 3.6 ms | 4.0 ms | 8.2 ms |
| groups / representative (nested, 1,000 leaves) | 4 ms | 4.2 ms | 4.6 ms | 4.5 ms | 8.0 ms |
| groups / stress (nested, 10,000 leaves) | 32 ms | 31.7 ms | **34.8 ms** | 33.3 ms | 7.4 ms |

**Result:** the 33 ms stress interaction target is not met. Draw submission alone
(74.6 ms) already exceeds the target regardless of the timing definition.
Backend: WebGL. Bundled font loaded: yes. CanvasKit payload: 7,317,345 bytes.
Repeated load/unload: pass — retained paths, images, and paragraphs returned to
zero after 10 build/draw/release cycles.

**Memory (peak across five runs, all application processes):** working set
817 MiB, private bytes 995 MiB, GPU process 280 MiB, 4 processes. CanvasKit does
not lower the empty footprint relative to the Phase 0 packaged SVG baseline.

**Diagnosis (slice 1).** Every fixture node was drawn on every frame with no
viewport culling and no retained layer cache, at roughly ten JS-to-WASM calls per
item, so the miss was per-item call and state overhead rather than GPU fill rate.

### Phase 1 slice 1b — recorded-picture replay optimization

Issue #23 added a second draw path and measured it on the same fixtures and
definition. Five packaged runs are recorded in
`.ecc/benchmarks/phase-one-optimization/`.

- `picture`: the scene is recorded once into at most 16 Skia pictures (buckets of
  consecutive top-level roots) and replayed with one `drawPicture` call per
  bucket; an edit re-records only the bucket containing the changed root.
- `direct`: the slice 1 per-item path, retained as the control.
- Paints are cached per style/color/width with batch eviction at 512 entries.

| Scenario (p95, five runs) | slice 1 direct | slice 1b direct (control) | **slice 1b picture** |
| --- | --- | --- | --- |
| primitives / 1,000 layers | 7.5 ms | 11.3 ms | **7.3 ms** |
| primitives / 10,000 layers; 100,000 declared segments (~250,000 rendered vertices) | 99.9 ms | 125.3 ms | **82.2 ms** |
| text / 1,000 nodes | 32.2 ms | 37.4 ms | **12.4 ms** |
| text / 10,000 nodes | 60.7 ms | 63.0 ms | **35.0 ms** |
| images / 1,000 images | 3.6 ms | 4.1 ms | **2.5 ms** |
| nested groups / 1,000 leaves | 4.6 ms | 6.7 ms | **3.1 ms** |
| nested groups / 10,000 leaves | 34.8 ms | 63.0 ms | **21.4 ms** |

- Worst picture interaction p95: **82.2 ms**, still above the 33 ms target, so the
  gate is **not met**. Nested groups at 10,000 leaves now pass (21.4 ms), text at
  10,000 nodes is marginal (35.0 ms), and loose 10,000-primitive documents remain
  the failing case.
- The remaining cost is GPU-side per-draw overhead: replay removed the JS-to-WASM
  per-item work, and the fixture still issues about 20,000 anti-aliased path draws
  per frame. Order-preserving batching cannot reduce that without changing paint
  order, and viewport culling has no effect because every fixture node is visible.
- Edit cost (re-record one bucket, then draw): 1–7 ms at 1,000 nodes, 22 ms for
  10,000 text nodes, 54–61 ms for 10,000 loose primitives. An edit is a one-frame
  re-record; interactions after it are cached.
- Paint caching made the **direct** control path slower (map lookup per item per
  frame) while helping only because recording is one-time. That overhead is
  reported rather than hidden.
- Leak check: pass for both modes — retained paths, images, paragraphs, and
  pictures returned to zero after 10 build/draw/release cycles.
- Memory peak across runs (all application processes): working set 861 MiB,
  private bytes 1038 MiB, GPU process 274 MiB, 4 processes. Picture mode holds
  both retained objects and recordings, so it is slightly above slice 1.

**Amendment (2026-10-14, issue #25).** A candidate comparison ran end to end with
criteria frozen before measurement (`docs/RENDERER_COMPARISON.md`), on the same
fixtures, definition, and protocol, five packaged runs each:

- CanvasKit recorded-picture: 1,000 live layers 5.7 ms; 10,000-leaf nested groups
  19.2 ms; 10,000 loose primitives 89.8 ms; peak working set 861 MiB.
- `vello_cpu` 0.3.0 (wasm32, SIMD128, single thread — VectorCraft's rasterizer):
  1,000 live layers 8.3 ms; 10,000-leaf groups 39.3 ms; 10,000 loose primitives
  125.6 ms; peak working set 727 MiB; leak-clean.
- VectorCraft's native bench on this machine: 37.2 ms for 20,000 **simpler** shapes
  at 2880×1800 with worker threads (their README claims ~27 ms).
- Not measured, not claimed: resvg-wasm/tiny-skia and CanvasKit WebGPU.

No measured candidate meets the 33 ms gate on 10,000 loose always-visible
primitives, so the gate is **amended, not met**. Accepted renderer: CanvasKit
recorded-picture, with the limits published here and in `docs/DECISIONS.md`.
`PERF-01` stays **open** with revisit triggers (wasm threads with COOP/COEP,
Phase 4 profiling with culling and retained regions, or an owner-approved limit
revision). Editor slices 2–6 remain stopped until the owner merges the pull
requests.

## Editor foundation evidence (Phase 1 slice 2)

Recorded with `electron . --smoke=stress` against the production bundle on the
Phase 0/1 machine (AMD Ryzen 5 9600X, Windows 11 Pro). The smoke run drives the
editor's real store and command path, then measures the renderer:

- Command path: create two shapes, select, one-entry drag transaction, undo, redo,
  marquee selection, rejection of an invalid command (`absent-node`), and delete
  with selection pruning — all nine steps pass.
- Renderer: WebGL backend, first frame 2.3 ms.
- Stress: 1,001 shapes in 16 recorded buckets, **render p95 1.10 ms** over 60
  frames, scene build 4.4 ms — inside the 33 ms interaction budget on the accepted
  recorded-picture path.

Unit coverage at the same commit: 48 tests across fixtures/report, document model,
command/undo semantics, hit testing, scene order, and the store; `npm run
typecheck` and `npm run build` clean.

## Prioritization and updates

The first implementation slice is `PERF-01`, followed by `DOC-01` through
`DOC-03`, `CAN-01`, `SEL-01`, `SEL-03`, `PATH-01`, `TYPE-01`, and `IMAGE-01`.
Its approved Phase 1 plan is in `docs/PLAN.md`; each capability moves to
`building` only on its fresh implementation branch.

Every catalog change must update this file and `docs/PROGRESS.md` before
handoff. Add: evidence link/capture, implementation plan or issue, status,
known limitation, platform coverage, and compiler behavior. New owner-selected
capabilities receive an ID before implementation rather than being treated as
untracked scope.
