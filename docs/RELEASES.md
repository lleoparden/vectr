<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Threaded text** arrives as a
one-shot distribution across area frames, and the native format moves to **v10**.

### What changed

- **Thread Text** (Type menu). Select two or more area text frames and the story's lines are distributed across them:
  the head keeps the whole story plus a link to the next frame, and every frame shows its own slice. Capacities follow
  Illustrator's rule — frame height divided by the leading, rounded up. Lines past the last frame stay in the story but
  are not displayed. One command, one undo entry, exact inverse.
- **Format v10.** `threadStory` and `threadNextId` are optional, so v1–v9 documents open unchanged; older builds refuse
  v10 rather than dropping the link.
- **Distribution is pure.** `src/doc/textThread.ts` decides capacity and slicing and is tested without a canvas; the
  action supplies the measured wrapping, so threading uses the same break rule as area text.

### What is in this build

Everything from **0.5.3** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point text, area text, and text on a path — plus transforms, gradients, blend modes, artboards, layers, images,
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
npm test           # layer check, 381 unit tests, UI standards
npm run build
npm run smoke      # 166 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Threading is one-shot**: editing a frame afterwards does not reflow the others, and there is no unlink UI. Only the
  first-to-second link is recorded; additional selected frames are display targets.
- Lines beyond the last threaded frame are retained in the story but not displayed, and there is no overflow marker.
- Path text is centred only, with copied (not linked) geometry; area text has no inset, columns, or handle resize.
- Point-text insertion remains the box's top-left rather than Illustrator's baseline.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **381 unit tests**, production build, and **166 packaged steps** across six reports.
- New packaged step threads an 8-line story into two 3-line frames: the head shows 3 lines, the next frame receives
  the overflow, and undo restores both.
- Unit tests pin capacity rounding, distribution dropping display overflow, the link command and its inverse, and
  refusals for non-area or self links.

</details>
