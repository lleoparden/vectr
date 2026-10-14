# Progress

## Done

- Documentation-only repository setup.
- Agent rules, planning record, decision log, and GitHub templates prepared.
- Stack-neutral agent roles, hooks, and planning/tracing workflows prepared.
- Agent-first delivery, branch naming, and progress-tracking policies recorded.
- Private GitHub repository created and configured as `origin`; the initial
  governance and planning branches were pushed. Later planning changes are
  currently local and unpushed.
- Master delivery plan revised: core reconstruction first; compiler next; MCP,
  cloud services, and proposal extensions afterward.
- Core architecture constraints for future MCP and built-in-agent support
  recorded before implementation begins.
- IDE work explicitly deferred beyond core parity, compiler, known extras, and
  future owner-selected expansion.
- Mandatory catalog and progress-update rules recorded for every capability
  change and handoff.
- Phase 0 direction approved pending a bounded renderer/memory benchmark:
  Electron + React + TypeScript, Windows-first testing, early macOS/Linux
  launch checks, renderer-independent document/command model, and TSX/Tailwind
  compiler contract.
- Memory efficiency elevated to a product requirement and future release gate.
- Repository stays private until the main Illustrator/compiler project is
  complete; no visibility change is authorized before then.
- Independent architecture review conditionally supports Electron, subject to
  the renderer/memory benchmark; no benchmark measurement or platform launch
  has been completed.
- Parity catalog v1 created with stable capability IDs, status definitions,
  minimum acceptance behavior, compiler support states, and the first proposed
  implementation slice.
- Phase 0 planning, catalog, and the benchmark harness were consolidated into
  `main`; Phase 0 itself remains open until the blocked benchmark produces
  evidence for the Electron/SVG decision.
- Benchmark harness started on `chore/renderer-memory-benchmark`: source test
  and UI production build pass. An initial Electron Builder runtime-packaging
  stall was repaired before the packaged Windows evidence run.
- Packaging was repaired and five packaged Windows synthetic-renderer runs
  completed. They show full-document SVG misses the stress interaction target;
  they do not verify real edited-document save/reopen, undo/redo, or recovery.
- Tauri comparison setup reached Rust, WebView2, Vite, and Cargo dependency
  compilation. It cannot yet produce an executable because the benchmark
  machine has no MSVC `link.exe`; two approved Build Tools installation attempts
  exited without registering Build Tools or installing that linker.
- Phase 0 platform decision completed after independent review: Electron +
  React + TypeScript + Tailwind + Vite is the development baseline; the
  full-document SVG renderer is rejected. CanvasKit/Skia is the next renderer
  candidate and must pass a bounded measured spike before editor work.
- Agent completion rule added: owner review/testing happens only after agents
  complete the approved outcome and their planned validation.
