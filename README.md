# Vectr

![Vectr](vectr.png)

A desktop-first vector design tool built to feel like a modern Illustrator, whose distinctive feature is
exporting a drawing's layer tree as readable **React components styled with Tailwind**.

Vectr follows Illustrator's conventions deliberately - menu bar, left tool palette, canvas, right-docked
panels, Layers as the document spine, Illustrator's shortcuts and groupings - with its own icons, type,
colours, and copy. No Adobe or VectorCraft assets, branding, screenshots, or copied source.

## Status

**Phase 4 is complete; Phase 5 (the path model) is next.**

Working today: twelve tools as state machines, rotation, hover outlines and per-tool cursors, a scrub-able
number field everywhere, artboards with rulers, grid and guides, paint with gradients and all sixteen blend
modes, named CMYK/spot swatches, point text, images, clipping masks, layers with locate and nested previews,
Align and Transform panels, and a native file format with autosave and crash recovery.

Missing by design, tracked per phase: Bezier paths and booleans (Phase 5), full type (Phase 6), effect and
appearance stacks (Phase 7), file interchange including SVG and `.ai` (Phase 8), macOS/Linux (Phase 9), and the
React compiler (Phase 10).

The row-by-row record is [`docs/AUDIT.md`](docs/AUDIT.md); the roadmap is [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).

## Run it

```bash
npm install
npm start          # build and launch the desktop editor
```

## Verify it

```bash
npm test           # 272 unit tests, plus the architecture and UI-standards checks
npm run typecheck  # tsc --noEmit
npm run build      # vite build
npm run smoke      # packaged evidence: 143 steps across seven reports
```

If `npm run smoke` fails with `Cannot read properties of undefined (reading 'whenReady')`, the shell has
`ELECTRON_RUN_AS_NODE=1` set, so `electron` runs as plain Node. Clear it for the run
(`$env:ELECTRON_RUN_AS_NODE=''` in PowerShell); it is not a Vectr bug.

`npm run benchmark` packages the app and re-measures the renderer; it is only needed when renderer numbers are
being recorded again.

## How it is built

Vectr follows a strict layering, enforced by `scripts/check-layers.mjs` in `npm test`: a module may only import
from a lower layer.

| Layer | Holds |
| --- | --- |
| L0 `src/geom/` | Curves, transforms, colour models, conversions |
| L1 `src/doc/` | The document: node types, commands with exact inverses, history, validation, hit testing |
| L2 `src/ops/` | Operations over the model (path booleans, layout) - Phase 5 onward |
| L3 `src/render/`, `src/file/` | The CanvasKit renderer and scene builder; the project format, atomic writes, recovery |
| L4 `src/tools/` | Tools as state machines: pointer in, commands and overlays out |
| L5 `src/state/`, `src/app/commands/`, `src/app/editing/` | Stores, history, the command registry, the pure editing rules |
| L6 `src/app/` | The interface: shell, panels, canvas host, the component kit |
| L7 `electron/`, `src/dev/`, `src/bench/`, `scripts/` | Application shells, harnesses, tooling |

The interface is a component kit in `src/app/ui/components/`: one button, one numeric field, one menu row, one
tab, one empty state, one swatch tile. `tests/uiStandards.test.ts` fails on any hand-written `<button>` or
`type="number"` outside that folder.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/doc/` | Document model, commands, history, validation, hit testing (no DOM, no GPU) |
| `src/geom/` | Geometry, colour, CMYK conversion, transforms, viewport maths |
| `src/tools/` | Selection, direct selection, lasso, seven shapes, type, hand, zoom, scale |
| `src/render/` | CanvasKit renderer, scene builder, thumbnails |
| `src/file/` | Manifest format, serialization, open-time validation, atomic writes, recovery |
| `src/state/` | Document and workspace stores, asset registry, React hooks |
| `src/app/` | Shell, canvas host, panels, menus, the command registry, the component kit |
| `src/dev/` | The packaged smoke harness used as evidence |
| `electron/` | Main process (window, menus, dialogs, close guard) and the preload bridge |
| `site/` | The project website published on GitHub Pages |
| `docs/` | Plan, progress, decisions, parity catalog and roadmap, audit, parity roadmap |

## Documentation

| Document | What it answers |
| --- | --- |
| [`docs/PLAN.md`](docs/PLAN.md) | What is being worked on now |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | What shipped, with its evidence |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why the settled choices are settled |
| [`docs/AUDIT.md`](docs/AUDIT.md) | Feature-by-feature: built, partial, or missing |
| [`docs/PARITY_CATALOG.md`](docs/PARITY_CATALOG.md) | The capability catalogue and its status rules |
| [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) | Every phase, in order, with exit criteria |
| [`AGENTS.md`](AGENTS.md) | The rules an agent (or a person) follows in this repo |

## License

MIT. See [`LICENSE`](LICENSE).

Adobe and Illustrator are trademarks of Adobe Inc. VectorCraft is a separate project used only as behavioural
and architectural reference; none of its source or branding is used here.
