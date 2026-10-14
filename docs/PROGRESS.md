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

## Next

- **Owner decision required on the renderer gate.** The approved Phase 1 plan
  pauses editor work after a failed spike. The measured position: CanvasKit is
  far faster than the rejected full-document SVG path, 1,000-layer, image, and
  nested-group documents are well inside 33 ms, and only the 10,000-node
  primitives and text fixtures miss it. Options:
  1. Fund a renderer optimization slice before editor work: viewport culling,
     retained layer caching/reuse, and paint-object reuse to remove per-item
     JS-to-WASM state churn, then re-run the same fixtures and definition.
  2. Accept CanvasKit with a revised, evidence-based stress target or a
     documented stress limit (for example "1,000 fully visible layers at 33 ms,
     10,000 with culling"), which changes a Phase 0 decision and needs to be
     logged as such.
  3. Compare another renderer candidate (batched WebGL or a tiled/hybrid
     approach) against the same fixtures before choosing.
  4. Proceed with editor slices 2–6 on CanvasKit as an accepted risk and revisit
     performance in Phase 4 profiling.
- After that decision, execute Phase 1 slices 2–6 in order: #18 document,
  commands, shapes, selection; #20 layers and groups; #16 plain text; #17 images;
  #19 durable local documents.

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
