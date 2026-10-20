# Vectr agent instructions

## Project

Vectr will be a desktop-first visual design tool. Its distinctive feature is
exporting a drawing's layer tree as readable React components using Tailwind.
VectorCraft is workflow inspiration only; do not copy its source or branding.

Until the owner explicitly changes this direction, agents build the product.
The long-term goal is VectorCraft/Illustrator-level feature parity plus the
React compiler; afterward, the owner will extend the product directly.

The stack is decided: Electron + React + TypeScript + Tailwind + Vite with CanvasKit/Skia (see
`docs/MASTER_PLAN.md`). Do not change it, add a dependency, or introduce a service without the owner's
approval, and do not write product code until the owner approves a feature plan.

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

## Reference architecture

Vectr follows the layering documented in VectorCraft's `docs/architecture.md` - behaviour and architecture
evidence only; its source and branding are never copied. A module may only import from a lower layer:

L0 geometry and colour - L1 document model - L2 operations (booleans, text layout, effects) - L3 renderer and
file formats - L4 tools as state machines - L5 engine (sessions, history, command registry) - L6 interface -
L7 application shells and tooling.

- `scripts/check-layers.mjs` enforces the direction and runs in `npm test`.
- The document layer never imports React, Skia, or Electron; the renderer never imports React and never mutates
  the document; tools never mutate the document directly - they emit commands.
- Every user-visible action is one command in the registry, reachable from menus, palette, and keyboard.
- During the Phase 3 realignment **behaviour is frozen**: a retrofit slice must leave the tests and the packaged
  run reporting the same results, and any behaviour change it uncovers is a follow-up, not part of the port.

## Start and finish every session

1. Read `docs/PLAN.md`, `docs/PROGRESS.md`, and `docs/PARITY_ROADMAP.md`.
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

## Brand palette

Vectr's colours are a brand, not a taste per screen. These six roles are the palette, and `src/styles.css` holds
them as Tailwind `@theme` tokens - the only place a colour is written:

| Role | Token | Hex |
| --- | --- | --- |
| Charcoal, main background | `--color-chrome`, `--color-pasteboard` | `#1B1B1F` |
| Charcoal raised, panels and alternate sections | `--color-chrome-raised`, `--color-chrome-panel` | `#242428` |
| Rose-vale, brand: buttons, selection, fills | `--color-accent` | `#A94A4A` |
| Rose light, links, small text, focus rings | `--color-accent-light` | `#E07C7B` |
| Rose deep, hover and pressed states | `--color-accent-deep` | `#8B3A3A` |
| Off-white, text and the logo letter | `--color-ink` | `#F3EEE8` |

- A component uses the token classes (`bg-accent`, `text-ink-muted`, `border-hairline`); it never writes a hex.
  A hex in a component is a review finding.
- Derived neutrals (`chrome-sunken`, `chrome-active`, `chrome-hover`, `hairline`, `ink-muted`, `ink-faint`) are
  shading of the charcoal and off-white, kept warm-neutral so they sit beside the rose without clashing.
- Document content colours are not brand colours: the default fill, the swatch palette, and user artwork may be
  any colour. The palette governs chrome, selection, focus, and the site.
- The site in `site/` uses the same six values; a palette change updates `src/styles.css`, `site/style.css`, and
  `docs/` together.

## UI components

The interface is repetitive by nature, so repetition in the code is a defect. One component per concept, in
`src/app/ui/components/`, with the differences expressed as parameters.

- **A button is one component**, with `variant` (panel, primary, quiet, danger, icon), `size`, and an optional icon;
  a second raw `<button>` in a panel is a review finding unless the case genuinely cannot be expressed, in which
  case the primitive is extended rather than copied.
- **A numeric input is one component**, with `min`, `max`, `step`, `suffix`, and `inline`: the gradient stop and the
  CMYK fields share `NumberField` for exactly this reason.
- **An empty state, a chip, a readout, a tab, a dialog button row** each have one implementation; the text and the
  behaviour are props.
- **Styling lives with the component.** A panel file may pass data and callbacks; it may not spell out a class list
  that another panel also spells out.
- **`tests/uiStandards.test.ts` enforces the mechanical half**: no imports from the old field module, and the
  shared primitives' class signatures appear only in `components/`.

