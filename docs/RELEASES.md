<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Blur** joins the drop shadow
as the second appearance effect, and the native format moves to **v14**.

### What changed

- **Blur** on vector shapes with a 0–100 radius, toggleable in **Appearance ▸ Effects** and from **Object ▸ Blur**.
  It stacks with a drop shadow in the same effect list, and each toggle is one undo entry.
- **Rendered as a filtered layer**: fill and stroke are drawn inside a `saveLayer` with Skia's blur filter, so the
  object blurs as a whole while its shadow stays sharp. Filters are cached by radius, for the same recording-lifetime
  reason the shadow filters are.
- **Format v14.** A blur in `effects` is unknown to v13 builds, so the bump lets them refuse the file cleanly rather
  than fail validation generically.

### What is in this build

Everything from **0.6.1** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point/area/path/threaded/vertical text, Create Outlines, missing-font resolution, and the drop shadow — plus
transforms, gradients, blend modes, artboards, layers, images, autosave, and crash recovery.

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
npm test           # layer check, 395 unit tests, UI standards
npm run build
npm run smoke      # 172 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Blur is one Gaussian radius per object** and applies to **vector shapes** only; text and images refuse effects.
  Glow and other effect types are not built, and there is no reorderable effect stack UI.
- Shadows do not expand selection bounds, and both effect caches are keyed by parameters rather than evicted by a
  memory budget.
- Character/paragraph styles remain the Phase 6 exception; vertical Latin is an upright stack; threading has no unlink
  UI; Create Outlines uses the default variation master and ignores kerning.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **395 unit tests**, production build, and **172 packaged steps** across six reports.
- New packaged step toggles a blur, asserts the stored effect with its radius, and undoes.
- A rendered proof confirmed the object's edges are actually soft, not just that the effect was serialized.
- Unit tests pin shadow and blur stored together, out-of-range radius refusal, and validation of the combined list.

</details>
