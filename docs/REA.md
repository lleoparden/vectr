# REA: what it can and cannot verify here

This records the first REA pass on Vectr, so later sessions do not repeat dead ends and so every claim
about a shipped build has a receipt.

## Scope and boundaries

- **Behaviour and artifact structure only.** No Adobe or VectorCraft assets, branding, screenshots, or
  copied source enter Vectr. REA is used to answer "what does the shipped thing do", not to lift code.
- **Illustrator's licence is respected.** No decompilation of Adobe binaries is attempted. Where REA
  cannot observe behaviour, the fallback is public documentation, the scripting model, and observed use -
  not native reverse engineering.

## What was actually run (2026-10-23)

| Step | Command surface | Result |
| --- | --- | --- |
| Readiness | `rea doctor` | Host and Node healthy; **no native analysis engines** (Ghidra/IDA/Hopper missing), so native decompilation is unavailable. |
| Illustrator located | `C:\Program Files\Adobe\Adobe Illustrator 2023\Support Files\Contents\Windows\Illustrator.exe` | Installed and launched (pid/window captured), then closed. |
| Illustrator native capture | `rea capture-native-ui-scenario ... --pid ... --window-id ...` | **Unavailable on Windows**: provider reports `Native macOS utilities require macOS` (checked 6.4.0 and 6.5.0). REA's native UI observation and native code providers are macOS-only in these releases. |
| Packaged JS analysis | `rea analyze-javascript-application release/win-unpacked/resources/app.asar` | Produced Evidence, but the staged artifact turned out to be **0.4.0**; whole-asar analysis emitted **452 MB** of JSON because it parsed node_modules too. |
| Targeted JS analysis | same, `--source-path dist/assets/index-*.js`, `--max-semantic-nodes 4000` | ~33 MB Evidence for one minified 658 KB bundle. Semantic graph value is low for a Vite-minified single file; **artifact identity and string presence are the useful outputs**. |
| Installed artifact check | `@electron/asar list/extract-file` + SHA-256 + string check | Per-user install at `%LOCALAPPDATA%\Programs\vectr` is **0.5.0**; bundle `index-MVbgqJ_s.js`, SHA-256 `d91efc0b…a1610b`, contains `tool.shapeBuilder`, `tool.livePaint`, `tool.width`, `path.divide`, `setWidthProfile`, `object.compoundMake`, `path.profileBulge` - but **not** `hitTestAll`, so the 0.5.1 Shape Builder fix is not in that install. |

Conclusions from this pass:

- **Observed:** the installed 0.5.0 build carries the Phase 5 registry and commands; the 0.5.1 fix is
  absent from it, as expected.
- **Observed:** the local `release/win-unpacked` staging directory was stale (0.4.0), which is why a first
  artifact scan found no Phase 5 symbols. Packaged verification must always name the artifact it read.
- **Inferred:** REA's strongest fit for Vectr is *artifact identity and presence*, not deep semantic
  analysis of a minified bundle.
- **Unknown:** Illustrator's tool semantics on this host; REA cannot observe them here.

## The repeatable verification pass

Run this per release, and record the artifact path, version, and hashes:

1. Build a fresh package (`npm run package:win`), or point at the installed app. Never assume
   `release/win-unpacked` is current - it was a full minor version behind.
2. Read `package.json` **from the asar**, not from the working tree.
3. Extract the renderer bundle, record its SHA-256, and assert the presence of the phase's required
   identifiers (tool ids, command ids, command labels). This is the artifact-side equivalent of the
   packaged smoke run and catches "source has it, installer does not".
4. Run the packaged smoke (`npx electron . --smoke=stress`) for behaviour, and REA
   `capture-electron-scenario` only when the question is about the shipped Electron runtime itself.
5. Record negatives: what the artifact does **not** contain is as useful as what it does.

## Illustrator as a behaviour oracle

Because native UI observation is macOS-only, Illustrator verification on this Windows host uses its own
automation surface instead of REA:

- **Geometry and document model:** ExtendScript through COM (`Illustrator.Application`) can create
  documents, draw primitives, run menu commands such as Pathfinder and compound-path make/release, and
  read back anchor counts, bounds, and path items. That gives real behaviour evidence for the model
  operations behind Phases 5.1-5.6 without touching Adobe binaries.
- **Gestures that scripting cannot reach** (Shape Builder drag semantics, Live Paint edges, Width tool
  placement) are verified by observing the installed app against a written checklist and recording the
  result, not by pretending REA saw them.

## Phase checklist for REA use

| Phase | REA role | Not REA |
| --- | --- | --- |
| 1-4 (shipped) | Artifact presence of menus, panels, commands; Electron runtime capture when needed | Behaviour is covered by the packaged smoke. |
| 5 (shipped) | Artifact check of path/tool/command ids; confirm fixes land in installers | Illustrator semantics via scripting + observation checklist. |
| 6+ (next) | Artifact checks per release; runtime capture of the built app for packaging regressions | UX parity questions are answered from Illustrator documentation, scripting, and observed use; never from Adobe code. |

The honest state: **REA is useful for our own artifacts and runtime, blocked for Illustrator on Windows,
and legally off-limits for Adobe internals.** The next phase should be planned with that split stated up
front, not discovered halfway through.
