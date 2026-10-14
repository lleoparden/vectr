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
| PERF-01 | Large-document rendering, memory budgets, idle behavior, and recovery | designed | not applicable | Phase 0 records synthetic Electron/SVG fixture evidence only; Phase 1 must validate CanvasKit/Skia with total-process memory, stress interaction, repeated unload, and real document lifecycle fixtures. |
| AUTO-01 | Account-scoped MCP and audit trail using normal document commands | deferred | not applicable | Deferred until after the core application and compiler. |
| COMP-01 | One readable React component per layer with stable names | deferred | supported | Deferred until core parity gate; supported layers export deterministic TSX. |
| COMP-02 | Tailwind mapping, inline SVG, assets, and fidelity diagnostics | deferred | SVG adjunct | Deferred until core parity gate; unsupported mappings are explicit. |

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
