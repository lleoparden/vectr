<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Missing fonts are now a
visible workflow** instead of a silent substitution.

### What changed

- **Type ▸ Resolve Missing Fonts…** opens a dialog listing the families the document references but Vectr does not
  ship, and substitutes them with **Inter** in one undo entry. The menu item is enabled only when something is
  actually missing, so the control cannot lie.
- **Detection is shared and tested.** The same walk powers the menu state, the dialog list, and the substitution
  command; it sees text inside groups, ignores case when comparing family names, and returns unique, sorted families.
- No document-format change: `fontFamily` already existed, and existing files with missing families now have a way out.

### What is in this build

Everything from **0.5.7** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point/area/path/threaded/vertical text, Create Outlines, and live thread reflow — plus transforms, gradients, blend
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
npm test           # layer check, 392 unit tests, UI standards
npm run build
npm run smoke      # 170 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Inter is the only face**, so substitution always lands on Inter with no per-family choice; the dialog lists
  families rather than per-object counts and does not open automatically when a file is loaded.
- Character/paragraph style presets are not built yet; text styling remains per object.
- Threading is live but has no unlink UI, and hidden overflow past the last frame is not marked.
- Create Outlines uses the default variation master and ignores kerning; vertical/path text is not outlined.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **392 unit tests**, production build, and **170 packaged steps** across six reports.
- New packaged step creates a Comic Sans MS text object, opens the dialog, asserts the family is listed, applies the
  substitution, checks the family became Inter, and undoes.
- Unit tests pin unique/sorted/case-insensitive detection, text inside groups, an all-Inter document reporting
  nothing, and a caller-supplied available list.

</details>
