# Phase 6 (Type) - REA and oracle checklist

Phase 6 is defined in [MASTER_PLAN.md](MASTER_PLAN.md): point and area text, text on a path, threading,
character and paragraph styles, tabs and alignment, vertical type, a real missing-font substitute workflow,
and text-to-outline. This checklist decides, per capability, **what evidence can answer a question** before
any probe is built, so the oracle stays small.

Three evidence kinds:

- **A - artifact evidence.** Command ids, labels, or symbols that must appear in the packaged bundle. These
  join the contract in `scripts/verify-artifact.mjs` in the slice that adds them; no Illustrator needed.
- **O - oracle needed.** Behaviour that only Illustrator can answer: measurements, ordering, what an operation
  actually produces. These become ExtendScript probes over COM with committed JSON fixtures (see the probe
  plan below).
- **D - documented-only.** A convention we can follow from Adobe's documentation and the scripting object
  model without probing; record the source, accept the risk, and re-check only if a bug contradicts it.

**Boundary:** the oracle is black-box observation of the installed application. No Adobe binary is read or
decompiled, no asset is copied. One open legal flag: check Adobe's EULA for automation and competitive-use
clauses before relying on the oracle as a permanent fixture source.

## Capability matrix

| # | Capability | Evidence | Why | Concrete probe / id |
| --- | --- | --- | --- | --- |
| 6.1 | Point text model: baseline, line height, alignment, measured box | **O** | Our `estimateTextSize` approximates; Illustrator's measured box and baseline are the ground truth | Create point text at 12/18/24 pt, three alignments; read `geometricBounds`, `baseline`, `textRange.characterAttributes.size/leading`, `position` |
| 6.2 | Area text: width/height box, overflow, inset | **O** | Overflow and padding rules decide the model; docs do not give numbers | Area frame 100x60 with 200 words; read `geometricBounds`, `textRange.lines.length`, `rowCount`, `columnCount`, `firstBaselineOffset` |
| 6.3 | Text on a path: start offset, alignment, orientation, flipping | **O** | Start offset and side-of-path rules are behavioural | Path circle + straight line; `textPath.startOffset` 0/50/100%; read `textPath` properties and rendered bounds |
| 6.4 | Threading: linked frames, overflow chain | **O** | Link order and what happens on resize is behavioural | Two frames linked via `nextFrame`; shrink the first; read where the second begins and what overflows |
| 6.5 | Character/paragraph styles: attributes that must survive reopen | **O + D** | Attribute list is documented (D); precedence/overrides are behavioural (O) | Script creates a character style and paragraph style, applies, reads `characterStyles`/`paragraphStyles` and per-range attributes |
| 6.6 | Tabs and paragraph alignment (left/centre/right/justify, last-line) | **O** | Tab stop units and justify behaviour affect layout | Set three tab stops; read `tabStops` and line positions for each alignment |
| 6.7 | Vertical type | **O + D** | The attribute is documented (D); line progression and punctuation rotation are behavioural (O) | Create vertical frame with mixed CJK/Latin; read bounds and line origins |
| 6.8 | Missing-font substitute workflow | **O** | The API's behaviour when a family is absent decides our model | Document using a font family absent on this machine; read `textRange.characterAttributes.textFont`, `app.textFonts`, and what Illustrator substitutes |
| 6.9 | Text-to-outline | **O** | The produced geometry (compound paths, anchors, bounds) is exactly what we would compare | `app.executeMenuCommand('createOutlineText')` on a two-line text; read `pathItems`, `pathPoints`, `geometricBounds`, fill/stroke |
| 6.10 | Text editing interactions (caret, selection, IME) | **D + observation** | Not scriptable; conventions from docs and observed use | Manual checklist only; no oracle fixture |
| 6.11 | Type commands exist in the shipped build | **A** | Packaging must contain what the source added | Add ids when each slice lands: e.g. `type.outline`, `type.area`, `type.thread`, `type.styles`, `type.vertical`, `type.textOnPath` (names final at slice time) |

Rules that fall out of the matrix:

- **No oracle for anything in the A column.** The artifact script already proves presence and, with `SINCE`,
  absence.
- **No oracle for editing interactions.** COM cannot see a caret; those are documentation plus an observed
  checklist, and saying so is cheaper than a fake fixture.
- **Styles and vertical type are split.** Probe precedence and line progression (O); take the attribute list
  from documented scripting properties (D) rather than enumerating it by poking.

## Probe plan (only after this checklist)

1. **Pin the application.** Record `app.name`, `app.version`, and the locale in every fixture. Illustrator 2023
   reports its own version string; the fixture is invalid against a different install and must be re-recorded.
2. **Convert units explicitly.** Illustrator scripting returns **points**; Vectr scene units are CSS pixels.
   The probe records raw points and the fixture also stores the converted values at `1pt = 4/3px`, so a
   tolerance bug cannot hide in the conversion.
3. **One probe per question.** A probe creates a fresh document, performs the smallest action, reads named
   properties, and closes without saving. No probe depends on another probe's document.
4. **Graceful failure.** Every probe runs with a timeout; a modal dialog or hung instance is killed and retried
   once, then recorded as a failed probe rather than silently skipped. Pixel/geometry comparisons use stated
   tolerances (target: bounds within 0.5 pt, anchor coordinates within 0.1 pt, text measurement within 1% of
   font size), because float noise and version differences are expected.
5. **Fixtures are committed, tests do not need Illustrator.** Each probe writes JSON under
   `tests/fixtures/illustrator/` (version, locale, inputs, raw outputs, converted outputs, tolerances). The unit
   suite reads those fixtures; running the oracle is a separate, opt-in command.
6. **Append, do not rewrite.** A new Illustrator version adds a versioned fixture; it never overwrites the old
   one, so comparisons stay honest about which build produced which number.



## Recorded fixtures

| Fixture | Probe | Illustrator | What it pins |
| --- | --- | --- | --- |
| `tests/fixtures/illustrator/point-text.json` | point text at 12/18/24 pt | 27.3.1 (Myriad Pro) | leading is exactly 1.2 x size, the measured box grows with size, position is the anchor, points convert at 4/3 px |

The runner is `npm run oracle:illustrator -- -Probe point-text -Out <fixture>` (Windows PowerShell). It
launches Illustrator through COM, records the version with the result, waits at most 180 s, and kills and
retries once if the instance hangs. The fixture is written without a BOM and read by
`tests/illustratorFixtures.test.ts`, so the suite never needs Illustrator installed.

Two constraints learned while recording the first fixture:

- **ExtendScript has no JSON object.** Probes return a compact delimited string and the test parses it; do
  not assume `JSON.stringify` exists in the Illustrator scripting engine.
- **Points are not pixels.** The fixture keeps Illustrator's point values and the test applies the 4/3
  conversion; mixing the two would hide a tolerance bug.

## What Phase 6 still needs from REA proper

- **Artifact side:** add one id per shipped command, and a `SINCE` entry for any fix-only symbol, so
  `verify:artifact` proves each installer contains the slice.
- **Runtime side:** if a packaging bug appears in text editing, `capture-electron-scenario` can observe the
  shipped Electron app; that is REA's supported lane on Windows.
- **Not REA:** Illustrator's native code, Adobe assets, and anything requiring decompilation. Blocked on
  Windows for native UI anyway (see [REA.md](REA.md)).

## Exit for this checklist

- Every Phase 6 capability has exactly one primary evidence kind, and the O items each name a probe and a
  measurable output.
- The A items are tracked to become contract entries, not hopes.
- Nothing in the matrix requires reading Adobe internals.
