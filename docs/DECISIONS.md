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

