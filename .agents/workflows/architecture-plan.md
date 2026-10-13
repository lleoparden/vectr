# Architecture plan workflow

Use this workflow before any feature, refactor, database change, or compiler
change that is larger than a small documentation edit.

1. Read `AGENTS.md`, `docs/PLAN.md`, `docs/PROGRESS.md`, and
   `docs/DECISIONS.md`.
2. State the user problem, in-scope work, and explicit non-goals.
3. Identify affected user flows, saved document data, compiler output, and
   external services.
4. Reuse existing patterns; name any new abstraction and why it is necessary.
5. Record interfaces, risks, acceptance criteria, and the smallest viable
   implementation in `docs/PLAN.md`.
6. Wait for the owner to approve the plan before changing product code.
