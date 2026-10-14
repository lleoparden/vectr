# Vectr agent instructions

## Project

Vectr will be a desktop-first visual design tool. Its distinctive feature is
exporting a drawing's layer tree as readable React components using Tailwind.
VectorCraft is workflow inspiration only; do not copy its source or branding.

Until the owner explicitly changes this direction, agents build the product.
The long-term goal is VectorCraft/Illustrator-level feature parity plus the
React compiler; afterward, the owner will extend the product directly.

The platform and technical stack are intentionally undecided. Do not select a
stack, initialize an app, add dependencies, or write product code until the
owner approves a feature plan.

## Product identity

- Vectr's interface deliberately reads as a **modern Illustrator**. Illustrator
  users must feel at home immediately: a menu bar, a left tool palette, the canvas
  in the middle, and docked panels on the right (Properties, Layers, Appearance,
  Color, Swatches, Align, Transform), with the Layers panel as the spine of the
  document.
- Familiarity is a requirement, not a nicety. Where Illustrator's behavior is a
  convention users rely on — shortcut keys, tool grouping, panel layout, selection
  and transform conventions, panel terminology — Vectr follows it, so the
  equivalent control is where an Illustrator user expects to find it.
- Vectr still has to be its own product: original icons, type, colors, and copy,
  modern and clean styling, and no Adobe or VectorCraft assets, branding,
  screenshots, or copied source. The differentiator is the modern execution and
  Vectr's own layer-to-React compiler, never a different mental model.
- Divergence is allowed only deliberately: a better interaction, a missing
  dependency, or an accessibility need. Record every divergence and its reason in
  `docs/DECISIONS.md` instead of drifting quietly.
- A UI slice states its Illustrator mapping in its issue or plan before
  implementation: what matches Illustrator, what deliberately differs, and what is
  simply not built yet. The parity catalog's `UI-01`/`UI-02` entries carry the
  status.

## Start and finish every session

1. Read `docs/PLAN.md` and `docs/PROGRESS.md`.
2. Read `docs/DECISIONS.md` before revisiting a settled choice.
3. For any change larger than a small documentation fix, write the proposed
   plan in `docs/PLAN.md` and wait for approval before changing files.
4. At the end, update `docs/PROGRESS.md`; log significant choices in
   `docs/DECISIONS.md`.

## Agent workflow

- Use the architect role to plan significant work, bounded implementation
  workers to make approved changes, and the reviewer role to assess completed
  changes before any merge decision.
- Before changing an established code area, trace its user flow, data model,
  compiler impact, and integration boundaries using `.agents/workflows/`.
- When `graphify-out/graph.json` exists, use `graphify query`, `graphify
  explain`, or `graphify path` before broad source exploration. Update the
  graph after production-code changes.

## Working rules

- Reuse existing patterns before creating a parallel helper or subsystem.
- Keep changes small, focused, typed, and colocated with the feature they serve.
- Validate untrusted input and preserve useful error context; never silently
  discard user work.
- Never read, edit, print, commit, or upload `.env` files or secrets.
- Ask before adding a dependency, changing the stack, or introducing a service.
- Never force-push, rewrite Git history, merge, push, create a pull request,
  or change a remote GitHub repository without explicit approval.
- Do not perform broad refactors without an approved plan.
- Do not claim checks passed unless they were run in the current session.
- Memory efficiency is a product requirement. Avoid unnecessary retained
  document copies, renderer allocations, background work, and dependencies;
  measure memory on representative and stress documents before declaring a
  capability ready.
- Finish each approved outcome completely before asking the owner to review or
  test it. Agents own implementation, self-review, and planned validation;
  request owner review/testing only as the final handoff, unless new authority,
  a safety decision, or an external blocker genuinely stops progress.

## Branch policy

- Every feature, bug fix, enhancement, update, or other product change starts
  on a fresh branch. Never make that work directly on `main`.
- Use a purpose prefix: `feat/`, `fix/`, `enhance/`, `update/`, `chore/`, or
  `docs/`, followed by a short lowercase slug.
- One branch serves one work item. Do not reuse or repurpose completed branches.
- Do not merge, push, or delete a branch without the owner's explicit approval.

## GitHub workflow

- Every phase in `docs/MASTER_PLAN.md` owns one **epic issue**, created up front
  so the whole program is visible. The epic states the goal, why the phase
  exists, its dependencies, deliverables, the catalog IDs it changes, exit
  criteria, explicit non-goals, risks, and the validation it must produce.
- When a phase starts, create one **sub-issue per approved slice** before writing
  code, and link each one to its epic (GitHub sub-issue plus the epic's task
  list). Sub-issues are not created speculatively for phases that have not
  started.
- A sub-issue is descriptive and thorough: the problem, the exact plan, every
  file, module, data structure, command, or asset it creates or changes, the
  document/persistence/compiler boundaries it touches, acceptance criteria,
  evidence to record, risks, and rollback.
- Agents choose the pull-request strategy for the phase and record it in the
  epic. One branch serves one work item; every branch, commit, and pull request
  references the issue it belongs to.
- **Self-review is required before every merge**, including a pull request the
  agent wrote moments earlier: re-read the full diff as a reviewer, post what it
  actually changes, any counter-argument or risk found, what was verified, and any
  residual doubt. An unresolved doubt blocks the merge.
- Agents may merge a **small** pull request themselves when it is confined to one
  approved slice or work item, avoids every decision surface listed below, and
  `npm run typecheck`, `npm test`, and `npm run build` pass on the branch head with
  the documentation, catalog, and progress updates included. Merges use a merge
  commit.
- **Big or important pull requests need the owner's review and merge decision.**
  That includes any change to the document format or persisted data, the
  command/undo model, persistence or file I/O, the renderer path or published
  performance limits, dependencies, the stack, security or permissions, or a
  public interface later slices build on; anything spanning more than one slice or
  exceeding a few hundred lines of non-test change; and anything the agent cannot
  honestly judge.
- Agents never squash, rebase, force-push, or delete a branch, and never push
  directly to `main`; every change reaches `main` through a pull request.
- Use the issue and pull-request templates in `.github/` and apply labels from
  `.github/labels.yml`.
- Add `agent-ready` only when an issue has an approved plan, clear boundaries,
  acceptance criteria, and no unresolved blocking decision.
- The parity catalog and `docs/PROGRESS.md` updates for a capability change ship
  in the same pull request as the change.

## Progress is a primary deliverable

- Keep `docs/PLAN.md` and `docs/PROGRESS.md` current throughout agent-led work.
- Mark scope changes, blockers, and completed milestones promptly so the owner
  can take over later with an accurate project record.
- Maintain the parity catalog as the source of truth for Vectr capability
  status. Before estimating or claiming parity, create or update its item.
- Every feature, bug fix, enhancement, import/export change, compiler change,
  or agent-surface change must update its catalog status, scope, limitations,
  and linked plan/issue before the work is handed off.
- Never silently add a capability outside the catalog or leave an existing item
  stale after its behavior changes.

## Definition of done

The approved scope is complete, documentation is current, and required checks
have been run when the owner asks for them.
