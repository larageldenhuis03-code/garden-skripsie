# Silly Goose MVP — project plan

This is the canonical source for product scope, current status and execution
order. If another document conflicts with this one, this one wins.

Updated: 2026-07-27

## Product outcome

Turn a Western Cape gardener’s site conditions, bed dimensions and design
preferences into a suitable plant group and a practical, measured planting
layout.

## Current status

The repository contains a **plant-discovery prototype**, not the completed
research-paper MVP.

| In place | Still missing |
|---|---|
| Desktop-first application | Reviewed soil and environmental rules |
| Five-question garden brief | Exact bed dimensions and geometry |
| Provisional plant ordering | Complete hard-constraint filter |
| Searchable 48-plant library | Expert-calibrated AHP weights |
| Plant details and evidence notes | Goal Programming ranking |
| Device-local saved list | Group selection and plant quantities |
| Western Cape data foundation | Measured 2D planting layout |
| Image placeholders | Approved visual asset system |
| Tested planning-maths kernel | Reviewed rules and live engine integration |

The current ordering is a hand-set heuristic. It must not be described as the
paper’s AHP or Goal Programming model.

The repository now has a tested, UI-independent kernel for AHP consistency,
hard-constraint tracing, Goal Programming deviations and provisional binary
group selection. It is deliberately uncalibrated and does not change visible
results yet.

## Primary user

A beginner or intermediate Western Cape home gardener who wants to use
indigenous plants but does not know:

- which plants are feasible for the site;
- which plants work well together;
- how many plants fit; or
- where to place them.

Desktop is the primary planning surface. Mobile remains usable but is not the
defining composition.

## Current prototype journey

1. Choose a broad Western Cape area.
2. Describe sunlight, water availability and approximate room.
3. Choose one or more planting intentions.
4. Review a provisionally ordered plant list.
5. Inspect plant details and data limitations.
6. Save plants on the current device.

## Target MVP journey

1. Describe location, soil, sunlight and available water.
2. Enter the bed’s dimensions and shape.
3. Choose a design direction and practical goals.
4. Remove plants that fail reviewed hard constraints.
5. Rank the feasible candidates through the calibrated decision model.
6. Select a balanced plant group within the spatial budget.
7. Generate quantities, coordinates, spacing and a 2D plan.
8. Show the assumptions, evidence and local checks still required.

## The execution sequence

Work through these gates in order. Do not start a later gate merely because it
is visually interesting.

### Gate 1 — approve and integrate the hero design

Owner: user, guided by Codex

The visual workflow is strictly one design at a time:

1. Codex supplies the single active prompt from `VISUAL_SYSTEM.md`.
2. The user pastes it into GPT and generates a design.
3. The user attaches the full-resolution result in this conversation.
4. Codex assesses crop, legibility, style and page fit.
5. The user revises it in GPT or approves it.
6. Codex integrates and deploys the approved asset in context.
7. The user approves the live result.
8. Only then does the next prompt become active.

The only active design now is:

`V01 — home-cape-cabinet.webp`

Done when:

- the hero is explicitly approved in the deployed site;
- the paper feels genuinely old rather than filtered beige;
- the botanical style is recognisably Western Cape;
- desktop and mobile crops both work; and
- the result is strong enough to become the reference for V02.

Do **not** generate V02, the finder plates, page backgrounds or plant portraits
before this gate closes.

### Gate 2 — extend the visual system one asset at a time

Owner: Codex, approved by user

The next active prompt is released only after the previous asset is approved in
the site. The queue is maintained in `VISUAL_SYSTEM.md`.

The first three assets establish the system:

1. V01 — home hero
2. V02 — global paper texture
3. V03 — wandering goose marginalia

Further page assets remain blocked until V03 is approved.

Done when:

- the home, finder and plant-card surfaces share the approved language;
- motion feels physical and restrained;
- no generated text is embedded in the artwork; and
- the user approves the visual system before page-specific production
  continues.

### Gate 3 — define the constraint contract

Owner: Codex with horticultural input

Define:

- the complete user inputs;
- every plant attribute the engine needs;
- which criteria are hard or soft;
- how missing and uncertain values behave;
- the source and confidence level for each field; and
- the explanation returned for every rejection or penalty.

The minimum new inputs are soil, exact bed dimensions/shape and design
direction.

Done when:

- the schema and data dictionary are written;
- hard and soft criteria cannot be confused;
- every missing-value path is explicit; and
- reviewed test fixtures describe expected feasible and infeasible plants.