## Release gate

The product ships **versioned releases**, one per phase, until the compiler lands. Every phase ends with a new
version and its own release; a tag never moves.

- **Version rule: a phase closes with a minor bump (`0.5.0`), a slice with a patch bump (`0.4.2`, `0.4.3`).**
  `package.json` carries the version and it is bumped in that slice's final pull request; the change is the only
  manual step and it is what triggers the release workflow. The tag is `v<version>`, the Windows installer is
  `Vectr-<version>-Setup.exe`, the macOS image is `Vectr-<version>.dmg`, and the release title says the version.
- **Both platforms ship on one release.** The workflow creates a **draft**, builds Windows and macOS in parallel,
  and publishes only when both assets attached; a failure leaves the draft, never a half-release. The macOS build
  is unsigned (`identity: null`, `CSC_IDENTITY_AUTO_DISCOVERY=false`), so Gatekeeper needs right-click Open or
  `xattr -dr com.apple.quarantine`; notarization is impossible without an Apple Developer ID.
- **A release is a normal release, not a GitHub pre-release.** Only normal releases appear in the repository
  sidebar with their version and the "Latest" badge, which is where a download is found; "alpha" is said in the
  title and the notes, not by hiding the release. "gh release edit ... --prerelease=false --latest" is the
  idempotent form.
- **Tags are immutable.** `v0.4.0` points at the commit that built that installer and never moves; a download URL
  must always return the same bytes, and a bug report that says "0.4.0" must be answerable. The release workflow
  creates the tag when a version is new and refuses to recreate or move an existing one.
- **The installer is built by CI, never by hand.** `npm run package:win` produces the NSIS installer (per-user,
  unsigned). The workflow builds it when the version is new, when the release exists but has no installer (a
  failed run), or on manual dispatch with `rebuild`. It is attached to that version's release; installers from
  earlier versions stay available.
- **The notes are `docs/RELEASES.md`**, published with `<version>` replaced by the actual version. A merge that
  changes that file or `package.json` runs the workflow.
- **At phase close, regenerate the screenshot and the site.** Run
  `npx electron . --screenshot=site/screenshot.png` (fresh profile, so no recovery prompt intrudes), update the
  site's feature list, its version line, and the README status where the phase changed them, and merge that with
  the notes. The Pages workflow deploys `site/` automatically.
- The notes are download-first: a download badge linking straight at the installer asset, one paragraph on what
  changed, then the install steps, the limits, and the evidence in collapsed `<details>` blocks, so the
  release reads as a download menu with the extra information underneath it.
- A phase is not closed until `docs/PROGRESS.md`, `docs/RELEASES.md`, the site, and the release for its version
  agree.

## Review checklist

Every pull request states, in its description:

1. **Which layer it belongs to** (L0-L7) and **which imports it adds**; the layer check must pass.
2. **Which architecture rule it touches** - document purity, renderer purity, tools emit commands, one registry - and
   why the change respects it.
3. **Which evidence it owes**: typecheck, the full unit suite, a production build, and packaged evidence for any
   user-visible path. During Phase 3 a retrofit also owes **identical** packaged-run results, step for step.
4. **Which catalog row it moves**, or that it moves none because nothing a user can do has changed.
5. **What it deliberately does not do**, including the dead code it leaves behind and why.
6. **Its residual doubt**, named. An unresolved correctness or data-loss doubt blocks the merge.

A new user-visible action is not complete until it is one entry in `src/app/commands/registry.ts` reachable from
the menus, the palette, and the keyboard: the registry is the only door.

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
- **Temporary Phase 1 merge authority (owner authorization, 2026-10-16; expired when Phase 1 closed).** Until
  Phase 1 is finished, agents may merge an approved pull request themselves —
  including an otherwise big or important one — after the required self-review is
  posted and the branch-head checks, documentation, catalog, and progress updates
  are recorded. A known verification gap must be stated in the pull request; an
  unresolved safety, data-loss, or correctness doubt still blocks merge. Merges use
  a merge commit. This exception expires when Phase 1 finishes, after which big or
  important pull requests again need the owner's review and merge decision.
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
