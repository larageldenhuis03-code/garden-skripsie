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

## AHP calibration

The expert comparison matrix is normalised by column and reduced to a priority
weight vector.

Before use, calculate:

- principal eigenvalue `λmax`;
- consistency index `CI`; and
- consistency ratio `CR`.

The project must define its accepted `CR` threshold before calibration. A
weight vector that fails the threshold cannot proceed to production ranking.

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

## Data required before implementation

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

