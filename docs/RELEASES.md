<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Phase 7 begins with a real
drop shadow**, stored in the document and rendered by Skia, and the native format moves to **v13**.

### What changed

- **Drop shadow** on vector shapes: offset, blur, colour, and opacity, editable in the **Appearance** panel and
  available from **Object ▸ Drop Shadow**. Every edit is one undo entry, and the effect is document data, not a paint
  hack — it saves, reopens, and inverts exactly.
- **Rendering is an appearance layer**: the shadow is drawn beneath the shape with Skia's drop-shadow image filter,
  with its opacity folded into the colour. Two cache bugs were fixed to get there: effects now participate in the
  bucket signature (the same class of bug the gradient cache had), and filters are kept alive across recording.
- **Format v13**: `Style.effects` is optional, so older documents open unchanged.

### What is in this build

Everything from **0.6.0** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point/area/path/threaded/vertical text, Create Outlines, missing-font resolution — plus transforms, gradients, blend
modes, artboards, layers, images, autosave, and crash recovery.

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
npm test           # layer check, 394 unit tests, UI standards
npm run build
npm run smoke      # 171 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **One effect type** (drop shadow) on **vector shapes**; text and images refuse effects rather than ignoring them, and
  there is one shadow per toggle rather than a reorderable stack.
- Shadows do **not expand selection or marquee bounds**, and filter paints are cached per parameter combination rather
  than evicted by a memory budget.
- Character/paragraph styles remain the Phase 6 exception; vertical Latin is an upright stack; threading has no unlink
  UI; Create Outlines uses the default variation master and ignores kerning.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **394 unit tests**, production build, and **171 packaged steps** across six reports.
- New packaged step toggles a drop shadow, asserts the stored effect, and undoes.
- A rendered proof confirmed the shadow is **visible** (not merely stored), which is how the missing signature entry
  and the filter-lifetime bug were found.
- Unit tests pin the effect command's round trip and inverse, and refusals for text, groups, out-of-range blur, and
  opacity.

</details>
