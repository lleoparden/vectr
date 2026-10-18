# Documentation

Seven documents carry the project record. Each has one job; when two seem to overlap, the more
specific one wins.

| Document | Job | Update when |
| --- | --- | --- |
| [`PLAN.md`](PLAN.md) | The operational checklist for the phase in progress, plus the approved slice plans. | A phase or slice is planned, started, or finished. |
| [`MASTER_PLAN.md`](MASTER_PLAN.md) | The full multi-phase roadmap and the phase goals behind the checklists. | The roadmap itself changes. |
| [`PARITY_ROADMAP.md`](PARITY_ROADMAP.md) | The reference architecture, the ranked gap list adapted from VectorCraft's, and why the phases are ordered as they are. | The architecture or the ordering changes. |
| [`PROGRESS.md`](PROGRESS.md) | What is done, what is in flight, the evidence for it, and the known gaps and limitations. | Every time something ships. |
| [`DECISIONS.md`](DECISIONS.md) | Why things are the way they are: settled choices, divergences from Illustrator, and their reasons. | Any choice another person would otherwise re-litigate. |
| [`PARITY_CATALOG.md`](PARITY_CATALOG.md) | The capability inventory with status per feature area. | Any behavior change, in the same pull request. |
| [`RENDERER_COMPARISON.md`](RENDERER_COMPARISON.md) | The recorded renderer candidate comparison behind `PERF-01`. | Renderer numbers are re-measured. |

Supporting material:

- [`proposal/vectr-project-proposal.html`](proposal/vectr-project-proposal.html) — the original
  project proposal page.
- [`assets/vectr-wordmark.png`](assets/vectr-wordmark.png) — the wordmark.
- `../.ecc/benchmarks/` — the recorded benchmark runs each phase's numbers come from.
