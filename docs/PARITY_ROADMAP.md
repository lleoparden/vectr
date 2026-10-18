# Parity roadmap against VectorCraft's architecture and gap list

**Status: proposed, awaiting owner approval.** This document does not change code; it changes what we aim at
and in which order. It is grounded in the VectorCraft repository cloned at `L:\vectrcraft-ref` (MIT OR
Apache-2.0), read as **behaviour and architecture evidence only** — no source is copied into Vectr.

## Why this exists

The owner's verdict on the current build is that it does not *feel* good, and the question was whether to fork
VectorCraft as a base. A fork would replace ~17k lines of TypeScript, 26 test suites, the v4 document format,
the command/history model and every packaged-evidence run with a Rust workspace of **~354k lines** (their own
architecture doc's figure) before parity improves at all, and it would rebuild the compiler on a document model
that does not exist yet. The better use of that repository is exactly what its own docs are for: a **ranked,
estimated gap list** and an **enforced architecture**.

Two facts from that repository shaped this plan:

1. **Their own gap list ranks interaction fidelity as gap 1 (60–90 agent hours)** — ahead of file formats,
   stability, type, effects. The complaint "it does not feel good" is that gap, and it is a craft problem, not a
   base problem.
2. **Their layers are the thing worth copying.** `cargo xtask layers` enforces that a crate depends only on lower
   layers and that nothing below the UI depends on a toolkit. Our code already has the right instincts (pure
   `doc/`, renderer isolated in `render/`) but no rule that keeps them that way.

## Architecture mapping (adopt the layers, translate the roles)

| Layer | VectorCraft (Rust) | Vectr equivalent today | Work to close the shape |
|---|---|---|---|
| L0 | `geom`, `color` (kurbo, ICC) | `doc/shapeGeometry.ts`, `ui/color.ts`, `ui/cmyk.ts` | One `geom` module (bezier, offset, booleans' input); colour models beyond hex |
| L1 | `doc` (artboards, layers, appearance, text, symbols) | `src/doc/` — validated, serializable, undoable | Symbols, appearance stacks, guide objects, richer type |
| L2 | `pathops`, `brush`, `trace`, `text`, `effects`, `plugins`, `three-d` | **missing** (arc/star geometry only) | Pathfinder/Shape Builder (`PATH-04`), text layout, effects — this is where most Illustrator power lives |
| L3 | `render`, `svg`, `pdf`, `format`, `eps`, `cad`, `metafile` | `render/`, `file/` (v4), no interchange | SVG/PDF/`.ai` read and write |
| L4 | `tools` — state machines, pointer in, commands and overlays out | **gestures live inside `CanvasView`** | Extract `src/tools/`: a state machine per tool, so every tool behaves the same way |
| L5 | `engine` — sessions, unlimited history, command registry (~710 commands) | `state/` + `actions.ts` (~60 actions) | Command registry with labels, chords, enablement, and a single table the UI and menus read |
| L6 | `ui-egui`, `mcp` | `src/app/` | MCP later (`Phase 7`) |
| L7 | `apps/*`, `xtask` | `electron/`, `src/main.tsx` | Layer-check script in CI |

**Rule to adopt now:** one direction only. `doc` knows nothing about React or Skia; `render` knows nothing about
React; `app` knows nothing about Skia; and a single script fails the build when a module imports "upwards". That
is the enforceable part of "follow its architecture", and it costs a day.

## The gap list, adapted (their ranking, our status)

Adapted from VectorCraft's `docs/gaps.md` ranking. Hours are **their** estimates for one agent, kept as a
yardstick; ours will differ because the stacks do.

| Rank | Gap | Their estimate | Vectr status |
|---:|---|---:|---|
| 1 | Interaction fidelity: cursors, hover, previews, snapping feel, tool behaviour | 60–90 h | **the felt problem**; gestures live in one component, no tool state machines, no hover affordances |
| 2 | Illustrator `.ai` / EPS files from real users | 10–20 h | not started |
| 3 | Launch and stability on real machines | 20–35 h | Windows only; packaged smoke is our evidence |
| 4 | Hardening at scale | 30–50 h | 1,000-shape path measured; 10,000 primitives is a recorded limit |
| 5 | Correctness bugs in core tools | 8–15 h | no known open correctness bugs; keep it that way |
| 6 | Advanced type (area, path, threading, styles) | 34–47 h | plain text only |
| 7 | Preferences and panels that do not act yet | 13–20 h | none — we refuse dead controls by rule |
| 8 | Raster effects and the Effect Gallery | 23–39 h | not started |
| 9 | Illustrator 30.x additions | 15–25 h | not started |
| 11 | Brushes, symbols, libraries | 17–28 h | not started |
| 12 | 3D and materials | 25–45 h | not started |
| 15 | Performance budgets and a GPU renderer | 15–25 h | CanvasKit; `PERF-01` amended with revisit triggers |
| 19 | Accessibility | 15–25 h | keyboard paths exist; no audit |

## Re-sequenced phases

The order changes so that "feels good" is early and the compiler is not stranded behind every parity item.

| Phase | Contents | Why here |
|---|---|---|
| **3 Architecture realignment** | Layer check; `src/tools/` state machines; one command registry; behaviour frozen | The retrofit phase the owner asked for: the structure has to be right before fidelity work adds to it |
| **4 Interaction fidelity** | Cursors, hover, live previews, keyboard and modifiers, snapping feel, panel liveness | Their gap 1 and the owner's complaint: this is what "does not feel good" means |
| **5 Path model and booleans** | Bezier pen and anchors, Pathfinder/Shape Builder, width profiles, live shapes, compound paths | The drawing grammar Illustrator users expect |
| **6 Type** | Area text, text on a path, threading, styles, vertical type, text-to-outline | Their gap 6 |
| **7 Appearance and effects** | Appearance stacks, transparency groups, raster effects, brushes/patterns/symbols, mesh and recolour | The depth a real illustration needs |
| **8 Files and interoperability** | SVG, PDF, `.ai` and EPS reading, fidelity matrix | Their gap 2: nobody can bring work in until this exists |
| **9 Core parity gate** | Capability audit, hardening, platforms, performance, accessibility | Their gaps 3, 4, 5, 10, 15, 19 |
| **10 Compiler** | React and Tailwind output - the differentiator | Unchanged position, now with a document model that supports more of what it must emit |

## What we will not do

- **No source translation.** Reading VectorCraft's code to understand a behaviour and writing our own
  implementation is what the current `AGENTS.md` allows; porting its Rust file-by-file into TypeScript is a
  derivative work, produces a worse codebase (idioms do not survive the move), and would need the owner to
  override the rule deliberately. The plan above gets the same outcome from behaviour evidence.
- **No fork as a base.** The engine is not the weak part; the breadth of the tooling is.
- **No phase-6 shortcut.** The compiler is the differentiator, not a substitute for the tools it has to compile.

## First three slices after approval

1. **Layer rule + script** (a day): `scripts/check-layers.mjs` asserting the L0–L7 import direction, wired into
   `npm test`.
2. **Tool state machines** (the core of 2.9): a `Tool` interface (pointer/keyboard/cancel/commit, overlays,
   cursor) and the first three tools ported — Selection, Direct Selection, Hand — with the canvas reduced to
   routing events and drawing overlays.
3. **Hover and preview fidelity**: the cursor set Illustrator uses, hover outlines, and a preview for every
   gesture, with the packaged run asserting each one through `elementFromPoint` rather than synthetic canvas
   events.
