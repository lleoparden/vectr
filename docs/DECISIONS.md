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
- Because the gate is still not met, editor slices 2–6 remain paused for the
  owner's renderer decision, with the options recorded in `docs/PROGRESS.md`.

## 2026-10-14 — Amendment to the Phase 0 renderer gate (candidate comparison)

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
