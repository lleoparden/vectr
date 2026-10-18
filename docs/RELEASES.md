<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a>

Windows x64 · per-user install · 95 MB · unsigned, so SmartScreen warns once

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. This release closes
**Phase 4**: tools as state machines, real rotation, hover and cursors, the component kit, and the rose palette.

### What is in this build

- Twelve tools, transforms, rotation, the Zoom tool, undo/redo, autosave and crash recovery
- Paint: fills, strokes, gradients with eight stops, all sixteen blend modes, CMYK and spot swatches
- Artboards, rulers, grid, guides; layers with locate, nested previews, and drag-into-group
- Align and Transform panels; point text; images with crop and masks
- The **rose palette** across the editor and the site

<details>
<summary><strong>Install, requirements, and other ways to run it</strong></summary>

#### Install on Windows

1. Download `Vectr-<version>-Setup.exe` from the assets below and run it.
2. SmartScreen warns that the publisher is unknown: the installer is **not code-signed**. Choose "More info"
   and "Run anyway" if you trust the source.
3. It installs per-user (no admin prompt) and creates a Start-menu shortcut.

#### Run from source

```bash
git clone https://github.com/lleoparden/vectr.git
cd vectr && git checkout v<version>
npm install && npm start
```

Requires Node.js 22+ and npm. Windows is the reference platform; macOS and Linux are Phase 9.

</details>

<details>
<summary><strong>Known limits, stated rather than hidden</strong></summary>

No Bezier path node or pen tool yet; no boolean operations or width profiles; point text only; no mesh or
patterns; the native format is the only file format; Windows only; no compiler output yet. The row-by-row list
is [docs/AUDIT.md](https://github.com/lleoparden/vectr/blob/main/docs/AUDIT.md).

</details>

<details>
<summary><strong>How this build was verified</strong></summary>

272 unit tests, a layer-architecture check, a UI-standards check, a production build, and a packaged Electron
run of 143 steps across seven reports. Details:
[docs/PROGRESS.md](https://github.com/lleoparden/vectr/blob/main/docs/PROGRESS.md).

</details>

<sub>Tag `v<version>` is immutable: it and this installer always describe the same commit. Previous versions
stay downloadable from [the releases page](https://github.com/lleoparden/vectr/releases).</sub>
