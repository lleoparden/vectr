# Vectr master project plan

## Outcome

Build a desktop-first vector design application with Illustrator-class parity, without copying Adobe's or VectorCraft's source or branding. The primary program is the illustration application itself; its first major addition after that core is a compiler that converts a Vectr document's layer tree into readable React components styled with Tailwind.

This is a living delivery plan, not an approval to start product code. Each phase becomes an approved feature plan before implementation.

**Replanned 2026-10-18**, on the owner's instruction, around the reference architecture and the ranked gap list in the VectorCraft repository (see [PARITY_ROADMAP.md](PARITY_ROADMAP.md)). Three things changed: the **architecture** is now prescribed layer by layer instead of left to each slice; the **order** puts interaction fidelity before new capability, because that is what "does not feel good" is; and a **new realignment phase** exists whose only job is to bring what is already built into that architecture, with no change in behaviour.

## Priority and historical context

The original graduation-project proposal remains useful product research, but it is not the current specification. Current owner direction overrides it:

- Vectr is a long-running product, not a graduation project.
- Illustrator-class reconstruction is the main program; the compiler follows it and shares its document model.
- Mockup import, AI assistant, shared library, analytics, cloud services, and IDE-like code editing are later features. The architecture leaves extension points for them without implementing them early.
- The stack is Electron + React + TypeScript + Tailwind + Vite + CanvasKit/Skia. This supersedes the proposal's web/Paper.js/Node direction.

## Reference architecture

Adopted from VectorCraft's documented layering (behaviour and architecture evidence only; no source is ported). A module may only import from a lower layer, and `scripts/check-layers.mjs` fails the build when one does not.

| Layer | Role | Vectr modules |
|---|---|---|
| L0 | Geometry and colour primitives: curves, transforms, colour models, conversions | `src/doc/shapeGeometry.ts`, `src/app/ui/color.ts`, `src/app/ui/cmyk.ts` (to become `src/geom/`) |
| L1 | The document model: artboards, layer tree, appearance, text, images, guides, swatches - pure data, serializable, no UI or GPU | `src/doc/` |
| L2 | Operations over the model: path booleans, text layout, effects, tracing | not yet built (`src/ops/`) |
| L3 | Renderer and formats: document to pixels, and every file format read or written | `src/render/`, `src/file/` |
| L4 | Tools: state machines that take pointer and keyboard input and emit commands and overlays | `src/tools/` - **to be extracted from `CanvasView`** |
| L5 | Engine: sessions, history, selection, the command registry, file orchestration | `src/state/`, `src/app/actions.ts` becoming a real registry |
| L6 | Interface: menus, panels, dialogs, canvas host | `src/app/` |
| L7 | Application shells and tooling | `electron/`, `src/main.tsx`, `scripts/` |

**Rules that follow from this, and that no slice may break:**

1. The document layer never imports React, Skia, or Electron.
2. The renderer never imports React and never mutates the document.
3. Tools never mutate the document directly; they emit commands.
4. Every user-visible action is one command, reachable from menus, palette, and keyboard through one registry.
5. A slice that needs a new layer says so in its plan before code.

## Agent-ready core architecture

MCP and a built-in agent arrive later as product features, but the core is built around these constraints from the beginning:

1. **One command model.** UI gestures, shortcuts, MCP calls, and agent proposals invoke the same validated commands; none gets a private mutation path.
2. **Serializable operations.** Changes have typed inputs, explicit results/errors, undo/redo behaviour, and stable document-version semantics.
3. **Context without hidden access.** Selection, active tool, artboard, and document context may be exposed to an agent; permissions and ownership stay enforced at the command boundary.
4. **Observable changes.** Commands emit structured events so people, MCP clients, autosave, compiler previews, and future collaboration stay synchronized without polling.
5. **Reviewable agent output.** A built-in agent may explain or propose edits; applying one is explicit, attributable, and reversible.

## How progress is measured

The parity catalog (`docs/PARITY_CATALOG.md`) is the source of truth. Every item carries a stable ID, the user-facing capability, reference evidence, a status (`planned`, `designed`, `building`, `verified`, `blocked`, `deferred`), its file-format and compiler behaviour, and links to plan, issue, and evidence. `docs/PROGRESS.md` records the current phase, milestones, blockers, and next approved work. No percentage is published without the catalog.

**Gate quality.** Every slice ships with typecheck, unit tests, a production build, packaged evidence for its user-visible path, and - where the user can see or press it - an assertion that reaches the control the way a user does (hit testing, real chords), not a synthetic event on a hidden element. Interaction fidelity is measured by the packaged run and by the catalog's UI rows, not by opinion.

## Phase tracking

Epics are created up front, one per phase, per the workflow in `.agents/workflows/issue-ready.md`.

