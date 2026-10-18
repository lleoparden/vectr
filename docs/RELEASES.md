# Vectr <version>

**A pre-release, one per phase.** This build is `v<version>`, built from the commit the tag points at.

Vectr is a desktop-first vector design tool with Illustrator's conventions and its own React + Tailwind
compiler. It is alpha software: the editor is usable, the compiler is not built yet, and every limitation is
written down rather than hidden.

- **All releases**: https://github.com/lleoparden/vectr/releases
- **Website**: https://lleoparden.github.io/vectr/
- **What works today**: [docs/AUDIT.md](AUDIT.md)
- **How it is verified**: [docs/PROGRESS.md](PROGRESS.md)

## Install on Windows

Download **`Vectr-<version>-Setup.exe`** from this release's assets.

1. Run the setup file and choose an install location (per-user, no admin prompt).
2. Windows SmartScreen will warn that the publisher is unknown: the installer is **not code-signed**. Choose
   "More info" and then "Run anyway" if you trust the source.
3. Vectr opens; `File ▸ Save` writes a `.vectr/` project folder.

Each phase gets its own version and its own release, and an older installer stays downloadable: pick the version
you need and its tag will always return the same build.

## Run from source

```bash
git clone https://github.com/lleoparden/vectr.git
cd vectr
git checkout v<version>
npm install
npm start
```

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

_Published by `.github/workflows/release.yml` from `docs/RELEASES.md` and `package.json`. The tag is never moved,
so this page and its installer always describe the same commit. Marked as a pre-release because it is not a
stable release._
