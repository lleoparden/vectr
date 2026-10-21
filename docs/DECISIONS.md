# Decisions

## 2026-10-13 — Product direction

- Vectr is an Illustrator-like visual design tool with a layer-to-code feature.
- Every drawn layer becomes a readable React component; output uses Tailwind.
- Text, shapes, images, groups, and nested groups are MVP layer types.
- Supabase is the intended free-tier service for accounts and persistent projects.
- VectorCraft is a workflow reference only. No VectorCraft source or branding
  will be copied.
- The primary platform is likely a normal desktop app, but the platform and
  stack remain unchosen until a dedicated decision is approved.

## 2026-10-13 — Repository workflow

- This setup is documentation and GitHub governance only: no app scaffold,
  dependencies, source code, or verification checks.
- TrustFlow's reusable conventions are adopted in a simplified form: plan
  significant work first, reuse established patterns, record decisions, and
  make scope and risk explicit in GitHub work items.
- Approved additions: Graphify, architect/worker/reviewer roles, safety and
  context hooks, feature tracing, architecture planning, and agent-ready issue
  criteria. Supabase safeguards and walkthroughs are deferred.

## 2026-10-13 — Delivery and branch policy

- Agents are the primary builders until VectorCraft/Illustrator-level parity
  and the React/Tailwind compiler are complete; the owner plans to extend the
  product afterward.
- Progress tracking is a primary deliverable. `docs/PLAN.md` and
  `docs/PROGRESS.md` must remain current.
- Every product work item uses one new, purpose-prefixed branch: `feat/`,
  `fix/`, `enhance/`, `update/`, `chore/`, or `docs/`. Branches are never
  reused for another work item, and `main` is not a product-work branch.

## 2026-10-13 — Master delivery plan

- The project is planned as a long-running parity program, measured by a
  feature catalog rather than an ungrounded percentage.
- The plan is phased: scope/platform, foundation, core vector work, content and
  appearance, advanced editing, interoperability, compiler, then parity closure
  and handover.
- A Vectr feature is not implicitly compiler-supported. The catalog tracks its
  explicit compiler support level and any fidelity limitation.

## 2026-10-13 — Current product priority

- The original proposal is historical context, not the controlling
  specification. Current owner direction overrides it.
- Core VectorCraft/Illustrator-class reconstruction is the main program; the
  React/Tailwind compiler follows on its shared document model.
- Cloud auth/storage, autosave sync, encrypted project storage, shared library,
  AI assistant, Mockup Import, and analytics are planned after the main app.
- A future MCP server lets agents operate Vectr within the signed-in account's
  explicit permissions. It must not bypass normal validation or safety controls.
- A full visual-design-tool-plus-IDE experience is a distant possibility after
  core parity, compiler, known extras, and later owner-selected features—not a
  normal roadmap phase or current scope.
- The implementation stack is undecided and is no longer bound to the original
  proposal's web/Paper.js/Node architecture.

## 2026-10-13 — Agent-ready core constraints

- MCP and the built-in agent are later features, but the core must use one
  validated, serializable, undoable command model for UI and agent actions.
- Future agent context may expose the active document state, selection, and
  tool context, but no agent gets a private state-mutation path or bypasses
  account permissions.
- Agent-proposed edits must be reviewable, attributable, and reversible.

## 2026-10-13 — Mandatory parity and progress tracking

- The parity catalog is required before estimating or claiming feature parity.
- Every capability change must update both its catalog entry and
  `docs/PROGRESS.md` before handoff, including limitations and blockers.
- A capability may not be silently added outside the catalog or left with a
  stale status after its behavior changes.

## 2026-10-13 — Approved Phase 0 direction

- Electron, React, and TypeScript are the proposed desktop direction. This is
  not locked until a bounded renderer and memory benchmark succeeds.
- Windows is the first fully tested release target. macOS and Linux must build
  and launch early; neither is called fully supported before platform testing.
- The document is a versioned, renderer-independent layer tree with stable
  IDs, order, geometry, transforms, styles, text, and assets. React/DOM is
  never the source of truth.
- UI, shortcuts, future MCP, and the future built-in agent share one validated,
  serializable, undoable command model.
- The compiler defaults to readable TSX + Tailwind, one component per layer,
  and uses inline SVG when needed for visual fidelity. JSX and semantic or
  responsive output are optional future choices when the source supports them.
- REA may investigate narrowly defined, observable behavior with recorded
  evidence and limitations. It must not be used to copy VectorCraft or Adobe
  source, branding, or protected assets.
- Vectr prioritizes memory efficiency. Features must avoid unnecessary retained
  document copies, renderer allocations, background work, and dependencies;
  representative and stress-document memory behavior is a release criterion.
- The repository remains private until the main Illustrator/compiler project is
  complete. It will use original Vectr branding. Apache-2.0 is the proposed
  code license, with the Vectr name/logo reserved, pending the future
  repository-license addition.

## 2026-10-13 — Independent Electron review

- An independent architecture review conditionally supports Electron as the
  provisional desktop shell. Its consistent bundled Chromium is valuable for a
  precision cross-platform editor, but it does not prove acceptable memory use.
- Before the stack is locked, the renderer/memory benchmark must exercise empty,
  representative, and stress documents; measure all application processes,
  interaction, save/reopen, undo/redo, and repeated open/close behavior; and
  retain the raw results. The exact budgets need owner approval in the benchmark
  plan.
- Electron-specific controls to evaluate include one editor window initially,
  one authoritative document, bounded history/caches, virtualized layer lists,
  lazy compiler/agent workers, and explicit resource release on close.
- If Electron misses the approved evidence-based budgets, compare the same
  workload against Tauri + React + TypeScript before choosing a replacement.

## 2026-10-13 — Electron and SVG benchmark evidence

- Five packaged Windows runs on an AMD Ryzen 5 9600X / 15.16 GiB Windows 11
  machine are recorded in `.ecc/benchmarks/phase-zero/`.
- These are synthetic SVG fixture measurements: the harness loaded fixtures,
  selected a layer, and serialized regenerated fixture data. It did not verify
  zoom application, edited-document save/reopen, undo/redo, or close/reopen
  recovery; those remain Phase 1 acceptance work.
- Electron + SVG reached 303.90 MiB maximum whole-app working set on the empty
  fixture and 410.00 MiB on the 10,000-layer/100,000-segment stress fixture.
- SVG is rejected as the production renderer candidate: the stress fixture had
  106.40 ms p95 render time and 86.00 ms p95 interaction time, above the
  provisional 33 ms target.
- Electron is not locked as the desktop shell. Its empty working set is above
  the proposed 300 MiB target, so the same benchmark must be run on Tauri
  before the shell decision is finalized.

## 2026-10-13 — Tauri benchmark environment blocker

- A disposable Tauri + React harness was prepared with the identical SVG
  fixtures and five-run measurement design; it is not Vectr source and does
  not add Tauri to the project.
- Rust, WebView2, and the JavaScript build completed. Native compilation stops
  at the missing MSVC `link.exe`.
- Two approved Build Tools installation attempts exited without registering the
  product or installing the C++ linker. No Tauri measurements exist, so no
  desktop-shell decision may be inferred from this setup attempt.

## 2026-10-14 — Desktop stack and renderer direction

- Electron + React + TypeScript + Tailwind + Vite is selected as Vectr's
  desktop development baseline. Electron's packaged empty working set exceeded
  the provisional budget by 3.90 MiB (1.3%), while full-document SVG missed
  the stress performance target by a far larger margin.
- The Electron evidence rejects full-document SVG, not the desktop shell.
  The editor will use one authoritative, renderer-independent document model;
  React owns controls and the visible layer list, not thousands of drawing
  objects. The one-component-per-layer rule applies to exported React code.
- CanvasKit/Skia is the production-renderer candidate. No renderer dependency
  is approved yet: first run a bounded spike on the frozen fixtures, including
  total-process memory, 33 ms stress interaction, and repeated open/close
  checks.
- Tauri remains a deferred comparison. It may replace Electron only if an
  equivalent foreground workload shows a repeatable runtime-memory advantage
  of about 20% or more, measuring all app-owned processes and private memory.
- Phase 1 must use typed, undoable commands; bounded history/caches; explicit
  GPU/WASM disposal; no whole-document IPC during interaction; and a single
  editor window initially. These preserve the future compiler, MCP, and agent
  boundaries without implementing them now.

## 2026-10-13 — Agent completion and owner handoff

- Agents complete the approved outcome, self-review it, and run planned checks
  before asking the owner to review or test.
- Owner review/testing is the final handoff, not a substitute for unfinished
  agent work. The only exception is a genuine need for new authority, a safety
  decision, or an external blocker that prevents meaningful progress.

## 2026-10-14 — CanvasKit renderer spike evidence (PERF-01)