Engineering status: the generic constraint executor and missing-evidence
policy are implemented and tested. The horticultural constraint catalogue,
input schema and reviewed fixtures are still required, so this gate is not
complete.

### Gate 4 — complete and review the data

Owner: Codex with horticultural and legal review

Add or review:

- soil compatibility;
- sun and water tolerance;
- mature canopy diameter or an explicit imputation rule;
- plant category and style membership;
- current legal status and audit date;
- category composition rules; and
- confidence/provenance for editorial attributes.

Done when every field required by Gate 3 is populated, explicitly unknown or
excluded from the model.

### Gate 5 — implement hard feasibility filtering

Owner: Codex

Implement preserving/reject filters before optimisation.

Done when:

- no hard-infeasible plant reaches ranking;
- every rejection has a plain-language reason;
- missing data cannot silently become compatibility; and
- automated tests cover boundary and sparse-data cases.

### Gate 6 — calibrate and implement soft ranking

Owner: Codex with horticultural experts

1. Run AHP pairwise comparisons.
2. Normalise the comparison matrix.
3. Calculate `λmax`, the consistency index and consistency ratio.
4. Reject weight sets that fail the agreed threshold.
5. Use the accepted weights in Goal Programming.
6. Return the penalty trace with every candidate.

Done when reviewed fixtures rank as expected and every contribution can be
reconstructed from the output.

Engineering status: AHP calculation, strict `CR < 0.10` gating, directional
Goal Programming penalties and pre-emptive comparison are implemented and
tested. Expert comparisons, accepted weights, targets and reviewed outcome
fixtures are still missing. The current UI heuristic remains active.

### Gate 7 — select the group and generate the layout

Owner: Codex

1. Calculate usable bed area and open-space allowance.
2. Use mature canopy area as spatial cost.
3. Enforce category minima and maxima.
4. Implement the multidimensional-knapsack feasibility model.
5. Start with a greedy constructive solver behind a replaceable interface.
6. Place circular canopy footprints in a rectangular bed.
7. Return quantities, coordinates, spacing, legend and unused area.

Done when the numerical feasibility result and rendered plan agree.

Engineering status: the paper's binary area model has a validator and a
replaceable greedy constructor. It is explicitly provisional: binary species
selection cannot calculate plant quantities. The required model corrections
are recorded in `METHODOLOGY.md`; the integer quantity model and 2D placement
remain to be built after spacing inputs are reviewed.

### Gate 8 — validate the target MVP

Owner: Codex, user and horticultural reviewers

- Review outputs with horticultural experts.
- Run failure-mode and effects analysis.
- Test very small beds, deep shade, missing soil data, incompatible styles and
  sparse candidate pools.
- Record sensitivity to weights, targets and open-space ratio.
- Test keyboard, narrow-screen and reduced-motion behaviour.

Done when known failure modes have controls and user-facing explanations.

## Immediate next actions

The user can continue the visual lane independently:

> Copy the active `V01` prompt from `VISUAL_SYSTEM.md` into GPT, generate one
> hero design and attach the full-resolution result in this conversation
> labelled `V01 hero`.

The technical lane now needs, in order:

1. define the complete site and plant input contract;
2. turn reviewed horticultural knowledge into named hard constraints;
3. choose a small expert panel and collect the first pairwise matrix;
4. review spacing and canopy assumptions for an integer quantity model; and
5. create expected-result fixtures before replacing the UI heuristic.

No second visual prompt is active. Technical foundation work may proceed in
parallel, but no unreviewed rule or weight may influence visible results.

## Deliberately deferred

Until the planning engine is credible, do not prioritise:

- accounts or cross-device persistence;
- nursery stock and pricing;
- purchasing;
- garden diaries or long-term personalisation;
- nationwide expansion;
- computer-vision site surveys;
- irregular bed shapes; or
- generation of the full 48-image plant set.

## Working rules that prevent drift

- One active visual asset at a time.
- Technical foundation may proceed in parallel when it cannot alter visible
  recommendations without a completed review gate.
- One active image prompt and one explicit approval at a time.
- No visual claim that implies unimplemented mathematics.
- No data field without source and confidence.
- No hidden hard constraint.
- No new feature without an exit condition.
- Update this file whenever scope or execution order changes.

## Canonical documentation

- `PROJECT.md` — scope, status and next steps
- `METHODOLOGY.md` — data provenance and mathematical model
- `VISUAL_SYSTEM.md` — copy, typography, assets, prompts and motion
- `DECISIONS.md` — durable decisions and change history
- `../data/README.md` — reproducible dataset operations
- `../data/quality_report.md` — measured data coverage and known gaps