| Phase | Epic | Phase | Epic |
|---|---|---|---|
| 0 Reference and platform | #2 (closed) | 7 Appearance, effects, advanced paint | #113 |
| 1 Document and editor foundation | #3 (closed) | 8 Files and interoperability | #11 |
| 2 Core vector illustration | #5 (closed) | 9 Core parity gate | #13 |
| 3 Architecture realignment | #106 | 10 React and Tailwind compiler | #14 |
| 4 Interaction fidelity | #112 | 11 MCP server | #4 |
| 5 Path model and booleans | #6 | 12 Cloud and collaboration | #7 |
| 6 Type | #9 | 13 Further expansion | #10 |

---

## Phase 0 - Reference catalog and platform decision (complete)

**Goal:** establish what will be built and on which desktop foundation.

1. Inventory VectorCraft and Illustrator capabilities into the parity catalog.
2. Define the lawful, evidence-led reconstruction workflow: behaviour and observable artefacts may guide Vectr; VectorCraft source and branding may not be copied.
3. Decide desktop targets, rendering approach, language/runtime, UI framework, packaging, storage, Supabase boundaries.
4. Define the product's original visual identity and licensing policy.
5. Define performance budgets, offline expectations, crash recovery, and the feature-completion standard.

**Exit:** desktop baseline, qualified renderer evidence, parity catalog v1, scoped MVP. Done.

## Phase 1 - Document and editor foundation (complete)

Versioned document and command model; local create/save/reopen/autosave/recovery; selection, layers, artboards, zoom/pan; a desktop command/menu framework on that command model; fixtures for save/reopen and tree integrity.

**Exit:** a user can create, edit, save, reopen, and recover a layered document. Done; see `PROGRESS.md`.

## Phase 2 - Core vector illustration (complete, with recorded limits)

Selection and direct selection, transforms, align/distribute, snapping and smart guides, rulers/grid/guides, artboard management; shapes, fills, strokes, gradients, swatches, opacity, blend modes, clipping, isolation, groups, ordering, lock/hide, duplicate/copy/paste.

**Exit:** users can create polished layered vector artwork with standard tools - **met with recorded limits**: no Bezier pen or anchor editing, no boolean operations, no width profiles, no rotation/reflect/shear, no mesh or patterns, plain text only. Those are Phases 5-7.

## Phase 3 - Architecture realignment (new, next)

**Goal:** make the codebase match the reference architecture, with **no change in behaviour**.

This phase exists because the owner's verdict is that the product does not yet feel good, and because every fidelity feature built on ad-hoc tool code costs more later. It is a retrofit, not a feature phase: the exit test is that the same tests and the same packaged run still pass.

1. **Layer rule and its check.** `scripts/check-layers.mjs` fails when a module imports upward, wired into `npm test`; `src/geom/` extracted for the L0 primitives.
2. **Tools as state machines.** A `src/tools/` interface - enter, pointer down/move/up, key, cancel, overlays, cursor - and the existing tools ported one at a time: Selection, Direct Selection, Lasso, Hand, each shape tool, Type. `CanvasView` becomes a host that routes events and draws overlays.
3. **One command registry.** A single table of commands (id, label, menu path, chord, enabled, run) that menus, palette, shortcut map, and action hub all read, replacing the parallel lists in `actions.ts`, `menuModel.ts`, and `shortcuts.ts`.
4. **No behaviour change.** Every port lands behind the existing tests; the packaged run is re-recorded and must report the same steps passing.
5. **The rule is documented and enforced**, so Phase 4 can add fidelity without re-litigating structure.

**Exit:** layer check green in CI; every tool is a state machine; one command registry; identical test and packaged-run results; no document-format change.

## Phase 4 - Interaction fidelity

**Goal:** make the editor feel like a professional tool. This is gap 1 in the reference gap list (60-90 agent hours there) and the owner's central complaint.

1. **Cursors and hover**: the Illustrator cursor set per tool and handle, hover outlines, tool-specific cursors over objects and panels.
2. **Live previews** for every gesture - move, scale, rotate, pen, text, artboard, guide, lasso - with no state that only appears after commit.
3. **Keyboard and modifier fidelity**: every chord Illustrator uses where the command exists; modifier previews (Shift/Alt) visible during the gesture.
4. **Snapping feel**: thresholds in screen pixels, target prioritisation, guide visuals, and a toggle that reports its state.
5. **Selection and transform polish**: proportional handles, rotation from outside corners, double-click behaviours, nudge speeds, and undo granularity per gesture.
6. **Panels that feel alive**: live values, inline editing everywhere, no dead controls, honest read-only states.

**Exit:** a scripted interaction pass over every tool recorded in the packaged run, plus the owner's walkthrough on Windows at normal and high DPI.

## Phase 5 - Path model and boolean operations

**Goal:** the drawing grammar Illustrator users expect.

