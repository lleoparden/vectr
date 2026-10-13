# Decisions

## 2026-10-13 — Product direction

- Vectr is an Illustrator-like visual design tool with a layer-to-code feature.
- Every drawn layer becomes a readable React component; output uses Tailwind.
- Text, shapes, images, groups, and nested groups are MVP layer types.
- Supabase is the intended free-tier service for accounts and persistent projects.
- VectorCraft is a workflow reference only. No VectorCraft source or branding
  will be copied.
- The primary platform is likely a normal desktop app, but the platform and
  stack remain unchosen until a dedicated decision is approved.

## 2026-10-13 — Repository workflow

- This setup is documentation and GitHub governance only: no app scaffold,
  dependencies, source code, or verification checks.
- TrustFlow's reusable conventions are adopted in a simplified form: plan
  significant work first, reuse established patterns, record decisions, and
  make scope and risk explicit in GitHub work items.
- Approved additions: Graphify, architect/worker/reviewer roles, safety and
  context hooks, feature tracing, architecture planning, and agent-ready issue
  criteria. Supabase safeguards and walkthroughs are deferred.

## 2026-10-13 — Delivery and branch policy

- Agents are the primary builders until VectorCraft/Illustrator-level parity
  and the React/Tailwind compiler are complete; the owner plans to extend the
  product afterward.
- Progress tracking is a primary deliverable. `docs/PLAN.md` and
  `docs/PROGRESS.md` must remain current.
- Every product work item uses one new, purpose-prefixed branch: `feat/`,
  `fix/`, `enhance/`, `update/`, `chore/`, or `docs/`. Branches are never
  reused for another work item, and `main` is not a product-work branch.

## 2026-10-13 — Master delivery plan

- The project is planned as a long-running parity program, measured by a
  feature catalog rather than an ungrounded percentage.
- The plan is phased: scope/platform, foundation, core vector work, content and
  appearance, advanced editing, interoperability, compiler, then parity closure
  and handover.
- A Vectr feature is not implicitly compiler-supported. The catalog tracks its
  explicit compiler support level and any fidelity limitation.
