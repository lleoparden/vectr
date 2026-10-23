<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. This patch makes the Phase 5
tools behave the way the panel says they do, and finishes the icon and interface pass that shipped with 0.5.0.

### What changed

- **Shape Builder works on overlaps.** It used to see only the topmost object under the pointer, so a drag across two
  shapes collected one and replaced it with an identical path — which looks like nothing happened. It now collects
  **every** shape under each point. A click on an overlap merges exactly that region and leaves the untouched faces as
  their own paths.
- **Live Paint paints with your current fill.** It used the creation default, which on a new document matches the
  shapes, so painting looked dead. The bucket now uses a single selected object's fill (falling back to the creation
  default), and on a lone shape it recolours that shape instead of stacking an identical path on top.
- **The Phase 5 icons are redrawn.** Pen, Shape Builder, Live Paint, and Width had been drawn on a 24-unit grid while
  the icon viewBox is 16, so their strokes were clipped — Width read as a bare vertical line. All four are now simple
  forms inside the grid.
- **Palette and status fit Illustrator.** Hand sits at the foot of the palette instead of second, the active slot's
  shadow is the rose accent rather than a leftover purple, the status bar prints Pen, Shape Builder, Live Paint, and
  Width by name, and each of those tools has an options-bar hint.

### What is in this build

Everything from **0.5.0**: paths with curves, Pen, anchor editing, curve-preserving Pathfinder, Divide, Shape
Builder, Live Paint, compound paths, Simplify, Outline Stroke, Offset Path, live shape reshaping, and width profiles
with the Shift+W Width tool — plus transforms, rotation, gradients, blend modes, artboards, layers, text, images,
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
npm test           # layer check, 356 unit tests, UI standards
npm run build
npm run smoke      # 162 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Live Paint paints regions, not edges**, and each painted region is its own path rather than a live-paint group.
- **Divide, Shape Builder, and Live Paint use flattened faces**; the four boolean modes keep curves.
- **Outline Stroke does not outline a compound's own stroke.**
- **Width profiles are per anchor**, not per point; curves are flattened, and alignment/dashes are not applied to a
  profiled stroke. The Width tool edits the nearest anchor.
- **Live shape reshaping** applies to unrotated, unscaled parametric shapes; corner-radius widgets are a field.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **356 unit tests**, production build, and **162 packaged steps** across six reports.
- New packaged steps click an overlap with Shape Builder and assert three resulting faces, and repaint a lone rose
  rectangle with a contrasting bucket fill; both then undo.

</details>
