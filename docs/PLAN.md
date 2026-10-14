# Vectr roadmap

The detailed delivery roadmap is [MASTER_PLAN.md](MASTER_PLAN.md). This file
remains the short operational checklist for the active phase.

## Phase 0 — Reference catalog and platform decision

- [x] Approve Electron + React + TypeScript as the proposed desktop direction:
  Windows is the first fully tested release; macOS and Linux must build and
  launch early, with full support claimed only after platform testing.
- [x] Run the packaged Electron + SVG renderer/memory benchmark. Five Windows
  runs are recorded in `.ecc/benchmarks/phase-zero/`; SVG fails the stress
  interaction target and is not a production renderer candidate.
- [x] Select Electron + React + TypeScript + Tailwind + Vite as the desktop
  development baseline. The evidence rejects full-document SVG, not Electron;
  Electron's 3.90 MiB empty-memory overrun is not enough to justify changing
  shells without an equivalent runtime comparison.
- [ ] Run the prepared Tauri comparison when its Windows toolchain is available.
  It is retained as non-blocking evidence: switch only for a repeatable,
  equivalent-workload memory advantage of about 20% or more.
- [ ] Run a bounded CanvasKit/Skia renderer spike before editor features. It
  must use the frozen fixtures and retain the 33 ms stress interaction target.
- [x] Build parity catalog v1 and define its feature-completion standard in
  `docs/PARITY_CATALOG.md`.
- [x] Approve a versioned, renderer-independent document model: stable layer
  IDs, order, geometry, transforms, styles, text, and assets.
- [x] Approve one validated, serializable, undoable command/change model for
  UI, shortcuts, future MCP, and the future built-in agent.
- [x] Approve lawful behavior-led reconstruction: use REA for narrow,
  evidence-backed investigations; never copy source or branding.
- [x] Approve a React/Tailwind export contract: readable TSX + Tailwind by
  default, one component per layer, inline SVG where fidelity requires it;
  JSX and semantic/responsive output are future user choices when supported.
- [x] Approve quality gates: save/reopen, undo/redo, import validation, visual
  comparisons, desktop interaction, performance/memory budgets, and future
  account-permission coverage.

### Completed Phase 0 platform decision

1. **Benchmark specification.** Define three frozen, versioned fixtures
   (empty, representative, stress), the test machine/OS, measured metrics,
   repeat count, and Electron-versus-Tauri decision rule. The plan will set
   proposed budgets for owner approval before measurements begin.
2. **Minimal benchmark harness.** On a fresh `chore/` branch, add only the
   approved Electron/React/TypeScript dependencies and the smallest desktop
   harness needed to load those fixtures, perform pan/zoom, selection, edit,
   undo/redo, save/reopen, and close/reopen cycles. No production editor tools,
   cloud services, compiler, MCP, or branding work is in scope.
3. **Evidence run.** Execute the packaged Windows release build with developer
   tools closed. Capture total memory for every application process, GPU memory
   where available, p95 interaction time, correctness outcomes, and raw traces
   across five independent runs; record macOS/Linux build-and-launch evidence
   when those hosts are available.
4. **Decision review.** The independent review selected Electron as the
   baseline and rejected full-document SVG. The future Tauri comparison is
   non-blocking and changes the shell only with a repeatable, material runtime
   memory advantage under the same workload.
5. **Parity catalog v1.** Create the catalog with stable IDs, reference
   evidence, status, acceptance behavior, exclusions, compiler support, and
   platform coverage. Inventory Illustrator and VectorCraft by workflow area,
   not by a misleading parity percentage; publish the catalog's completion
   rules and first prioritized MVP slice.

**Outcome:** Electron + React + TypeScript + Tailwind + Vite is selected for
development. The document model remains renderer-independent. Full-document
SVG is rejected; CanvasKit/Skia is the production-renderer candidate pending
the bounded spike above. Tauri remains a deferred comparison, not a stack gate.

## Phase 1 — Core application foundation

### Approved execution plan

1. **Renderer spike (`PERF-01`).** Add CanvasKit/Skia only if its smallest
   official package set can render frozen primitive, text, image, and nested
   group fixtures. Measure total-process, JavaScript, WASM, and GPU memory;
   redraw timing; resize; zoom; replacement; and repeated load/unload. The
   stress interaction target is 33 ms. A failed spike pauses editor work for a
   documented renderer decision.
2. **Editable shapes (`DOC-01`, `DOC-03`, `PATH-01`, `SEL-01`).** Establish
   one versioned document with stable IDs, ordered children, local transforms,
   rectangle/ellipse nodes, and serializable create/select/move commands with
   bounded transactional undo/redo.
3. **Layers and groups (`DOC-02`, `SEL-03`).** Add the layer list,
   multi-selection, sibling reorder, group/ungroup, and nested groups. Reject
   cycles, absent IDs, and invalid parents. Canvas paint order and tree order
   must agree.
4. **Plain text (`TYPE-01`).** Add accessible plain-text editing with content,
   position, size, color, multiline support, and defined missing-font behavior.
   Advanced typography is deferred.
5. **Images (`IMAGE-01`).** Import PNG/JPEG into content-addressed local asset
   storage. Image nodes reference shared bytes and participate in selection,
   movement, grouping, ordering, and history; invalid or excessive images fail
   without altering the document.
6. **Durable local documents (`DOC-04`).** Add new/open/save/save-as, a
   versioned manifest plus asset directory, validation, dirty-state handling,
   and failure-safe open/save. Do not use JSON-embedded base64 assets or
   full-document undo snapshots.

### Cross-slice constraints

- One editor window. React renders controls and the visible layer list; the
  renderer owns drawing objects.
- Commands store inverse data or changed fields, not whole documents. A drag or
  text edit is one bounded history transaction; a fresh command clears redo.
- Renderer and decoded-asset caches are derived, bounded, and explicitly
  disposed. No idle animation or document-wide IPC on pointer movement.
- Cloud, authentication, Supabase, MCP, built-in agents, compiler output,
  collaboration, advanced paths, and the IDE are out of scope.
- Each slice uses its own fresh branch, reviewer assessment, focused checks,
  and catalog/progress update before the next slice.

## Later phases

- [ ] Reach VectorCraft/Illustrator-level feature parity without copying source.
- [ ] Build the React/Tailwind compiler on the completed document model.
- [ ] Add an account-scoped MCP server for authorized AI agents.
- [ ] Add Supabase, shared library, AI assistant, mockup import, and analytics
  after the core application and compiler.
- [ ] Add future owner-selected features after the currently known extras.
- [ ] Consider a full design-tool-plus-IDE workspace only as a distant
  possibility after all earlier work.
- [ ] Add import/export formats and reusable component options.
- [ ] Improve compiler output, accessibility, and project collaboration.

## Delivery model

- [ ] Agents deliver the planned product through parity; project records track
  all milestones, decisions, scope changes, and blockers.
- [ ] The owner begins direct feature work after that parity milestone.

## Planning rule

Before any feature larger than a small documentation update, replace the
relevant checklist item with an implementation plan and wait for approval.
