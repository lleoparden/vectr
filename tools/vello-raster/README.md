# vello-raster-bench

Measurement scaffolding for the Phase 1 renderer comparison (issue #25). It wraps
`vello_cpu` 0.3.0 — the rasterizer VectorCraft uses (`crates/render/src/lib.rs`:
"The backend is `vello_cpu` (SIMD, sparse strips)") — behind a raw C ABI so the
packaged Electron harness can measure it without wasm-bindgen tooling.

This is not Vectr product code. Nothing here ships in the editor.

## Build

```powershell
$env:RUSTFLAGS = '-C target-feature=+simd128'
cargo build --release --target wasm32-unknown-unknown
Copy-Item target/wasm32-unknown-unknown/release/vello_raster_bench.wasm ../../src/bench/vendor/vello_raster.wasm
```

`Cargo.lock` is committed so the measured binary version is reproducible.

## What it exposes

`vc_new`, `vc_free`, `vc_alloc`, `vc_scene`, `vc_clear_scene`, `vc_shape_count`,
`vc_begin`, `vc_draw`, `vc_render`, `vc_byte_len`, `vc_width`, `vc_height`.

## Recorded handicaps (not adjusted for in the comparison)

- **Single-threaded** (`num_threads: 0`): wasm threads require `SharedArrayBuffer`
  plus COOP/COEP cross-origin isolation, which the measurement harness does not
  enable. VectorCraft's native bench runs workers.
- **No culling**: every frozen fixture node is inside the 1200×800 viewport, so
  culling could not change the result.
- **Pixel copy-out per frame**: the harness copies the premultiplied pixmap into a
  canvas, which any CPU rasterizer must do to present a frame.
- Geometry parity is structural: vertices come from the same
  `primitiveLocalPoints` list the CanvasKit baseline uses, and item transforms are
  applied per frame as the baseline does per item.
