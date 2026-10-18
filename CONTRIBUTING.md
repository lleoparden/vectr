# Contributing to Vectr

Thanks for being here. Vectr is a vector design tool with Illustrator's conventions and its own React +
Tailwind compiler, built in public. This file explains how to get the code running, how a change becomes a
merge, and the few rules that are not negotiable.

If you only read one more file, read [`AGENTS.md`](AGENTS.md) — it is the binding rulebook, and this guide is the
human-facing path through it.

---

## Ways to contribute

- **Report a bug** with the smallest document that shows it, what you expected, what happened, and the platform.
- **Propose a feature** by opening an issue that states the Illustrator behaviour it follows (or deliberately
  diverges from) and what "done" would mean.
- **Take a slice** from [`docs/PLAN.md`](docs/PLAN.md). Slices are sized to finish, not to linger.
- **Improve the docs.** A stale claim is a defect: if the README says 143 steps and the reports say otherwise,
  that is a bug worth a pull request.

Feature work is scoped by the phase plan. A large idea is welcome as an issue first; it does not need to arrive
as a surprise pull request.

## Getting started

**Prerequisites:** Node.js 22+ and npm. Windows is the reference platform today; macOS and Linux are Phase 9.

```bash
git clone https://github.com/lleoparden/vectr.git
cd vectr
npm install
npm start          # build and launch the desktop editor
```

Useful scripts:

```bash
npm run typecheck  # tsc --noEmit
npm test           # unit tests + the layer rule + the UI standards check
npm run build      # vite build
npm run smoke      # packaged evidence run (see the note below)
```

`npm run smoke` launches the packaged app and drives it with real input. If it fails with
`Cannot read properties of undefined (reading 'whenReady')`, your shell exports `ELECTRON_RUN_AS_NODE=1`, so
`electron` runs as plain Node. Clear it for that run:

```powershell
$env:ELECTRON_RUN_AS_NODE=''   # PowerShell
npm run smoke
```

That is an environment quirk, not a Vectr bug.

## Branch and commit rules

- **Never commit to `main`.** Every change, including a one-line typo fix, starts on a branch.
- One branch per work item. Do not reuse a branch or pile unrelated work onto one.
- Prefixes: `feat/`, `fix/`, `enhance/`, `update/`, `chore/`, or `docs/`, then a short lowercase slug — e.g.
  `feat/pen-tool`, `fix/zoom-cursor`.
- Commits are imperative and scoped: `feat(tools): add the Pen tool`, `fix(canvas): keep the guide on release`.
  A body explains *why* when it is not obvious.
- Never force-push a branch, rebase pushed history, or delete a branch with unmerged work. The only moving tag is
  `alpha`, handled by the release workflow.

## The architecture rules

The codebase is layered, and `scripts/check-layers.mjs` fails the suite when a module imports upward:

| Layer | Holds |
| --- | --- |
| L0 `src/geom/` | Curves, transforms, colour, CMYK, viewport maths |
| L1 `src/doc/` | Document model, commands, history, validation, hit testing |
| L2 `src/ops/` | Operations over the model (path booleans, layout) |
| L3 `src/render/`, `src/file/` | Renderer and formats |
| L4 `src/tools/` | Tools as state machines |
| L5 `src/state/`, `src/app/commands/`, `src/app/editing/` | Stores, command registry, pure editing rules |
| L6 `src/app/` | Shell, panels, canvas host, the component kit |
| L7 `electron/`, `src/dev/`, `src/bench/`, `scripts/` | Shells, harnesses, tooling |

What follows from that:

- The document layer never imports React, Skia, or Electron.
- The renderer never imports React and never mutates the document.
- Tools never mutate the document directly; they call the host, which dispatches commands.
- Every user-visible action is **one command** in `src/app/commands/registry.ts`, reachable from the menus, the
  palette, and the keyboard. The registry is the only door.
- A new UI control is a component in `src/app/ui/components/`, parameterised, not a new spelling of a button.
  `tests/uiStandards.test.ts` enforces this.
