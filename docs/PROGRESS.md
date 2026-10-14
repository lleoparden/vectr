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

- **Owner action: review and merge PR #30** (Phase 1 slice 2, issue #18 — versioned
  document, validated command path, bounded undo/redo, editor store, renderer, and
  editor shell). It is classified big: it sets the command/undo model, the app
  identity, and the interfaces slices 3–6 build on. Merged already: #21, #22, #24,
  #26, #27, #29, #31.
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

- No production editor code or GitHub labels exist yet.
- Graphify is installed, but no knowledge graph exists until source code is added.
- Full-document SVG misses the stress interaction target. CanvasKit is now
  measured and also misses it on the 10,000-node stress fixtures; the spike has no
  viewport culling or retained layer cache, and the diagnosis points at per-item
  call and state overhead.
- CanvasKit raises the measured peak whole-app working set to 817 MiB on the
  combined fixture run (four processes, GPU process 280 MiB), so the shell memory
  question stays open alongside the renderer decision.
- The current Windows benchmark machine lacks the MSVC linker required to
  compile Tauri. Its comparison is deferred and non-blocking; the temporary
  harness and dependencies are outside the repo.
- The uncommitted Phase 0 harness identity (`vectr-phase-zero-benchmark`,
  `com.vectr.phase-zero-benchmark`, "Vectr Phase Zero Benchmark") is still in
  place; the rename to the Vectr app identity is part of slice 2.
- `.ecc/tmp/canvaskit-smoke.json` (informal single-run smoke evidence) and
  `.ecc/issues/*.md` (issue bodies used for creation) remain untracked working
  files.
- The shell does not yet meet the modern-Illustrator UI direction recorded in
  `docs/DECISIONS.md` (2026-10-14). Slice 2 ships a top toolbar plus a plain layer
  list, not a menu bar, left tool palette, and right-docked panels. Issue #20 owns
  the layer tree and panel layout; issue #28 owns the menu bar, tool palette, and
  docked panels, and must land before Phase 2 adds tools.
