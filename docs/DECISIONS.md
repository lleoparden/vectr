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

## 2026-10-13 — Agent completion and owner handoff

- Agents complete the approved outcome, self-review it, and run planned checks
  before asking the owner to review or test.
- Owner review/testing is the final handoff, not a substitute for unfinished
  agent work. The only exception is a genuine need for new authority, a safety
  decision, or an external blocker that prevents meaningful progress.
