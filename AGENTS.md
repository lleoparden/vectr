# Vectr agent instructions

## Project

Vectr will be a desktop-first visual design tool. Its distinctive feature is
exporting a drawing's layer tree as readable React components using Tailwind.
VectorCraft is workflow inspiration only; do not copy its source or branding.

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

## GitHub workflow

- Use the issue and pull-request templates in `.github/`.
- Apply labels from `.github/labels.yml`; create them on GitHub only after a
  remote exists and the owner authorizes that change.
- Issues need problem, scope, acceptance criteria, and risk notes.
- Pull requests need summary, linked issue, user impact, and known risks.

## Definition of done

The approved scope is complete, documentation is current, and required checks
have been run when the owner asks for them.
