# Phase issue and pull-request workflow

Every phase in `docs/MASTER_PLAN.md` has one epic issue. Epics for all phases are
created up front; sub-issues are generated only when their phase starts.

## 1. Epic issue (created up front, one per phase)

An epic is descriptive and self-contained. It records:

- the phase goal and why the phase exists in the program;
- its position: what it depends on and what depends on it;
- its deliverables, taken from `docs/MASTER_PLAN.md`;
- the parity catalog IDs it will create, change, or verify;
- exit criteria that prove the phase is complete;
- explicit non-goals, so scope cannot drift;
- risks, blockers, and decisions still needed;
- the phase's pull-request strategy (chosen by the agent at phase start);
- a task list linking each sub-issue.

## 2. Sub-issues (created when the phase starts)

One sub-issue per approved slice, written before any code changes. Each
sub-issue carries the full slice plan:

- the problem and the intended user-visible outcome;
- the approved plan reference in `docs/PLAN.md`;
- every file, module, type, command, or asset the slice creates or changes;
- the document, persistence, renderer, compiler, and IPC boundaries it touches;
- acceptance criteria and the exact checks or evidence to run;
- risks, failure cases, and rollback;
- the catalog and `docs/PROGRESS.md` updates it must carry.

## 3. Pull requests

- Agents choose the strategy for the phase and record it in the epic (for
  example stacked slice branches, or one branch per slice merged in order).
- One branch serves one work item; the branch name uses a purpose prefix.
- Every commit and pull request references its issue; the pull request uses the
  template in `.github/PULL_REQUEST_TEMPLATE.md`.
- A pull request is not ready to merge until its scope is complete, its
  catalog/progress updates are included, and the checks below were actually run on
  the branch head.
- **Required self-review before any merge.** The agent re-reads the full diff as a
  reviewer — including a pull request it wrote moments earlier — and posts the
  conclusion on the pull request: what the diff actually changes, any counter-
  argument or risk it found, what it verified, and any residual doubt. A pull
  request whose self-review finds an unresolved doubt does not merge.
- **Agents may merge a small pull request themselves** when all of these hold:
  the diff is confined to one approved slice or one small work item; it does not
  touch a decision surface listed below; `npm run typecheck`, `npm test`, and
  `npm run build` pass on the branch head; documentation, catalog, and progress
  updates are included; and the self-review found no unresolved doubt. The merge
  uses a merge commit.
- **Big or important pull requests need the owner's review and merge decision.**
  A pull request is big or important when it changes any decision surface: the
  document format or persisted data, the command/undo model, persistence or file
  I/O, the renderer path or published performance limits, dependencies, the stack,
  security, permissions, or accounts, or any public interface later slices build
  on. It is also big when it spans more than one slice, exceeds a few hundred lines
  of non-test change, or when the agent cannot honestly judge it.
- Agents never squash, rebase, force-push, or delete a branch, and never push
  directly to `main`. Every change reaches `main` through a pull request.
- **The UI direction is a review criterion.** Vectr's interface is a modern
  Illustrator (`AGENTS.md`, Product identity, and `docs/DECISIONS.md`, 2026-10-14):
  the same workspace logic, panel set, terminology, and shortcut conventions an
  Illustrator user expects, with Vectr's own original icons, type, colors, and copy.
  A pull request that changes the interface states its Illustrator mapping — what
  matches, what deliberately differs, and what is not built yet — and records every
  deliberate divergence in `docs/DECISIONS.md`. An interface change that quietly
  invents a different layout, terminology, or shortcut does not merge, and neither
  does one carrying Adobe or VectorCraft assets, screenshots, or branding.

# Agent-ready issue workflow

An issue may receive the `agent-ready` label only when it contains:

- the user problem and expected outcome;
- clear scope boundaries;
- testable acceptance criteria;
- relevant risks and dependencies;
- an approved implementation plan;
- for a slice with a user interface, its Illustrator mapping (what matches
  Illustrator, what deliberately differs with a recorded reason, and what is not
  built yet), per the UI direction in `AGENTS.md` and `docs/DECISIONS.md`; and
- no unresolved product or platform decision.

Remove `agent-ready` when a requirement becomes ambiguous or blocked.
