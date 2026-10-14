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
## Results (measured on the frozen fixtures, five packaged runs each)

Machine: AMD Ryzen 5 9600X · 15.16 GiB · Windows 11 Pro · Electron 35.7.5 / Chromium
134 · packaged Windows release. Evidence:
`.ecc/benchmarks/renderer-comparison/canvaskit/` and
`.ecc/benchmarks/renderer-comparison/vello/`.

| Fixture (criterion) | CanvasKit picture (A) | vello_cpu wasm, SIMD, 1 thread (C) |
| --- | --- | --- |
| primitives / 1,000 live layers (1) | **5.7 ms — pass** | **8.3 ms — pass** |
| groups / 10,000-leaf nested (2) | **19.2 ms — pass** | 39.3 ms — fail |
| primitives / 10,000 loose, ~255k segments (3) | 89.8 ms — **fail** | 125.6 ms — **fail** |
| text / 10,000 nodes (informational) | 35.6 ms — miss | not measured |
| images / 1,000 (informational) | 2.1 ms | not measured |
| Leak check (4) | pass (retained objects → 0) | pass (wasm shapes → 0) |
| Memory, criterion 5 | 861 MiB working set · 1035 MiB private · 271 MiB GPU · 4 procs | 727 MiB working set · 575 MiB private · 4 procs |

CanvasKit context: the same protocol measured 82.2 ms (recorded, #23), 85.7 ms
(machine re-check), and 89.8 ms here — 82–90 ms run-to-run variance on the
10,000-primitive fixture.

Reference (candidate E, not comparable — different fixture, resolution, and native
multithreaded execution): VectorCraft's own bench on this machine produced
`20000 objects, fit 2880x1800: 37.2 ms/frame (drawn 19923, culled 1078)`,
`zoom 400%: 13.1 ms (drawn 1650, culled 19351)`, `thumb 400x300: 22.2 ms (drawn
21001, culled 0)`. Their README quotes "about 27 ms"; this machine measured 37.2 ms
for 20,000 **simpler** shapes (4–10 points each) at 2880×1800.

## Candidates not measured in this pass

| Candidate | Status | Reason |
| --- | --- | --- |
| B — `@resvg/resvg-wasm` 2.6.2 (tiny-skia CPU) | **not measured** | The dependency is installed and the interface exists, but the harness pass ended before its SVG-scene target was built and run. No number is claimed for it. |
| D — CanvasKit WebGPU (Graphite-style) | **not attempted** | `canvaskit-wasm@0.42` exposes GPU-device and GPU-texture surface constructors, but presenting them requires an application-managed WebGPU device plus a texture presentation path in the harness — a renderer change of its own, not a measurement. Unverified in a packaged Electron `file://` app. |

## Decision (applying the frozen criteria)

- Criterion 1 passes for both measured candidates; criterion 2 passes only for
  CanvasKit; **no measured candidate passes criterion 3** (10,000 loose
  primitives). Criterion 4 passes for both. Criterion 5 is satisfied by both, with
  CanvasKit 18% higher on working set.
- **Recommendation: accept the recorded-picture CanvasKit path with the documented
  limit** (the branch the criteria pre-committed to when nothing passes), and keep
  `PERF-01` open with a revisit trigger. See `docs/DECISIONS.md` for the amendment.
- The measured reason the VectorCraft-style CPU path does not close the gap here is
  **threading, not the rasterizer**: their native bench uses worker threads
  (`Renderer.threads` → `vello_cpu::RenderSettings { num_threads }`), and their
  full-retina figure is 37.2 ms for a lighter fixture. Our wasm build runs one
  thread because wasm threads need `SharedArrayBuffer` plus COOP/COEP isolation,
  which this harness does not enable.
- Revisit triggers for `PERF-01`: (a) a wasm-threads + COOP/COEP harness that
  measures `vello_cpu` with 4–8 workers on the same fixtures; (b) viewport culling
  and retained-region caching measured on a realistic document (Phase 4 profiling);
  (c) any owner-approved revision of the 10,000-loose-primitive limit.


