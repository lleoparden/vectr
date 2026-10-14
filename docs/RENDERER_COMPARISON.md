# Renderer candidate comparison (PERF-01)

Owner-ordered comparison, Phase 1 slice 1c. This file is written **before** any
candidate is measured. Nothing in it changes after results exist.

## Why this comparison exists

Phase 0 set a 33 ms stress interaction gate. Slice 1b (recorded-picture CanvasKit
replay) reached 82.2 ms p95 on 10,000 loose primitives, and the diagnosis was
GPU-side per-draw cost across roughly 20,000 anti-aliased path draws per frame.
The owner reopened the gate with new evidence: VectorCraft's README states
"Multithreaded SIMD rendering off the UI thread. 20,000 shapes render in about
27 ms at full retina resolution while the interface stays at 120 fps"
(`README.md` lines 136–137). A CPU rasterizer that costs per tile rather than per
draw would not pay the cost we measured, so "every renderer hits the same wall"
was unproven.

## Reference research (VectorCraft, MIT OR Apache-2.0, read-only)

Cloned to `L:\vectrcraft-ref` (outside this repository) on 2026-10-14. Findings
are behavior evidence only — no source is copied into Vectr:

- **Engine:** `crates/render/src/lib.rs` line 3: "The backend is `vello_cpu`
  (SIMD, sparse strips)." `vello_cpu` is on crates.io (0.3.0: "A CPU-based
  renderer for Vello, optimized for SIMD and multithreaded execution").
- **Threads:** `Renderer.threads: u16` ("Worker threads for the multithreaded
  rasterizer (0 = single-threaded)"), wired into
  `vello_cpu::RenderSettings { num_threads }`. CMYK composition is banded across
  threads with `std::thread::scope` (`ink.rs`).
- **Retention:** a `RenderContext` is reused across frames; filter layers render
  offscreen on the calling thread when the main context is multithreaded.
- **Culling:** the bench prints `drawn` and `culled`, so viewport culling is part
  of their measured path.
- **Their bench fixture** (`crates/render/examples/bench.rs`): 20,000 shapes
  (ellipse fill + 0.5 stroke, rectangle fill at 0.8 opacity, 5-point star stroke
  2.0) randomly placed in a 1600×1200 document, plus 1,000 point-text labels; one
  warm-up render, then `ITERS` renders averaged (default 5) at "fit 2880x1800"
  (scale 1.6), "zoom 400% 2880x1800" (scale 6.4), and "thumb 400x300" (0.25).
- **Fixture weight difference:** their shapes are simple primitives (4–10 points).
  Our `primitives/stress` fixture is 10,000 shapes at 10 line segments (rect) or
  40 (ellipse), drawn fill **and** stroke — about 255,000 line segments and 20,000
  draw ops, materially heavier per shape. Recorded as a difference, not adjusted
  for.
- **Their native bench could not run here**: building needs the MSVC linker and
  this machine has no `link.exe` (the same Phase 0 Tauri blocker). The exact
  failure is recorded in the pull request; no native reference number is claimed
  from this machine.

## Frozen pass/fail criteria

A candidate **passes** only if all of the following hold on the frozen fixtures,
with the slice 1b gate definition and measurement protocol:

1. `primitives/representative` (1,000 live layers): interaction p95 ≤ 33 ms.
2. `groups/stress` (10,000-leaf nested groups): interaction p95 ≤ 33 ms.
3. `primitives/stress` (10,000 loose primitives, ~255k segments): interaction
   p95 ≤ 33 ms.
4. Leak check: retained objects return to zero after 10 build/draw/release cycles.
5. Memory recorded (peak working set over all application processes); a candidate
   that only passes while exceeding 2× the CanvasKit baseline working set is
   flagged as a memory regression even when it is fast.

Fixed in advance: 33–36 ms counts as a **miss** (marginal, not a pass).
`interactionMs` is exactly slice 1b's definition — viewport change, frame
production, flush — excluding fixture build, React rendering, and the vsync wait.
Fixtures, thresholds, protocol, and this definition do not change after results
exist. A candidate that cannot be measured fairly is marked **not comparable** with
the concrete reason recorded.

## Candidates

| # | Candidate | Why it is in the set | Fairness caveats |
| --- | --- | --- | --- |
| A | CanvasKit WebGL recorded-picture replay (slice 1b) | Baseline that must be beaten | None |
| B | `@resvg/resvg-wasm` 2.6.2 (tiny-skia CPU scanline rasterizer, WASM) | Same class as VectorCraft's CPU rasterizer: per-tile/per-scanline cost instead of per-draw GPU cost | Single-threaded; no sparse strips |
| C | `vello_cpu` 0.3.0 (VectorCraft's actual engine) built for `wasm32-unknown-unknown` with SIMD128 | Tests the exact engine behind the 27 ms claim | Single-threaded here: wasm threads need SharedArrayBuffer plus COOP/COEP isolation, which this packaged harness does not enable. Recorded as a known handicap, not adjusted away |
| D | CanvasKit WebGPU (Graphite-style) surface | GPU alternative suggested by the owner | Included only if a probe renders and presents through Electron's WebGPU; otherwise **not comparable** with the recorded reason |
| E | VectorCraft's native `bench` example | Reference number on this machine | **Not comparable**: no MSVC linker; recorded as attempted |

Geometry parity rule: candidates B and C receive the **same deterministic geometry**
as fixture A — identical placement, sizes, and segment counts mirrored from
`src/bench/fixtures.ts` — so the comparison measures rasterizers, not fixtures.

## Measurement protocol (unchanged from slice 1b)

- Packaged Windows release, five runs per candidate, developer tools closed.
- `interactionMs` p95 across the five runs decides criteria 1–3.
- Leak check per candidate: 10 build/draw/release cycles with retained objects
  returning to zero.
- Memory: process working set summed over all application processes, GPU process
  reported separately.
- Evidence per candidate in `.ecc/benchmarks/renderer-comparison/<candidate>/`.
- Full numbers and the decision are recorded in `docs/DECISIONS.md` as an explicit
  amendment to the Phase 0 gate, and `PERF-01` stays open with a revisit trigger.