- Phase 1 slice 1 (issue #15) measured CanvasKit/Skia 0.42 in a packaged Windows
  build across five runs on the same AMD Ryzen 5 9600X / 15.16 GiB Windows 11 Pro
  machine used for Phase 0. Records: `.ecc/benchmarks/phase-one/`.
- The gate metric is defined as one viewport change plus draw submission and
  flush, excluding fixture build work, React rendering, and the vsync wait.
  Presented and React-driven variants are recorded but do not decide the gate.
  Phase 0's number included a two-frame wait and is not directly comparable.
- Verdict: the 33 ms stress interaction target is not met. Worst stress
  interaction p95 was 99.9 ms (primitives), with text at 60.7 ms and nested groups
  at 34.8 ms; draw submission alone was 74.6 ms, above the target independent of
  the timing definition. The 1,000-layer, image, and nested-group fixtures stayed
  inside the target.
- CanvasKit is materially faster than the rejected full-document SVG renderer, but
  it is not proven at the stress scale. The diagnosis is per-item JS-to-WASM call
  and state overhead, because every fixture node is drawn each frame with no
  viewport culling and no retained layer cache.
- Resource evidence from the same runs: retained paths, images, and paragraphs
  returned to zero after 10 build/draw/release cycles; peak whole-app working set
  817 MiB with a 280 MiB GPU process across four processes.
- Because the approved plan pauses editor work after a failed spike, the renderer
  options in `docs/PROGRESS.md` require an owner decision before Phase 1 slices
  2–6 proceed.
- Fixtures are document-shaped (stable ids, local transforms, styles, geometry)
  and versioned at `FIXTURE_VERSION = 1` so the editor's renderer and the compiler
  can reuse them instead of a second synthetic harness.
- Primitive geometry is generated programmatically with the fixture's segment
  budget; the Phase 0 SVG-string parse is deliberately not reproduced, so parse
  cost cannot be mistaken for draw or interaction cost.
- A bundled Inter face (SIL OFL 1.1, license shipped) is loaded through
  `FontMgr.FromData`, and a missing font is reported instead of silently
  substituted, because `canvaskit-wasm@0.42` exposes no system font manager.
- Tailwind is installed now (`tailwindcss`, `@tailwindcss/vite`) and used by the
  app shell; `npm run typecheck` was added so type regressions fail a check instead
  of reaching review.

## 2026-10-14 — Recorded-picture replay optimization (PERF-01)

- Issue #23 added a recorded-picture draw path and measured it against the slice 1
  direct path on the same frozen fixtures and the same gate definition. Evidence:
  `.ecc/benchmarks/phase-one-optimization/`.
- The production path records the scene into at most 16 Skia pictures (buckets of
  consecutive top-level roots) and replays one `drawPicture` call per bucket; an
  edit re-records only the bucket that contains the changed root. Paints are
  cached per style/color/width with batch eviction at 512 entries.
- Worst picture interaction p95 fell from 99.9 ms to 82.2 ms across five packaged
  runs, and several fixtures now pass: nested groups at 10,000 leaves 34.8 → 21.4
  ms, text at 1,000 nodes 32.2 → 12.4 ms, images 3.6 → 2.5 ms. Text at 10,000
  nodes is marginal at 35.0 ms.
- The 33 ms stress target is still not met for 10,000 loose primitives. Replay
  removed the per-item JS-to-WASM work, so the remaining cost is GPU-side
  per-draw overhead across roughly 20,000 anti-aliased path draws per frame.
  Order-preserving batching cannot reduce that without changing paint order, and
  viewport culling has no effect because every fixture node is visible in the
  1200×800 viewport.
- Edit cost is recorded next to interaction cost: re-recording one bucket takes
  1–7 ms at 1,000 nodes, 22 ms for 10,000 text nodes, and 54–61 ms for 10,000
  loose primitives, after which interaction is cached.
- Paint caching slows the direct control path because it adds a map lookup per
  item per frame; it only helps because recording is one-time. The direct path is
  retained as a control and its numbers are reported but do not decide the gate.
- Leak behavior is unchanged and verified in both modes: retained paths, images,
  paragraphs, and pictures return to zero after 10 build/draw/release cycles.
  Peak whole-app working set is 861 MiB across four processes, slightly above
  slice 1 because picture mode holds recordings and retained objects together.
- Because the gate was still not met, editor slices 2–6 stayed paused for the
  owner's renderer decision, with the options recorded in `docs/PROGRESS.md`.

## 2026-10-14 — Amendment to the Phase 0 renderer gate (candidate comparison)

The evidence sections this amendment references follow below, appended by earlier
merge commits (slice 1 evidence, slice 1b optimization, and the workflow record).

- The Phase 0 gate is amended on measured evidence from issue #25. Every candidate
  ran the frozen fixtures with the slice 1b definition and protocol, five packaged
  runs each, on this machine (AMD Ryzen 5 9600X · 15.16 GiB · Windows 11 Pro ·
  Electron 35.7.5). Criteria and candidates were committed before measurement
  (`docs/RENDERER_COMPARISON.md`).
- Measured interaction p95: **CanvasKit recorded-picture** passes 1,000 live layers
  (5.7 ms) and 10,000-leaf nested groups (19.2 ms) and misses 10,000 loose
  primitives (89.8 ms). **`vello_cpu` 0.3.0** (wasm32-unknown-unknown, SIMD128,
  single thread — the rasterizer VectorCraft uses) passes 1,000 layers (8.3 ms) and
  misses both stress cases (10,000-leaf groups 39.3 ms; 10,000 loose primitives
  125.6 ms). Both are leak-clean. Peak working set: CanvasKit 861 MiB with a
  271 MiB GPU process; vello 727 MiB with no GPU process.
- **VectorCraft's own bench ran on this machine**: `20000 objects, fit 2880x1800:
  37.2 ms/frame (drawn 19923, culled 1078)`, `zoom 400%: 13.1 ms`, `thumb 400x300:
  22.2 ms`. Their README claims "about 27 ms"; this machine measures 37.2 ms for a
  lighter fixture (4–10 points per shape) with native worker threads.
- **Decision:** no measured candidate meets 33 ms on 10,000 loose always-visible
  primitives at 1200×800, so the gate is **amended, not met**. Accepted renderer:
  the CanvasKit recorded-picture path, with published limits — up to 1,000 fully
  visible live layers hold 33 ms; 10,000-leaf nested-group documents hold 33 ms;
  10,000 loose primitives are a limitation at 82–90 ms p95.
- The measured reason the CPU path does not close the gap here is **threading, not
  the rasterizer**: VectorCraft's bench uses `vello_cpu` worker threads
  (`Renderer.threads` → `RenderSettings { num_threads }`), while our wasm build runs
  one thread because wasm threads require `SharedArrayBuffer` plus COOP/COEP
  isolation, which the harness does not enable.
- Not measured and therefore not claimed: `@resvg/resvg-wasm` (tiny-skia) and the
  CanvasKit WebGPU path; reasons are recorded in `docs/RENDERER_COMPARISON.md`.
- `PERF-01` stays **open** with revisit triggers: a wasm-threads + COOP/COEP
  `vello_cpu` harness with 4–8 workers; Phase 4 profiling with culling and retained
  regions on realistic documents; or an owner-approved revision of the
  10,000-loose-primitive limit.
- Editor slices 2–6 remain stopped: the owner ordered them paused until the pull
  requests are reviewed and merged.

## 2026-10-14 — Issue, epic, and pull-request workflow

- Every phase in `docs/MASTER_PLAN.md` owns one epic issue, and all phase epics
  are created up front so the whole delivery path is visible. Phase 0 is recorded
  as a completed epic with its evidence.
- Sub-issues are generated only when a phase starts: one per approved slice, each
  carrying the full plan plus every file, module, type, command, asset, and
  boundary the slice creates or changes.
- Agents choose the pull-request strategy for each phase and record it in that
  phase's epic. The owner reviews and tests pull requests and makes every merge
  decision; agents never merge or push to `main`.
- Phase 1 pull-request strategy: one stacked branch and pull request per slice,
  each based on the previous slice, merged by the owner in order.
- Labels `type: epic`, `type: task`, `area: renderer`, and `area: documents` were
  added to `.github/labels.yml` and created on the remote repository, together
  with the previously declared label set.

## 2026-10-14 — Phase 1 approvals and agent choices

- Tailwind is approved for installation now (`tailwindcss` and
  `@tailwindcss/vite`), matching the approved desktop baseline.
- The Phase 0 benchmark harness is repurposed into the Vectr application
  identity: `package.json` name/product name, Electron `appId`, and window
  metadata move from the Phase Zero benchmark naming to `vectr`. The frozen
  fixtures and measurement code are kept as the regression harness.
- Text rendering requires a bundled font: `canvaskit-wasm@0.42` exposes only
  `FontMgr.FromData(...buffers)` and no system font manager, verified in
  `node_modules/canvaskit-wasm/types/index.d.ts`, so a portable editor cannot
  rely on operating-system fonts. Decision: bundle Inter (SIL OFL 1.1) via
  `@fontsource/inter`, ship its license text, and use it as the default editor
  and spike typeface. CanvasKit cannot parse WOFF2, so the TTF/OTF face is loaded
  through `FontMgr.FromData` while the WOFF2 face may style the UI. Missing-font
  behavior later inherits this rule: fall back to the bundled face and report the
  substitution instead of failing silently.
- The informal CanvasKit smoke evidence at `.ecc/tmp/canvaskit-smoke.json` is
  retained as an open item. It is not acceptance evidence; the recorded five-run
  spike evidence replaces it.

## 2026-10-14 — Document model and command path (Phase 1 slice 2, issue #18)

Recorded before slices 3–6 so they extend written decisions instead of guessing at
them. Implementation: `src/doc/{types,document,validate,commands,history}.ts`.

### Identity

- Ids come from `newId(prefix)`: `${prefix}-${base36 counter}-${six random base36
  characters}`. They are opaque, stable, never derived from a layer name, and never
  reused, so renaming or moving a layer cannot break a reference to it.
- Uniqueness is enforced by `validateDocument` (`duplicate-id`) rather than trusted
  from the generator, so an imported or hand-edited document fails loudly.
- Ids are the persistence key planned for the file format (slice #19) and the
  component-identity key planned for the compiler (Phase 6, one component per
  layer). Both later phases must treat ids as opaque strings and must not renumber,
  reorder, or regenerate them on load or export.

### Versioning

- `FORMAT_VERSION = 1` is the document's `formatVersion`. It is separate from
  `revision`.
- `revision` increments on every applied command so renderers, caches, and future
  consumers can invalidate without diffing the tree. It is not persisted as
  identity and nothing may branch on its exact value.
- An unsupported `formatVersion` is refused with `unsupported-version`; migrations
  key off it. Loading must never guess at a newer or older shape.

### Undo granularity

- History stores **inverse commands**, never document snapshots. A command records
  changed fields or the removed subtree, which is what keeps memory bounded on
  large documents.
- A drag, transform, or text edit is **one transaction**: the transaction keeps the
  first inverse (which restores the pre-gesture state) and the last command (which
  is what redo re-applies), so a 200-step drag costs one history entry. (Superseded for
  multi-node transactions by the aggregate-inverse entry below, which still keeps this
  compact form for a repeated single-node gesture.)
- The stack is bounded at 200 entries and drops the oldest first. A committed
  command clears redo. If an inverse fails to apply, the entry is pushed back and
  the document is left untouched rather than partially mutated.
- Selection is deliberately **not** history state. Slices 3–6 must restore
  selection from the command's effect (the ids still exist) instead of recording
  selection snapshots, or the history stops being a record of document changes.

### Validation error codes

- The stable set: `duplicate-id`, `absent-node`, `absent-parent`, `invalid-parent`,
  `cycle`, `invalid-index`, `non-finite`, `non-positive-size`, `unsupported-version`.
- Codes are part of the contract, because the UI, the file loader (slice #19), and
  the future MCP surface act on codes; messages are for people and may change.
- Responsibility split: commands validate **structure** before mutating (parent
  exists and is a group, index in range, no cycle, ids resolvable, transforms
  finite) and leave the document byte-identical when they reject; `validateDocument`
  additionally enforces **geometry** (non-positive sizes) at document boundaries
  (create, open, save). The `createRect`/`createEllipse` helpers never produce
  non-positive sizes, so the normal edit path cannot create an invalid document.
- Known wart, recorded so a later slice can fix it deliberately: a locked node's
  transform is rejected with `invalid-parent`, because no dedicated `locked` code
  exists yet. Slice #20 or later should add one rather than overloading this code;
  until then the message carries the distinction.

### Consequences for slices 3–6

- #20 (layers and groups) and later slices add behavior through new command types
  in `src/doc/commands.ts`, never by mutating nodes directly, and group/ungroup
  must preserve ids so the compiler and files stay stable.
- #16 (text) and #17 (images) extend the same command path and must keep text and
  asset references in the document, not in the renderer.
- #19 (durable local documents) persists `formatVersion`, ids, order, and nesting
  verbatim, validates on open, and rejects unknown versions instead of repairing
  them silently.

## 2026-10-14 — UI shell alignment (issue #28)

The shell now follows the UI direction (recorded in the next section, *UI direction: a
modern Illustrator*) instead of the slice 2 placeholder: a menu bar
(`src/app/MenuBar.tsx` + `menuModel.ts`), the docked tool palette
(`src/app/ToolPalette.tsx`), the right panel dock with collapsible tabbed groups
(`src/app/panels/PanelDock.tsx`), the style panels
(`panels/{Layers,Properties,Appearance,Color}Panel.tsx`), a status bar, theme tokens
in `src/styles.css` (`@theme`) plus `src/app/theme.ts`, and an Illustrator-default
keyboard map (`src/app/shortcuts.ts`) driving one action table (`src/app/actions.ts`)
that the menus, palette, and keyboard all share.

Panel layout, the canvas size, and the About dialog live in a new workspace store
(`src/state/workspaceStore.ts`) rather than the document store. That is deliberate: it
fixes the slice 2 wart where a viewport change notified every document subscriber,
including the layer list.

### Every place the shell diverges from Illustrator, and why

1. **The File menu has Place only, and there is no Effect menu.** New/Open/Save arrive with
   issue #19 and Export React with the compiler phase; Vectr has no effects. An empty menu or a
   permanently greyed placeholder is worse than an honest omission.
2. **The tool palette has three tools** (Selection, Rectangle, Ellipse). Illustrator
   has around forty. Only built tools appear; Pen, Type, Shape Builder, gradients, and
   the rest arrive with the slices that implement them.
3. **No subtool groups or press-and-hold flyouts** on the palette; with three tools
   there is nothing to nest.
4. **Shortcut keys exist only where a command exists** (V, M, L, Ctrl+Z, Ctrl+Shift+Z,
   Delete, Ctrl+A, Ctrl+Shift+A, Ctrl+2/3, Ctrl+Alt+2/3, Ctrl+=/−, Ctrl+0, Ctrl+1, F6,
   Shift+F6, F7). P, T, A, Ctrl+G/H/J and the rest are absent because the commands are.
5. **RESOLVED in the conformance pass below** — Escape used to deselect as well. Escape is
   now a cancel key only: it closes menus and dialogs and clears the pending rejection
   notice, and Deselect keeps Illustrator's Ctrl+Shift+A.
6. **Backspace is an extra binding for Clear** (Delete is Illustrator's own key), for
   keyboards without a Delete key.
7. **RESOLVED in the conformance pass below** — the menu bar takes Alt now: Alt+letter opens
   the matching menu by mnemonic (Alt+E for Edit, Alt+O for Object, and so on) and the
   mnemonic letter is underlined in the title, the way Illustrator's Windows menu bar shows
   it. Ctrl+Alt+2/3 stay unambiguous because they require Ctrl.
8. **The panel dock has a fixed width** with collapsible tabbed groups. No drag-to-
   resize, no floating or rearranged panels, no saved workspaces (that is UI-02).
9. **The panel set is smaller**: Layers, Properties, Appearance, Color. Swatches,
   Align, Transform, Stroke, Gradient, Character, Paragraph, Pathfinder, and Symbols
   are not built. Each group now carries Illustrator's flyout menu at its top right; the
   Layers flyout runs Hide Selection, Show All, Lock Selection, and Unlock All, and the
   style group's flyout is absent rather than empty because it has no commands yet.
10. **RESOLVED in issue #20, extended since** — the Layers panel was read-only beyond selection, hide,
    lock, and disclosure. It is now interactive (drag reorder, drop into a group, Shift range,
    double-click or F2 rename, right-click menu, Delete and arrow keys), it carries Illustrator's
    panel foot (New Layer, Duplicate Selection, Delete Selection), and its rows show **live
    thumbnails for top-level layers** (the first 12; nested rows keep the slot, and a layer in a
    shared bucket is refused rather than previewed misleadingly). The target/locate column and
    dragging a layer into another layer remain unbuilt.
11. **RESOLVED in issue #34** — Hide/Lock/Show All/Unlock All used to record one history
    entry per node, where Illustrator aggregates them into a single undo step, because a
    transaction kept only the first inverse of a gesture. The aggregate inverse described
    later in this file lets a multi-object Hide be one transaction and one undo step, and
    `src/app/actions.ts` uses it again.
12. **Properties and Appearance are read-only for geometry, stroke, and opacity.** Color now
    applies a fill to shapes and text, and the Properties panel edits a text object's font size,
    but position, size, stroke, and opacity still need resize and stroke commands. The panels
    say so instead of showing controls that silently do nothing.
13. **No rulers, guides, grids, snapping, artboard tool, or multiple artboards on
    screen.** Phase 2.
14. **RESOLVED for object commands in issue #20** — the canvas and a layer row open Illustrator's
    right-click menu (Arrange, Group, Ungroup, Delete, Hide, Lock), and right-clicking an
    unselected object on the canvas selects it first. Context menus for text, transform, and
    paste-related commands arrive with those features, so the menu is still smaller than
    Illustrator's.
15. **The menu bar carries the document name** at its right edge. Illustrator relies on
    the operating system's window title; Vectr draws its own single-window chrome.
16. **Zoom and Hand are not tools.** Pan is middle-drag (or two-point drag on a
    trackpad via the wheel), zoom is the wheel plus the View menu, so Z and H are not
    bound while the tools they belong to do not exist.
17. **Opening a document fits the artboard in the window.** Illustrator restores the
    last view per document; Vectr has no persisted view state until #19.
18. **Colors, type, icons, and copy are Vectr's own** — a dark chrome with a single
    violet accent and hand-drawn geometric icons. This is the intended divergence: the
    familiarity is in the layout, terminology, and behavior, never in artwork.
19. **The status bar shows the zoom level, the tool, the selection, and the artboard.** The
    revision counter was removed from it in the conformance pass, because Illustrator keeps
    renderer internals out of the interface; the renderer statistics overlay on the canvas
    remains a Phase 1 dev affordance and should become optional before Phase 2 ships.

### Conformance pass (owner direction, after #28)

The owner flagged that the shell was drifting from the UI rule — inventing elements rather
than following Illustrator. This pass removes the invented pieces and closes three
divergences:

- **Electron's default application menu is gone.** `electron/main.cjs` now calls
  `Menu.setApplicationMenu(null)`. Until now the window showed the native File/Edit/View/
  Window/Help menu *and* Vectr's own menu bar, and Alt opened the native one; Illustrator has
  exactly one menu bar, so the native menu had to go. This was the most serious violation of
  the direction and it was invisible to the test suite.
- **Alt mnemonics work.** Alt+letter opens the matching menu (Alt+E, Alt+O, Alt+S, Alt+V,
  Alt+W, Alt+H) and the mnemonic letter is underlined in the title, as on Windows
  Illustrator. `menuMnemonic`/`menuForMnemonic` derive the letter from the label and a test
  asserts the six letters are distinct.
- **Escape cancels instead of deselecting** (divergence 5). Deselect stays Ctrl+Shift+A.
- **Panel groups got Illustrator's flyout menu** at the top right of the tab strip (divergence
  9, narrower). The Layers flyout runs the same object commands the Object menu does.
- **Invented chrome removed.** The tool palette no longer prints the active tool's letter in
  its corner — Illustrator's palette has no such element — and the status bar no longer shows
  the document revision, which is renderer bookkeeping (divergence 19, narrower).
- **Panel tab labels are sentence case**, like Illustrator's, instead of the uppercase
  treatment the first pass used.

What this leaves genuinely diverging is behaviour that needs features Vectr does not have
yet (File/Type/Effect menus, the missing panels, panels' read-only contents, the fixed dock,
context menus, rulers, and the Layers panel's read-only tree), not styling or gestures
chosen differently for their own sake. Sixteen divergences remain live.

### Evidence and limits

- `electron . --smoke=stress` passes all nine command-path steps on the new shell and
  measures 1,001 shapes in 16 recorded buckets at render p95 1.10 ms over 60 frames
  (scene build 3.5 ms), WebGL backend.
- 64 unit tests pass, including the keyboard-map consistency, the menu model, the panel
  layout rules, the viewport arithmetic, and the layer-row inheritance rules.
- The panels' own interactions (dragging a layer, editing a value) are unbuilt by
  design, so the GUI is still verified by scripted store-level evidence plus manual
  checks rather than by browser automation.

## 2026-10-14 — UI direction: a modern Illustrator

The shell that implements this direction, with its full divergence list, is recorded in
the section above (*UI shell alignment*, issue #28).

- Owner direction: Vectr's interface must be as close to Illustrator as is
  practical, so Illustrator users are productive without relearning anything, while
  staying visibly Vectr's own product — a modern-looking Illustrator.
- Concretely: a menu bar following Illustrator's menu structure; a left tool palette
  with Illustrator's tool groupings and compatible single-key shortcuts; the canvas
  in the middle, gaining rulers, guides, and grids when Phase 2 lands; right-docked,
  collapsible, tabbed panels (Properties, Layers, Appearance, Color, Swatches,
  Align, Transform); and the Layers panel as the document's spine, with per-row
  visibility and lock toggles as Illustrator has them.
- Panel and tool terminology, selection and transform conventions, and default
  keyboard shortcuts follow Illustrator. This is a standing requirement for every UI
  slice, not a one-off polish pass.
- Deliberate divergence is allowed — a better interaction, a dependency we do not
  have, or an accessibility need — but each divergence is recorded here with its
  reason, so the product cannot drift from the familiar model by accident.
- Not allowed, ever: Adobe or VectorCraft icons, assets, screenshots, branding, or
  copied source. Vectr's icons, type, colors, and copy are original; the modern
  visual execution is the identity.
- Consequence for current work: the Phase 1 slice 2 shell (a top toolbar and a plain
  layer list) does **not** yet meet this rule. Issue #20 owns the layer tree and
  panel layout, and a UI-alignment slice owns the menu bar, tool palette, and docked
  panels before Phase 2 tools arrive. `docs/PROGRESS.md` records the gap as a known
  issue.
- Enforcement: `AGENTS.md` (Product identity) states the rule, the issue and pull
  request templates require the Illustrator mapping for interface work, and
  `.agents/workflows/issue-ready.md` makes the mapping part of `agent-ready` and the
  UI direction a review criterion, so an interface change that invents its own layout,
  terminology, or shortcut does not merge.

## 2026-10-14 — Aggregate inverse: one transaction, many commands, one undo step (issue #34)

Recorded before implementation. Supersedes the transaction rule written for slice 2
("the transaction keeps the first inverse and the last command"), and resolves divergence
11 in the shell-alignment section above.

### The problem

A transaction kept `{ command: last, inverse: first }`. That is exactly right for a drag —
hundreds of `setTransform` steps on one node collapse to two commands, and the first
inverse restores the pre-gesture value. It is wrong when a transaction's steps touch
**different** nodes: undo applied the first step's inverse only, so the other steps stayed
applied. #28 hit this with a multi-object Hide and worked around it by recording one entry
per node, which diverged from Illustrator (one undo step) and would have forced #20 to
either do the same or add bespoke commands.

### The design

**A batch command.** `{ type: 'batch'; commands: Command[] }` is a new variant on the
`Command` union. Applying it folds its steps into a local document and returns
`inverse = batch(inverses reversed)`.

- **Ordering.** Undo applies the inverses in **reverse** order of application. This is not
  cosmetic: a step can depend on an earlier one, and unwinding must run from the last
  change back to the first. The canonical case, used as a test, is a batch of
  `[insertNodes X, setTransform X]`: the inverse reverses to `[setTransform X, removeNodes
  X]`, which restores the tree. Applying the inverses in their recorded order would try to
  transform the node after removing it and be rejected. Redo replays the original commands
  in their **original** order, re-creating the same node ids, because the inverse batches
  store the removed subtrees and ids are stable and never reused.
- **Atomicity.** The batch folds into a local variable and returns the caller's document
  untouched on any rejection, so a rejected step cannot leave a partial mutation. The
  failing step's own `ValidationCode` and message survive; the message adds the step index
  and command type (`Batch step 2 of 3 (setTransform) was rejected: …`) so the UI and the
  future MCP surface keep useful context. An empty batch and a nested batch are refused
  (`invalid-index`); `batchCommand()` flattens nesting, so an inverse is always a flat list
  and the ordering stays obvious.
- **Revision.** Each step still bumps `document.revision`, so a two-step batch advances it
  by two. Nothing may branch on the exact value, as recorded for slice 2.
- **Failure on undo.** Unchanged in spirit from slice 2, now covering aggregates:
  `History.undo` applies the entry's inverse; if it is refused the entry is pushed back
  onto the undo stack, nothing moves to the redo stack, and the document is unchanged. A
  batch that cannot fully apply is refused as a whole rather than half-applied.

**Which form a transaction commits.** `transactionEntry()` picks it from the steps:

| Steps | Entry | Why |
| --- | --- | --- |
| one | plain `{ command, inverse }` | identical to the previous behavior; no needless wrapper |
| several, all the same type on the same node, and that type is `setTransform`, `setStyle`, `setFlags`, or `renameNode` | compact `{ command: last, inverse: first }` | each of those commands sets a value, so re-applying the last one supersedes the earlier ones and the first inverse restores the original. This is the drag case, and it keeps a 200-step drag at **two** retained commands instead of two hundred — memory is a product requirement |
| anything else (different nodes, or different kinds of change) | aggregate `{ command: batch(commands), inverse: batch(inverses reversed) }` | correctness: the compact form cannot restore several different nodes |

**Memory.** An aggregate retains every command of its transaction until the entry leaves
the stack, bounded by the transaction's own size and by the 200-entry history cap. The
compact path exists so the one unbounded case — a drag emitting a command per pointer move
— never grows.

**Consequences for #20 and later slices.** Group/ungroup, multi-selection transforms, and
style edits can now compose existing commands inside one transaction and still be one undo
step, so they do not need bespoke commands. #20 does **not** depend on this for correctness
— without it, every composed entry would still undo correctly, just one step per command —
but it depends on it for the one-step behavior, and it avoids adding new command types for
things an aggregate already expresses.

### Evidence

- `tests/history.test.ts` covers batch ordering (including the dependent-step case and the
  refused wrong order), atomic rejection with the step index, empty and nested batches,
  flattening, a two-node transaction undone and redone in one step with the command order
  asserted, a stale inverse refusing the whole undo without touching the document, the
  compact 200-step drag, single-step entries, and abort recording nothing.
- `tests/ui.test.ts` now asserts that a two-object Hide is one undo step and that one undo
  restores both layers.
- `electron . --smoke=stress`: 9/9 command-path steps, drag still one entry, 1,001 shapes in
  16 buckets at render p95 1.00 ms over 60 frames (scene build 3.5 ms).

## 2026-10-14 — Layers, groups, ordering, and the interactive Layers panel (issue #20)

### Composed commands, not new ones

Group, Ungroup, the four Arrange commands, and a Layers-panel drag are **plans** built from
the commands that already exist — `insertNodes`, `moveNode`, `removeNodes` — and executed in
one transaction, so each gesture is one history entry through the aggregate inverse from
issue #34. No command was added to the document model for #20, and `src/app/arrange.ts` plus
`src/app/layerDrag.ts` hold the planning as pure, tested functions.

- **Group** inserts one group at the stacking position of the *topmost* selected node and then
  moves the members in, in paint order, so the group lands where the topmost member was and
  the members keep their relative order. The new group is selected afterwards, which is what
  makes a following Ungroup or Arrange act on it.
- **Ungroup** moves each child out to the group's own position (so the children end up exactly
  where the group sat, in order) and then removes the empty group. One level per press, like
  Illustrator: a nested group inside stays a group.
- **Arrange** moves every selected node: Bring to Front / Send to Back take the extreme,
  Bring Forward / Send Backward move each node by one position. The selection's relative order
  is preserved by walking it bottom-up for Front and Backward and top-down for Back and
  Forward, which is the detail that stops a two-node Bring Forward from swapping its own
  members. It is unavailable when the selection spans parents or when every sibling is
  selected, so the menu items grey out instead of doing nothing.
- **A drag** resolves against the row under the pointer: the upper quarter drops before the
  row, the lower quarter after it, and the middle half of a *group* row drops inside the group
  (Illustrator's target behavior). A node cannot be dropped on itself, into its own subtree, or
  back where it already is, and those are refused in planning rather than by a failing command.
- **Atomicity.** Every plan is simulated on a local document with the real command path before
  anything is dispatched, so a plan that would be rejected never starts; and if a step fails
  anyway, the applied steps are rolled back and the transaction is dropped, leaving the
  document as it was.

### The `locked` validation code

Issue #18 recorded a wart: a locked node's transform was rejected with `invalid-parent`
because no dedicated code existed, and the decision said a later slice should add one. #20 is
that slice: `ValidationCode` now includes **`locked`**, `isLocked()` checks the node and every
ancestor (Illustrator's lock is inherited), and the code is used by `setTransform`, `setStyle`,
`moveNode`, `removeNodes`, and by the planners, so a locked layer cannot be moved, restyled,
reordered, deleted, or used as a drop target. `setFlags` deliberately does **not** check lock,
because Unlock All and Show All have to reach locked nodes.

### Ordering semantics kept from the command model

`moveNode`'s `index` is the position "as if the node were still in place" (the command adjusts
it down when the node left the same parent before the insertion point). That is subtle enough
to be worth restating here: every planner computes indices against a simulated document for
exactly this reason, and both the unit tests and the drag tests pin the resulting orders.

### Layers panel behavior

Drag to reorder or drop into a group, Shift-click for a range selection, double-click or F2 to
rename in place (Enter commits, Escape cancels), right-click for the object menu, Delete and
the arrow keys for navigation and disclosure. Row layout stays Illustrator's: disclosure
triangle, eye, lock, thumbnail slot, name.

### Context menus

The canvas and a layer row both open a right-click menu, which closes divergence 14 for object
commands: Arrange, Group, Ungroup, Delete, Hide, Lock. On the canvas, right-clicking an object
that is not selected selects it first, the way Illustrator does. Text, transform, and
paste-related context menus arrive with those features.

### Selection is still not history state

Undoing a group leaves the selection empty, because the selected node no longer exists and
selection is pruned rather than restored (recorded for #18 and asserted in the #20 tests).
Grouping across parents is refused rather than silently reparenting, which differs from
Illustrator: it groups objects from different layers into the topmost object's layer.

### Evidence

- 88 unit tests, 12 of them new for this slice: plan ordering for all four Arrange commands,
  group placement, ungroup with a nested group, drop resolution (before/inside/after, self,
  subtree, no-op), inherited locking across five command types, one-undo-step behavior for
  group/arrange/ungroup through the store, and paint order equal to tree order after grouping
  and arranging.
- `electron . --smoke=stress`: 13/13 steps, including `group is one entry` (depth 4 → 5, two
  top-level layers become one), `group selected and nested`, and `undo ungroups in one step`;
  1,002 shapes in 16 buckets at render p95 1.20 ms over 60 frames.

## 2026-10-14 — Plain text (issue #16)

### Model

`TextNode` is a fourth node kind beside rectangle, ellipse, and group:
`{ type: 'text', text, width, height, fontSize, fontFamily, align, lineHeight, style }`.
`style.fill` is the text color, so stroke and opacity behave as they do on a shape, and the
node's **box is stored on the node** so bounds, hit testing, marquee selection, the Layers panel,
and the scene builder need no special cases. Advanced typography — character and paragraph
styles, text on a path, area text, multilingual layout — stays in Phase 3, as the phase plan
says.

### Measurement

Two measurements exist and they are deliberately different:

- `estimateTextSize()` in `src/doc/document.ts` is pure and renderer-free: the longest line
  times 0.55 × the font size, and the line count times the leading. It is the default the
  document layer can always compute, so a text node created without a renderer still has a
  usable box.
- The renderer measures with the real font by summing Skia's glyph advances
  (`getGlyphIDs` + `getGlyphWidths`), which is exact for the face that will be drawn.

The editor prefers the renderer's measurement because it makes the selection outline match the
glyphs; `estimateTextSize` is the fallback when no renderer or font is available. Both paths
are tested, and the two agree in kind (longer text is wider, more lines are taller).

### Commands

- `setText { nodeId, text, width?, height? }` replaces the content and the box. The optional box
  is what the caller measured; when it is absent or invalid the command uses the estimate, so
  the box can never disagree with the content in a way that breaks selection. The inverse
  restores the previous text *and* the previous box exactly.
- `setTextStyle { nodeId, fontSize, fontFamily, align, lineHeight, width?, height? }` validates
  size and leading as finite, positive, and bounded (≤ 1000), refuses an unknown alignment, and
  rejects an empty or over-long family name. A locked text node refuses both, through the
  `locked` code from #20.
- Content is capped at `MAX_TEXT_LENGTH` (100 000 characters) so a paste cannot grow the
  document without bound; the same limit is enforced by `validateDocument` at document
  boundaries.
- One text edit is one command inside whatever transaction the caller uses, so an edit is one
  undo step and an edit inside a multi-object gesture folds into the aggregate entry.

### Missing-font behavior (recorded in slice 1, implemented here)

Vectr bundles Inter and CanvasKit has no system font manager, so:

- Requesting a family Vectr does not have is **accepted, not refused**: the text is drawn with
  Inter.
- The substitution is **reported** three ways: `[vectr-font] "X" is not available; drawing with
  Inter.` on the console, `RenderStats.substitutedFonts`, which the canvas shows as a notice,
  and a warning row in the Properties panel for the selected text object.
- The packaged smoke run asserts the report end to end (`font substitution reported`).

### Editing

- The Type tool (`T`) places a text object where the canvas is clicked and starts editing it,
  which is what Illustrator's Type tool does.
- Double-clicking a text object with the Selection tool edits it, as in Illustrator.
- The editor is a real labelled `<textarea>` positioned over the object at its own size,
  leading, color, and alignment, so what is typed is what will be drawn, and the whole flow
  works from the keyboard. Escape commits (Illustrator's Escape ends text editing), Ctrl+Enter
  commits, clicking away commits, and Tab does not leave the field.
- **An empty text object is discarded** rather than left invisible in the document. Illustrator
  keeps the empty object; this is a deliberate divergence, recorded here.
- Text participates in everything else already: drag to move, marquee and shift-click
  selection, grouping, arranging, hiding, locking, and the Layers panel.

### Type commands and chords

The Type menu exists now (it was an omitted menu), in Illustrator's menu order, with
Horizontal Align Left / Center / Right (Ctrl+Shift+L/C/R) and Increase / Decrease Size
(Ctrl+Shift+> / <). Size steps through Illustrator's size list (6…144) and moves by 20 % past
either end. The commands grey out when no text is selected, as Illustrator's do. The Properties
panel also edits the font size directly, and the Color panel's swatches now apply a fill to
shapes *and* text, which closes the "applying color is not built" note from #28.

### Evidence

- 97 unit tests, 9 new here: defaults and estimated box, estimate monotonicity, `setText`
  content/box/inverse, refusals (wrong kind, missing, locked, oversized), `setTextStyle`
  validation and inverse, document validation of corrupt metrics, hit testing and marquee and
  scene order for text, one-undo-step editing and size/alignment actions, and the size-stepping
  table.
- `electron . --smoke=stress`: **21/21** steps, including `text created`, `text edit is one
  entry`, `text undo restores content`, `invalid text style rejected`,
  `missing font is recorded, not refused`, and (in the stress phase) `font substitution
  reported`; 1,003 shapes in 16 buckets at render p95 1.20 ms over 60 frames.

## 2026-10-14 — Images: content-addressed assets (issue #17)

### The split: bytes at runtime, metadata in the document

An `ImageNode` holds `{ type: 'image', assetId, width, height, style }` and nothing else. The
bytes live in a runtime **asset registry** (`src/state/assetRegistry.ts`) keyed by a digest of
their content, and the document carries only an `AssetRef` (id, MIME type, byte length, pixel
size) in its existing `assets` list. Three consequences are deliberate:

- The document stays small and serializable, and two placements of one file share one entry
  and one copy of the bytes in memory.
- The renderer never touches the filesystem or the store: the canvas hands it bytes per asset
  id and it decodes once per id (`EditorRenderer.putAsset`).
- Issue #19 can persist the registry next to the document without changing the model.

### Content addressing and limits

The key is `sha256-<hex>` over the bytes, computed with `crypto.subtle.digest`. Import checks
run **before** anything is decoded or dispatched: PNG and JPEG only, ≤ 20 MiB per asset,
≤ 40 megapixels, ≤ 512 assets per document. A rejected import reports a reason
(`unsupported-type`, `too-large`, `too-many-pixels`, `corrupt`, `too-many-assets`) through the
store's error path — a new `reportError` so a pre-command failure surfaces exactly where a
rejected command does — and the document, the registry, and the memory footprint are unchanged.

### One command for placement

`placeImage { parentId, index, node, asset }` inserts the node **and** registers the asset, so
the two halves cannot get out of step. Its inverse removes the node, and — only when this
placement was what added the asset — also removes the asset record, as a batch inverse. That is
why a second copy of the same image undoes without dropping the shared asset, and it is the
first real use of the aggregate-inverse work from #34 inside the command model itself.
`addAsset` and `removeAsset` exist for the other direction: removing an asset an image still
uses is refused with `invalid-asset`, and `validateDocument` reports an image whose asset the
document does not carry, so a broken reference fails at the boundary rather than drawing
nothing.

### Renderer

The scene carries `assetId` per image item (and the signature includes it, so a changed asset
re-records its bucket). `drawImage` draws the decoded image into the node's box with
`drawImageRect`, and an asset the renderer never received is drawn as a light placeholder frame
plus a report in `RenderStats.missingAssets`, which the canvas shows as a notice — the same
"report, do not fail silently" rule the fonts follow. Decoded images are disposed with the
renderer, and one image is decoded once no matter how many nodes reference it.

### Import paths

`File > Place…` (Ctrl+Shift+P, Illustrator's chord) opens the platform dialog through the
preload bridge; the main process shows the dialog, reads the file, and sends the bytes over
IPC, so the renderer needs no filesystem access. Dropping image files onto the canvas places
them too. In a plain browser build the same flow falls back to a file input, which is why the
import logic lives in `src/app/imageImport.ts` rather than in the Electron layer. The File menu
appears now with the command it actually has: New, Open, and Save join it in #19, so the
"File menu is absent" divergence narrows to those commands.

### Where a placed image lands

An imported image is placed at its natural pixel size, centered on the first artboard. That is
predictable and testable; Illustrator places at the click point or centered in the window
depending on the dialog, which is a distinction worth revisiting when placement options arrive.

### Evidence

- 107 unit tests, 10 new here: content addressing, the four limit checks, a rejected import
  leaving everything untouched, placement registering both halves with undo and redo, a shared
  asset surviving the undo of a second copy, four refusals, asset-removal rules and document
  validation, hit/marquee/scene order for an image, registry deduplication and pruning, and the
  store's failure path for an undecodable file.
- `electron . --smoke=stress`: **25/25** steps. The new ones generate a PNG in the page and
  place it for real: `image imported` (8×8 pixels, 89 bytes, `sha256-ab57fee…`), `image undo
  removes node and asset`, `image redo restores both`, and `image drawn from its asset`; 1,004
  shapes in 16 buckets at render p95 1.30 ms over 60 frames.

## 2026-10-14 — Durable local documents (issue #19)

### The format

A project is a directory, `<name>.vectr`, holding:

```
manifest.json      canonical JSON: manifestVersion, formatVersion, revision, id, name,
                   artboards, asset references, and the whole node tree
metadata.json      savedAt, app, versions — deliberately not part of the format
assets/<key>.png   content-addressed bytes, one file per asset, shared by every node using it
```

Two rules shaped it. **No base64**: assets are referenced by content key and live as their own
files, which a test asserts by refusing long base64-looking runs. **Byte-stable manifests**:
saving an unchanged document twice produces identical text, so the manifest is canonical JSON
(keys sorted recursively, two-space indent, trailing newline) and everything that changes on its
own — the save timestamp, the app name — lives in `metadata.json` instead. The round trip is a
fixed point: re-serializing what was read yields the same bytes.

The tree is stored as the document model already is. The model was built JSON-safe from slice 2
precisely so this step would be a copy rather than a translation, and the manifest is therefore
also the compiler's future input.

### Versioning and refusal

`manifestVersion` (the file's shape) and `formatVersion` (the document model) are separate, so
each can move without dragging the other. `MIGRATIONS` is the hook later versions plug into.
Unknown or newer versions are refused with a reason (`unsupported-manifest-version`,
`unsupported-format-version`), as are broken JSON (`not-json`), foreign files (`not-a-manifest`),
and documents that fail the model's own validation (`invalid-document`, carrying the specific
code: `duplicate-id`, `non-finite`, `invalid-asset`, …). **Nothing partial is ever returned**: the
open path validates the manifest, then verifies the assets, and only then replaces what is on
screen, so a bad file leaves the open document untouched.

Asset verification is the part a manifest alone cannot do: every referenced asset must be present,
must have the byte length the manifest claims, and must hash back to its own content key — which
is what catches a file that was replaced with different bytes of the same size.

### Atomic writes

Order: new assets are written (temp file, then rename), then the manifest is written to
`manifest.json.tmp` and **renamed** over `manifest.json`. The rename is the only step that can
replace the previous manifest, so an interrupted save leaves the previous project complete and
loadable; the worst case is an unreferenced asset file, which the next save prunes. The policy is
tested against an in-memory filesystem that can be made to fail at exactly that step.

Saves also prune: an asset no node references any more is deleted from the project, so editing an
image out of a document does not leave its bytes behind forever.

### Recovery: one snapshot, newest wins

`recovery.json` (written through a temp file and renamed) holds one rolling snapshot: the document
name, the project it came from, the time, and the manifest. It is written on a 30-second interval
while the document is dirty, again before the window unloads, and once more if the user chooses
"Don't Save" when closing. **Limits, stated plainly: one snapshot, no merge, no history, newest
wins.** The snapshot lives outside the project, so a failed save can never be what breaks
recovery. It is cleared on a successful save, and `File > Recover Unsaved Work` is greyed out when
there is nothing to recover. Discarding is the only path that can lose work, which is why the
snapshot is taken first.

### Dirty state and the close guard

The store holds `savedRevision` and `filePath`, and `isDirty` is a comparison — no edit path can
forget to set a dirty bit. The menu bar shows the document name with an asterisk and the status
bar shows the project path plus `saved` / `unsaved changes`. Closing the window is guarded in the
main process: the first close asks the renderer, which answers through a native Save / Don't Save
/ Cancel dialog and then calls `app:allow-close`, so the second close proceeds. A renderer killed
before answering leaves the window open rather than quitting silently with unsaved work.

### IPC surface

Dialogs and disk IO stay in the main process; the renderer never touches the filesystem. Every
result is a discriminated union with an `ok` flag: `{ ok: false, code, message }` for failures,
`{ ok: true, canceled }` for cancels, and a payload for success, so the renderer cannot
misinterpret a failure as data. Two extra handlers exist for automated runs only — `file:open-at`
(read a project by explicit path) and `file:scratch-directory` (a scratch folder under user data)
— so the packaged smoke run can exercise save and reopen without a dialog and without littering
the user's Documents folder.

### Deviations recorded

- The issue names `tests/files.test.cjs`; the suite is `tests/files.test.ts`, because every other
  test in this repository is TypeScript executed by Node's type stripping and a `.cjs` file could
  not import the modules under test.
- Cycle and missing-parent manifests are structurally unrepresentable in a JSON tree (a node's
  parent *is* its container), so those classes are covered by `validateDocument`'s own tests and
  by the open-time call into it, rather than by a hand-built manifest that cannot exist.

### Evidence

- 119 unit tests, 12 new here: manifest round-trip fidelity across every node kind with nested
  groups and a placed image, byte-identical and fixed-point manifests, no-base64 assertions,
  version/foreign/JSON refusals, four validation-failure classes, asset presence/length/hash
  verification, one asset written once with reuse on the second save, an interrupted save leaving
  the previous project intact, pruning, recovery write/read/newest-wins/clear/corrupt, dirty-state
  derivation, and filesystem-safe names.
- `electron . --smoke=stress`: the packaged `[vectr-file]` run passes **11/11** steps against the
  real filesystem: `save writes a project`, `saving clears the dirty state`, `an edit after save is
  dirty`, `reopen restores the layer tree` (4 top-level nodes), `reopen restores geometry, text,
  and the image` (1 asset), `a reopened document resaves byte-identically` (3208 bytes),
  `reopened document is clean`, `recovery snapshot is written`, `recovery restores the unsaved
  work`, `recovery clears after it is consumed`, and a memory record of **453.5 MiB whole app**
  after save and reopen with one image asset.

## 2026-10-14 — Repository layout (owner-requested structure cleanup)

The owner reported the folder structure had become a mess. Two changes, in the order they were
made, each independently revertable:

**Hygiene (`chore/repo-hygiene`, PR #43).** The 60 KB Phase 0 proposal page moved from the
repository root to `docs/proposal/`, and the wordmark — which was an *untracked* file at the root —
was tracked as `docs/assets/vectr-wordmark.png` rather than deleted. Generated build logs were
removed and the scratch that kept appearing in `git status` (`.ecc/tmp/`, `.ecc/issues/`,
`tools/vello-raster/target/`, `*.err.txt`) is now ignored: those issue and pull-request bodies are
working copies whose authoritative record is GitHub. The repository had **no README at all**, which
is why one now exists, with the real commands, a structure map, and where the project record lives;
`docs/README.md` gives each of the six documents one job.

**Code layout (`chore/src-app-structure`).** `src/app/` had 22 flat files — components, the action
table, pure editing logic, file glue, icons, and theme side by side — with `panels/` the only
subfolder, so the folder followed no rule at all. It is now grouped by role: `shell/`, `canvas/`,
`menus/`, `panels/`, `editing/`, `files/`, and `ui/`, with the benchmark window moved next to the
harness it belongs to in `src/bench/`.

Two things deliberately stayed where they were:

- **`src/app/actions.ts`** is the action table every surface calls (menu bar, panels, shortcut hook,
  canvas, tests). Moving it would have churned importers for no structural gain, so it remains the
  hub at the root of `src/app/`, next to `App.tsx`, which composes the shell.
- **Nothing was renamed**, only moved. The grouping rule is "one kind of thing per folder", and a
  reader looking for "where is the menu built" or "where do groups get computed" now has one answer
  each: `shell/`, `menus/`, and `editing/`.

The move was done with `git mv` so history follows, and the 99 relative import specifiers were
rewritten by a script that resolved each one against the file's old location and re-emitted it from
the new one. Evidence that it changed nothing but paths: typecheck clean, **119/119 tests**,
identical production bundle hash before and after (`index-5DFkgqNk.js`, 480.32 kB), and the packaged
smoke run passing all three reports (18 + 11 + 8 = 37 steps).

## 2026-10-14 — Bug: the Type tool did nothing (owner-reported), and why the evidence missed it

### The report

The owner pressed the Type tool and clicked the canvas: **nothing happened, and they could not type.**

### The cause

The click placed a text object and opened the inline editor, and then the *same click* closed it. A
real mouse-down runs the browser's default focus change **after** the `pointerdown` handler returns;
the canvas is not focusable, so focus went to the document body, which blurred the textarea that had
just been focused. The editor's blur handler committed the (still empty) text, and the empty-text rule
discarded the new object. From the user's side: a flash, then nothing.

### The fix, in two parts

1. **Root cause, in the canvas:** the Text tool's `pointerdown` now calls `event.preventDefault()`, so
   the browser does not move focus away from the editor it just opened. That is what `preventDefault`
   is for in this exact situation, and it is why the fix belongs in the canvas rather than in a
   timeout.
2. **Safety net, in the editor:** a blur that arrives before the user has typed anything no longer
   counts as leaving. It is recovered from **once** by re-focusing; a second blur commits as usual.
   So a stray focus change can never delete the object the user was about to type into, and a genuine
   departure (clicking another panel, pressing Escape) still behaves normally.

### Why the existing tests did not catch it — the lesson worth keeping

The unit tests cover the text *commands*, and the file round trip covers *saving* a text object, so
both were green while the interaction was completely broken. I then wrote a DOM-level test that
dispatched `pointerdown`/`pointerup` at the canvas and **it passed too**, which proved nothing:
`dispatchEvent` does not run a browser's *default* actions, so the focus change that caused the bug
never happened in the test.

The regression test now simulates the missing half as well — it blurs the editor immediately after the
click, which is what the real browser does — and that step failed before the fix (`editor closed`) and
passes after it (`editor open, 2 text object(s)`, followed by typing that commits). The lesson is
recorded because it generalises: for interaction bugs, a test that dispatches events is not evidence
until it also reproduces the browser behavior around them.

### Evidence

- The new `[vectr-text]` packaged report drives the real canvas element: click with the Type tool
  places text and opens the editor; typing commits as one entry; the editor closes after committing;
  an abandoned empty object is discarded; **a blur before typing does not destroy the object**;
  typing still works after that blur; and double-clicking an existing object reopens the editor.
- Full run: 126 unit tests and **58 packaged steps** across five reports, all passing.

## 2026-10-14 — Layer thumbnails, made real rather than decorative

The Layers panel's thumbnail slot had been an empty box since #28, recorded as a divergence. It now
shows a real preview of the layer — the actual renderer output, not a hand-drawn approximation, which
matters because an approximation would be a picture of what the panel thinks the layer looks like
rather than what the canvas draws.

### How it works, and why it is cheap

`EditorRenderer.renderThumbnail(rootId, size, bounds)` reuses the bucket's **already-recorded
picture**: it draws that picture into a small offscreen surface scaled to the layer's bounds and
encodes one PNG, which the panel shows as a data URL. No scene rebuild, no second code path, and the
thumbnail cannot disagree with the canvas because it is the same recording.

### The three limits, all deliberate and all asserted

1. **Top-level layers only.** A nested row keeps its slot. Previewing a nested node would mean
   drawing a subtree out of a picture that also contains its siblings and its parent's background.
2. **The first 12 layers.** That is a panel's worth of rows, and it bounds the cost of a thumbnail
   pass to roughly a dozen draws plus encodes per document change.
3. **Refused when the bucket is shared.** The renderer keeps at most 16 buckets, so a document with
   more than 16 top-level layers gets buckets that hold several of them. A preview from such a bucket
   would silently show a layer's *neighbours*, so `renderThumbnail` returns null instead and the row
   keeps its placeholder. The packaged run asserts this refusal, so the limitation cannot rot into a
   lie later.

The panel caches thumbnails per document revision and retries once a second until the renderer exists
(it is created a moment after launch), so nothing renders before there is something to render with.

### Evidence

- `electron . --smoke=stress` — **51 packaged steps** across four reports, all passing. Two new in
  `[vectr-file]`: `layer thumbnail renders a real preview` (144 bytes of PNG for a rect layer) and
  `the thumbnail decodes as a 28×28 image`, which proves the data URL is a real image rather than a
  well-formed stub. One new in `[vectr-memory]`: `a chunked bucket refuses a misleading thumbnail`,
  asserted against the 1,048-layer stress document.

## 2026-10-14 — Layers panel actions: Duplicate and New Layer

The Layers panel had no foot. Illustrator's has New Layer, New Sublayer, Collect in New Layer,
Make/Release Clipping Mask, and Delete Selection along the bottom, and its panel menu offers the
same commands. Vectr now has the three that make sense without clipping masks or sublibraries:

- **New Layer** (`layer.new`) inserts an empty group at the top of the layer list and selects it —
  Illustrator's "new layer appears above the current one".
- **Duplicate** (`object.duplicate`) copies the selection directly above the topmost selected node,
  keeping the copies in their originals' order, and leaves the copies selected so a drag right after
  duplicating moves them.
- **Delete Selection** reuses one shared policy (`deleteUnlockedSelection`), so the panel foot, the
  row context menu, and the keyboard now cannot disagree: a locked layer is skipped rather than
  failing the whole delete.

All three are reachable from the panel foot, the Layers flyout menu, and the row's context menu,
which is where Illustrator puts them.

### Duplicate semantics, recorded deliberately

`duplicateSubtree` in `src/doc/document.ts` deep-copies with **fresh ids** and nothing else changed:
same order, geometry, styles, text, and leading. A duplicated image keeps pointing at the same
content-addressed asset, so duplicating a photograph costs one more node rather than one more copy
of the pixels — the asset model from #17 doing exactly what it was built for. Fresh ids are not
cosmetic: ids are how selection, history, and the manifest refer to nodes, so a copy that shared an
id would corrupt undo.

No keyboard chord is bound. Illustrator's Ctrl+D is "transform again", not duplicate, and its Layers
panel Duplicate has no default chord either, so binding one would be a divergence dressed as a
convenience.

### Still open in the Layers panel

Thumbnails. The row's thumbnail slot is still an empty box (recorded as a divergence since #28):
making it show a real preview means rendering a subtree offscreen and encoding it, with a bounded
cache invalidated per subtree — a piece of work worth doing on its own rather than smuggling into
this one.

### Evidence

- 126 unit tests, five new: `duplicateSubtree` (fresh ids at every level, identical otherwise, and a
  shared asset id), the duplicate plan's placement, duplication through the store as one entry with
  the copies selected, New Layer as one entry, and the locked-layer delete policy.
- `electron . --smoke=stress` — **48 packaged steps** across four reports, all passing, including two
  new ones in `[vectr-smoke]`: `duplicate is one entry above the original` (with `undo removes the
  duplicate`) and `new layer lands on top and is selected`.

## 2026-10-14 — Vectr's own unsaved-changes dialog, and a data-loss bug it exposed

### The dialog is Vectr's, not the operating system's

Closing with unsaved work used to raise a native `dialog.showMessageBox`. That made the one surface
that interrupts the user the one surface that did not look like the product — against the UI rule,
which wants the equivalent control where an Illustrator user expects it, drawn the way Vectr draws
everything else. `src/app/shell/UnsavedChangesDialog.tsx` replaces it: Vectr's chrome, Vectr's copy
(`src/app/files/unsavedPrompt.ts`, pure and tested), a real modal with `aria-modal`, a labelled
title, focus on the primary action, Tab kept inside the dialog, Escape cancelling, and the primary
button reading "Saving…" while an async save is in flight.

The main process keeps the guard and loses the dialog: it still intercepts the first close and sends
`app:before-close`, and the renderer answers with `app:allow-close` only when it may. **An unanswered
prompt can never lose work** — no answer means the window stays open. `dialog:confirm-close` is gone
from the main process, the preload bridge, and the type declarations.

### The bug the same code path had: New and Open discarded unsaved work silently

`file.new` and `file.open` called straight into `newDocument()` and `openDocument()`, so an unsaved
document was replaced without a question. That is the exact silent data loss the recovery rules exist
to prevent, and it was worse than the native dialog ever was. Both actions now go through
`requestNewDocument()` / `requestOpenDocument()`, which raise the same dialog with copy written for
the occasion ("Save changes before starting a new document?"). One dialog, three ways work can be
lost: closing, New, and Open.

Cancelling a save inside the dialog keeps the dialog open rather than dropping the work, and
discarding on close still writes the recovery snapshot first — discarding remains the only lossy
path, and it is now explicitly chosen in every case.

### Evidence

- 121 unit tests, two new: the copy for all three kinds (distinct wording, the document name, the
  unnamed fallback, and that closing explains the snapshot), and the guard logic.
- `electron . --smoke=stress` — 45 packaged steps across four reports, all passing. Two new steps in
  `[vectr-file]` prove the guard end to end: `starting a new document asks before discarding unsaved
  work` (prompt raised, work kept) and `cancelling the prompt leaves the document untouched`.

## 2026-10-14 — Bounded decoded-asset cache, and the Phase 1 exit audit

### The cache is now bounded

The epic's architecture constraint says renderer and decoded-asset caches must be "derived, bounded,
and explicitly disposed". The decoded-image map was keyed by asset id and only ever released in
`dispose()`, so a session that opened several documents kept every document's pixels alive until the
window closed. `EditorRenderer.retainAssets(assetIds)` now releases every decoded image the current
document does not reference, the canvas calls it whenever `document.assets` changes (including when a
document is closed or replaced), and `RenderStats.decodedAssets` exposes the current size so the
bound is observable rather than assumed. `dispose()` still releases whatever remains.

This is a real fix, not a tidy-up: the packaged run now asserts the count returns to **0** after
closing a document that held 48 decoded images.

### What the audit of the epic's exit criteria changed

The owner asked for the Phase 1 epic's exit criteria to be verified rather than assumed. Five of the
seven were already met with evidence on `main`. Two were not:

1. **Zoom evidence was missing.** The criterion names zoom, but no recorded run had a zoom scenario —
   the spike covered `fixture`, `resize`, `replace`, and `unload`. The packaged run now renders the
   stress scene at 0.25×, 1×, 2×, and 4× and records each time (7.6 ms, 1.0 ms, 0.6 ms, 0.1 ms).
2. **Memory on a stress document with many assets was never measured**, although issue #19 asked for
   it. `[vectr-memory]` now builds 1,000 shapes plus 48 distinct images and records the working set
   at each stage: **792.6 MiB** after building, 795.6 after save, 799.8 after reopen, 799.3 after
   close.

### Recorded observation: freeing is not the same as returning

Closing the document releases the decoded cache (48 → 0 images, registry empty), but the process
working set does **not** return to the empty-document baseline (~453 MiB) inside the measured window.
That is CanvasKit's WASM and GPU allocations not being handed back to the operating system promptly,
not a leak: the spike's leak check passes and retained scene objects return to zero. It is recorded
because it is the honest shape of the memory behavior, and because a session that opens and closes
many large documents will sit at the high-water mark until the window restarts.

### Open owner decision: there is no approved memory budget

`DECISIONS.md` (Phase 0 direction) says "the exact budgets need owner approval in the benchmark", and
no approval was ever recorded. The measurements above therefore have no target to pass or fail
against. Rather than invent a threshold and declare success, the numbers are recorded in
`docs/PROGRESS.md` with the budget question left explicitly open for the owner. That is the only
Phase 1 exit criterion that cannot be closed by work — it needs a decision.

## 2026-10-14 — Standing merge authorization for the remainder of Phase 1

The owner went offline and gave standing permission to merge whatever an agent judges
complete, until the end of Phase 1, and asked that Phase 1 be 100% complete on return.

How that permission is used, so the record is unambiguous:

- It **supersedes the "big or important pull requests need the owner's review and merge
  decision" rule** in `AGENTS.md` only for the duration of Phase 1. From Phase 2 onward the
  rule applies again unless the owner says otherwise.
- Every slice still ships with its own branch, its required self-review posted on the pull
  request, the three checks run on the branch head (`npm run typecheck`, `npm test`,
  `npm run build`), the packaged smoke run, and its catalog, decisions, and progress updates
  in the same pull request.
- The big-PR classification is still recorded on each pull request, so the owner can see
  which merges they would otherwise have reviewed.
- Anything the agent cannot judge honestly — where it would be guessing at the owner's
  intent — is recorded as an open question in `docs/PROGRESS.md` instead of being merged on
  a guess.


## 2026-10-14 — Tool palette grouping and the tool options bar

The owner asked for two things: a small horizontal bar that changes with every tool, "like the one in
Illustrator", and for the rectangle and the ellipse to be the same shape tool. Both are Illustrator
conventions, so both are followed rather than reinvented.

**Matching Illustrator:**

- **One shape slot.** `TOOL_GROUPS` in `src/app/ui/toolOptions.ts` holds the palette as *groups*.
  Rectangle and Ellipse are two members of one slot, so the palette shows three slots (Selection,
  Shape, Type) instead of four. The slot shows the member in use, or the member last picked while
  another tool is active, which is how Illustrator remembers the shape you drew last. The flyout
  opens from the slot's corner triangle (Illustrator's own affordance) and from a right-click, and
  `M` / `L` still select Rectangle and Ellipse directly.
- **A tool-aware bar under the menu bar.** `ToolOptionsBar` is Illustrator's Control panel in
  Vectr's chrome. Its contents are pure data (`toolOptionsModel`), derived from the tool, the
  selection, the document, and the creation defaults, so the bar cannot disagree with the document:
  - *Selection tool* — with nothing selected, an empty-state hint and no commands; with a selection,
    the object's X/Y/W/H numbers and Duplicate, Group, Ungroup, Bring to Front, Send to Back, Hide,
    Lock, Clear, each enabled only when `canRunAction` says it would work.
  - *Shape tool* — the Rectangle/Ellipse switch (the same grouping the palette shows), the fill the
    next shape will use, and a Stroke readout.
  - *Type tool* — font size, horizontal alignment, and colour, plus a hint saying whether they apply
    to the selection or to the next text object.
- **Tool options set the *next* object.** This is Illustrator's behavior and it is why the bar has
  anything to do at all: the shape fill and the text size/alignment/colour are remembered in
  `workspaceStore.creationDefaults`, and the create paths read them when they draw. When a selection
  can take the same change, the control edits the selection as well (one undo entry per change, like
  any style edit) and remembers the value for next time.
- **Picking a shape member anywhere remembers it.** `tool.rect` / `tool.ellipse` route through
  `setToolShapeMember`, so the palette, the flyout, the options-bar switch, and the `M` / `L`
  shortcuts all leave the palette's shape slot showing the same tool.

**Deliberate divergences, recorded here rather than drifting quietly:**

- The bar's geometry readouts are **read-only text, not editable fields**. Illustrator lets you type
  into them; Vectr has no transform-editing command yet, so an editable box would be a lie.
- The bar carries **no Appearance, Align, or Transform sections** because stroke width, opacity,
  align, and transform commands do not exist yet. Empty sections were not shipped as placeholders.
- **Corner radius is not offered** even though `RectNode.cornerRadius` exists: the renderer models
  rounded corners but does not draw them, so the control would change nothing visible.
- **Stroke is a readout, not a control** — every shape is drawn with the same fixed stroke today.
- The fill control is a **fixed quick palette**, not the full Swatches/Color picker; that arrives
  with the interactive Color and Swatches panels.

`toolOptionsModel` is a pure function and the shipped tests cover it; the component only renders what
the model returns, which is the same split the Layers panel uses.


## 2026-10-14 — Shape tools, honest previews, and one geometry source

The owner reported three things in one message: dragging an ellipse previewed a **rectangle**, Shift
did nothing while dragging, and **line, polygon, star, arc, and rounded corners were all missing**
from PATH-01. The first two were bugs in the slice-6 canvas; the third was a capability the phase
table lists as "rectangle and ellipse" only.

**One geometry source, so a preview cannot lie.** `src/doc/shapeGeometry.ts` computes every outline
in the node's own box coordinates. The renderer turns those points into a Skia path, and the drag
preview (`src/app/canvas/ShapePreview.tsx`) turns the *same* points into an SVG outline. The old
overlay was a `<div>` with a border, which is why an ellipse drag showed a rectangle. The same
functions now feed `polygonPoints`, `starPoints`, `arcPoints`, `lineEndpoints`, and
`clampCornerRadius`, and a test asserts the preview's outline equals the drawn one. This is the layer
thumbnail rule applied to the canvas: one source for the picture, never a second drawing path.

**Shift constrains a drag** (`src/app/canvas/shapeDrag.ts`, pure and tested): a square for
rectangle/rounded rectangle/polygon/star, a circle for ellipse/arc, and a 45° snap for a line —
using the larger of the two distances from the drag origin, keeping the direction, which is what
Illustrator does. Shift is read on every pointer move, so holding or releasing it mid-drag updates
the shape live.

**The new node kinds** are `line`, `polygon`, `star`, and `arc`, joining `rect` (which now *draws*
`cornerRadius` instead of only modelling it), `ellipse`, `text`, `image`, and `group`. Each has its
own tool in the shape group, so the palette slot has seven members behind one flyout: Rectangle (M),
Rounded Rectangle, Ellipse (L), Polygon, Star, Line Segment (\\), Arc.

**Format version 2.** Adding node kinds changes what a file can contain, so `FORMAT_VERSION` is 2 and
`SUPPORTED_FORMAT_VERSIONS` is `[1, 2]`: files written before this slice still open (they simply
contain none of the new kinds, so no migration function is needed), and new files are v2. The
validation boundary gained the shape parameters — sides 3–60, tips 3–60, inner radius 0.05–0.95,
sweep −360…360 and non-zero, corner radius at most half the shorter side, a known line corner — so a
corrupt or hand-edited file is refused with a reason instead of drawing nonsense.

**Matching Illustrator:**

- The seven tools, their grouping behind one palette slot, the corner-triangle flyout, and `M` / `L`
  / `\` as the three keys Illustrator defines. Polygon, Star, and Arc have **no** Illustrator
  shortcut, so Vectr invents none.
- The options bar changes with the member, and its controls set what the *next* shape draws:
  Corner radius (Rounded Rectangle), Sides (Polygon), Points + Inner radius (Star), Stroke weight
  (Line), Start angle + Sweep + Pie (Arc). That is Illustrator's Control-panel habit.
- A polygon starts with a vertex at the top and a star starts with a tip at the top, both inscribed
  in the drag box; the arc's angles are degrees counterclockwise from +x, so its default 0°–90° sweep
  draws the top-right quarter, exactly as Illustrator's Arc tool does.
- A line's appearance is its **stroke**, which is how the Line Segment tool's weight control reaches
  the renderer; the fill colour chooser supplies that stroke's colour.

**Deliberate divergences, recorded here rather than drifting quietly:**

- **Polygon and star are inscribed in the dragged box, not sized by a radius from the centre.** In
  Illustrator the drag sets the radius, so a hexagon's box is narrower than the drag rectangle. Vectr
  models every leaf as a box (that is what makes bounds, marquee selection, transforms, and
  thumbnails uniform), so the shape fills the box it was dragged. A test asserts the hexagon's real
  extent (93% of its box width) so nobody mistakes it for a bug later.
- **No Spiral, Rectangular Grid, Polar Grid, or Flare tools.** They are not in the catalog's
  PATH-01 list; them arriving is a later slice with its own fixtures.
- **No live corner reshaping.** Illustrator lets you drag a corner radius widget on an existing
  rectangle; Vectr sets the radius on creation only. Editing an existing shape's geometry has no
  command yet (`PATH-01` records this).
- **The arc has a Pie switch rather than Illustrator's open/closed/pie cycling** on the same tool,
  because a switch is reachable by keyboard and screen readers.
- **`\` for Line Segment is Illustrator's own key**, so it is marked `illustratorDefault: true`; the
  Rounded Rectangle tool has no Illustrator key and Vectr adds `J`, marked as a divergence in
  `src/app/menus/shortcuts.ts`.

**A bug the packaged report caught before the owner could.** The new `[vectr-path]` report failed on
its first run with "created rect" for every member: the options bar's shape switch still hardcoded
`rect`/`ellipse` from the previous slice, so choosing Polygon, Star, Line, or Arc silently activated
Rectangle. The switch now resolves the clicked value through the group table, and the report proves
each member draws what it says. This is the same lesson as the Type tool bug recorded earlier: a
control that *looks* wired is not evidence until something drives it.


## 2026-10-14 — The inline text editor grows with its content

The owner reported that the box which appears on the first Type-tool click is too small — "nothing
fits in it". They were right, and the cause was simple: the editor was sized from the node's *stored*
box, which is the box the text had when it was last committed. An empty new object is one character
wide, so the editor started at 32 px and stayed there while the user typed into a box that clipped
everything past the first couple of glyphs (`overflow: hidden`).

**The fix.** `src/app/canvas/textEditorBox.ts` holds the sizing rule, pure and unit-tested, and
`TextEditor` now takes a `measure` callback instead of a fixed width and height:

- Every keystroke is measured with **the same function the commit uses** (`textBoxFor`: the
  renderer's real metrics when it has them, the shared estimate otherwise), so the box you type into
  is the box the canvas will store and draw. The editor can no longer be smaller than its text.
- A **minimum of 32 px wide and one line tall** keeps an empty object clickable — Illustrator's point
  text is a bare caret, which is not a target worth copying for a DOM control.
- `EDITOR_BORDER = 2` is added to both axes because the editor's 1 px border sits *inside* its box
  (border-box): the content area then equals the measured box exactly, so the text starts where the
  canvas will draw it.
- The textarea gets `wrap="off"` and `white-space: pre`, and the node's font family is set explicitly.
  The canvas draws text line by line and never wraps it, so the editor must not wrap either — that was
  a second, quieter way the old editor could disagree with the canvas.
- Sizes are rounded to whole pixels so the caret never sits on a half pixel.

**Divergences, unchanged in spirit but now explicit:**

- Illustrator's point-text caret is a bare insertion point with no box; Vectr keeps a small bordered
  box because a DOM textarea has to be a real, focusable, screen-reader-visible target. The border is
  the editing affordance, and it is outside the measured content area.
- The editor still does not update the *node's* box until the commit, so the canvas underneath shows
  the previous box while you type. Illustrator reshapes the object live. Live reshaping needs a
  per-keystroke document command, which would flood the undo stack — a text edit must stay one undo
  step (issue #16) — so this stays a documented difference rather than a compromise that would trade
  away the one-entry rule.

**Evidence.** A unit test covers the rule (minimum, border compensation, growth in both axes, whole
pixels) and the packaged `[vectr-text]` report now measures the real textarea's bounding rect before
and after typing: it widens past 40 px of growth, grows taller when a second line is added, and the
committed object's stored box matches the size the editor had reached.


## 2026-10-14 — Autosave, crash recovery, and the memory budget (owner spec)

The owner gave the autosave rules explicitly, delegated the memory number ("figure it out"), and
approved the next capability slices. This records the rules as implemented and the budget as decided.

### Recovery is a project folder in the user folder

The snapshot was a single `recovery.json` holding only the manifest, which meant a document that
crashed **with placed images would come back with empty frames** — the asset bytes were never in the
snapshot. It is now `userData/recovery.vectr/`: `manifest.json`, the content-addressed `assets/`, and
a `recovery.json` sidecar naming the document, the file it came from, and the revision it matched. It
is written by the same failure-safe `writeProject` a normal save uses (assets, then the manifest
through a rename, then the sidecar), and it lives outside any project so a failed save cannot corrupt
it. `readRecovery` rebuilds the assets from **the manifest's own references**, so a file that is not
there reads as "no asset" instead of a fabricated ref that would fail verification later, and a
manifest without its sidecar (a half-finished write) counts as no snapshot at all.

### A crash says so

An orderly quit writes `userData/recovery-clean-exit.json`; a crash cannot. At launch the renderer
reads that marker (and consumes it, so the *next* crash is detectable): a snapshot waiting **plus** no
marker means the last session died badly, which opens a dialog instead of leaving the user to find a
File-menu item. The dialog says Vectr closed unexpectedly, names the document, says the copy contains
work that was never saved, and offers **Restore the recovery copy** or **Discard it**. Escape and a
click outside dismiss it and *keep* the copy, so the non-destructive answer is always available.

Restoring reopens the document **where it lived** and keeps it attached to that file, so the next
Save writes back to the user's own project rather than a copy — the owner's "it brings up the old
file". It also restores the revision the file matched, so the recovered document is correctly *dirty*;
a restored document that looked clean could be closed without ever being saved.

### Autosave only belongs to a saved document

`shouldWriteSnapshot` (pure, tested) encodes the rule: an interval snapshot needs a dirty document
that **already has a file** and autosave enabled; an untitled document is never autosaved. The close
path is a separate net with a different rule — it fires *as* unsaved work is dropped, so it snapshots
an untitled document too, and it is unaffected by the autosave switch. That is a deliberate reading of
the instruction rather than an inconsistency: "autosave" is the background timer, and the close net is
the last chance before the work is discarded.

### The interval is a preference

`settingsStore` holds `autosaveEnabled` and `autosaveIntervalMinutes` (1–60, default **10** like
Illustrator's "Automatically Save Recovery Data Every"), persists them in `localStorage`, and the
timer follows the setting instead of a constant. Edit ▸ Preferences… (Ctrl+K, Illustrator's Windows
chord) opens the dialog, which also states the two rules plainly rather than leaving them to be
discovered. Preferences live in `localStorage`, which Electron keeps inside the app's user-data
directory; a real settings file arrives with the rest of the preference surface (units, undo levels),
and this is recorded so the choice is not mistaken for a decision that was never made.

### The memory budget, decided

The Phase 1 audit left the budget open because `DECISIONS.md` (Phase 0) says the numbers need owner
approval. The owner delegated it, so it is now set — whole-application working set, all processes, on
the Phase 1 machine — with the recorded measurements as the baseline:

| Scenario | Measured | Budget | Headroom |
| --- | --- | --- | --- |
| Empty editor (small document) | ~453 MiB | **600 MiB** | ~32% |
| Stress: 1,000 shapes + 48 images | ~793 MiB (peak 800 MiB) | **1,200 MiB** | ~50% |

Both are asserted in the packaged `[vectr-memory]` report (`IDLE_BUDGET_MIB`, `STRESS_BUDGET_MIB`), so
a regression fails the run instead of being noticed later. Alongside them the report asserts what
actually protects the product: **decoded images return to 0 and the asset registry is empty** after
the document closes, whatever it held.

Two honest limits are part of the decision rather than hidden behind it:

- The budgets apply to a **fresh window** and to a **single document's peak**. After a large document
  closes, the process working set does not fall back to the baseline because CanvasKit's WASM and GPU
  allocations are not returned to the operating system promptly (measured: ~799 MiB after close). That
  is why the idle budget is asserted *after* closing the stress document — a number that passes — and
  why the leak verdict stays "retained scene objects return to zero" rather than "memory comes back".
- `PERF-01`'s rendering gate is untouched by this: no measured candidate meets 33 ms on 10,000 loose
  always-visible primitives, and that stays published as an amended, unmet gate. A memory budget does
  not make that gate pass, and it is not presented as if it did.

## 2026-10-16 — IMAGE-01 links, crop, and raster masks

- Vectr follows Illustrator's familiar Place split: **Place…** embeds content-addressed bytes and
  **Place Linked…** records the source chosen through the desktop picker. Linked bytes are never
  copied into the ordinary project asset folder.
- A missing or content-changed link opens as a labelled placeholder rather than preventing the rest
  of the project from opening; Properties offers **Relink…** to repair it. This deliberately favours
  preserving the editable document over silently substituting changed pixels.
- Crop is a normalized, non-destructive source rectangle. A mask is an optional raster alpha asset;
  it is not an Illustrator vector clipping mask and has no generic mask editor. Image tracing,
  clipping masks, network links, and colour-management work remain separate capability areas.

## 2026-10-16 — UI-01 modern Illustrator shell refinement (issue #62)

- The shell remains deliberately Illustrator-familiar in layout, not copied styling: menu bar,
  Control panel, left tool rail, central pasteboard, and right dock stay fixed in their established
  geometry while Vectr's dark-violet identity, Inter typography, and original icons remain intact.
- The Control panel exposes **Place image** and **Link** as a visible pair. Both delegate to the
  existing File placement actions; they are not a new Image tool and do not change document, import,
  history, or renderer behavior.
- Chrome hierarchy is refined through existing tokens and compact surface/focus/active states only.
  Floating/resizable panels, rulers, guides, grids, and unbuilt Appearance/Align/Transform controls
  remain out of scope.
- **Status (recorded 2026-10-16):** merged as PR #63. The branch head passed `npm run typecheck`,
  `npm test` (145/145), `npm run build`, and the packaged `npm run smoke` run including both image
  controls. Normal- and high-DPI Windows desktop visual inspection was **not** performed — the
  available UI-automation environment exposed no native desktop window — and it remains a recorded
  verification gap on the pull request rather than a completed check.
- **Divergence counts are no longer asserted.** Earlier sections in this file stated that
  "fourteen", "sixteen", "eighteen", and "nineteen" divergences remained live. Each figure was
  accurate for the slice that wrote it and stale as soon as the next slice closed or opened a
  difference, and the catalog and progress record quoted two different stale figures at once. The
  lists here are the authority; the catalog and `docs/PROGRESS.md` now point at them instead of
  restating a number.

## 2026-10-17 — Selection modes, lasso, and a live corner radius (Phase 2.1, issue #64)

Phase 2 starts here. The owner's instruction: start Phase 2, ship each issue as its own pull
request, and an agent may merge once it has reviewed the change properly. This slice is first in
the dependency order because it needs none of the four open Phase 2 decisions.

### Two arrows, one slot

`A` is Direct Selection and selects the deepest leaf under the pointer; `V` stays the Selection
tool and keeps returning the top-level object. They share one palette slot with a flyout because
that is Illustrator's own black-arrow/white-arrow button — the familiar control in the familiar
place. The Direct Selection marquee selects leaves rather than whole groups, which is what makes a
nested object reachable without first entering the group.

### Double-click descends one level, not all the way

`hierarchySelection` computes the top-level-to-leaf chain under the pointer and moves one step in.
With nothing selected, clicking an object two groups deep selects the group that contains it; a
second double-click selects the object; a third changes nothing. That is Illustrator's descent,
and it is deliberately *not* "select the deepest leaf", which would make a single double-click feel
unpredictable on a deeply nested document. A double-click that lands on a text object still opens
the inline editor, which is what the canvas already did for text before this slice.

### The lasso's rule, stated rather than implied

A freehand path selects every visible, unlocked leaf whose world bounds it touches: a corner of
the object inside the path, a path vertex inside the object, or an edge crossing. Illustrator's
lasso is closer to "what is enclosed by the path", so a path drawn across an object's middle
selects it in Vectr but would not in Illustrator. The reason is honest: Vectr's selection model is
box-based (bounds, marquee, thumbnails, hit testing all agree on the box), and a
touched-bounds test is the rule that composes with it. It is recorded as a divergence, not as a
bug, and it is what the catalog entry and the unit tests state.

### The radius is a command, not a control

`setCornerRadius` is a real document command with an exact inverse, so typing a radius is one undo
step and the same edit is reachable from the Control panel, from Properties, and later from an
agent. The UI clamps the typed value to half the shorter side, which is what Illustrator does when
a live corner is dragged past the middle; the command itself refuses a value in that range
(`invalid-index`) rather than silently clamping, so a caller that is not the UI cannot write a
document that `validateDocument` would then reject.

### Divergences recorded in this slice

- **Direct selection is object-level, not anchor-level.** Illustrator's white arrow also selects
  path anchors and handles; Vectr has no Bézier paths yet (PATH-02), so the tool selects whole
  objects. The tool, its key, its slot, and its drill behavior match; the granularity does not.
- **No Group Selection tool.** Illustrator's third arrow member is the Group Selection tool;
  double-click drilling covers the same intent for now.
- **The lasso's touched-bounds rule** is broader than Illustrator's enclosed-path rule, as above.
- **The corner radius has no on-canvas widget.** Illustrator draws live corner handles on a
  selected rectangle; Vectr edits the value in the Control panel and Properties only.
- **`Q` and `A` are Illustrator's keys**, so they are `illustratorDefault: true`; nothing new was
  invented for this slice.

## 2026-10-17 — Move and scale, and why rotate is not in this slice (Phase 2.2, issue #65)

### The box is the selection's world union

`unionBounds` composes the same `worldBounds` the hit test and the renderer use, and expands a
group to the union of its leaves because a group has no box of its own. That keeps one definition
of "where the selection is": the handles, the Properties fields, the tool options readouts, and the
hit test cannot disagree.

### A scale is one `setTransform` per object

`scaleFactors` and `scaledTransform` are pure; the canvas captures each transform once at the start
of a handle drag and re-computes absolute values on every move inside one transaction. That is the
same rule the drag-move gesture already used, so a 200-move scale is one compact history entry
rather than two hundred, and Undo restores the pre-gesture box exactly.

### The arrow keys are transforms, not menu commands

Illustrator's arrows work in every tool and have no menu item, so they are handled beside the chord
table rather than in it — but they still dispatch `setTransform` through the store, so the keyboard
has no second path to the document. The handler ignores events another surface already handled,
which is what keeps the Layers panel's arrow-key navigation working.

### Why rotate, reflect, and shear are not here

The scene builder does not carry `rotation`, and the hit test is axis-aligned. A rotate control
added today would move the selection box while the artwork stayed put — a control that lies, which
the UI direction explicitly rejects ("read-only fields remain honest rather than becoming inert
inputs"). Those three need the rotation matrix in the scene, an inverse-rotation hit test, rotated
bounds for the box and the thumbnails, and a rotated selection outline. That is a slice of its own,
recorded as remaining on `SEL-02` rather than half-shipped.

Deliberate limits of the shipped half, stated rather than implied: a nested node inside a *scaled*
group scales in its own local units (no group can be scaled yet), the box does not rotate, and
constrain/from-centre are key modifiers rather than sticky tool options.


## 2026-10-17 — The lasso now matches Illustrator: enclosed, not touched

The owner asked for Illustrator's exact lasso rule. This replaces the touched-bounds rule recorded above,
which selected an object any time the path crossed its box — broader than Illustrator, and therefore a
divergence that changed what a familiar gesture did.

- `polygonEnclosesBounds` is the rule now: every corner of the object's box must be inside the path, and no
  path edge may cross the box (a concave path can contain all four corners and still cut an object).
- A path across an object's middle encloses nothing and selects nothing; half an object is not selected.
- The unit tests pin both cases, and the packaged smoke step draws an enclosing loop, so it still proves
  the gesture end to end.
- The `SEL-01` catalog row states the enclosed rule, so the recorded behavior and the tests agree.

## 2026-10-17 — Align, distribute, and a Vectr-only clipboard (Phase 2.3, issue #66)

The issue left one decision to the owner: which clipboard. With Phase 2 delegated to the agent, the
plan's recommendation is taken and recorded as a delegated decision, the same way the memory budget
was settled.

- **Vectr-only structured clipboard first.** One session slot holding JSON clones of the selected
  subtrees. It never stores a document copy, never duplicates image bytes (a pasted image keeps its
  content-addressed `assetId`), and never reuses node ids — `duplicateSubtree` gives every pasted node
  a fresh id. The operating-system clipboard is later scope: it needs a validated, bounded
  interchange format and IPC, and guessing at that would create an untrusted-input boundary for no
  current benefit.
- **Paste offset is 10 scene units**, Illustrator's convention, so a paste is visibly a copy.
- **Align is against the selection's own union box**, with no key object yet; **distribute spaces
  centres evenly** between the outermost objects, which is Illustrator's default Distribute Objects
  behaviour. Both are recorded so a later key-object or spacing mode is an addition, not a rewrite.
- **Locked objects are skipped, not refused.** Aligning four objects where one is locked moves the
  three unlocked ones, which is what Clear already does and avoids a command that fails wholesale.
- **No new document command.** Alignment and distribution are `setTransform` moves in one
  transaction; paste is the existing `insertNodes`.

## 2026-10-17 — The artboard contract, decided before slice 2.4 (issue #67)

The Phase 2 plan says the multi-artboard coordinate and active-artboard model must be decided before
artboards are implemented. With Phase 2 delegated to the agent, the contract is:

- **Artboard geometry is document data.** `artboards: Artboard[]` already persists (id, name, width,
  height) and stays ordered by array position; new artboards are appended, so existing files open
  unchanged with no migration and no format bump.
- **The active artboard is workspace state, not document state.** It is a session pointer (like the
  viewport and the tool), because Vectr persists no view state yet; persisting it would put
  "which page was I on" into the file for every collaborator and every future compiler run. `Fit
  Artboard in Window`, the status bar, and new-object placement use the active artboard, falling back
  to the first one when the pointer names a missing id.
- **Scene coordinates stay absolute.** Every artboard sits in the same unlimited pasteboard space, the
  first at the origin and the rest laid out left to right with a fixed gap; artboards do not introduce
  per-page coordinate origins, so a node's transform never means different things on different pages.
  Moving a node between artboards is therefore just a move, which is Illustrator's model too.
- **The last artboard cannot be removed** (`invalid-index`): a document with no page has no coordinate
  reference for Fit, placement, or the status bar, so the command refuses rather than leaving the
  editor in a state it cannot describe.
## 2026-10-17 — Artboards shipped, and where their controls live (Phase 2.4, issue #67)

Implementation follows the contract recorded above: geometry in the document, positions derived,
the active page in workspace state.

- **Positions are derived, not stored.** `artboardRects` lays pages out left to right at a fixed gap, so
  the file never records a page's coordinates and two people cannot open the same file with pages in
  different places. A page move, when it arrives, will move its artwork instead.
- **The last page cannot be removed** (`invalid-index`), because Fit, placement, and the status bar all
  need a page to describe.
- **Divergence, recorded:** Illustrator has an Artboards panel and an Artboard tool (Shift+O) with
  on-canvas resize handles. Vectr lists the pages in Properties while nothing is selected, with New,
  Delete, and numeric W/H — no tool, no handles, no reordering yet. The controls are where the values
  are editable, not a second dock slot; the tool and handles arrive with the canvas work in #68.
- **The status bar, Fit Artboard in Window, and image placement all read the active page** in one place
  (`artboardRect`), so they cannot disagree about which page is current, and they fall back to the first
  page rather than failing when the pointer names a page that no longer exists.

## 2026-10-17 — The snapping contract, decided before slice 2.5 (issue #68)

The plan requires snapping to snap against *finalized* primitives with keyboard-accessible controls and
explicit acceptance fixtures. Artboards are final after #67; guides and grids are not built yet. So:

- **Snap targets, in priority order:** the active artboard's edges and centre lines; the other objects'
  bounding-box edges and centres; guide lines once guides exist. A target contributes both axes
  independently, so an object can snap left-to-left on x and centre-to-centre on y in one move.
- **One threshold, in screen pixels, not scene units:** six pixels converted by the current zoom. Snapping
  is a gesture affordance, so it must feel the same at 25% and 400%, which scene-unit thresholds do not.
- **Snapping is a post-gesture adjustment, not a second geometry model.** The gesture computes its raw
  delta from the pointer, then the snapper may replace that delta with the nearest target's. The stored
  transform is still produced by `setTransform`, still one entry per gesture, and undo restores the
  pre-gesture value — a snap cannot appear in history as a separate change.
- **Selected objects are not their own snap targets**, or a drag would snap to where it started.
- **Toggles are keyboard-reachable:** Smart Guides (Ctrl+U, Illustrator's own chord) turns snapping on and
  off for the session; it is a workspace setting, never document data.
- **Acceptance fixtures (written before implementation):** (1) a drag within six screen pixels of an
  artboard edge lands exactly on it and one outside the threshold moves by its raw delta; (2) two objects
  dragged near each other's edges align exactly, and the pair snaps on both axes independently; (3) a
  locked or hidden object neither snaps nor acts as a target; (4) the threshold scales with zoom, so the
  same screen distance snaps at 25% and 400%; (5) a snapped gesture is one undo entry that restores the
  exact pre-gesture transform.

## 2026-10-17 — Fill and stroke weight from Properties (start of Phase 2.6, issue #69)

- **No new command.** A fill or stroke edit is the existing `setStyle`, applied per object inside one
  transaction, so a multi-object edit is one undo entry and history stays a record of document changes.
- **Editable where the values live.** Properties, not the Control panel: the Control panel's shape row
  already sets the *next* shape's fill, and two controls writing different defaults would be a trap.
- **Divergences recorded:** there is no stroke colour field yet (a stroke keeps its colour and defaults to
  the fill), and no caps, joins, dashes, alignment, or width profiles. The Appearance panel stays
  read-only until those commands exist, rather than showing controls that do nothing.
- **Zero means none.** A stroke weight of 0 stores `null` rather than a zero-width stroke, so the
  renderer's existing "no stroke" path is what runs and the saved file says what it means.

## 2026-10-17 — Smart Guides snapping shipped (Phase 2.5, issue #68)

Implementation follows the contract recorded above, with two decisions worth naming:

- **The guide lines are drawn as an overlay, not recorded into the scene.** They are gesture feedback,
  so they live in the canvas exactly like the lasso path and the shape preview; nothing about them can
  reach the document or the renderer's recorded pictures.
- **Only drags snap so far.** Draw gestures and scale handles compute their own deltas, and snapping
  them would change what a new shape's size *is* rather than where it sits; each needs its own rule, so
  they are recorded as remaining on `CAN-02` rather than guessed at. Guide objects you can place (the
  ruler-guide workflow) also remain, since no ruler exists yet.

## 2026-10-17 — Stroke colour joins the paint controls (Phase 2.6, issue #69)

- A stroke now has its own colour field next to its weight. Changing only the colour keeps the weight,
  and changing only the weight keeps the colour: the helper fills in whichever half the caller left
  out, so one control can never silently reset the other.
- The colour defaults to the fill when a node has no stroke yet, which means turning a stroke on starts
  from the object's own colour rather than an arbitrary black.
## 2026-10-17 — Opacity editing, and why it needed no renderer work (Phase 2.6, issue #69)

- `style.opacity` was already serialized, multiplied into the scene, and applied by the recorder — groups
  composite it multiplicatively through their children. So exposing the value was a UI and action change
  only: `setSelectionOpacity` clamps to 0–1 and applies through one `setStyle` transaction.
- **It is per object, not per selection.** Selecting three shapes and setting 60% sets each one's own
  opacity, which is what Illustrator's Transparency panel does for separate objects; a group's opacity
  multiplies into its children without changing their stored values.

## 2026-10-17 — Isolation is workspace state (Phase 2.8, issue #71)

- **Isolation is a session pointer, not document data.** The file never records that you were editing
  inside a group; reopening lands at document level. That matches how the viewport and tool behave and
  keeps the compiler reading a plain tree.
- **It is enforced by filtering, not by a second selection model.** One helper (`withinIsolation`) trims
  click, marquee, and lasso results, and one (`deepHitWithin`) resolves clicks to leaves inside the
  subtree; everything downstream — the command path, history, the renderer — sees ordinary ids.
- **The isolated group itself is not selectable**, so a click cannot silently re-select the container you
  just entered. Escape leaves isolation before it clears anything else.
- **Divergence recorded:** Illustrator enters isolation by double-clicking an object and shows a
  breadcrumb with Back/Forward; Vectr enters from Object ▸ Isolate Selection (the double-click there still
  drills one level in the hierarchy) and shows the group's name in the status bar.

## 2026-10-17 — The clipping contract, and the format-version policy it needs (issue #71)

Vector clipping is the last unbuilt piece of Phase 2, and it is the first addition since v3 that
changes the *shape* of persisted data, so both decisions are recorded before code.

### Clipping

- **A clip is a group-owned relationship, not a new node kind.** The group carries
  `clipChildId: string | null`, naming one of its own children; that child's geometry clips its
  siblings. Illustrator's "Make Clipping Mask" wraps the topmost object of a selection and clips the
  rest to it, which is exactly this: the clip object is a child like any other, and the relationship is
  the group's.
- **One clip per group, and only a direct child.** A nested chain of clips would need an ordering model
  nobody has asked for, and a reference to a non-child could point at a subtree the group does not own.
  Validation rejects both.
- **The clip object itself is not drawn on its own**, but it keeps its own style and transform, so
  releasing the mask restores exactly what was there.
- **Release** is the same command with `null`, so release is an exact inverse of make.
- **Hit testing follows the clip**: a point clipped away is not a hit, because selecting something you
  cannot see is the same lie as drawing something you cannot see.
- **Not in this slice:** compound paths, clipping a whole document, clipping by a stroke's outline, and
  the `APP-01` opacity/blend work. Raster masks on images already ship and are unchanged.

### Format version 4

- `clipChildId` is persisted, so `FORMAT_VERSION` moves to 4 and `SUPPORTED_FORMAT_VERSION_LIST` becomes
  `[1, 2, 3, 4]`.
- **v1–v3 files open unchanged**: the reader treats a missing `clipChildId` as `null`, so no migration
  function is needed and no existing document changes shape on disk until it is edited and saved.
- **The version bumps once, for the whole of Phase 2's remaining persisted work** (clip now; stroke caps,
  joins and dashes when they land). Bumping per feature would churn every file three times for no
  reader benefit, since each addition is optional-field shaped and the same rule — absent means default —
  covers all of them.
- **The validation boundary checks the reference**: a clip id must name a direct child of the group that
  carries it, so a hand-edited file cannot create a clip that the renderer or the hit test would misread.

## 2026-10-17 — Stroke caps and joins, and format version 4 (Phase 2.6, issue #69)

- **Optional fields, one version bump.** `Stroke.cap` and `Stroke.join` are optional, so the reader treats
  absence as Skia's default and a v3 file renders exactly as it did. The persisted version still moves to
  4 — the same bump the clipping contract reserved — because the file can now contain fields a v3 reader
  would not understand, and a reader that silently ignored them would draw the wrong outline.
- **The renderer keeps one paint cache keyed by everything that affects a paint**, now including the cap and
  join, so two shapes with different line ends cannot share a paint object and draw with the wrong ends.
- **The UI commits on change**, not per keystroke, and sends only the field the user touched: the action
  fills in the rest from the current stroke, so changing the join never resets the cap or the weight.
- **Dashes are not here.** Skia needs a path effect for them, which is a different call on the paint and a
  different validation (a dash array must be finite, positive, and bounded). Recorded as remaining rather
  than approximated with a stroke width change.

## 2026-10-17 — Vector clipping shipped (Phase 2.8, issue #71)

Implementation follows the contract above. Three decisions worth naming:

- **Curves are sampled, not exact.** An ellipse clip is 64 points and a rounded corner is four per
  corner. The renderer, the hit test, and the cheap tests all use the same polygon, so what is drawn and
  what is clickable agree — which matters more than sub-pixel exactness at this stage. Recorded as a
  limit rather than hidden.
- **One clip in force per shape.** A clipped group inside another clipped group takes the inner clip,
  not the intersection. Intersecting clips need an ordered stack the document does not have yet, and
  nobody has asked for it.
- **Duplicating a clipped group re-points the clip at the copied child.** A clip is an id reference, so a
  naive copy would point at the original's child — a cross-tree reference that would clip the copy to
  something it does not own. This is the one place where ids-as-references bites, and it has a test.

## 2026-10-17 — Linear gradient fills (Phase 2.7, issue #70)

- **A gradient is a paint definition, not a new node kind.** It lives on the style as normalised stop
  offsets and unit endpoints, so the file stays renderer-independent and the same definition can later
  drive the compiler's CSS or SVG output without translation.
- **The solid fill is kept as the fallback.** A gradient augments `fill` rather than replacing it, so a
  renderer or exporter that cannot do gradients still draws the right colour instead of nothing.
- **Angle 90 runs bottom to top**, matching Illustrator's gradient tool; scene y grows downward, so the
  vertical component is flipped once, in `linearGradientFrom`, and the tests pin it.
- **Only two stops in the UI, up to eight in the model.** The document accepts multi-stop gradients from
  any caller (and the compiler will need them), but the panel offers a start and end colour plus an angle
  rather than a stop editor it cannot yet draw honestly.
- **No blend modes yet.** `APP-01` needs a limited set chosen deliberately; that is its own slice, not a
  free extra on the gradient work.

## 2026-10-17 — Dashed strokes (Phase 2.6, issue #69)

- **An absent dash array means solid.** Clearing the field stores no `dash` key at all rather than an empty
  array, so the renderer's plain path stays the common case and the file does not accumulate `dash: []`.
- **Dashed paints bypass the paint cache.** A dash effect is pattern-specific, so a paint cached by colour
  and width would give one shape another shape's dashes; the dashed paint is created for the recorded
  shape and released immediately after the recording call, which keeps the leak bound at one paint per
  recorded shape rather than one per frame.
- **Bounds, not just finiteness:** at most eight entries, each positive and at most 1000, because a zero or
  negative interval is meaningless to Skia and an unbounded pattern would be a hand-edited file's way of
  making the renderer allocate forever.
- **No presets.** Illustrator's dashed presets are a Swatches-panel feature, and Vectr has no stroke panel
  yet; a text field that takes `6 3` is honest about what it stores instead of inventing preset names.

## 2026-10-17 — A deliberately small blend-mode set (Phase 2.7/APP-01)

- **Six modes, not Illustrator's full list.** Normal, multiply, screen, overlay, darken, lighten cover the
  compositing people actually reach for in illustration work, and each maps to one Skia enum. Shipping the
  whole list would promise behaviour nobody has verified against the renderer or the future compiler.
- **The mode lives on the style and defaults to absent.** No file gains a `blendMode` key until someone
  chooses one, so old documents composite exactly as before, and the compiler can treat absence as the
  normal case.
- **It applies to the fill paint only.** Strokes and text keep normal compositing, because blending a stroke
  against its own fill is a different model (an isolation group in Illustrator) and that is recorded as
  remaining rather than half-built.
- **Unknown modes are refused at the boundary**, so a hand-edited file cannot reach `setBlendMode` with
  something the renderer would silently treat as normal.

## 2026-10-17 — Live fields, one entry per edit session (UI pass)

- **Fields edit the document as you type, and the session is the undo unit.** Focusing a field opens a
  transaction; every keystroke or slider/colour change dispatches inside it; blurring closes it. Dragging a
  colour wheel through a hundred values is one step to undo, and the panel never looks stale while you drag.
- **The helpers had to stop opening their own transactions.** `setSelectionFill` and friends began a
  transaction unconditionally, which nested inside the live session and produced one history entry per
  keystroke. They now join an open transaction and only own one when they started it — the fix that makes
  live editing possible at all, and the one the unit test pins.
- **One control set, shared.** `ui/fields.tsx` owns the height, radius, focus ring, and label column for
  every input, so a panel cannot invent its own scale. `ui/color.ts` owns hex normalisation and readability
  (Rec. 709 luma) instead of each control deciding for itself.
- **The colour control is a popover, not a replaced native input.** The platform wheel is still there (it is
  the only one that works with a system colour picker), joined by a hex field, the document's own colours,
  a fixed palette, and recent picks — more options without inventing a colour model the document cannot
  store.
- **No horizontal scrolling in any panel.** One fixed label column, `min-w-0` on every shrinking control,
  and `overflow-x-hidden` on panel bodies; the packaged run asserts `scrollWidth <= clientWidth`.
- **Deliberately not in this pass:** an eyedropper, CMYK/colour books, GHS/HSB sliders, and draggable
  panel widths. Those are colour-management or shell work, not field polish.

## 2026-10-17 — One control set across every panel (UI pass, second half)

- **Appearance is a view of the same actions, not a second appearance model.** It calls the same fill,
  stroke, opacity, and blend actions Properties does, so the two panels cannot disagree about a value.
- **Every colour pick goes through one control**, in Properties, Appearance, and Color. The palette and
  document colours are *suggestions* passed to it, so the popover shows the same wheel and hex everywhere.
- **The Color panel's swatch grid marks the active colour** with a pressed state and a check, so the panel
  answers "what colour is this object?" as well as "set it to that".
- **The status bar's zoom readout is a button.** It prints the same chord hint Illustrator does and runs the
  same Fit Artboard action, so a readout people already look at is also a way to use it.
- **Restored: the isolation chip.** A merge-conflict resolution during Phase 2 dropped it while keeping the
  unused variable, so isolation mode was invisible in the status bar. It is back, with the key that leaves it
  in its tooltip — a reminder that a green typecheck can still hide a lost line.

## 2026-10-17 — The canvas is a sized sheet on a grey pasteboard (canvas pass)

- **The page is bounded, the pasteboard is not.** The viewport clears to the pasteboard grey and each
  page paints white with a soft shadow and a crisp edge, so the sheet reads as a fixed size you can work
  inside — Illustrator's model — instead of an endless white field.
- **Pages are drawn *inside* the viewport transform.** They were drawn before `translate`/`scale`, which
  meant the pages ignored pan and zoom while the artwork moved — a real bug that only looked right at the
  default view. Fixed, and the packaged run's artboard steps still pass.
- **The page edge scales with the zoom** (`1 / zoom` stroke width, cached per zoom like the selection
  outline), so it stays one screen pixel rather than becoming a fat band when you zoom in.
- **Presets are data, not UI.** Seven common sheet sizes live in `doc/artboards.ts`; the panel renders
  them. A size that matches one reads as that preset, anything else reads as Custom, so the menu never
  claims a size the document does not have.
- **Page labels are DOM, not renderer text.** A label must stay the same size at every zoom and must not be
  recorded into a page's picture — labels have no business in an exported layer.
- **A new page copies the active page's size**, so setting a preset then creating a page gives two sheets of
  the same size, which is what a multi-page document wants.

## 2026-10-18 — The Artboard tool places pages (Shift+O)

- **A placed page stores its corner.** `Artboard.x`/`y` are optional: a page created by the tool keeps where
  it was dragged, and a page from an older file has none and still flows after the previous one. No format
  bump — the fields are optional in v4.
- **Only right, bottom, and the corner resize a page.** The placed corner is the anchor, so growing left or
  upward would mean moving the page, which is a separate gesture. Offering edges that do nothing would be
  the lie the UI rule forbids, so the overlay shows the three that work.
- **A resize drag is one live session**, not one command per pointer move: the same transaction the live
  fields use, so the whole drag is a single undo entry.
- **A click is not a page.** A drag smaller than the minimum becomes nothing rather than a 1×1 artboard.
- **Shift+O is Illustrator's own chord**, so the tool is reachable the way an Illustrator user reaches it.

## 2026-10-18 — The Hand tool drags the camera (H, and Space to borrow it)

- **One pan gesture, three ways in.** The Hand drag reuses the `pan` gesture the middle mouse button already
  used, so the viewport has a single code path and the hand cannot drift from the wheel/zoom maths.
- **Space borrows the hand instead of switching tools.** While Space is held, the tool becomes `hand`; on
  release the previous tool comes back. That is Illustrator's behaviour and it means a pan never costs you
  the tool you were drawing with — the reason the hand is useful in the middle of work.
- **Space is swallowed when it would scroll.** The handler calls `preventDefault` so the page under the
  canvas cannot scroll, and it is skipped inside text fields so typing a space still types a space.
- **The cursor says what the tool does:** grab while the hand is active, grabbing while dragging it.

## 2026-10-18 — No Artboard tool, and an overlay bug that ate the canvas input

The owner asked for the Artboard tool to be removed and reported that the Hand tool did nothing and the
scroll wheel no longer zoomed. Both reports were one bug.

### The bug

The artboard chrome overlay's root div lost its `pointer-events-none` when the Artboard tool was added,
because its resize handles needed to receive pointers. That div covers the entire canvas, so every real
wheel event, click, and drag landed on the overlay instead of the canvas: no zoom, no pan, no selection.
**The packaged smoke run did not catch it** because it dispatched events directly on the `<canvas>`
element, which skips hit testing — a scripted event is only evidence when it arrives the way a user's
does. The overlay root is click-through again and its handles are gone with the tool.

### The regression test

`[vectr-ui]` now asks the browser `document.elementFromPoint` at the canvas centre and asserts the canvas
is what is on top, then dispatches the wheel and the Hand drag **on that element**. If an overlay ever
covers the canvas again, the run fails at the first question rather than passing on synthetic events.

### The tool

The Artboard tool is removed: tool id, action, palette slot, Shift+O, canvas gesture, preview, resize
handles, the drag maths module, and its tests. Pages stay fully managed from Properties (New, Delete, size
presets, typed W/H) with names and sizes on the canvas and an outline on the active page — the parts the
owner asked for originally.

## 2026-10-18 — Rulers, grid, and guides (issue #67 completed)

- **Guides are document data; rulers and the grid are view state.** A guide is a position someone chose for
  this artwork, so it persists (`document.guides`, optional, so older files open with none). Rulers and the
  grid are chrome: session flags, never written, so a file cannot record that you had rulers on.
- **The grid is drawn by the renderer, clipped to the page, under the artwork.** It cannot be DOM: the
  canvas is opaque above it, and a grid that floated over the drawing would be a different product. Minor
  lines are skipped below 4 screen pixels apart so zooming out cannot cost a thousand draws.
- **Guide drags use the live-edit transaction**, so dragging a guide is one undo entry and the guide is
  visible while it moves — the same rule as the colour and transform fields.
- **Guides snap.** `snapTargets` includes them, which is the whole point of placing one: a guide you cannot
  snap to is a line you can only look at.
- **Ctrl+R / Ctrl+' / Ctrl+; / Ctrl+Alt+;** are Illustrator's own chords for rulers, grid, guides, and
  clearing guides; nothing new was invented.

## 2026-10-18 — Stroke alignment, named swatches, and what PAINT-02 does not claim (#69)

- **Inside and outside alignment are clipping, not offset geometry.** Skia strokes straddle the path, so a
  stroke asked to sit inside is clipped to the outline and drawn at double width; outside uses the
  difference clip. The result is exact for the visible half, needs no path offsetting, and keeps one paint
  path for dashes, caps, and joins.
- **CMYK is stored as entered and converted by plain arithmetic.** There is no ICC profile in the product,
  so a press-accurate conversion is not available to be honest about; the values a person types are kept
  verbatim in the swatch and the RGB used for display is derived from them, documented in `ui/cmyk.ts`.
- **A spot swatch is a label, not a separation.** It marks a named ink in the document; producing
  separations or overprint is later print work, and claiming otherwise would be worse than the label.
- **Deleting a swatch never changes artwork.** A swatch is a name for a colour; objects keep the colour
  they were filled with, which is why removal has no inverse side effects on the tree.
- **Width profiles are recorded as unsupported.** A variable-width stroke needs stroke-to-outline geometry
  (a real vector operation), not a paint setting; shipping a slider that changed nothing would be the
  lie the UI rule forbids.

## 2026-10-18 — Radial gradients, stop editing, gradient strokes, and the full blend set (#70)

- **A radial gradient is the same definition as a linear one**, with `from` as the centre and the distance
  to `to` as the radius. No second paint type, no second UI, and a gradient can be switched between the two
  without losing its stops.
- **Stops are edit ord: colour and position in the panel, add up to eight, remove down to two.** The model
  already allowed eight; the panel now does too, and validation refuses one stop because one stop is not a
  gradient.
- **A gradient can paint the fill, the stroke, or both.** The stroke reuses the fill's shader, so dashes,
  caps, joins, and stroke alignment all still work on a gradient stroke.
- **All sixteen blend modes ship**, including the four non-separable ones (hue, saturation, colour,
  luminosity), and they now apply to **strokes as well as fills** — the earlier fill-only limit is closed.
- **Recorded as unsupported:** freeform gradients, patterns, mesh, and recolour. Each needs geometry or a
  pattern/mesh model the document does not have; the catalog says so rather than shipping a control that
  changes nothing.

## 2026-10-18 — Architecture replan: VectorCraft's layers, their gap list, and a retrofit phase

The owner's verdict was that the build does not yet feel good, and the question was whether to fork
VectorCraft as the base. Reading that repository changed the answer, and the owner approved the result:

- **What we take from VectorCraft: its architecture and its behaviour.** Its documented layering (L0 geometry
  and colour, L1 document, L2 operations, L3 renderer and formats, L4 tools as state machines, L5 engine and
  command registry, L6 interface, L7 shells) becomes ours, with an enforced import direction. Its ranked gap
  list against Illustrator becomes our prioritisation evidence. Its source is **not** ported: no Rust is
  translated, no file is copied. The rule in `AGENTS.md` stands, and the reason is practical as well as legal -
  idioms do not survive translation, and a ported codebase would be stranger than the one we have.
- **What we do not take: the fork.** Their workspace is ~354k lines of Rust with a native `vello_cpu` renderer;
  adopting it would discard ~17k lines of TypeScript, 26 test suites, the v4 format with its validation and
  exact inverses, the command/history model, and every packaged-evidence run, before parity improved at all.
- **Their gap list says the feel problem is gap 1** (interaction fidelity, 60-90 agent hours there), ahead of
  file formats, stability, type, and effects. That is the owner's complaint, and it is craft, not base.
- **A new Phase 3 exists purely to retrofit what is already built** into the architecture - layer check, tool
  state machines, one command registry - with **behaviour frozen**: same tests, same packaged run, no
  document-format change. Fidelity work then starts from a structure worth adding to.
- **The phase order changed**: 3 realignment, 4 interaction fidelity, 5 path model and booleans, 6 type,
  7 appearance and effects, 8 files and interoperability, 9 core parity gate, 10 compiler (unchanged position,
  no longer reachable only by skipping parity), 11 MCP, 12 cloud, 13 distant expansion.
- **What does not change:** the format stays v4 through the retrofit, every slice still ships with typecheck,
  tests, build, packaged evidence, and self-review, and no control ships that does not do what it says.

## 2026-10-18 - The layer rule is enforced by a script, and L0 was extracted (Phase 3.1)

- **The rule is a test, not a paragraph.** `scripts/check-layers.mjs` maps every source file to a layer and fails
  the suite when a runtime import points upward. It runs before the unit tests in `npm test`, so a violation
  cannot hide behind a green test run.
- **Type-only imports may cross layers.** A lower layer needs to name a shape the higher layer owns (the
  viewport math names `Artboard`), and those imports disappear at build time. Allowing them keeps the model
  honest without forcing every type into one file.
- **`src/geom/` is the new L0**: shape geometry, colour, CMYK conversion, and the viewport's own math and
  parameters. The zoom limits and fit padding moved out of the theme because they are viewport behaviour, not
  styling; the theme re-exports them so the interface keeps one import surface.
- **The check's first run found two real violations** - the engine layer importing the interface layer for CMYK
  conversion and viewport helpers - which is the strongest argument for having it.

## 2026-10-18 - Tools are state machines fed by a host, and never touch the document (Phase 3.2)

- **The host is injected, not imported.** `ToolHost` is the only surface a tool can reach, and the canvas
  implements it from the same store calls the inline gestures used. A tool therefore cannot mutate the
  document, open a transaction it cannot close, or depend on React - and it can be tested with a fake host, which
  is how the eight new tests check the click, shift-click, drag, marquee, and Escape semantics without a canvas.
- **Every pointer position carries scene units and screen pixels.** Hit testing and drawing need scene units;
  panning must not, because the scene moves under the pointer as the view moves and a scene delta would feed
  back on itself. Rather than special-case the Hand, the contract gives every tool both.
- **Selection and Direct Selection are one machine with a `deep` flag.** They differ only in the hit test depth,
  so writing them once means a future fix to click or marquee semantics cannot land in one arrow and miss the
  other.
- **The move capture stays in the host.** Capturing originals, opening the transaction, snapping, and committing
  are document operations; the tool only says when to begin and what delta to apply. This keeps undo semantics in
  one place across every tool that will ever move something.
- **Marquee commit matches today exactly**: it resolves through `marqueeHitTest` and does not apply isolation
  filtering, unlike the lasso. That asymmetry is existing behaviour, recorded rather than silently "fixed",
  because Phase 3 freezes behaviour.

## 2026-10-18 - The tool registry must match the palette, and the canvas keeps no gestures (Phase 3.3)

- **A tool that is not in the registry silently becomes a no-op.** The first version of this slice registered five
  shape tools and forgot the rounded rectangle and the arc; both tools stopped creating anything, and the packaged
  run reported a star for a rounded-rectangle drag and a line for an arc drag. The fix is mechanical, but the
  lesson is recorded: when tools move behind a registry, enumerate the palette's tool list and assert it, rather
  than porting the tools you remember. The registry test now names all twelve ids.
- **All seven shapes are one machine.** The tool id decides the kind and the host resolves it through
  `shapeKindForTool`, so a new shape tool is a registry entry plus a case in that map - not another machine that
  can drift from its siblings.
- **The canvas keeps no gesture logic.** It routes pointer down/move/up, implements `ToolHost`, and draws overlays.
  The old `Gesture` union now only carries the middle-button pan; the rest of its variants are dead and should be
  pruned when the scale handles move behind a tool in Phase 4.
- **Overlay clearing is belt and braces.** The tool clears its own preview on release, and the canvas also clears
  on pointer up; that double clear is deliberate during the retrofit so a forgotten tool cannot leave a stale
  preview on screen.

## 2026-10-18 - The registry owns identity, label, and chord; the menu owns placement (Phase 3.4)

- **Data lives at L5, layout at L6.** `src/app/commands/registry.ts` holds ids, labels, and chords and imports
  nothing; `menuModel.ts` holds which menu, which order, and which separators. The split is deliberate: identity
  is engine data that the palette, the menus, the shortcut hints, and a future MCP command list all need, while
  placement is an interface decision that changes when the interface changes. The layer check keeps the
  dependency direction honest.
- **Re-exports, not copies.** `actions.ts` and `shortcuts.ts` re-export from the registry so existing importers keep
  working without a second table existing anywhere. The moment a second copy appears, the tests in
  `tests/commands.test.ts` fail on a label or a duplicated chord.
- **Chords may repeat an id.** `Delete` and `Backspace` are two spellings of one command's chord, so the
  uniqueness test keys on the chord and allows a second entry for the same id; it refuses the same chord for two
  different commands.
- **Divergence must pay a note.** A shortcut that is not Illustrator's default must carry a note, enforced by a
  test rather than by review, because the divergence list is a product promise.

## 2026-10-18 - The architecture is now a checklist, and the retrofit leftovers are gone (Phase 3.5)

- **The checklist is in `AGENTS.md`**, because a rule that lives only in a decision record is a story, not an
  obligation. Six questions per pull request: which layer and which imports, which architecture rule and why it
  holds, which evidence is owed (including identical packaged results during Phase 3), which catalog row moves,
  what the change deliberately leaves undone, and the residual doubt. A new user-visible action must be one
  registry entry reachable from menus, palette, and keyboard.
- **The canvas keeps two gesture kinds, not six.** `move`, `marquee`, `lasso`, and `create` moved into the tools;
  leaving their union variants behind would have suggested the canvas still owned them. The lasso's sample cap
  moved with the lasso.
- **A cancelled pointer drops the gesture.** `onPointerCancel` now calls the active tool's `cancel` instead of
  routing to `onPointerUp`, so a cancelled lasso cannot select and a cancelled drag cannot move. This closes the
  residual doubt recorded in Phase 3.3.
- **What is deliberately still outside a tool:** the scale handles (`scaleRef` and `SelectionOverlay`). They are the
  last direct-manipulation path in the canvas, and moving them behind a tool is the first fidelity slice of
  Phase 4, where proportional handles and rotation are being rebuilt anyway - porting them now would mean porting
  them twice.

## 2026-10-18 - The scale gesture is a tool, and its math split across two layers (Phase 4.1)

- **The gesture is at L4 even though its input is a DOM handle.** The tool exposes `startHandle`, `moveHandle`,
  `endHandle`, and `cancelHandle` beside the pointer contract, because the overlay is the input surface today.
  Keeping the gesture in the canvas until the handles are canvas-drawn would leave the last direct-manipulation
  path outside the tool layer for no gain.
- **The math is split by what it touches.** `unionBounds` walks the document tree, so it belongs to L1
  (`doc/transform.ts`); factors, scaled transforms, and handle points touch only geometry and a transform, so they
  are L0 (`geom/transform.ts`). The first attempt kept the whole file at L0 and the layer check refused it - the
  right outcome, and the reason the check exists.
- **Shift constrains corners, not edges.** The tests now assert what the code does: a corner handle with Shift
  gives equal factors, while a side handle keeps scaling one axis. That matches Illustrator; the first test
  assumed otherwise and was wrong, not the code.

## 2026-10-18 - Rotation is degrees about a leaf's own centre, and scaling follows the frame (Phase 4.2)

- **Degrees, not radians, about the node's own centre.** The field existed but was unused; degrees suit the
  numeric field, the validation, and the file (v4 already carries it, so older files open with zero). Rotation
  renders as a world-space turn about the shape's centre, which composes correctly with translation and scale at
  any zoom.
- **Rotation lives on leaves.** Rotating a selection applies a rigid-body turn: each leaf's centre orbits the
  selection pivot and its own rotation advances. A group therefore rotates as its leaves rotate, without storing
  a group-level rotation that would require composing rotations through the tree. This is a recorded limit, not
  an accident.
- **Hit testing rotates the point, not the node.** The query point is turned back into the node's frame by the
  same angle, so the existing axis-aligned point-in-shape tests remain exact and cheap. Bounds for marquee and
  lasso use the box around the rotated corners; the click is exact, the marquee is conservative.
- **Scaling is frame-aware.** The scale tool brings the pointer into the frame's axes, scales centres in that
  space, and rotates them back, so a rotated object scales along its own sides. Without this, resizing a rotated
  rectangle would visibly change its shape - the kind of bug that makes rotation feel fake.
- **The packaged evidence uses a bar, not a square.** Rotation of a square is invisible to hit testing, so the
  smoke step builds a 200x40 bar and probes a point 80 units above its centre: outside before the turn, inside
  after it. A square would have passed for the wrong reason.

## 2026-10-18 - Cursors are data, hover uses the tool hit test (Phase 4.3)

- **The cursor vocabulary is a pure function**, not scattered classes: `cursorForTool` and `cursorWhileDragging`,
  both tested, so the packaged run can assert what the canvas actually shows rather than reading a class string.
  A drag's cursor outranks the tool's because the thing being done outranks the tool being held.
- **Hover is the tools' own hit test**, called from the canvas on pointer move with no buttons down. If hover had
  its own geometry, the outline and the click could disagree - the worst kind of lie this interface can tell.
  The cost is one hit test per pointer move; it is measured again in Phase 9's performance work.
- **The rotation zone checks sides now.** A press inside the frame near a corner is a scale, not a rotation; the
  4.2 divergence is closed. The zone remains 18 screen pixels outside, with Shift snapping to 15 degrees.
- **A packaged failure is not automatically a product failure.** The rotation step failed four times because the
  test helper converted coordinates with a viewport captured before the viewport was pinned. The lesson is
  recorded above the rule it protects: debug which side is wrong before changing the feature.

## 2026-10-18 - Panels are dock data, and availability is the command's rule (Phase 4.4)

- **A panel is three pieces of data and one component**: an id in `PanelId`, a label, and a slot in
  `PANEL_GROUPS`; the Window menu and the dock then both see it. Adding Align and Transform cost one group entry
  each and no bespoke wiring, which is the test of whether the dock was designed as data.
- **Disabled means what the command refuses.** `alignAvailability` counts unlocked objects and requires two to
  align and three to distribute, because that is what the commands need; the panel never invents its own rule,
  and the rule is unit-tested rather than inspected.
- **No key-object claim.** The Align panel's caption says it aligns inside the selection's own box, because that
  is what the commands do. A key-object mode is real Illustrator behaviour and belongs with the boolean slice,
  where align gains an explicit reference object.
- **Accessible names are part of a control, not a nicety.** `PanelButton` dropped props it did not declare, so
  panel buttons had no accessible name at all; forwarding `aria-label` fixed a real accessibility gap that the
  packaged run had surfaced by being unable to find the button.

## 2026-10-18 - Correcting a stale claim: drag-into-group already shipped (Phase 4.5)

- **The locate rule excludes the root and the selected rows.** A row is a locate target when it is an ancestor of
  the selection, is not itself selected (a selected row needs no pointer to itself), and is not the document root
  (which has no row). The rule is pure, tested, and the panel renders one button from it.
- **Nested previews are evidence, not decoration.** The thumbnail pass considers rows at any depth, and a row whose
  bucket is shared keeps its slot with a tooltip that says why. The packaged run accepts either a drawn preview or
  that stated reason - what it refuses to accept is a silent empty slot.
- **A stale comment is a defect.** The Layers panel header and the parity catalog both claimed dragging a layer
  into a group was unbuilt; `layerDrag.placementFor` and its tests say otherwise, and the behaviour was verified by
  reading the code. Building it again would have been the expensive way to correct a comment. Corrected in the
  panel, the catalog note, and `docs/AUDIT.md`.

## 2026-10-18 - One number field, scrubbed and arithmetic; a transaction owns only its own commit (Phase 4.6)

- **Scrub sensitivity is two pixels per step, ten times finer with Shift.** Shift is the owner's "more accurate"
  modifier, so it slows the drag rather than speeding it; both the value and the clamp are computed from the
  gesture's start, so a drag cannot compound rounding error.
- **Expressions are evaluated only on commit, never per keystroke.** Typing "120+" must not momentarily commit
  120. The evaluator is a small recursive-descent parser over numbers and the four operators - no identifiers, no
  units, no access to anything else.
- **`NumberField` is the only numeric input.** The inline variant exists so the gradient stop and CMYK fields can
  share it without the label column; a second raw `type="number"` in a panel is now a review finding, not a style
  choice.
- **Alt-drag is one undo entry.** The duplicate joins the move's transaction. Making that true exposed that
  `runPlan` committed transactions it had only joined, and the fix - commit only when the plan opened it - is
  recorded with a regression test because the same trap applies to every future batch action.
- **The palette order follows the owner's request**: Hand directly under the selection tools. Shortcuts are
  unchanged, so muscle memory for H and Space still works.

## 2026-10-18 - The Zoom tool: four gestures, one machine, host-owned viewport maths (Phase 4.7)

- **Three screen pixels separate a click from a frame**, so a slightly shaky click still zooms about the pointer
  instead of framing a four-pixel rectangle - the most common way a zoom tool feels broken.
- **The tool never touches the viewport itself.** It calls `zoomAt(screen, factor)` or `zoomToBox(sceneRect)` on the
  host, which owns the arithmetic and the clamping; that keeps the wheel, the menu, Fit Artboard, and the tool
  using the same `zoomAtPoint` and the same limits.
- **A framed zoom leaves an eight percent margin**, so the dragged area does not touch the canvas edges; the zoom is
  clamped to the same 0.05-32 range as every other path.
- **Double-click returns to 100%**, which is the behaviour implemented and therefore the behaviour recorded. The
  issue allowed either 100% or the previous zoom; returning to the previous zoom needs a remembered stack and is
  not what shipped.
- **Pairing Zoom with the Hand in one palette slot** is Illustrator's grouping and also keeps the owner's earlier
  request intact: the slot itself still sits directly under the selection tools.

## 2026-10-18 - The UI component kit: one concept, variants as parameters (issue #133)

- **`Button` carries six variants rather than six components.** `panel`, `primary`, `quiet`, `danger`, `icon`, and
  `dialog` differ in paint and padding, not in behaviour, so one component with a `variant` parameter is the honest
  shape; a separate component per variant would have re-created the duplication the rule forbids.
- **Dialogs keep their data attributes and their ref.** `Button` accepts a `data` map and a `ref`, because the
  dialog tests and the save-focus behaviour depend on them; dropping either would have made the kit unable to
  express a real case, which is exactly when the rule says extend the primitive rather than copy it.
- **The accent button text is now `text-accent-ink` everywhere.** The dialog and the panel had drifted (white in
  one, ink in the other); one variant means one choice, and the theme's own on-accent token is the better one.
  Pixels change slightly and the change is deliberate.
- **The empty state is a component, not a class.** Three panels printed the same sentence with two different
  colours; a component makes that a prop-free single answer.
- **The standards test enforces only what has been cleaned.** It checks the four converted panels and the retired
  import; widening it to the twelve remaining files before converting them would leave the suite red for reasons
  the pass did not fix. The remaining inventory is in the issue, and the test grows with each conversion.

## 2026-10-18 - Row controls, list rows, colour tiles, and tabs join the kit (issue #133, second pass)

- **A row control is one component with state parameters.** The locate pointer, the disclosure triangle, the eye
  and the lock differ in which ARIA state they carry and whether they are accented; a separate component per
  icon would have re-created the duplication the rule forbids.
- **A list row is one component, and its data map is passed through.** Layers rows and swatch rows need
  `data-layer-name` and `aria-label` for their handlers and tests; `ListItem` takes a `data` map rather than
  inventing a prop per attribute.
- **The colour tile is shared by the panel and the popover.** They had drifted in size and tick colour; one
  component with a `size` parameter keeps the picked-tick readable on light and dark colours in both places.
- **The standards test only names converted files.** Widening it early would have kept the suite red for work not
  yet done; it grows with each pass, and the inventory of what remains lives in issue #133 rather than in a
  permanently failing assertion.

## 2026-10-18 - Menus, palette slots, and the backdrop complete the kit (issue #133, final pass)

- **A menu row is a component with behavioural props, not a styled div.** `MenuItem` takes the keyboard handler, the
  ref, the tab index, and the popup state as props; that is what let the menu bar, the flyouts, and the context
  menu share one row without moving their focus logic.
- **The palette's slot is not a Button.** It has a fixed square shape, an active fill, and a flyout corner; making
  it a variant of Button would have pushed palette-specific paint into every other button, so it is its own small
  component with three exports (slot, corner, member row).
- **The dialog backdrop is a control, and it is in the kit.** A full-screen click-away is a button semantically but
  not visually; `Backdrop` keeps it consistent (label, tab index, z-order) instead of leaving it hand-written.
- **The standard is absolute now**: no raw `<button>` or `type="number"` outside `src/app/ui/components/`. The
  harnesses under `src/bench` and `src/dev` are excluded because they are not the interface - a rule that would
  otherwise force a test harness to adopt product components it deliberately avoids.
- **When a shared control changes, the harness must adapt, not the product.** The options bar's switch to
  `NumberField` broke six packaged steps on a stale selector; the fix was in the smoke helper, and the product
  behaviour was already correct.

## 2026-10-18 - MIT licence, a static site, and what a clean branch list means

- **MIT, because the product's value is the implementation, not the licence.** The owner asked for a licence;
  MIT is the least friction for a tool meant to be adopted, and the trademark note keeps Adobe's marks out of
  any claim. `VectorCraft is behavioural and architectural reference only` stays written down next to it.
- **The site is a static folder, not a generator.** `site/` is three files and the logo, deployed by the Pages
  action on changes only to that folder. A site that needs a build would need a second toolchain for one page.
- **Only merged branches are deleted.** The cleanup removed the 73 remote branches whose work is in `main` and
  left the three local branches that are genuinely unmerged; deleting unmerged work because it is old is how
  history gets lost.
- **Phase 5 is issued before it is coded**, one sub-issue per slice with its boundaries and evidence, because the
  repository's workflow says the plan exists first - and because the path model is the slice everything after it
  depends on.

## 2026-10-18 - Public repository, a Pages site, and a rolling pre-release

- **Public, because Pages needed it and because the project is meant to be adopted.** The licence was already
  MIT; the repository visibility now matches it. Any future decision to go private has to move the site.
- **One rolling pre-release, not a version per phase.** The `alpha` tag follows `main`, and
  `.github/workflows/alpha-release.yml` recreates the release from `docs/RELEASES.md` on every merge. Versioned
  tags would either lie between phases or multiply; a rolling tag always describes the code that exists.
- **The release body is a file in the repository.** Writing notes in the GitHub UI would drift from the code;
  `docs/RELEASES.md` is reviewed like everything else and published mechanically.
- **The one force-push in the project is the `alpha` tag**, and it is documented in the workflow: a tag is a
  label, and this label is defined as pointing at the head of `main`. No branch is ever force-pushed.
- **Phase close now has a release gate**: progress, release notes, and the site must agree before a phase is
  called done.

## 2026-10-18 - The rose palette is the brand, and a screenshot is generated, not posed

- **Six roles, one source per medium.** The DOM reads `src/styles.css` tokens; the few canvas overlays that cannot
  (shape preview, pasteboard clear) read `src/app/ui/brand.ts`, which mirrors the same six values. Two sources that
  must agree is a real risk, so the rule says they change together and the UI standards test is the place to add
  the check if it drifts.
- **Rose-deep is the interaction state.** Hover and pressed states use `#8B3A3A` rather than a brightness filter, so
  the palette's own values describe every state and a future theme change stays in one file.
- **Document colours are not brand colours.** The default fill, the swatch palette, and user artwork keep their own
  values; the palette governs chrome, selection, focus, and the site. A "brand" palette that recoloured artwork
  would be a bug.
- **The screenshot is a harness, not a hand capture.** `--screenshot=path` renders the real editor in a fresh
  profile and captures the window, so the release and site images can be regenerated with one command instead of
  drifting whenever the interface changes.
- **A stashed change is the owner's intent.** The site conflict was resolved by keeping the `Stashed changes` side
  in full and dropping the upstream head; anything the owner writes in that file wins over an older copy.

## 2026-10-18 - An unsigned installer on the rolling alpha, built only when the notes change

- **electron-builder's NSIS target, per-user, no admin prompt.** A desktop tool should install like one; the
  per-user default avoids elevation and keeps the installer runnable by anyone who can run an app.
- **Unsigned, and the notes say so.** Code signing needs a certificate the project does not have; an unsigned
  installer that explains SmartScreen is honest, a signed-looking one without a certificate is impossible.
- **Built only when `docs/RELEASES.md` changes.** Rebuilding a ~96 MB installer on every merge would waste minutes
  and disk for no new build; the notes are the phase-close signal, and a manual dispatch exists for one-offs.
- **Edit, do not recreate.** The release is updated in place so its assets survive a notes refresh; the alternative
  (delete and recreate on every push) dropped the installer each time. Exactly one installer is kept per release to
  stop the rolling tag accumulating a file per phase.
- **Version is `0.<phase>.0`.** It is a pre-release line, not semver theatre: the minor number names the phase, the
  installer file name matches, and nobody has to guess which build they downloaded.
- **The screenshot is part of the release.** A phase that changes the interface regenerates
  `site/screenshot.png` with the harness, because a release page showing last phase's chrome is a lie of omission.

## 2026-10-18 - Versioned, immutable release tags replace the rolling alpha tag

- **A moving tag was the wrong shape.** GitHub releases are always backed by a tag; the problem was that ours
  moved. A tag that moves breaks the two promises a download makes: the URL returns different bytes later, and a
  user cannot say which build they run. It also made the release title ("alpha") disagree with the installer name
  ("0.4.0"), and forced pruning so the tag would not accumulate files.
- **One version per phase: `v0.<phase>.0`.** The tag is created on the commit the installer was built from and is
  never moved. Re-running the workflow for an existing version edits the notes or re-attaches a missing installer;
  it never recreates the tag.
- **Old installers stay.** A version exists to be reproducible; deleting a phase's build would defeat the reason to
  version in the first place.
- **The workflow is the only publisher**, and it decides with facts: new version → build, existing version without
  an installer → build, manual `rebuild` → build, otherwise just refresh notes. That is why `package:win` passes
  `--publish never` and why no step ever deletes a tag.

## 2026-10-20 - Shader colours are 0-1 in all four channels, and the signature covers every pixel

- **CanvasKit's «Color()» is not a shader colour.** It normalises RGB and leaves alpha at 0-255; gradient APIs
  want 0-1 across the board. The renderer now converts hex to «Float32Array» itself («src/render/shaders.ts»),
  so the quirk cannot leak back in through a convenient helper.
- **The bucket signature is a correctness boundary, not a cache detail.** Anything that changes pixels belongs in
  it; a field that is missing is a style edit that silently does not repaint. It now lives in a pure module with
  its own tests, because a cache bug is invisible until someone looks at the canvas and sees the old picture.
- **A bug needs a reproduction, not a guess.** The first screenshot confirmed the symptom but not the cause; the
  cause came from logging the actual shader parameters and from a Node probe that painted a white rect. The
  writing in the issue said a fix without a reproduced cause would be a guess, and this is what that looks like
  when it is done properly.

## 2026-10-20 - Path anchors are relative, and the path model lands before its tool

- **Handles are offsets from their anchor, not absolute points.** Translating an anchor then moves its curve
  with it, and the two mirrored handles of a smooth anchor are one sign away - the shape 5.2 and 5.3 will edit.
- **The node's box is the flattened curve's bounding box.** Frame, scale, rotation, align, and snapping all read
  «width»/«height», so the box has to include the handles' reach or a curve would look cropped in the frame.
- **The flattener has a named tolerance and lives at L0.** Hit testing, bounds, and tests share it; a renderer
  that sampled differently would let a click miss the stroke it is visually on.
- **Format 5 only adds a node kind, so there is no migration.** «SUPPORTED_FORMAT_VERSION_LIST» keeps 1-4, a v4
  file opens unchanged, and a v5 file opened by an older build fails its version check rather than half-loading.
- **Model first, tool second.** 5.1 ships no pointer interaction on purpose: the pen (5.2) and anchor editing
  (5.3) are only honest if the document, file, renderer, and hit test already agree about what a path is.

## 2026-10-21 - Compound paths are an optional contour list, not a group flag

- **A path owns its contours.** `subpaths` sits on `PathNode`, so a compound path is still one node with one style,
  one fill rule, one transform, and one selection - which is what every command already assumes. A group with a
  "compound" flag would have split the style and the hit test across two kinds.
- **Format v6, optional field.** Old files have no `subpaths` and open unchanged; the version bump only tells an
  older build to refuse a v6 file instead of drawing a compound without its holes.
- **Even-odd hit testing by parity.** A compound's fill is the parity of covering contours, so holes are real in
  both the renderer and the click test rather than only visually.

## 2026-10-21 - Width profiles live on the stroke, one multiplier per anchor

- **Per-anchor, not per-arc-length samples.** A multiplier list that matches the anchor list is small, survives
  editing (nudging or adding anchors keeps the correspondence), and reads clearly in a file; a dense sample table
  would be finer but would drift out of sync the moment the path changes.
- **Profiles are geometry.** Skia has no variable-width stroke, so the renderer builds the outline and fills it.
  That is also why dashes and stroke alignment are declared unsupported on a profiled stroke instead of being
  silently ignored.
- **Format v7, optional field.** Old files open unchanged; new files are refused by older builds rather than drawn
  with a uniform stroke.
