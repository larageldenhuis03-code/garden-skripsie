# Silly Goose MVP — methodology

This is the canonical source for data provenance, current scoring and the target
decision/layout model.

Updated: 2026-07-27

## Source hierarchy

1. SANPC 2026 provides the accepted Western Cape taxonomic backbone.
2. BODATSA 2026 provides Western Cape preserved-specimen occurrence evidence.
3. BioSCape GCFR provides maximum height, growth form, phenology and measured
   canopy observations.
4. The SANBI alien checklist and current NEMBA notices provide warning and
   legal-review evidence.
5. The 2018 Western Cape vegetation map provides a future spatial matching
   layer.

Full source, DOI, version and licence details are in `../data/sources.json`.
Reproduction steps and measured coverage are in `../data/README.md` and
`../data/quality_report.md`.

## Catalogue already implemented

The visible 48 plants are an editorial subset of
`../data/processed/garden_app_seed_catalog.csv`. Each selected taxon:

- is accepted by SANPC;
- is marked native or native-endemic for the Western Cape;
- has a canonical-name match in BODATSA;
- has a BioSCape trait record; and
- has no machine-detected regulatory-review flag in the integration seed.

## Field provenance

Source-derived:

- scientific name and family;
- maximum height;
- growth form;
- flowering period;
- Western Cape occurrence count; and
- measured median canopy axes where available.

Editorial prototype fields:

- sun preference;
- water grouping;
- broad site affinity;
- garden uses;
- common-name presentation; and
- descriptive copy.

Editorial fields may support interaction testing. They cannot become production
constraints until their rules, sources and confidence are reviewed.

## Current heuristic

The current `scorePlant` function proves the interaction only. Its hand-set
points are:

- sunlight match: `+4`, or `+2` for the partial-light fallback;
- water match: `+3`, or `+2` for a low-water plant under moderate-water input;
- low-water input against a moderate-water plant: `−1`;
- approximate size fit: `+3`, otherwise `−3`;
- each matching garden intention: `+2`;
- broad-area match: `+2`; and
- occurrence-count tie-breaker: capped at `+2`.

These values were not derived through expert pairwise comparisons. They have no
AHP consistency result and do not implement the literature-review method.

## Target analytical pipeline

The literature review, particularly pages 16–22, specifies:

1. **Preserving/reject filters:** remove infeasible plants before
   optimisation.
2. **AHP calibration:** derive a weight vector from expert pairwise
   comparisons using Saaty’s 1–9 scale.
3. **Consistency gate:** reject an inconsistent comparison matrix before its
   weights are embedded.
4. **Goal Programming:** evaluate soft goals through weighted under- and
   over-achievement.
5. **Group selection:** use suitability as value and mature canopy as spatial
   cost in a multidimensional knapsack formulation.
6. **Composition constraints:** enforce total coverage, required open space,
   category minima and category maxima.
7. **Search and layout:** use a greedy constructive solver first, then consider
   simulated annealing and a genetic algorithm only as scale requires; place
   the selected plants in a bounded 2D bed.

AHP derives weights only. The conventional AHP decision-score formula must not
rank the plants directly; Goal Programming performs that function.

## Implemented mathematical foundation

The planning kernel now exists under `app/lib/planning/`, isolated from the
current discovery UI:

- `ahp.ts` validates reciprocal matrices, derives weights, calculates
  `lambdaMax`, `CI` and `CR`, and blocks unaccepted calibrations;
- `feasibility.ts` evaluates hard constraints with a complete explanation
  trace and an explicit reject-or-review policy for unknown evidence;
- `goalProgramming.ts` calculates directional under- and over-achievement,
  weighted penalties and lexicographic priority comparison;
- `groupSelection.ts` checks the paper's binary area constraints and provides a
  deterministic, replaceable greedy constructor; and
- `tests/planning-engine.test.ts` covers consistent and inconsistent AHP
  matrices, unknown hard evidence, directional penalties, priority ordering,
  area constraints and honest greedy failure.

This is an engineering foundation, not a calibrated horticultural model. It is
not connected to the visible plant ordering. No expert weights, soil rules,
spacing rules or category ratios have been invented.

## AHP calibration

The expert comparison matrix is normalised by column and reduced to a priority
weight vector.

Before use, calculate:

- principal eigenvalue `λmax`;
- consistency index `CI`; and
- consistency ratio `CR`.

The engineering gate uses the literature review's strict `CR < 0.10`
acceptance rule. A weight vector at or above the threshold cannot proceed to
production ranking. A stricter threshold may be agreed before expert
calibration; a looser one requires a documented methodological decision.

The random-index values transcribed from the literature review are:

| Matrix size | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Random index | 0 | 0 | 0.58 | 0.90 | 1.12 | 1.24 | 1.32 | 1.41 | 1.45 | 1.51 |

