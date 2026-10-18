# Vectr alpha

**The rolling pre-release, republished automatically on every merge to `main`.**

Vectr is a desktop-first vector design tool with Illustrator's conventions and its own React + Tailwind
compiler. It is alpha software: the editor is usable, the compiler is not built yet, and every limitation is
written down rather than hidden.

- **Website**: https://lleoparden.github.io/vectr/
- **What works today**: [docs/AUDIT.md](AUDIT.md)
- **How it is verified**: [docs/PROGRESS.md](PROGRESS.md)

## Download and run

This alpha ships as source; there is no installer yet.

`bash
git clone https://github.com/lleoparden/vectr.git
cd vectr
npm install
npm start
`

Requires Node.js 22+ and npm. Windows is the reference platform; macOS and Linux are Phase 9.

## State of the build

| Area | State |
| --- | --- |
| Document model, undo/redo, autosave, crash recovery | Working |
| Twelve tools, transforms, rotation, artboards, rulers, guides | Working |
| Paint: fills, strokes, gradients, sixteen blend modes, CMYK swatches | Working |
| Layers: reorder, nest, lock, thumbnails, locate, drag-into-group | Working |
| Text | Point text only |
| Paths, pen, boolean operations | Phase 5, next |
| SVG, PDF, `.ai` interchange | Phase 8 |
| React + Tailwind compiler | Phase 10 |

## Known limits, stated

No Bezier path node or pen tool yet; no boolean operations or width profiles; point text only; no mesh,
patterns, or brushes; the native format is the only file format; Windows only for now; no compiler output yet.
The full list, row by row, is in [docs/AUDIT.md](AUDIT.md).

## Evidence

272 unit tests, a layer-architecture check, a UI-standards check, a production build, and a packaged Electron
run of 143 steps across seven reports. The details are in [docs/PROGRESS.md](PROGRESS.md).

---

_This release is regenerated from `docs/RELEASES.md` by `.github/workflows/alpha-release.yml` on every push to
`main`, so it always describes the current `main`. It is marked as a pre-release because it is not a stable
release._