- **No control may lie.** If a capability is not built, it does not appear in the interface; the limitation is
  recorded in [`docs/PARITY_CATALOG.md`](docs/PARITY_CATALOG.md) and [`docs/DECISIONS.md`](docs/DECISIONS.md)
  instead.

## What a pull request owes

Open the pull request against `main` from your branch and answer these six questions in the description — they
are the review checklist from `AGENTS.md`:

1. **Which layer** the change belongs to and which imports it adds.
2. **Which architecture rule** it touches and why the change respects it.
3. **Which evidence** it brings: typecheck, the full unit suite, a production build, and packaged steps for
   anything a user can see or press.
4. **Which catalog row** it moves, or that it moves none because nothing a user can do has changed.
5. **What it deliberately does not do**, including dead code it leaves behind.
6. **Its residual doubt**, named. An unresolved correctness or data-loss doubt blocks the merge.

Before merging, read your own diff as a reviewer would: state what it actually changes, any counter-argument,
what you verified, and what you are unsure about. A pull request without that self-review is not ready.

Merges use a merge commit. Nothing is squashed; the history is part of the evidence.

## Tests and evidence

- Every command gets an inverse test. Undo is not a feature to sanity-check by hand.
- Pure logic (geometry, planners, hit testing, availability rules, arithmetic) is unit-tested.
- Interaction is verified in the packaged run, **through real hit testing**: `document.elementFromPoint` and
  dispatched events on the element that is actually on top. Dispatching events straight at the `<canvas>` has
  passed while the canvas was covered, so it is not evidence.
- A failing packaged step can be the harness's fault. Determine which side is wrong before changing the
  feature; the decision record has an example of exactly that.
- Do not claim checks passed unless you ran them in this session.

## Documentation is part of the change

- Every capability change updates its catalog row, its own limitations, and [`docs/PROGRESS.md`](docs/PROGRESS.md)
  with the evidence, in the same pull request.
- Settled choices go into [`docs/DECISIONS.md`](docs/DECISIONS.md) with the reason, so nobody relitigates them by
  accident.
- Issue and slice structure lives in [`docs/PLAN.md`](docs/PLAN.md); an epic owns a phase, a sub-issue owns a
  slice, and each sub-issue is written before its code.
- At the close of a phase, [`docs/RELEASES.md`](docs/RELEASES.md) and the site's feature list are updated in the
  phase's final pull request. The rolling `alpha` pre-release is regenerated from that file automatically, and a
  phase is not closed until progress, release notes, and the site agree.

## Reporting a good bug

Include:

- Vectr version or commit,
- platform and display scaling,
- the smallest document that reproduces it (a `.vectr` folder is fine — it is text plus assets),
- what you did, what you expected, what happened,
- whether undo recovers.

A saved document plus a sentence about the gesture is usually enough to reproduce a bug in a tool like this.

## Style, briefly

- TypeScript everywhere, `strict` on. No `any` as a shortcut; `unknown` plus validation at the boundary.
- Validation belongs in `src/doc/validate.ts` and the commands, not in a component.
- Prefer a pure function and a test over a clever component.
- Name things the way Illustrator names them, so the interface, the code, and the documentation use one word.
- Comments explain *why*, not *what*. A comment that restates the line is noise.
- Keep the diff small and the pull request single-purpose.

## Licensing and provenance

- By contributing you agree your work is licensed under the repository's [MIT licence](LICENSE).
- **No Adobe assets, screenshots, or source.** Illustrator is a convention to follow, not a source to copy.
- **No VectorCraft source or branding.** That project is behavioural and architectural reference only; reading
  it to understand a behaviour is fine, porting its code is not.
- Icons, copy, colours, and type must be original to Vectr.

## Questions

Open an issue with the `type: task` label, or a discussion if the repository has them enabled. For a change you
are unsure about, an issue that describes the intended behaviour and asks "should this be a slice?" is cheaper
than a large pull request that has to be unbuilt.
