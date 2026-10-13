# Vectr master project plan

## Outcome

Build a desktop-first vector design application with VectorCraft/Illustrator
feature parity, without copying VectorCraft source or branding. Its defining
addition is a compiler that converts a Vectr document's layer tree into
readable, usable React components styled with Tailwind.

This is a living delivery plan, not an approval to start product code. Each
phase becomes an approved feature plan before implementation.

## How progress is measured

The project will maintain a parity catalog. Every catalog item has:

- a stable ID and user-facing capability;
- reference evidence from VectorCraft and/or Illustrator documentation;
- a status: `planned`, `designed`, `building`, `verified`, `blocked`, or
  `deferred`;
- its supported file formats and compiler behavior; and
- links to the implementation plan, issue, and evidence when available.

`docs/PROGRESS.md` records current phase, completed milestones, blockers, and
next approved work. The catalog is the source of truth for the parity claim;
no percentage is published until the catalog exists.

## Phase 0 — Scope and platform decision

**Goal:** establish what will be built and on which desktop foundation.

1. Inventory VectorCraft and Illustrator capabilities into the parity catalog:
   tools, panels, commands, document features, effects, import/export formats,
   shortcuts, and accessibility behavior.
2. Decide desktop targets, rendering approach, language/runtime, UI framework,
   packaging, local-storage model, and Supabase boundaries.
3. Define the product's original visual identity and licensing policy.
4. Define performance budgets, offline expectations, crash recovery, and a
   feature-completion standard.

**Exit:** approved technology ADRs, parity catalog v1, and a scoped MVP.

## Phase 1 — Document and editor foundation

**Goal:** make a reliable editable design document before advanced tools.

1. Define the versioned document model: artboards, layer tree, groups, text,
   vector shapes, paths, images, style/transform data, and metadata.
2. Implement local project creation, autosave, undo/redo, recovery, selection,
   layers, artboards, zoom/pan, and a desktop command/menu framework.
3. Add authenticated project metadata and backup/sync boundaries through
   Supabase without making the editor unusable offline.
4. Establish fixtures that cover document save/reopen and layer-tree integrity.

**Exit:** a user can create, edit, save, reopen, and recover a layered document.

## Phase 2 — Core vector illustration

**Goal:** cover everyday vector creation and transformation.

1. Deliver selection/direct selection, transform, align/distribute, snapping,
   smart guides, rulers, grids, and artboard management.
2. Deliver rectangles, ellipses, lines, polygons, stars, pen/anchor editing,
   curves, strokes, fills, gradients, swatches, opacity, and blend modes.
3. Deliver groups, clipping masks, isolation, stacking order, lock/hide, and
   dependable duplicate/copy/paste behavior.
4. Make every completed capability update the parity catalog and compiler
   support matrix.

**Exit:** users can create polished layered vector artwork with standard tools.

## Phase 3 — Type, images, and visual appearance

**Goal:** support the non-path content that real design files require.

1. Deliver editable text, character/paragraph styles, font handling, text on
   path, area text, and multilingual layout requirements from the catalog.
2. Deliver image place/embed/link, crop, masks, color management, and asset
   relinking behavior.
3. Deliver appearance stacks, effects, transparency, gradients, patterns,
   brushes, symbols/components, and reusable styles in catalog priority order.

**Exit:** mixed text, image, and vector compositions survive save/reopen and
render predictably.

## Phase 4 — Precision drawing and advanced editing

**Goal:** close the core Illustrator workflow gap.

1. Deliver Pathfinder/Shape Builder and exact boolean operations.
2. Deliver blends, repeats, envelope/mesh-like workflows, compound paths,
   offset/path operations, perspective, and tracing according to catalog scope.
3. Add keyboard shortcuts, contextual controls, panels, and automation hooks
   only where catalog behavior requires them.
4. Profile large documents and improve rendering/editing without compromising
   document correctness.

**Exit:** advanced vector workflows are usable and cataloged rather than
placeholder menu items.

## Phase 5 — Files, import/export, and interoperability

**Goal:** make user work portable and recoverable.

1. Define Vectr's documented native file format and compatibility policy.
2. Add SVG import/export first, then PDF, raster exports, and other formats in
   catalog priority order.
3. Treat Illustrator-compatible files as an interoperability effort with
   explicit fidelity reporting; never imply unsupported editable round-trips.
4. Add packaging, linked-asset management, print/export settings, and format
   regression fixtures.

**Exit:** users can reliably exchange the formats promised by the catalog.

## Phase 6 — React and Tailwind compiler

**Goal:** turn a Vectr document into maintainable application code.

1. Specify the export contract: one component per layer, groups compose child
   components, stable readable names, deterministic formatting, and a clear
   asset-output layout.
2. Map supported geometry, typography, transforms, fills, clipping, images,
   and responsive behavior to React, Tailwind, CSS, and SVG as appropriate.
3. Clearly flag features that cannot be represented faithfully in Tailwind
   alone; generate the smallest readable CSS/SVG adjunct instead of misleading
   output.
4. Build an export preview and round-trip comparison workflow so generated code
   can be inspected against the source document.
5. Maintain a compiler support matrix tied to the parity catalog; every editor
   capability is `supported`, `partial`, `raster fallback`, or `not exportable`.

**Exit:** a supported layered document exports to understandable React/Tailwind
code that renders as expected and can be edited by a developer.

## Phase 7 — Parity closure and agent handover

**Goal:** finish the declared catalog and prepare the owner to continue safely.

1. Work remaining parity-catalog items by user value, dependencies, and risk.
2. Resolve every `partial`, `fallback`, and `blocked` compiler entry or record
   an explicit supported-limit decision.
3. Complete desktop packaging, update/recovery behavior, accessibility, and
   documentation for supported targets.
4. Produce a handover map: architecture, active decisions, feature catalog,
   open limitations, contribution rules, and next priorities.

**Exit:** the catalog's agreed scope is complete and the owner can add features
with an accurate map of the product.

## Operating cadence

For each catalog capability:

1. Create a focused GitHub issue with the approved template.
2. Write and obtain approval for its implementation plan.
3. Create one fresh purpose-prefixed branch.
4. Trace the relevant document, editor, persistence, compiler, and file-format
   boundaries before changing code.
5. Update the parity catalog and `docs/PROGRESS.md` when the capability changes
   status.

## Known decisions still needed

- Which desktop technology and operating systems are in scope first.
- Whether cloud project files are source-of-truth, backup-only, or optional.
- The exact baseline/version of Illustrator and VectorCraft used for parity.
- The public/private licensing and release model for Vectr.
- MVP boundaries before the full parity program begins.
