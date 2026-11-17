<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Phase 6 (Type) is closed in
scope**: point, area, path, threaded, and vertical text, Create Outlines, and missing-font resolution. The format is at
**v12**.

### What changed in this phase

- **Point text** with in-place editing, alignment that keeps the insertion anchor fixed, and ink-height bounds
  (ascent + descent + leading), matching Illustrator's measured box rather than `lines × leading`.
- **Area text**: drag with the Type tool to author a frame; text wraps at word boundaries, long words break by
  character, overflow is clipped, and content/style edits keep the frame.
- **Text on a path**: click a filled path with the Type tool; glyphs are centred along it and rotate to the tangent.
- **Threaded text with live reflow**: Thread Text links area frames into a chain; editing the head's story
  redistributes every frame in one undo, and Type ▸ Reflow Thread recomputes on demand.
- **Vertical type**: an upright stack, one column per line, with area/path frames keeping their box.
- **Create Outlines** (Ctrl+Shift+O) via **our own TrueType reader** — cmap, loca/glyf, hmtx, quadratic-to-cubic —
  because CanvasKit exposes glyph metrics but not outlines.
- **Resolve Missing Fonts**: lists absent families and substitutes them with Inter in one undo.
- **Format evolution v8 → v12**, each field optional so older documents open unchanged.

### What is in this build

Everything from **0.5.x** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles —
plus transforms, gradients, blend modes, artboards, layers, images, autosave, and crash recovery.

<details>
<summary><strong>Install, requirements, and other ways to run it</strong></summary>

#### Install on Windows

1. Download `Vectr-<version>-Setup.exe` and run it.
2. SmartScreen warns that the publisher is unknown: the installer is **not code-signed**. Choose "More info" and
   "Run anyway" if you trust the source.
3. It installs per-user (no admin prompt) and creates a Start-menu shortcut.

#### Install on macOS

Download **`Vectr-<version>-arm64.dmg`** on Apple Silicon or **`Vectr-<version>-x64.dmg`** on an Intel Mac.

1. Open the DMG and drag **Vectr** into **Applications**.
2. First launch may warn that the app is from an unidentified developer or is **damaged**; it is neither corrupt nor
   signed by Apple — it is **ad-hoc signed** and still carries the download quarantine.
3. Clear the quarantine once and open it:

   ```bash
   xattr -cr /Applications/Vectr.app
   open /Applications/Vectr.app
   ```

   Or right-click the app, choose **Open**, and confirm once.

#### Run from source

```bash
npm install
npm run dev        # Vite + Electron with hot reload
npm test           # layer check, 392 unit tests, UI standards
npm run build
npm run smoke      # 170 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Character/paragraph style presets are the Phase 6 exception.** Per-range character styles need a rich-text run
  model (runs in the document, run-aware rendering and editing, run-scoped commands); text styling remains per object.
- **Tab stops are documented-only**: Illustrator 27.3.1's scripting API cannot set them, recorded in the oracle
  fixtures rather than guessed.
- Vertical Latin is an **upright stack**, not rotated; no vertical punctuation, tate-chu-yoko, or bidirectional layout.
- Threading is live but has **no unlink UI**; a continuation's edit stays local until the next reflow, and hidden
  overflow past the last frame is not marked.
- Create Outlines uses the **default variation master**, ignores kerning, and only outlines horizontal text.
- Point-text insertion is still the box's top-left, not Illustrator's baseline.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **392 unit tests**, production build, and **170 packaged steps** across six reports.
- The packaged run covers every Phase 6 path: area-frame creation, path-text creation, threading plus reflow,
  vertical toggle, Create Outlines, and the missing-fonts dialog.
- `npm run verify:artifact` asserts the Phase 6 contract now (command ids and fields) against the staged build, and
  writes a receipt with the ASAR and bundle hashes.

</details>
