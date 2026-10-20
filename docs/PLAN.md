# Vectr roadmap

The detailed delivery roadmap is [MASTER_PLAN.md](MASTER_PLAN.md), replanned on 2026-10-18 around
[PARITY_ROADMAP.md](PARITY_ROADMAP.md). This file is the operational checklist for the **phase in progress**.

## Phase 4 - interaction fidelity (complete 2026-10-18)

Five slices, all merged and evidenced: the scale gesture became a tool (#125), rotation renders, hit-tests,
frames, and scales in its own frame (#126), the canvas gained hover outlines, per-tool cursors, and a live
rotation readout (#127), Align and Transform got their panels (#128), and the layer panel gained its locate
column and nested previews (#129).

Two owner-requested slices followed: **4.6** scrub-able number fields with arithmetic, Alt-drag duplicate, and
Shift+wheel pan (PR #130, which also fixed a transaction-ownership bug in `runPlan`), and **4.7** the Zoom tool
(PR #132). Then the **UI component kit** (issue #133) standardised every control into
`src/app/ui/components/` across three passes (#134, #135, #136), with a standards test that fails on any raw
`<button>` or `type=number` outside it.

## Phase 5 - the path model and boolean operations (next)

Epic [#6](https://github.com/lleoparden/vectr/issues/6). This is the largest remaining capability gap: there is
no Bézier path node yet, so the pen, anchors, Pathfinder, width profiles, and compound paths all wait on it.

| Slice | Issue | What it delivers |
| --- | --- | --- |
| 5.1 Path node and format v5 | #137 | `PathNode` with anchors and in/out handles, open and closed paths, validation, serialization as format v5 with v4 files still opening, rendering, and hit testing |
| 5.2 Pen tool | #138 | **Done**: click for a corner, drag for a smooth anchor, close on the first anchor, rubber-band preview, Escape to cancel, one undo entry per path |
| 5.3 Anchor and segment editing | #139 | **Partly done**: anchors and handles select and drag under rotation/scale, an overlay shows them, and add/delete/convert have exact inverses. Remaining: join, average, menu entry |
| 5.4 Pathfinder and Shape Builder | #140 | `src/ops/boolean` with unite, subtract, intersect, exclude, divide over flattened curves; commands, panel, and menu; fixtures that compare results |
| 5.5 Width profiles (#103) | #141 | Stroke-to-outline geometry, width points, and the Width tool; the renderer draws the outline and hit testing follows it |
| 5.6 Compound paths, offset, and live shapes | #142 | Compound path create and release, offset path, simplify, outline stroke, and live rectangle/ellipse/corner reshaping |

Every slice owes the usual evidence (typecheck, full suite, build, packaged steps) plus a fixture for the
geometry it introduces. Booleans owe property tests on area and winding, not eyeballing.

## Phase 2 history (complete, for reference)

The Phase 2 slices shipped across #75-#102 and are audited in `docs/PROGRESS.md`. Their records stay in this
file below; nothing in them is active work.


The detailed delivery roadmap is [MASTER_PLAN.md](MASTER_PLAN.md). [PARITY_ROADMAP.md](PARITY_ROADMAP.md) is the **proposed** parity re-sequencing (interaction fidelity first, then the path model, type, files, compiler) and is awaiting owner approval. This file
remains the short operational checklist for the active phase.

Every phase in the master plan owns an epic GitHub issue; all phase epics are
created up front. When a phase starts, each approved slice below becomes a
sub-issue of that epic, and each slice ships as its own branch and pull request.
The issue and pull-request flow is defined in
[`.agents/workflows/issue-ready.md`](../.agents/workflows/issue-ready.md).

## Phase 1 issue tracking

- Epic: [#3 Phase 1 — Core application foundation](https://github.com/lleoparden/vectr/issues/3)
- Sub-issues in approved slice order:
  - [#15 CanvasKit/Skia renderer spike with recorded memory and lifecycle evidence](https://github.com/lleoparden/vectr/issues/15) (`PERF-01`)
  - [#18 Versioned document, validated commands, bounded undo/redo, editable shapes and selection](https://github.com/lleoparden/vectr/issues/18) (`DOC-01`, `DOC-03`, `PATH-01`, `SEL-01`)
  - [#20 Layer panel, multi-selection, ordering, groups, and nesting](https://github.com/lleoparden/vectr/issues/20) (`DOC-02`, `SEL-03`)
  - [#16 Plain text nodes with accessible editing and defined missing-font behavior](https://github.com/lleoparden/vectr/issues/16) (`TYPE-01`)
  - [#17 Image import with content-addressed local assets](https://github.com/lleoparden/vectr/issues/17) (`IMAGE-01`)
  - [#19 Durable local documents: versioned manifest, assets, validation, recovery](https://github.com/lleoparden/vectr/issues/19) (`DOC-04`)
- Pull-request strategy for this phase: one stacked branch and pull request per
  slice, each based on the previous slice, reviewed and merged by the owner in
  order. Every slice pull request carries its own catalog and `docs/PROGRESS.md`
  update.

## Phase 2 issue tracking

**Status: delivered with recorded gaps (2026-10-17).** All eight slices shipped a branch, pull request,
catalog/progress update, self-review, and a packaged run: #64→#75 (+#76), #65→#77, #66→#78, #67→#80
(+contract #79), #68→#83 (+contract #81), #69→#82/#84/#85/#88/#91, #70→#90/#92, #71→#86/#89 (+contract
#87). Issues #67, #69, and #70 stay open because acceptance items remain (artboard tool/rulers/grids,
stroke alignment/width profiles, radial and multi-stop gradients); `docs/PROGRESS.md` carries the
criterion-by-criterion audit and the five named gaps.

- Epic: [#5 Phase 2 — Core vector illustration](https://github.com/lleoparden/vectr/issues/5)
- Planning method: ECC architecture decomposition on 2026-10-16. It keeps every
  change on the existing validated document/command/history path instead of
  creating a parallel editing model.
- Pull-request strategy: one fresh, unstacked branch and one merge-commit pull
  request per slice, in the dependency order below. Big decision-surface changes
  require owner review and merge under the normal policy; the temporary Phase 1
  exception has expired.
- Child issues: [#64 selection](https://github.com/lleoparden/vectr/issues/64),
  [#65 transforms](https://github.com/lleoparden/vectr/issues/65),
  [#66 align/clipboard](https://github.com/lleoparden/vectr/issues/66),
  [#67 artboards](https://github.com/lleoparden/vectr/issues/67),
  [#68 snapping](https://github.com/lleoparden/vectr/issues/68),
  [#69 appearance](https://github.com/lleoparden/vectr/issues/69),
  [#70 gradients](https://github.com/lleoparden/vectr/issues/70), and
  [#71 isolation/clipping](https://github.com/lleoparden/vectr/issues/71).

### Proposed execution plan — pending the recorded decisions

1. **Selection modes (`SEL-01`, `PATH-01`).** Add direct selection, lasso,
   hierarchy selection, and editing of the existing rounded-rectangle radius.
   Reuse hit testing and the one command path; Bézier anchors/handles remain out
   of scope for this slice.
2. **Transforms (`SEL-02`).** Add selection bounds/handles and numeric move,
   scale, rotate, reflect, and shear. Pointer gestures remain one history entry
   and use the existing `Transform` data rather than a second geometry model.
3. **Align, distribute, and clipboard (`SEL-03`).** Extend the existing arrange
   and duplicate planners with deterministic alignment/distribution and copy,
   cut, and paste. The clipboard boundary must be decided before implementation.
4. **Artboards and precision canvas (`CAN-01`, `UI-01`).** Add multi-artboard
   management, rulers, a grid, and guides. This is the only planned slice that
   changes persisted artboard/guide data; the coordinate and active-artboard
   contract must be decided first.
5. **Snapping and Smart Guides (`CAN-02`).** Snap drawing and transforms against
   the finalized artboard, guide, and selection primitives with keyboard-accessible
   controls and explicit acceptance fixtures.
6. **Basic vector appearance (`PAINT-01`, `PAINT-02`).** Add editable fills,
   strokes, caps, joins, dashes, widths, and named RGB swatches through
   `setStyle`; CMYK, spot colors, and color books remain deferred.
7. **Gradients, opacity, and blend modes (`PAINT-03`, `APP-01`).** Add
   deterministic serializable gradients and a deliberately limited blend-mode
   set, with renderer cache/memory evidence.
8. **Isolation and vector clipping masks (`DOC-02`, `APP-02`).** Add isolation
   as workspace state and a persisted group-owned vector clipping relationship,
   preserving existing stack, lock/hide, and raster-mask behavior.

### Decisions required before implementation

- Persisted multi-artboard position and active-artboard model.
- Vectr-only structured clipboard first (recommended) versus operating-system
  clipboard interoperability.
- RGB-only swatches for Phase 2 (recommended), plus the initial blend-mode list.
- A group-owned vector clipping relationship using one existing shape as the
  clip (recommended), rather than raster masking or compound-path editing.

Every slice must trace UI, document, persistence, compiler, and renderer
boundaries; preserve exact undo/redo and locked/hidden protections; prove
save/reopen and recovery for persisted data; run typecheck, tests, build, and
packaged smoke; and update the catalog, progress record, decision log, and
compiler matrix in the same pull request. UI slices also record Illustrator
mapping, deliberate Vectr differences, and unbuilt controls.

## Approved — Phase 2.1 selection modes (issue #64, started 2026-10-17)

**Tracking:** [#64](https://github.com/lleoparden/vectr/issues/64), a sub-issue of
[#5 Phase 2 — Core vector illustration](https://github.com/lleoparden/vectr/issues/5). The owner
started Phase 2 with the instruction that every issue ships as its own pull request and that
agents may merge after reviewing. Slice order is the one recorded above: #64 is first because it
needs none of the four open Phase 2 decisions.

**Problem.** Vectr selects whole objects and can marquee, but a designer cannot select a nested
object predictably, lasso an irregular set, or change the corner radius of a rectangle that already
exists (`cornerRadius` is modelled and drawn, but only set at creation).

**Scope.** Two more pointer tools — Direct Selection (`A`) and Lasso (`Q`) — a double-click
hierarchy drill on the canvas, deep marquee selection for Direct Selection, a `setCornerRadius`
command with an exact inverse, and a corner-radius control in the Control panel and Properties.
No Bézier anchors or handles (PATH-02), no transform handles (SEL-02), no second selection store,
and no persisted-schema change: every new edit goes through the existing command path.

**Semantics.**
- The Selection tool keeps object-level selection: a click returns the top-level ancestor.
- Direct Selection selects the deepest leaf under the pointer; Shift toggles it; its marquee
  selects leaves rather than top-level objects.
- A lasso drag selects every visible unlocked leaf whose world bounds its path touches, collapsed
  to the top-level object unless Direct Selection is the active tool.
- Double-click with the Selection tool drills exactly one level into the group chain under the
  pointer (Illustrator's double-click), and still opens the text editor when the target is a text
  object.
- Radius: `setCornerRadius { nodeId, cornerRadius }` applies to rectangles only, rejects a
  non-finite or negative radius (`non-finite`) and one larger than half the shorter side
  (`invalid-index`), and refuses a locked node (`locked`). The UI clamps the typed value the way
  Illustrator does; the command still refuses bad input from any other caller.

**Illustrator mapping.** Selection and Direct Selection share one palette slot with a flyout,
which is Illustrator's black/white arrow button; Lasso keeps its own slot and its `Q` chord; the
corner radius is edited where Illustrator's Control panel and Properties panel put it. Deliberate
divergences, recorded in `docs/DECISIONS.md`: direct selection is object-level rather than
anchor-level until PATH-02, and the lasso uses a touched-bounds test rather than Illustrator's
exact within-the-path rule.

**Evidence.** Unit tests for the polygon and lasso maths, hierarchy drilling, the radius command
(inverse, refusals, clamping), the palette grouping, and the shortcut table; packaged smoke steps
for direct selection of a nested leaf, double-click drilling, a lasso selection, a radius edit with
undo, and save/reopen of the edited radius; typecheck, tests, build, and the packaged run.

## Approved — Phase 2.2 transform controls (issue #65, started 2026-10-17)

**Tracking:** [#65](https://github.com/lleoparden/vectr/issues/65). Second slice of Phase 2, still before
any of the four open decisions.

**Scope.** A selection bounding box with eight scale handles, Properties X/Y/W/H editing, and arrow-key
nudging. Every value goes through the existing `setTransform` command inside one transaction per gesture,
so history, save/reopen, hit testing, and the renderer agree by construction.

**Semantics.** Scale anchors at the opposite corner (Alt: the centre); Shift takes the dominant factor for
both axes; an edge handle scales only its own axis; a drag can never collapse a node below a hundredth of
its size. Position is a move; a size edit scales about the box's top-left corner.

**Explicitly out, with the reason recorded.** Rotate, reflect, and shear: the scene builder carries no
rotation and the hit test is axis-aligned, so they need a rotation slice (scene, inverse-rotation hit test,
rotated bounds and outline) before a control for them can be honest.

**Evidence.** Unit tests for the box, the handle maths, constraints, the collapse guard, and the store-level
one-entry behavior; packaged smoke steps for the box, a handle scale, and a nudge; typecheck, tests, build,
smoke.

## Phase 0 — Reference catalog and platform decision

- [x] Approve Electron + React + TypeScript as the proposed desktop direction:
  Windows is the first fully tested release; macOS and Linux must build and
  launch early, with full support claimed only after platform testing.
- [x] Run the packaged Electron + SVG renderer/memory benchmark. Five Windows
  runs are recorded in `.ecc/benchmarks/phase-zero/`; SVG fails the stress
  interaction target and is not a production renderer candidate.
- [x] Select Electron + React + TypeScript + Tailwind + Vite as the desktop
  development baseline. The evidence rejects full-document SVG, not Electron;
  Electron's 3.90 MiB empty-memory overrun is not enough to justify changing
  shells without an equivalent runtime comparison.
- [ ] Run the prepared Tauri comparison when its Windows toolchain is available.
  It is retained as non-blocking evidence: switch only for a repeatable,
  equivalent-workload memory advantage of about 20% or more.
- [x] Run a bounded CanvasKit/Skia renderer spike before editor features. It
  must use the frozen fixtures and retain the 33 ms stress interaction target.
  Done and recorded in issues #15, #23 and #25: the spike missed the target, the owner approved a
  bounded optimization, and the frozen 1,000-shape stress document now renders at p95 1.0–1.3 ms in
  the packaged smoke run. **The gate is not fully closed**: the #25 comparison records 10,000 loose
  primitives at 89.8 ms, so `PERF-01` stays open with revisit triggers for Phase 2 (see
  `PROGRESS.md` and the catalog's renderer evidence section).
- [x] Build parity catalog v1 and define its feature-completion standard in
  `docs/PARITY_CATALOG.md`.
- [x] Approve a versioned, renderer-independent document model: stable layer
  IDs, order, geometry, transforms, styles, text, and assets.
- [x] Approve one validated, serializable, undoable command/change model for
  UI, shortcuts, future MCP, and the future built-in agent.
- [x] Approve lawful behavior-led reconstruction: use REA for narrow,
  evidence-backed investigations; never copy source or branding.
- [x] Approve a React/Tailwind export contract: readable TSX + Tailwind by
  default, one component per layer, inline SVG where fidelity requires it;
  JSX and semantic/responsive output are future user choices when supported.
- [x] Approve quality gates: save/reopen, undo/redo, import validation, visual
  comparisons, desktop interaction, performance/memory budgets, and future
  account-permission coverage.

### Completed Phase 0 platform decision

1. **Benchmark specification.** Define three frozen, versioned fixtures
   (empty, representative, stress), the test machine/OS, measured metrics,
   repeat count, and Electron-versus-Tauri decision rule. The plan will set
   proposed budgets for owner approval before measurements begin.
2. **Minimal benchmark harness.** On a fresh `chore/` branch, add only the
   approved Electron/React/TypeScript dependencies and the smallest desktop
   harness needed to load those fixtures, perform pan/zoom, selection, edit,
   undo/redo, save/reopen, and close/reopen cycles. No production editor tools,
   cloud services, compiler, MCP, or branding work is in scope.
3. **Evidence run.** Execute the packaged Windows release build with developer
   tools closed. Capture total memory for every application process, GPU memory
   where available, p95 interaction time, correctness outcomes, and raw traces
   across five independent runs; record macOS/Linux build-and-launch evidence
   when those hosts are available.
4. **Decision review.** The independent review selected Electron as the
   baseline and rejected full-document SVG. The future Tauri comparison is
   non-blocking and changes the shell only with a repeatable, material runtime
   memory advantage under the same workload.
5. **Parity catalog v1.** Create the catalog with stable IDs, reference
   evidence, status, acceptance behavior, exclusions, compiler support, and
   platform coverage. Inventory Illustrator and VectorCraft by workflow area,
   not by a misleading parity percentage; publish the catalog's completion
   rules and first prioritized MVP slice.

**Outcome:** Electron + React + TypeScript + Tailwind + Vite is selected for
development. The document model remains renderer-independent. Full-document
SVG is rejected; CanvasKit/Skia is the production-renderer candidate pending
the bounded spike above. Tauri remains a deferred comparison, not a stack gate.

## Phase 1 — Core application foundation

**Status: complete.** All six approved slices are merged (issues #18, #20, #16, #17, #19, plus the
renderer spike #15 and its optimization #23), and the phase's product statement holds on the
packaged Windows build: *a user can create, edit, save, reopen, and recover a layered document.*
See `PROGRESS.md` for the exit evidence and the recorded gaps.

### Approved execution plan

1. **Renderer spike (`PERF-01`).** Add CanvasKit/Skia only if its smallest
   official package set can render frozen primitive, text, image, and nested
   group fixtures. Measure total-process, JavaScript, WASM, and GPU memory;
   redraw timing; resize; zoom; replacement; and repeated load/unload. The
   stress interaction target is 33 ms. A failed spike pauses editor work for a
   documented renderer decision.
2. **Editable shapes (`DOC-01`, `DOC-03`, `PATH-01`, `SEL-01`).** Establish
   one versioned document with stable IDs, ordered children, local transforms,
   rectangle/ellipse nodes, and serializable create/select/move commands with
   bounded transactional undo/redo.
3. **Layers and groups (`DOC-02`, `SEL-03`).** Add the layer list,
   multi-selection, sibling reorder, group/ungroup, and nested groups. Reject
   cycles, absent IDs, and invalid parents. Canvas paint order and tree order
   must agree.
4. **Plain text (`TYPE-01`).** Add accessible plain-text editing with content,
   position, size, color, multiline support, and defined missing-font behavior.
   Advanced typography is deferred.
5. **Images (`IMAGE-01`).** Import PNG/JPEG into content-addressed local asset
   storage. Image nodes reference shared bytes and participate in selection,
   movement, grouping, ordering, and history; invalid or excessive images fail
   without altering the document.
6. **Durable local documents (`DOC-04`).** Add new/open/save/save-as, a
   versioned manifest plus asset directory, validation, dirty-state handling,
   and failure-safe open/save. Do not use JSON-embedded base64 assets or
   full-document undo snapshots.

### Cross-slice constraints

- One editor window. React renders controls and the visible layer list; the
  renderer owns drawing objects.
- Commands store inverse data or changed fields, not whole documents. A drag or
  text edit is one bounded history transaction; a fresh command clears redo.
- Renderer and decoded-asset caches are derived, bounded, and explicitly
  disposed. No idle animation or document-wide IPC on pointer movement.
- Cloud, authentication, Supabase, MCP, built-in agents, compiler output,
  collaboration, advanced paths, and the IDE are out of scope.
- Each slice uses its own fresh branch, reviewer assessment, focused checks,
  and catalog/progress update before the next slice.

## Later phases

- [ ] Reach VectorCraft/Illustrator-level feature parity without copying source.
- [ ] Build the React/Tailwind compiler on the completed document model.
- [ ] Add an account-scoped MCP server for authorized AI agents.
- [ ] Add Supabase, shared library, AI assistant, mockup import, and analytics
  after the core application and compiler.
- [ ] Add future owner-selected features after the currently known extras.
- [ ] Consider a full design-tool-plus-IDE workspace only as a distant
  possibility after all earlier work.
- [ ] Add import/export formats and reusable component options.
- [ ] Improve compiler output, accessibility, and project collaboration.

## Delivery model

- [ ] Agents deliver the planned product through parity; project records track
  all milestones, decisions, scope changes, and blockers.
- [ ] The owner begins direct feature work after that parity milestone.

## Planning rule

Before any feature larger than a small documentation update, replace the
relevant checklist item with an implementation plan and wait for approval.

## Approved — UI-01 modern Illustrator shell refinement

**Tracking:** [#62 UI-01: modern Illustrator shell and visible image placement](https://github.com/lleoparden/vectr/issues/62), a sub-issue of [#3 Phase 1 — Core application foundation](https://github.com/lleoparden/vectr/issues/3).

**Problem.** The Phase 1 workspace has the required Illustrator layout and behavior,
but its chrome still reads as a collection of equal-weight dark surfaces. The owner
asked for a closer, more modern Illustrator feel without turning this into a new
tool or panel feature.

**In scope.** On a fresh `enhance/modern-illustrator-shell` branch, refine the
existing shell only: `src/styles.css`, `src/app/shell/MenuBar.tsx`,
`src/app/shell/ToolPalette.tsx`, `src/app/shell/ToolOptionsBar.tsx`,
`src/app/panels/PanelDock.tsx`, `src/app/ui/icons.tsx`, and the focused packaged
UI smoke assertion in `src/dev/smoke.ts`.
The work will make the menu/control strip, left tool rail, right-panel tab strips,
and canvas boundary more deliberately layered; improve the visible active, hover,
and keyboard-focus states; and preserve the established compact desktop metrics.

**Illustrator mapping.** This keeps Illustrator's menu bar, Control panel beneath
it, left tool palette, central pasteboard, right-docked panel groups, Layers-first
ordering, terminology, and shortcut behavior. The deliberately Vectr-specific
dark-violet color system, Inter type, and original icons stay unchanged. No Adobe
or VectorCraft assets, branding, screenshots, or copied styling are permitted.

**Out of scope.** No new commands, tools, menus, panels, document fields,
persistence, renderer changes, keyboard bindings, dependencies, resizeable or
floating panels, rulers, guides, grids, or unimplemented Appearance/Transform/
Align controls. Read-only fields remain honest rather than becoming inert inputs.

**User-flow and data impact.** The only affected flow is visual navigation of the
existing editor shell. The document command path, layer tree, file/recovery path,
renderer, IPC, and compiler contract are untouched; the change must not create,
retain, expose, or discard user work.

**Smallest implementation.** Reuse the current CSS theme tokens and component
classes rather than add a design system or dependency. Adjust only shell surface,
border, and state classes; keep `DOCK_WIDTH`, `PALETTE_WIDTH`, menu ordering,
tool grouping, panel behavior, and action wiring unchanged. Remove the duplicated
global `pre`/verdict CSS declarations while touching the stylesheet.

**Acceptance and evidence.** Existing menus, palette buttons, panel tabs/flyouts,
shortcuts, focus indicators, Layers actions, and canvas pointer behavior remain
unchanged. Add focused assertions only if a token or model-level shell invariant
changes; styling itself is verified in the packaged desktop smoke run plus a
manual Windows visual pass at normal and high DPI. Run `npm run typecheck`,
`npm test`, `npm run build`, and `npm run smoke`; record the Illustrator mapping,
the visual evidence, any divergence, and the results in `docs/DECISIONS.md`,
`docs/PROGRESS.md`, and `docs/PARITY_CATALOG.md` in the same pull request.

**Risks and rollback.** Denser contrast could weaken legibility or obscure focus;
the fixed geometry is therefore preserved and keyboard focus is tested. CSS-only
regression is isolated to this branch and rolls back by reverting the slice.

## Approved — IMAGE-01 completion: linked images, relink, crop, and masks

**Tracking:** [#58 IMAGE-01 follow-up: linked images, relink, crop, and raster masks](https://github.com/lleoparden/vectr/issues/58), a sub-issue of [#3 Phase 1 — Core application foundation](https://github.com/lleoparden/vectr/issues/3).

**Problem.** Vectr currently places and embeds PNG/JPEG assets safely, but `IMAGE-01`
still lacks the linked-image, relink, crop, and image-mask workflows named in the
catalog. The owner approved completing this capability before the UI refinement.

**Scope and document contract.** On `enhance/image-workflows`, extend the versioned
document and serializable command model with: (1) an asset storage mode (`embedded`
or `linked`) and a recorded external path for linked assets; (2) a non-destructive,
normalised crop rectangle on an image node; and (3) an optional raster mask asset on
an image node. A linked file is never copied into the ordinary project asset folder;
it is explicitly reported as missing, changed, or unreadable rather than being
silently substituted. Cropping and mask changes are commands with exact inverses.
Existing v1/v2 embedded documents continue to open unchanged; the writer moves to
the next format version only after the reader and validation accept the old forms.

**User flows.** File ▸ Place offers Embed or Link. The selected image may be relinked
from Properties when its source is unavailable or intentionally replaced. Properties
also exposes crop bounds and Set/Clear Mask for the selected image; mask selection
uses the same guarded PNG/JPEG import boundary. The renderer draws the crop and
applies the raster mask; missing main or mask content remains a labelled placeholder.

**Boundaries and safety.** The renderer receives only decoded runtime bytes from the
asset registry; Electron alone opens or rereads a linked path. Project save writes
only embedded bytes. Recovery snapshots carry the runtime bytes required to restore
unsaved linked work, but restoration retains the link metadata and reports if the
source has changed. All imported/relinked/mask bytes use the existing MIME, byte,
pixel, count, decode, hash, and validation limits. A failed read, decode, relink,
or command leaves the current document and registry untouched.

**Likely files.** `src/doc/{types,document,commands,validate,assets}.ts`,
`src/file/{format,serialize,validate}.ts`, `src/render/{scene,EditorRenderer}.ts`,
`src/state/assetRegistry.ts`, `src/app/{actions.ts,canvas/CanvasView.tsx,files/*,
panels/PropertiesPanel.tsx,menus/*}.ts[x]`, `electron/{main,preload}.cjs`, type
declarations, the image/file/editor/UI tests, packaged smoke steps, and the catalog,
progress, and decisions records. The compiler is not changed: it continues to state
its raster-image limitation explicitly.

**Illustrator mapping and deliberate limits.** Place supports Embed and Link; relink
is explicit; crop and a raster opacity mask are non-destructive. Vectr will not add
image tracing, vector clipping masks, live effects, CMYK/color management, linked
network assets, or a generic mask editor in this slice. Those are separate capability
areas and must not be implied by a raster mask control.

**Acceptance.** Tests prove exact undo/redo, save/reopen, old-format readability,
asset pruning, recovery, missing/changed-link reporting, invalid-input refusal,
crop source-rectangle correctness, and mask lifecycle/disposal. The packaged smoke
run places embedded and linked images, crops and masks an image, saves/reopens,
relinks a missing source, and checks recovery. Run typecheck, tests, build, smoke,
and representative/stress memory evidence; update `IMAGE-01`, `DOC-04`, and the
recorded limitations in the same branch.

**Risk and rollback.** This touches persistence and image memory, so it is an
important change: no merge without full evidence and self-review. The format reader
remains backward-compatible and reverting the branch preserves previously saved
documents.

## Repository structure cleanup (owner request, 2026-10-14)

The owner reported that the folder and file structure had become a mess and asked for it to be
cleaned up. The audit found five problems, and the work is split into two pull requests so either
half can be reverted on its own.

**Found:**

1. Root clutter: a 60 KB proposal page (`vectr.html`) and the wordmark PNG sat next to
   `index.html`, and the repository had no `README.md` at all.
2. `src/app/` was flat: 22 files mixing React components, the action table, pure editing logic,
   file glue, icons, and theme, with `panels/` the only subfolder — an inconsistent rule.
3. Scratch that kept appearing in `git status`: `.ecc/tmp/` smoke logs, `.ecc/issues/` body drafts,
   `tools/vello-raster/build.err.txt` and its build logs, and a full Rust `target/` tree on disk.
4. `docs/` had six documents with overlapping names (PLAN, MASTER_PLAN, PROGRESS) and no index, and
   `PROGRESS.md` carried two `## Next` sections, one of them stale.
5. The benchmark window (`src/app/BenchmarkApp.tsx`) lived away from the harness it belongs to
   (`src/bench/`).

**Approved direction (this is the plan the cleanup follows):**

- 1 — `chore/repo-hygiene`: move the proposal to `docs/proposal/` and the wordmark to
  `docs/assets/`, delete generated logs, ignore `.ecc/tmp/`, `.ecc/issues/`, and `tools` build
  output, add the missing root `README.md` and a `docs/README.md` index, add an `npm run smoke`
  script so the evidence command is discoverable, and retitle the stale `PROGRESS.md` section.
- 2 — `chore/src-app-structure`: group `src/app/` by role — `shell/` (menu bar, status bar, tool
  palette, about dialog, panel flyout), `canvas/` (canvas view, text editor, context menu,
  viewport math), `menus/` (menu model, shortcuts, context-menu contents), `panels/` (unchanged
  plus the dock and the layer row model), `editing/` (arrange and drag planning), `files/` (file
  and image actions), `ui/` (theme tokens and icons) — keeping `App.tsx` and `actions.ts` at the
  root of `src/app/` because they are the shell entry point and the action hub. The benchmark
  window moves to `src/bench/`.

**Why this shape:** the groups follow what a reader asks for ("where is the menu built", "where do
groups get computed"), each folder has one kind of thing in it, and no module is renamed — only
moved, so the diff stays mechanical and verifiable by typecheck, the test suite, the build, and the
packaged smoke run. Imports outside `src/app` change in `src/main.tsx`, `src/dev/smoke.ts`, and six
test files; `src/app/actions.ts` keeps its path so the hub import stays stable.

**Outcome:** both pull requests are merged — hygiene as #43 (`48915fd`) and the code layout as the
follow-up branch `chore/src-app-structure`. The move rewrote 99 import specifiers across 27 files
with `git mv` preserving history, and it changed nothing but paths: typecheck clean, 119/119 tests,
an identical production bundle hash, and 37/37 packaged smoke steps. The layout is recorded in
`docs/DECISIONS.md`.
