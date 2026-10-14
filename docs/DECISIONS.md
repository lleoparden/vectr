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

