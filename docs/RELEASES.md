<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. Phase 6 has begun: this patch
adds **area text** and the first point-text parity work, and moves the native format to **v8**.

### What changed

- **Area text.** Drag with the Type tool to author a fixed text frame. Text wraps inside its width at word
  boundaries (long words break by character), lines past the frame height are clipped, and content or style edits
  keep the authored box. A click still places point text, exactly like Illustrator's Type tool.
- **Point-text parity.** Changing left/centre/right alignment now keeps the **insertion anchor** fixed and moves the
  box around it, and the measured box uses Illustrator's **ink height** (ascent + descent + leading per extra line)
  instead of `lines × leading`. Undo restores the exact position, not just the alignment.
- **Format v8.** `textType: 'area'` is optional, so v1–v7 documents open unchanged; older builds refuse v8 rather
  than drawing area text as point text.

### What is in this build

Everything from **0.5.1** — paths, Pen, anchor editing, curve-preserving Pathfinder, Divide, Shape Builder, Live
Paint, compound paths, Simplify, Outline Stroke, Offset Path, live shapes, width profiles with the Width tool, and
the Phase 5 tool fixes — plus point/area text with in-place editing, transforms, gradients, blend modes, artboards,
layers, images, autosave, and crash recovery.

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
npm test           # layer check, 373 unit tests, UI standards
npm run build
npm run smoke      # 164 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Area text has no inset, columns, threading, or overflow indicator**, and its frame is not resized by handles
  yet; content edits keep the authored box and overflow is clipped.
- **Point-text insertion is stored as the box's top-left**, not Illustrator's baseline; alignment reproduces the
  anchor behaviour without redefining `transform.y`.
- Text on a path, character/paragraph styles, tabs, vertical type, and text-to-outline are Phase 6 work that has
  its evidence recorded but not its features.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor with flattened curves, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **373 unit tests**, production build, and **164 packaged steps** across six reports.
- New packaged step drags with the Type tool and asserts the resulting **150×120 area frame**.
- The Illustrator fixtures under `tests/fixtures/illustrator/` (recorded on 27.3.1) back the area-capacity and
  alignment assertions; the unit suite reads them without Illustrator installed.

</details>
