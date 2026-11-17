<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. **Threaded text now reflows
live**: editing a head redistributes the whole chain, and the native format moves to **v12**.

### What changed

- **Threads are a real chain.** Thread Text records a link on every frame (head: story + next; continuations: head id +
  their own next), so a thread can reflow from one place instead of being frozen at the moment it was created.
- **Edit the head, the chain reflows.** The inline editor loads the whole story for a head; committing it updates the
  story and redistributes every frame's slice **in one undo entry**. **Type ▸ Reflow Thread** recomputes on demand.
- **Format v12.** `threadHeadId` is optional, so v1–v11 documents open unchanged.

### What is in this build

Everything from **0.5.6** — paths, booleans, compound paths, Simplify/Outline/Offset, live shapes, width profiles,
point/area/path/threaded/vertical text, and Create Outlines — plus transforms, gradients, blend modes, artboards,
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
npm test           # layer check, 389 unit tests, UI standards
npm run build
npm run smoke      # 169 packaged steps, six reports
```

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **No unlink UI**; a continuation's own edit stays local until the next reflow, which then re-derives it from the head.
- Capacity and wrapping use the **head's** font, size, and leading; lines past the last frame stay in the story but are
  hidden, with no overflow marker.
- Create Outlines uses the font's default variation master, ignores kerning, and only handles horizontal text.
- Vertical Latin is an upright stack; area text has no inset/columns; point insertion is the box's top-left.
- Phase 5 limits stand: Live Paint paints regions not edges, Divide faces are flattened, width profiles are per
  anchor, and a compound's own stroke is not outlined.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, layer check, **389 unit tests**, production build, and **169 packaged steps** across six reports.
- New packaged step reflows a 12-line story into **3 + 6** visible lines across two frames, then undoes.
- Unit tests cover chain links and their inverse, a last frame with no next, refusal of a continuation without a head,
  and refusal of a head that also carries a head id.

</details>
