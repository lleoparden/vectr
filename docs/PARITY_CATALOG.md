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
| DOC-01 | Native document, artboards, metadata, and versioning | planned | future | A multi-artboard document saves, reopens, and retains stable IDs and order. |
| DOC-02 | Layer tree, nested groups, lock, hide, isolate, and stacking | planned | future | Nested layer changes survive save/reopen and undo/redo. |
| DOC-03 | Validated commands, transactions, undo/redo, and recovery | planned | not applicable | Every edit is attributable, reversible, and leaves no partial document mutation. |
| DOC-04 | Local files, autosave, crash recovery, and portable assets | planned | not applicable | Interrupted work can be recovered without silently discarding user data. |
| CAN-01 | Canvas, artboards, zoom, pan, rulers, grids, and guides | planned | not applicable | View navigation preserves document geometry and guide placement. |
| CAN-02 | Snapping, Smart Guides, measurement, and precision input | planned | not applicable | Configured snapping is predictable and keyboard-accessible. |
| SEL-01 | Selection, direct selection, marquee, lasso, and hierarchy selection | planned | future | Object and anchor selection obeys stacking and isolation boundaries. |
| SEL-02 | Transform, free transform, scale, rotate, reflect, shear, and align | planned | future | Numeric and pointer transforms preserve expected anchors and undo correctly. |
| SEL-03 | Distribute, arrange, group, duplicate, copy/paste, and global edit | planned | future | Reordering and duplicate operations retain layer identity and appearance. |
| PATH-01 | Rectangle, ellipse, line, polygon, star, arc, and rounded corners | planned | SVG adjunct | Shapes remain editable primitives until explicitly expanded. |
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
| UI-01 | Illustrator-familiar workspace: menus, tools, panels, contextual controls | planned | not applicable | Core workflows are discoverable without copying Adobe/VectorCraft branding. |
| UI-02 | Shortcuts, command palette, workspaces, preferences, and localization | planned | not applicable | Keyboard paths and persisted preferences are documented and testable. |
| A11Y-01 | Keyboard access, focus, contrast, screen-reader labels, and input devices | planned | not applicable | Core workflows have an accessible path and known gaps are recorded. |
| PERF-01 | Large-document rendering, memory budgets, idle behavior, and recovery | blocked | not applicable | Phase 1 measured CanvasKit/Skia in a packaged build on all required scenarios including real unload cycles; the 33 ms stress interaction target is still missed, so the renderer choice needs an owner decision. See "Renderer evidence" below. |
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
| primitives / stress (10,000 layers, 100,000 segments) | 54 ms | 74.6 ms | **99.9 ms** | 93.4 ms | 18.4 ms |
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

**Diagnosis.** Every fixture node is drawn on every frame with no viewport
culling and no retained layer cache, and each item costs roughly ten JS-to-WASM
calls (state changes plus one or two draws). The miss is per-item call and state
overhead rather than GPU fill rate, which is why 1,000 layers stay well inside the
target while 10,000 layers do not.

**Pending decision.** The approved Phase 1 plan states that a failed spike pauses
editor work for a documented renderer decision; the options are recorded in
`docs/PROGRESS.md`.

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
