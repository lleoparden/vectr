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
- The owner reviews and tests each pull request and makes every merge decision.
  Agents never merge or push to `main` without explicit approval.
- A pull request is not ready for review until its scope is complete, its
  self-review is done, its checks were actually run, and its catalog/progress
  updates are included.

# Agent-ready issue workflow

An issue may receive the `agent-ready` label only when it contains:

- the user problem and expected outcome;
- clear scope boundaries;
- testable acceptance criteria;
- relevant risks and dependencies;
- an approved implementation plan; and
- no unresolved product or platform decision.

Remove `agent-ready` when a requirement becomes ambiguous or blocked.
