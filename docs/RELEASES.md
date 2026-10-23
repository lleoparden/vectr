<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. Phase 6 continues: **text on a
path** joins point and area text, and the native format moves to **v9**.

### What changed

- **Text on a path.** Click a filled path with the Type tool and text is centred along it. Each glyph is placed at its
  arc distance and rotated to the path's tangent, so letters turn around corners and curves. The text object's box is
  the path's bounds, and content or style edits keep that box.
- **One gesture, three text types.** A Type click on empty canvas places point text, a drag draws an area frame, and a
  click on a path starts path text — Illustrator's Type tool in miniature.
- **Format v9.** `textPath` is optional, so v1–v8 documents open unchanged; older builds refuse v9 rather than
  drawing path text as flat text.
- **Hardening:** a document file with a missing `transform` is now refused with a validation failure instead of
  throwing, so a malformed file cannot crash the open path.

### What is in this build

Everything from **0.5.2** — paths, Pen, booleans, compound paths, Simplify/Outline/Offset, live shapes, width
profiles with the Width tool, point and area text — plus transforms, gradients, blend modes, artboards, layers,
images, autosave, and crash recovery.

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
npm test           # layer check, 377 unit tests, UI standards
npm run build
npm run smoke      # 165 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Path text is centred only**: no start offset, no side-of-path, no align-to-path controls, and the path geometry is
  **copied into the text node** at creation, so editing the original path later does not move the text.
- The path-text editing overlay is the path's rectangular bounds, not the glyph positions.
- Area text still has no inset, columns, threading, or overflow indicator; point-text insertion is the box's
  top-left rather than Illustrator's baseline.
- Text on a path does not follow a compound path's separate contours; only the node's first path geometry is copied.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **377 unit tests**, production build, and **165 packaged steps** across six reports.
- New packaged step clicks a filled path with the Type tool and asserts a **160-wide path-text object**.
- Unit tests pin glyph placement on a straight path (90/100/110 along 200), a vertical tangent, a closed square's
  corners, path bounds preserved through edits, and rejection of a text path with one anchor.

</details>
