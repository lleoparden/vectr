<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Vertical text** joins point,
area, path, and threaded text, and the native format moves to **v11**.

### What changed

- **Vertical Type** (Type menu). Select point text and toggle it vertical: characters stack downward one font size per
  row, each line becomes a new column, and the box becomes columns wide by longest-column tall. Selecting several text
  objects toggles them together as one undo entry, and area or path frames keep their authored box.
- **Format v11.** `orientation` is optional, so v1–v10 documents open unchanged; older builds refuse v11 rather than
  drawing vertical text horizontally.
- **Measurement parity.** The renderer and the pre-render estimate share the same vertical rule (one font size per
  character, one column per line), so the box does not jump after the first frame.

### What is in this build

Everything from **0.5.4** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point/area/path/threaded text — plus transforms, gradients, blend modes, artboards, layers, images, autosave, and
crash recovery.

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
npm test           # layer check, 384 unit tests, UI standards
npm run build
npm run smoke      # 167 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Vertical Latin is stacked upright, not rotated** the way Illustrator rotates some scripts; vertical punctuation,
  tate-chu-yoko, and bidirectional layout are not implemented, and the editing overlay stays a rectangle.
- Area text has no inset, columns, or handle resize; path text is centred with copied geometry.
- Threading is one-shot: editing afterwards does not redistribute, there is no unlink UI, and only the first link is
  recorded.
- Point-text insertion remains the box's top-left rather than Illustrator's baseline.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **384 unit tests**, production build, and **167 packaged steps** across six reports.
- New packaged step toggles a point-text object vertical and asserts the box becomes taller than it is wide, then
  undoes.
- Unit tests pin the vertical column maths (`abc` at 16 → 16×48, `ab\nc` → 32×32), the toggle command and its
  inverse, and area frames keeping their box.

</details>
