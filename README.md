# Vectr

A desktop-first visual design tool whose distinctive feature is exporting a drawing's layer tree
as readable React components using Tailwind. The workspace deliberately reads as a modern
Illustrator — menu bar, tool palette, canvas, docked panels, Layers as the document spine — with
Vectr's own identity and no Adobe or VectorCraft assets.

**Status: Phase 1 is complete.** A user can create, edit, save, reopen, and recover a layered
document. The exit evidence and the recorded gaps are in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Getting started

```bash
npm install
npm start          # build and launch the desktop editor
npm test           # 145 unit tests (node:test)
npm run typecheck  # tsc --noEmit
npm run build      # vite build
npm run smoke      # build and run the packaged evidence run (one JSON report per area)
```

If `npm run smoke` fails with `Cannot read properties of undefined (reading 'whenReady')`, the shell
has `ELECTRON_RUN_AS_NODE=1` set, so `electron` is running as plain Node instead of launching the
app. Clear it for the run (`$env:ELECTRON_RUN_AS_NODE=''` in PowerShell); it is not a Vectr bug.

`npm run benchmark` packages the app and runs the recorded renderer benchmark; it is only needed
when renderer numbers are being re-measured.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/doc/` | The document model: node types, commands with inverses, history, validation, hit testing. No DOM, no GPU. |
| `src/file/` | The project format: manifest, serialization, open-time validation, atomic writes, recovery. |
| `src/render/` | The CanvasKit renderer and the scene builder that turns a document into an ordered draw list. |
| `src/state/` | The document and workspace stores, the asset registry, and the React hooks around them. |
| `src/app/` | The editor shell: `App.tsx` composes it, `actions.ts` is the action table everything calls, and the folders below group the rest. |
| `src/bench/` | The renderer benchmark harness, its fixtures, and the benchmark window. |
| `src/dev/` | The smoke-run entry points used as packaged evidence. |
| `electron/` | The main process — window, menus, file and image dialogs, the close guard — and the preload bridge. |
| `tests/` | One `node:test` suite per area, named after the layer it covers. |
| `docs/` | The project record: see [`docs/README.md`](docs/README.md). |
| `.ecc/` | Recorded evidence, one directory of benchmark runs per phase. Local scratch there is ignored. |
| `.agents/` | The architect / implementation-worker / reviewer workflows the working rules refer to. |
| `.codex/` | Agent hooks and role definitions for a separate tool; kept because it is in use. |
| `.github/` | Issue and pull-request templates and the label set. |
| `scripts/`, `tools/` | Benchmark orchestration, and the Rust helper used for the renderer comparison. |

Inside `src/app/`, one folder per kind of thing:

- `shell/` — menu bar, status bar, tool palette, about dialog, panel flyout.
- `canvas/` — canvas view, in-place text editor, context menu, viewport math.
- `menus/` — menu model, shortcut map, shortcut hook, context-menu contents.
- `panels/` — panel dock and the four panels, plus the layer row model.
- `editing/` — group/ungroup/arrange planning and drag targeting.
- `files/` — new/open/save/recovery actions and image import.
- `ui/` — theme tokens and icons.

`dist/` and `release/` are build output and are ignored. `docs/proposal/` holds the original
project proposal page, and `docs/assets/` holds the wordmark.

## How work is done here

[`AGENTS.md`](AGENTS.md) is the contract: read `docs/PLAN.md` and `docs/PROGRESS.md` first, log
choices in `docs/DECISIONS.md`, keep the parity catalog current, and work on one branch per work
item. `docs/PLAN.md` holds the operational checklist and `docs/MASTER_PLAN.md` the full roadmap.
