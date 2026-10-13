# Vectr roadmap

The detailed delivery roadmap is [MASTER_PLAN.md](MASTER_PLAN.md). This file
remains the short operational checklist for the active phase.

## Phase 0 — Reference catalog and platform decision

- [x] Approve Electron + React + TypeScript as the proposed desktop direction:
  Windows is the first fully tested release; macOS and Linux must build and
  launch early, with full support claimed only after platform testing.
- [ ] Run a bounded renderer and memory benchmark before locking Electron and
  SVG rendering for production. Compare realistic and stress documents;
  measure all application processes rather than JavaScript heap alone; avoid a
  GPU renderer unless the evidence requires one.
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

### Proposed execution plan — awaiting approval

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
4. **Decision review.** Compare results with the approved budgets. Retain
   Electron/SVG only if all required checks pass; otherwise run the same harness
   on Tauri before a replacement decision. Record the outcome and limitations.
5. **Parity catalog v1.** Create the catalog with stable IDs, reference
   evidence, status, acceptance behavior, exclusions, compiler support, and
   platform coverage. Inventory Illustrator and VectorCraft by workflow area,
   not by a misleading parity percentage; publish the catalog's completion
   rules and first prioritized MVP slice.

**Approval needed:** approve this benchmark scope and authorize the specific
dependencies after they are listed. Until then, Phase 0 stays open and no
application code or benchmark harness is created.

## Phase 1 — Core application foundation

- [ ] Create, select, reorder, and group layers.
- [ ] Support text, shapes, images, and nested groups.
- [ ] Save and reopen projects.
- [ ] Establish the desktop document/editor foundation before cloud features.

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
