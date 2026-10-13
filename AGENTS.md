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

## Branch policy

- Every feature, bug fix, enhancement, update, or other product change starts
  on a fresh branch. Never make that work directly on `main`.
- Use a purpose prefix: `feat/`, `fix/`, `enhance/`, `update/`, `chore/`, or
  `docs/`, followed by a short lowercase slug.
- One branch serves one work item. Do not reuse or repurpose completed branches.
- Do not merge, push, or delete a branch without the owner's explicit approval.

## GitHub workflow

- Use the issue and pull-request templates in `.github/`.
- Apply labels from `.github/labels.yml`; create them on GitHub only after a
  remote exists and the owner authorizes that change.
- Issues need problem, scope, acceptance criteria, and risk notes.
- Pull requests need summary, linked issue, user impact, and known risks.
- Add `agent-ready` only when an issue has an approved plan, clear boundaries,
  acceptance criteria, and no unresolved blocking decision.

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
