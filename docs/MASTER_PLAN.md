# Vectr master project plan

## Outcome

Build a desktop-first vector design application with VectorCraft/Illustrator
feature parity, without copying VectorCraft source or branding. The primary
program is the illustration application itself. Its first major addition after
that core is a compiler that converts a Vectr document's layer tree into
readable, usable React components styled with Tailwind.

This is a living delivery plan, not an approval to start product code. Each
phase becomes an approved feature plan before implementation.

## Priority and historical context

The original graduation-project proposal remains useful product research, but
it is not the current specification. The current owner direction overrides it:

- Vectr is a long-running product, not a graduation project.
- Reconstructing the Illustrator/VectorCraft-class application is the main
  program. Recent reverse-engineering capability makes this a realistic,
  evidence-led effort.
- The compiler follows the core application and shares its document model.
- Mockup import, AI assistant, shared library, analytics, cloud services, and
  IDE-like code editing are later features. The core architecture must leave
  extension points for them without prematurely implementing them.
- The stack is deliberately undecided and will change from the proposal's
  web/Paper.js/Node direction.

## Agent-ready core architecture

MCP and the built-in agent arrive later as product features, but the core app
must be built around these constraints from the beginning:

1. **One command model.** UI gestures, keyboard shortcuts, MCP calls, and
   built-in-agent proposals invoke the same validated document commands; none
   receives a private mutation path.
2. **Serializable document operations.** Changes have typed inputs, explicit
   results/errors, undo/redo behavior, and stable document-version semantics.
3. **Context without hidden access.** Selection, active tool, artboard, and
   document context can be exposed to an agent, but permissions and account
   ownership remain enforced at the command boundary.
4. **Observable changes.** Commands emit structured change events so people,
   MCP clients, autosave, compiler previews, and future collaboration can stay
   synchronized without polling or bypassing the application model.
5. **Reviewable agent output.** A built-in agent may explain or propose edits;
   applying a change must be explicit, attributable, and reversible.

These are core design constraints, not a reason to implement MCP, cloud auth,
or the built-in agent before their planned phases.

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

## Phase 0 — Reference catalog and platform decision

**Goal:** establish what will be built and on which desktop foundation.

1. Inventory VectorCraft and Illustrator capabilities into the parity catalog:
   tools, panels, commands, document features, effects, import/export formats,
   shortcuts, and accessibility behavior.
2. Define the lawful, evidence-led reconstruction workflow: behavior and
   publicly observable artifacts may guide Vectr; VectorCraft source and
   branding must not be copied.
3. Decide desktop targets, rendering approach, language/runtime, UI framework,
   packaging, local-storage model, and Supabase boundaries.
4. Define the product's original visual identity and licensing policy.
5. Define performance budgets, offline expectations, crash recovery, and a
   feature-completion standard.

**Exit:** approved technology ADRs, parity catalog v1, and a scoped MVP.

## Phase 1 — Document and editor foundation

**Goal:** make a reliable editable design document before advanced tools.

1. Define the versioned document model and command model: artboards, layer
   tree, groups, text, vector shapes, paths, images, style/transform data,
   metadata, validated operations, undo/redo, and change events.
2. Implement local project creation, autosave, undo/redo, recovery, selection,
   layers, artboards, zoom/pan, and a desktop command/menu framework on that
   shared command model.
3. Establish fixtures that cover document save/reopen and layer-tree integrity.

Cloud identity, Supabase persistence, and shared storage are intentionally out
of this phase. The document model must still be versioned and portable enough
to support them later.

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

## Phase 3 — Full illustration parity

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

## Core parity gate

Before the compiler begins, finish the agreed VectorCraft/Illustrator parity
catalog for the core application. Any remaining unsupported item must be an
explicit, owner-approved exception—not an untracked gap.

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

## Phase 7 — MCP server for account-scoped agents

**Goal:** let authenticated AI agents operate Vectr through a deliberate,
auditable control surface.

1. Define an MCP server that exposes document, canvas, layer, selection, tool,
   import, export, and command operations in terms of the same application
   model used by people.
2. Bind every MCP session to a signed-in Vectr account and its projects. An
   agent may act only within that account's permissions and explicit grants.
3. Require confirmation or policy controls for destructive, expensive, or
   externally visible actions; record an audit trail for agent actions.
4. Ensure agents and people can collaborate on the same document without
   corrupting document state or bypassing normal validation.

**Exit:** an authorized agent can perform supported Vectr work for its account
through the app's safe, observable command surface.

## Phase 8 — Cloud, collaboration, and proposal extensions

**Goal:** add the original proposal's supporting capabilities after the core
application and compiler are established.

1. Add Supabase sign-in, project backup/sync, encrypted storage, concurrent
   shared-library behavior, and backend API-key proxying where needed.
2. Add the shared editable vector library and usage analytics.
3. Add the context-aware AI assistant with reviewable suggested changes only.
4. Add Mockup Import: classical raster tracing first, then optional learned
   cleanup, grouping, semantic labeling, and fusion into the standard document
   model.

**Exit:** these features extend the proven core instead of defining or blocking
it.

## Phase 9 — Further product expansion

**Goal:** add new capabilities chosen after the currently known extra features
are complete.

This phase is intentionally open-ended. New ideas get their own approved plan,
catalog entries, and purpose-specific branches; none should be precommitted
just to fill a roadmap slot.

## Phase 10 — Distant possibility: design tool and IDE convergence

**Goal:** explore a workspace where Vectr is both the visual illustration app
and an editable code environment.

This may someday evolve the Design/Code tabs into a true IDE experience, but
it is not near any currently planned feature. It becomes discussable only after
core parity, compiler, known extra features, and later owner-selected product
expansion are complete. It requires a separate product decision and plan.

## Ongoing stewardship and handover

**Goal:** finish the declared catalog and prepare the owner to continue safely.

1. Resolve every `partial`, `fallback`, and `blocked` compiler entry or record
   an explicit supported-limit decision.
2. Complete desktop packaging, update/recovery behavior, accessibility, and
   documentation for supported targets.
3. Maintain a handover map: architecture, active decisions, feature catalog,
   open limitations, contribution rules, and next priorities.

**Milestone:** after core parity and compiler, the owner can add features with
an accurate map of the product; stewardship continues as Vectr grows.

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
- The first operating systems and desktop distribution model.
- MVP boundaries before the full parity program begins.