1. **Bezier path model** (PATH-02): anchors, in/out handles, open and closed paths, pen tool, direct selection of anchors and segments, join/average, convert point types, and an editable path node kind.
2. **Boolean operations** (PATH-04): Pathfinder and Shape Builder - unite, minus front/back, intersect, exclude, divide, trim, merge, crop, outline; exact, deterministic, undoable as one step each.
3. **Width profiles** (#103): stroke-to-outline geometry, variable width points, and the Width tool.
4. **Live shapes and corners**: reshaping existing shapes, corner widgets, shape-to-path conversion.
5. **Compound paths and offsets**: compound path create/release, offset path, simplify, outline stroke.

**Exit:** a user can draw and restructure curves with Illustrator's mental model, and boolean results compare against its output.

## Phase 6 - Type

**Goal:** text that behaves like a design tool's text (gap 6).

Point and area text, text on a path, threading, character and paragraph styles, tabs and alignment, vertical type, missing-font handling with a real substitute workflow, and text-to-outline.

**Exit:** mixed text layouts survive save/reopen, render predictably, and can be outlined and edited back.

## Phase 7 - Appearance, effects, and advanced paint

**Goal:** the visual depth a real illustration needs (gaps 2, 8, 11, 12).

1. **Appearance stacks**: multiple fills and strokes per object, per-attribute opacity and blend, effects attached and reorderable.
2. **Transparency**: isolation blend groups, knockout groups, opacity masks.
3. **Raster effects**: blur, drop shadow, glow, and a small documented gallery.
4. **Brushes, patterns, symbols, libraries**: pattern swatches, art brushes, symbols and sets.
5. **Mesh, freeform gradient, recolour** (#104), each with its document model.

**Exit:** an object's appearance can be layered and edited non-destructively, with fidelity stated per effect.

## Phase 8 - Files and interoperability

**Goal:** work comes in and goes out without being trapped (gap 2).

1. Native format evolution with migration tests both directions.
2. **SVG** read/write with fidelity reporting, then **PDF** export, then **Illustrator (.ai) and EPS** reading, with a documented fidelity matrix.
3. Raster import/export, clipboard interchange with other applications, linked-asset management.
4. Format regression fixtures plus a published statement of what round-trips exactly, what is flattened, and what is refused.

**Exit:** an Illustrator file opens with its structure intact or a precise report of what changed; a Vectr file exports with named fidelity.

## Phase 9 - Core parity gate

**Goal:** an honest audit before the compiler, and the hardening a professional tool needs (gaps 3, 4, 5, 10, 15, 19).

1. **Capability audit** against the reference gap list and catalog: every item verified, deferred with a reason, or an owner-approved exception.
2. **Stability and hardening**: no crash path, recovery proven, large-document behaviour measured, memory budgets asserted, import fuzzing.
3. **Platforms**: macOS and Linux build, launch, and pass the packaged run; Windows stays the reference.
4. **Performance**: renderer budgets on the frozen fixtures, culling and retained regions, and PERF-01 closed with evidence.
5. **Accessibility**: keyboard-only workflow audit, focus order, contrast, screen-reader labels.
6. **Localization scaffolding** for the interface, without claiming translated catalogues.

**Exit:** the parity claim is defensible line by line, and the app survives real files on real machines.

## Phase 10 - React and Tailwind compiler

**Goal:** turn a Vectr document into maintainable application code - the differentiator.

1. Specify the export contract: one component per layer, groups compose children, stable readable names, deterministic formatting, documented asset output.
2. Map geometry, typography, transforms, fills, gradients, clips, masks, and images to React and Tailwind, with the smallest honest CSS/SVG adjunct where Tailwind cannot express something.
3. Export preview and round-trip comparison against the source document.
4. A compiler support matrix where every editor capability is supported, partial, raster fallback, or not exportable.

**Exit:** a layered Vectr document produces a component tree a developer would keep, and the matrix explains every difference from the canvas.

## Phase 11 - MCP server for account-scoped agents

Command registry over MCP, permission-scoped, with the same validation and history as the UI; reviewable, attributable, reversible agent edits.

## Phase 12 - Cloud, collaboration, and proposal extensions

Accounts and storage (Supabase as the intended free-tier service), shared libraries, autosave sync, encrypted storage, and the proposal's remaining features.

## Phase 13 - Further product expansion

Design-tool-plus-IDE convergence remains a distant possibility after core parity, compiler, and owner-selected features - not a normal roadmap phase.

## Known decisions still needed

- Which Illustrator version is the parity baseline (the reference repository targets Illustrator 2026, 30.x).
- Whether cloud project files are source of truth, backup-only, or optional.
- The public/private licensing and release model, and when repository visibility changes.
- The distribution model per platform.

## Operating cadence

1. Read `AGENTS.md`, this plan, `docs/PLAN.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md` at session start.
2. Plan significant work in `docs/PLAN.md` and wait for approval.
3. Trace the affected document, editor, persistence, compiler, and file boundaries before changing code.
4. One branch and one pull request per slice, referencing its issue, with catalog and progress updates in the same pull request.
5. Self-review the full diff as a reviewer before merging; record doubts rather than resolving them silently.
6. Close a phase only when its exit criteria and evidence are recorded.
