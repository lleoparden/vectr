<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Create Outlines** lands with
our own TrueType reader, so text can become geometry for export.

### What changed

- **Create Outlines** (Type menu, **Ctrl+Shift+O**). Selected text becomes a compound path of its glyph outlines, drawn
  with the text's fill and in the same place, size, and rotation. One command, one undo entry.
- **A real TrueType reader.** CanvasKit exposes glyph metrics but not outlines, so `src/geom/ttf.ts` reads the bundled
  Inter face directly: `cmap`, `loca`/`glyf` (simple and composite glyphs), `hmtx` advances, and ascender, with
  quadratic curves converted to cubic handles. It is pure geometry and tested without a GPU.
- **No new dependency, no Adobe internals.** The font is the one the editor already ships and draws with.

### What is in this build

Everything from **0.5.5** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point/area/path/threaded/vertical text — plus transforms, gradients, blend modes, artboards, layers, images,
autosave, and crash recovery.

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
npm test           # layer check, 387 unit tests, UI standards
npm run build
npm run smoke      # 168 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Outlines use the font's default variation master** — weight/width axes are not applied — and **ignore kerning** in
  pen positions.
- Only **horizontal text** is outlined; vertical and path text are skipped rather than outlined wrongly.
- Outlines are paths: **text editing ends** at the command, and the compound keeps nonzero winding for counters.
- Vertical Latin remains an upright stack; area text has no inset/columns; threading is one-shot; point-text insertion
  is the box's top-left rather than Illustrator's baseline.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **387 unit tests**, production build, and **168 packaged steps** across six reports.
- New packaged step outlines a 48 pt "Ab" and asserts the resulting path, then undoes.
- Unit tests parse the bundled font (cmap, ascender, glyph count), check that contours convert to finite cubic anchors,
  that Inter's curved **S** carries handles where its straight **A** does not, and that advance widths grow with text
  and size.

</details>