- Issue and pull-request workflow adopted (PR #21): every phase owns an epic
  issue created up front (#1–#14), sub-issues are generated when a phase starts,
  agents choose the phase's pull-request strategy, and the owner reviews, tests,
  and decides every merge. Phase 1 sub-issues #15–#20 are linked to epic #3.
- Tailwind installed as approved; `npm run typecheck` added; the Phase 0 harness
  identity is scheduled to move to the Vectr app identity in slice 2.
- Phase 1 slice 1 delivered (issue #15, branch `feat/canvaskit-renderer-spike`):
  frozen document-shaped fixtures for primitives, text, images, and nested groups
  at empty/representative/stress sizes; a WebGL CanvasKit renderer with retained
  objects, shared content-addressed fixture assets, and explicit disposal; a
  defined interaction methodology; and five packaged runs recorded in
  `.ecc/benchmarks/phase-one/`.
- Bundled Inter (SIL OFL 1.1, license included) because `canvaskit-wasm@0.42`
  exposes only `FontMgr.FromData` and no system font manager.
- Renderer spike verdict: **FAIL** — worst stress interaction p95 99.9 ms against
  the retained 33 ms target, with draw submission alone at 74.6 ms. Leak check
  passed (retained paths/images/paragraphs returned to zero after 10
  build/draw/release cycles); peak whole-app working set 817 MiB, private bytes
  995 MiB, GPU process 280 MiB across four processes. Full numbers and the gate
  definition are in `docs/PARITY_CATALOG.md` ("Renderer evidence (PERF-01)").
- Phase 1 slice 1b delivered (issue #23, branch `enhance/renderer-picture-replay`):
  a recorded-picture draw path (at most 16 Skia pictures over buckets of
  consecutive top-level roots), per-bucket invalidation for edits, cached paints
  with batch eviction, an edit scenario in the suite, per-mode verdicts, and a
  `--directory=`/`--contents=` runner for scoped evidence runs and quick checks.
  Renderer diagnostics now forward to stdout so a failed or hung run is visible.
- Optimization verdict: still **FAIL**, but the worst stress interaction dropped
  from 99.9 ms to 82.2 ms across five packaged runs. Nested groups at 10,000
  leaves now pass (34.8 → 21.4 ms), text at 1,000 nodes 32.2 → 12.4 ms, images
  3.6 → 2.5 ms, 1,000 primitives 7.5 → 7.3 ms. Text at 10,000 nodes is marginal
  (35.0 ms); 10,000 loose primitives remain the failing case. The remaining cost
  is GPU-side per-draw overhead across roughly 20,000 anti-aliased path draws per
  frame, not JS-to-WASM work. Edit cost (re-record one bucket): 1–7 ms at 1,000
  nodes, 22 ms at 10,000 text nodes, 54–61 ms at 10,000 loose primitives. Leak
  check passed in both modes; peak whole-app working set 861 MiB across four
  processes.
- The workflow and renderer stack merged into `main`: #21 (workflow), #22 (slice 1,
  `8c8f72c`), #24 (slice 1b, `325508e`), #26 (slice 1c comparison, `601c32e`), and
  #27 (small-vs-big merge policy plus mandatory self-review, `c0613de`).
- Phase 1 slice 2 delivered (issue #18, PR #30, branch `feat/document-command-core`):
  versioned document model with structural sharing (`src/doc/types.ts`,
  `document.ts`), stable rejection codes (`validate.ts`), one validated command
  path with inverse commands (`commands.ts`), bounded history with single-entry
  drag transactions (`history.ts`), pure hit testing (`hitTest.ts`), a
  paint-order scene builder (`src/render/scene.ts`), the editor renderer on the
  accepted recorded-picture path with per-bucket invalidation
  (`src/render/EditorRenderer.ts`), the editor store with one `dispatch` entry
  point (`src/state/documentStore.ts`), and the editor shell (toolbar, canvas with
  rect/ellipse tools, marquee, drag transactions, zoom/pan, layer list, shortcuts).
- The app identity is now `vectr` / `Vectr` / `com.vectr.app`, the benchmark
  runner targets `Vectr.exe`, and the Phase 1 benchmark harness stays reachable
  with `?benchmark` inside the same app.
- Slice 2 evidence: `electron . --smoke=stress` passes all nine command-path steps
  and measures 1,001 shapes in 16 recorded buckets at **render p95 1.10 ms** over
  60 frames (scene build 4.4 ms), with 48 unit tests passing and clean typecheck
  and build.
- Bugs found and fixed while building the slice: `replaceNode` never matched the
  document root (root-level inserts silently did nothing); `History` used a
  TypeScript parameter property that Node strip-only mode rejects; a locked group
  did not lock its subtree in hit testing; and a PowerShell rewrite of
  `package.json` added a UTF-8 BOM that broke the Vite build.
- Phase 1 slice 2b, the UI shell alignment (issue #28, PR #33, branch
  `feat/ui-shell-alignment`, stacked on #18): the shell is now a modern Illustrator
  rather than a placeholder — menu bar with Illustrator's menu structure
  (`src/app/MenuBar.tsx`, `menuModel.ts`), docked left tool palette with V/M/L and
  original icons (`ToolPalette.tsx`, `icons.tsx`), right panel dock with collapsible
  tabbed groups (`src/app/panels/PanelDock.tsx`), Layers panel with disclosure, eye,
  lock, and a reserved thumbnail slot (`panels/LayersPanel.tsx`), read-only
  Properties, Appearance, and Color panels, status bar, theme tokens
  (`src/styles.css` `@theme` plus `src/app/theme.ts`), one action table shared by
  menus, palette, and keyboard (`src/app/actions.ts`), an Illustrator-default
  shortcut map (`src/app/shortcuts.ts`), pure viewport arithmetic
  (`src/app/viewportOps.ts`), and workspace state split out of the document store
  (`src/state/workspaceStore.ts`) so layout changes stop waking document subscribers.
- Slice 2b evidence: `electron . --smoke=stress` passes all nine command-path steps on
  the new shell and measures 1,001 shapes in 16 recorded buckets at **render p95
  1.10 ms** over 60 frames (scene build 3.5 ms), WebGL; 64 unit tests pass (16 new
  shell tests) with clean typecheck and build.
- Slice 2b bug found and fixed by the new tests: Hide/Lock over several selected nodes
  first shared one transaction, and a transaction keeps only the first inverse, so
  undo restored one layer and left the others hidden. Flag changes now record one
  entry per node, and the aggregate-inverse fix is logged as a follow-up instead of
  changing the command model inside a UI slice.
- Phase 1 slice 2c, the aggregate inverse (issue #34, branch `feat/aggregate-inverse`):
  a transaction may contain many commands and undo/redo as one history entry. New
  `batch` command variant with an atomic fold and an inverse of the step inverses in
  reverse order (`src/doc/commands.ts`), `transactionEntry()` choosing plain, compact,
  or aggregate entries with `peekUndo()`/`peekRedo()` for the Edit menu and tests
  (`src/doc/history.ts`), and multi-object Hide/Lock back to one transaction
  (`src/app/actions.ts`) so they are one undo step as they are in Illustrator.
- Slice 2c evidence: `electron . --smoke=stress` passes 9/9 command-path steps with the
  drag still one entry and 1,001 shapes in 16 buckets at render p95 1.00 ms over 60
  frames (scene build 3.5 ms); 74 unit tests pass (10 new aggregate-inverse tests);
  clean typecheck and build.
- UI conformance pass (branch `enhance/ui-conformance`), after the owner's direction that the
  shell was drifting from Illustrator: Electron's default application menu is removed so the
  window has one menu bar instead of two, Alt+letter opens menus by mnemonic with the letter
  underlined in the title, Escape cancels instead of deselecting (Deselect stays
  Ctrl+Shift+A), panel groups gained Illustrator's flyout menu (the Layers flyout runs the
  object commands), the tool palette's invented corner letter and the status bar's revision
  counter are gone, and panel tabs are sentence case. Sixteen divergences remain live, all of
  them features Vectr does not have yet rather than styling chosen differently.
- Phase 1 slice 3, layers, groups, and ordering (issue #20, branch `feat/layers-groups`,
  PR #37): Group, Ungroup, the four Arrange commands, and Layers-panel drags are plans
  composed from `insertNodes`/`moveNode`/`removeNodes` (`src/app/arrange.ts`,
  `src/app/layerDrag.ts`), so no document command was added and each gesture is one undo step
  through the #34 aggregate inverse. The Layers panel became interactive (drag reorder and
  drop-into-group with Illustrator's before/inside/after targets, Shift range selection,
  double-click/F2 rename, Delete, arrow-key navigation) and both the canvas and a layer row
  gained Illustrator's right-click object menu (`src/app/ContextMenu.tsx`,
  `contextMenus.ts`). Object and Type menus gained a real submenu (Object > Arrange). The
  deferred `locked` validation code now exists and is inherited from ancestors, so a locked
  layer refuses transform, style, move, delete, and drops into it; `isLocked` replaces the
  `invalid-parent` wart recorded in #18.
- Slice 3 evidence: `electron . --smoke=stress` passes 13/13 steps including `group is one
  entry` (4 → 5 history depth, two top-level layers become one), `group selected and nested`,
  and `undo ungroups in one step`, with 1,002 shapes in 16 buckets at render p95 1.20 ms over
  60 frames; 88 unit tests pass (12 new for this slice) with clean typecheck and build.

## Next

- **Renderer gate amended by measurement (issue #25).** A candidate comparison ran
  end to end with criteria frozen before measurement, five packaged runs per
  candidate, on the same fixtures and protocol:
  - CanvasKit recorded-picture: 1,000 live layers 5.7 ms (pass), 10,000-leaf nested
    groups 19.2 ms (pass), 10,000 loose primitives 89.8 ms (**fail**); peak working
    set 861 MiB with a 271 MiB GPU process.
  - `vello_cpu` 0.3.0 built for wasm32 with SIMD128 (VectorCraft's rasterizer):
    1,000 live layers 8.3 ms (pass), 10,000-leaf groups 39.3 ms (fail), 10,000 loose
    primitives 125.6 ms (**fail**); peak working set 727 MiB; leak-clean.
  - VectorCraft's own native bench on this machine: 37.2 ms for 20,000 simpler
    shapes at 2880×1800 with worker threads (their README claims ~27 ms).
  - Not measured, not claimed: resvg-wasm/tiny-skia and CanvasKit WebGPU.
  - Outcome: no measured candidate meets 33 ms on 10,000 loose always-visible
    primitives, so the gate is **amended, not met**; CanvasKit recorded-picture is
    accepted with published limits and `PERF-01` stays open with revisit triggers.
    Evidence: `.ecc/benchmarks/renderer-comparison/`.

## Next

- **Owner action: review and merge the aggregate-inverse pull request** (issue #34):
  a transaction may now contain many commands and undo/redo as one entry, and
  multi-object Hide/Lock are one undo step again. Classified big: it changes the
  command/undo model. Merged already: #21, #22, #24, #26, #27, #29, #31, #32, #30
  (slice 2), #33 (UI shell alignment).
- The UI shell alignment is merged (issue #28, PR #33), so the menu bar, tool palette,
  panel dock, theme tokens, and Illustrator-default shortcut map are the shell Phase 2
  builds into. `UI-01` stays `building` until save/reopen and platform coverage exist
  (#19) and the eighteen live divergences shrink.
- After #34: Phase 1 continues in order: #20 (layers and groups: interactive tree,
  reorder, group/ungroup, rename — composed edits are now one undo step), #16 (plain
  text), #17 (images), #19 (durable local documents, which also retires the missing
  File menu).
- If #34 is declined, the fallback is the #28 behavior: one history entry per node for
  multi-object flag changes, which is correct but diverges from Illustrator.
- **UI direction recorded and enforced (PRs #29 and #31).** Vectr's interface is a
  modern Illustrator (`AGENTS.md`, Product identity; `docs/DECISIONS.md`, 2026-10-14;
  catalog `UI-01`). Interface work must state its Illustrator mapping in its issue and
  pull request, divergence needs a recorded reason, and Adobe or VectorCraft assets,
  screenshots, or branding are never used.
- Issue #28 owns the shell alignment (menu bar, left tool palette, right panel dock,
  theme tokens, Illustrator-default shortcuts) and must land before Phase 2 adds
  tools, so no tool is built twice. Issue #20 must build the Illustrator-style Layers
  panel, docked in the same layout, with per-row visibility and lock.
- After #18 merges, Phase 1 continues in order: #20 (layers and groups), #16 (plain
  text), #17 (images), #19 (durable local documents) — one branch and one pull
  request each, with the UI mapping recorded for the slices that have an interface.
- `PERF-01` revisit triggers: wasm threads with COOP/COEP isolation, Phase 4
  profiling with culling and retained regions on realistic documents, or an
  owner-approved revision of the 10,000-loose-primitive limit.

## Known issues

- No automated end-to-end test covers the GUI. The editor smoke run
  (`electron . --smoke=stress`) is the current evidence path; a GUI test harness is
  an open choice.
- Graphify is installed, but no knowledge graph exists until source code is added.
- The layer list is read-only until #20: reorder, group/ungroup, multi-select, and
  nesting are not interactive yet.
- `cornerRadius` is in the document model but a rectangle still draws with square
  corners until a later slice adds rounded-rect rendering.
- Nothing is persisted yet: the document lives in memory until #19 adds new/open/
  save with a versioned manifest and asset directory.
- Full-document SVG misses the stress interaction target. CanvasKit is measured and
  the accepted recorded-picture path is inside budget up to 1,000 live layers, but
  10,000 loose always-visible primitives remain a published limit (`PERF-01`).
- CanvasKit raises the measured peak whole-app working set to 817 MiB on the
  combined fixture run (four processes, GPU process 280 MiB), so the shell memory
  question stays open alongside the renderer decision.
- The deferred Tauri comparison still cannot build on this machine (no MSVC linker);
  it is non-blocking and the temporary harness sits outside the repo.
- `.ecc/tmp/*` scratch files and `.ecc/issues/*.md` (issue bodies used for creation)
  remain untracked working files.
- The shell now follows the UI direction, with fourteen live divergences from Illustrator
  (`docs/DECISIONS.md`, UI shell alignment). The load-bearing ones: Properties, Appearance,
  and Color are read-only because style and transform commands do not exist yet; the File menu
  is absent until #19 adds documents; there are no rulers, guides, or saved workspaces; panel
  thumbnails, the target/locate column, and dragging a layer into another layer are unbuilt.
  Five divergences have been closed since #28: the per-node undo aggregation (#34), Escape
  deselecting, the missing Alt menu mnemonics, the read-only layer tree (#20), and the missing
  context menus (#20).