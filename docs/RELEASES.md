<a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-Setup.exe"><img src="https://img.shields.io/badge/Download%20for%20Windows-Vectr%20<version>-A94A4A?style=for-the-badge&logo=windows&logoColor=F3EEE8" alt="Download Vectr <version> for Windows" height="40"></a> <a href="https://github.com/lleoparden/vectr/releases/download/v<version>/Vectr-<version>-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20macOS%20(Apple%20Silicon)-Vectr%20<version>-242428?style=for-the-badge&logo=apple&logoColor=F3EEE8" alt="Download Vectr <version> for macOS on Apple Silicon" height="40"></a>

Windows x64 · per-user install · unsigned, so SmartScreen warns once · macOS arm64/x64 · ad-hoc signed

**Vectr <version>** — the vector editor that reads like Illustrator and writes React. Phase 5 is closed: a real
Bézier path model, the Pen, anchor editing, Pathfinder with curve-preserving booleans, Divide, Shape Builder, Live
Paint, compound paths, Simplify, Outline Stroke, Offset Path, live shape reshaping, and width profiles with their
Width tool. The format moves to **v7**.

### What changed in this phase

- **Paths, end to end.** A path node with per-anchor handles (format v5), the Pen tool, Direct Selection that edits
  anchors and handles, nudge, add/delete, corner/smooth conversion, join, and average. Format v6 added compound
  paths: several contours in one node, drawn and hit-tested with the even-odd rule, made and released with Ctrl+8 /
  Ctrl+Alt+8.
- **Pathfinder, Divide, Shape Builder, Live Paint (#140).** Unite, Intersect, Subtract, and Exclude run on Skia path
  ops and **keep their curves** — a result is an editable Bézier path, not a polygon soup — and a compound operand's
  hole survives. Divide splits shapes into non-overlapping faces. Shape Builder collects the faces a drag touches
  and unites them (Alt removes them), leaving untouched regions as their own paths. The Live Paint bucket (K) fills
  the face under a click.
- **Path cleanup (#142).** Simplify runs Ramer–Douglas–Peucker over the flattened outline; Outline Stroke turns an
  open stroke into a filled outline and a closed one into a compound ring with a real hole; Offset Path asks for a
  distance in a dialog and copies the outline in one undo.
- **Width profiles and the Width tool (#141, format v7).** `Stroke.widthProfile` is one multiplier per anchor;
  profiles render as real outlines (an even-odd ring when closed) and hit testing follows the band. Object ▸ Path ▸
  Width Profile offers Uniform, Taper Start, Taper End, and Bulge, and **Shift+W** is the Width tool: drag away from
  an anchor to widen, toward it to narrow, one undo entry per drag.
- **Live shapes.** Dragging a selection handle on one unrotated, unscaled parametric shape changes its width and
  height instead of its transform scale, so strokes and corner radii are not stretched.
- **Seventeen tools, all state machines**, including Shape Builder (Shift+M), Live Paint (K), and Width (Shift+W).

### What is in this build

- Paths with curves, Pen, anchor editing, Pathfinder, Divide, Shape Builder, Live Paint
- Compound paths with even-odd holes; Simplify, Outline Stroke, Offset Path
- Width profiles with presets and the Width tool
- Everything from 0.4: transforms, rotation, zoom, paint and gradients, blend modes, swatches, artboards, rulers and
  guides, layers, align and transform panels, point text, images with crop and masks, autosave and crash recovery
- The rose palette across the editor and the site

<details>
<summary><strong>Install, requirements, and other ways to run it</strong></summary>

#### Install on Windows

1. Download `Vectr-<version>-Setup.exe` from the assets below and run it.
2. SmartScreen warns that the publisher is unknown: the installer is **not code-signed**. Choose "More info"
   and "Run anyway" if you trust the source.
3. It installs per-user (no admin prompt) and creates a Start-menu shortcut.

#### Install on macOS

Download **`Vectr-<version>-arm64.dmg`** on Apple Silicon or **`Vectr-<version>-x64.dmg`** on an Intel Mac.

1. Open the DMG and drag **Vectr** into **Applications**.
2. First launch: macOS may say the app is from an unidentified developer, or that it is **damaged**. It is
   neither corrupt nor signed by Apple — the build is **ad-hoc signed** (no Apple Developer ID) and still carries
   the download quarantine.
3. Clear the quarantine once and open it:

   ```bash
   xattr -cr /Applications/Vectr.app
   open /Applications/Vectr.app
   ```

   Or right-click the app, choose **Open**, and confirm once. Notarization would need an Apple Developer ID.

#### Run from source

```bash
npm install
npm run dev        # Vite + Electron with hot reload
npm test           # layer check, unit suite, UI standards
npm run build
npm run smoke      # 160 packaged steps, six reports
```

Node 22+, pnpm 10. The document layer never imports React, Skia, or Electron; the renderer never mutates the
document; tools emit commands.

</details>

<details>
<summary><strong>What this build deliberately does not do</strong></summary>

- **Live Paint paints regions, not edges**, and each painted region is its own path rather than a live-paint group.
- **Divide, Shape Builder, and Live Paint use flattened faces**; the four boolean modes keep curves, Divide cannot.
- **Outline Stroke does not outline a compound's own stroke**, and it reads contours one at a time.
- **Width profiles are per anchor**, not per point on the curve; curves are flattened for the outline, and stroke
  alignment and dashes are not applied to a profiled stroke. The Width tool edits the nearest anchor.
- **Live shape reshaping applies to unrotated, unscaled parametric shapes**; rotated or pre-scaled ones keep
  transform scaling. Corner-radius widgets are a field, not a canvas handle.
- **No Width tool for arbitrary positions**, no symbols panel, no pattern fills, no text on a path. Those are Phase 6
  and later; the full status is in `docs/PARITY_CATALOG.md`.

</details>

<details>
<summary><strong>Evidence</strong></summary>

- Typecheck, the layer check, and **355 unit tests** pass, including the boolean area checks against analytic
  values, compound-hole hit testing, ring areas, profile trapezoids, and exact command inverses.
- A production build succeeds and the queued release assets are attached to the draft before publishing.
- The packaged run logs **160 steps across six reports**: editor, file round trip, text, UI and tool options, path
  tools, and memory. It covers curves and anchors, Pathfinder and Divide areas, Shape Builder regions, Live Paint,
  compound holes, Outline Stroke rings, Offset Path, live reshaping, presets, and the Width tool.
- Memory: a 1,000-shape document with images is saved, reopened, closed, and checked against a 1,200 MiB budget.

</details>