Larger matrices require an explicitly sourced random index; the code does not
extrapolate one.

## Goal Programming

For soft goals, minimise weighted deviation:

`min Z = Σ(wᵢ⁻sᵢ⁻ + wᵢ⁺sᵢ⁺)`

where:

- `sᵢ⁻` is under-achievement of goal `i`;
- `sᵢ⁺` is over-achievement of goal `i`; and
- `wᵢ⁻`, `wᵢ⁺` are the relevant penalty weights derived from the accepted AHP
  calibration.

Each goal takes the form:

`Gᵢ = fᵢ(x) + sᵢ⁻ − sᵢ⁺`, with `sᵢ⁻, sᵢ⁺ ≥ 0`.

Hard constraints are not weak penalties. They remove a plant from the candidate
pool.

All goals may remain at priority 1 for the weighted formulation in the review.
The kernel also supports pre-emptive priority levels: it compares the penalty
at priority 1 before priority 2, so an improvement to a lower-priority goal
cannot conceal damage to a higher-priority goal. Production priorities remain
unset.

## Group selection

The target formulation treats:

- `xᵢ ∈ {0,1}` as selection of plant `i`;
- `vᵢ` as the Goal Programming suitability value;
- `aᵢ` as mature canopy area;
- `B` as usable bed area;
- `ρ` as required open-space ratio;
- `αc` as the maximum area ratio for category `c`; and
- `βc` as the minimum area ratio for category `c`.

The selected group must satisfy:

- total canopy coverage within `B(1−ρ)`;
- category maximum ratios;
- applicable category minimum ratios; and
- binary integrity.

The first solver should be greedy and replaceable. More complex
metaheuristics are justified only when the dataset and measured performance
require them.

## Methodology discrepancy register

Obvious source errors or model gaps are not implemented literally. They are
recorded here with the engineering interpretation.

### M-001 — malformed group objective

Observed: the displayed objective on page 20 is dimensionally malformed and
does not clearly index the suitability term. The surrounding prose says the
group should maximise total Goal Programming suitability.

Override: implement the binary objective as:

`max Z = Σ(vᵢxᵢ)`

Consequence: `groupSelection.ts` sums candidate suitability once for each
selected species. It does not multiply suitability by canopy area.

### M-002 — binary selection cannot produce quantities

Observed: `xᵢ ∈ {0,1}` records whether species `i` is selected. It cannot state
that three or twelve plants of that species are required, although the target
MVP promises plant quantities.

Override: keep the current solver explicitly labelled
`binary-species-subset`. Do not claim that it produces quantities. The quantity
phase will use a reviewed integer variable such as `qᵢ ∈ Z≥0`, with:

- total canopy and spacing expressed as functions of `qᵢ`;
- an optional linking variable to distinguish species inclusion from count;
- minimum viable planting counts where horticulturally required; and
- a placement check so numeric quantities and 2D geometry agree.

Consequence: quantity and coordinate generation remain blocked by reviewed
spacing, mature-canopy and composition rules.

### M-003 — unsupported aggregate category-max inequality

Observed: page 21 gives `Σαc ≤ (1−ρ)` as an internal consistency condition.
That condition is not required by the stated per-category maxima plus global
coverage constraint. If categories partition the planting and full usable
coverage is desired, this direction may make the available category maxima too
small rather than guarantee feasibility.

Override: enforce the global canopy allowance and each category's individual
minimum and maximum. Do not enforce the aggregate inequality until its intended
meaning is clarified.

Consequence: the code preserves the stated operative constraints without
adding a restriction that can reject otherwise valid groups.

## Layout

Version one supports a rectangular bed and circular mature-canopy footprints.
It returns:

- plant quantities;
- centre coordinates;
- modelled spacing;
- legend;
- open/unfilled area; and
- the feasibility and assumption trace.

Irregular boundaries are deferred until the rectangular model is validated.

## Data required before production integration

- Reviewed hard/soft classification for every criterion
- Soil compatibility and tolerance ranges
- Reviewed sun and water rules
- Current legal exclusion status and audit date
- Mature canopy diameter or a defensible imputation rule
- Plant category and style membership
- Expert pairwise-comparison matrix and consistency result
- Goal targets and directional penalties
- Open-space ratio and category minimum/maximum ratios
- Horticulturist-reviewed expected outcomes

## Guardrails

- Occurrence shows evidence of presence, not garden performance.
- Missing data cannot silently become compatibility.
- Hard exclusions must be versioned and explainable.
- Editorial fields must not be presented as source facts.
- Legal rules require reviewed Gazette transcription and effective dates.
- Every result must show assumptions and material data gaps.
- Every rejection, penalty and selection must be reconstructable.

## Implementation order

The gate sequence and exit criteria are maintained in `PROJECT.md`.
