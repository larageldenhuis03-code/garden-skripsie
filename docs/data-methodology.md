# Silly Goose MVP — data and decision methodology

Updated: 2026-07-27

## Source hierarchy

1. SANPC 2026 provides the accepted Western Cape taxonomic backbone.
2. BODATSA 2026 provides Western Cape preserved-specimen occurrence evidence.
3. BioSCape GCFR provides maximum height, growth form, phenology and measured
   canopy observations.
4. The SANBI alien checklist and current NEMBA notices provide warning and
   review evidence.
5. The 2018 Western Cape vegetation map provides a future spatial matching
   layer.

Full source, DOI, version and licence details are in `data/sources.json`.

## Catalogue selection already implemented

The 48 visible plants are an editorial subset of
`data/processed/garden_app_seed_catalog.csv`. Every selected taxon:

- is accepted by SANPC;
- is marked native or native-endemic for the Western Cape;
- has a canonical-name match in BODATSA;
- has a BioSCape trait record; and
- has no machine-detected regulatory-review flag in the integration seed.

## Field provenance

Source-derived fields:

- scientific name and family;
- maximum height;
- growth form;
- flowering period;
- Western Cape occurrence count; and
- measured median canopy axes when available.

Editorial prototype fields:

- sun preference;
- water grouping;
- broad site affinity;
- garden uses;
- common-name presentation; and
- descriptive copy.

The editorial fields are useful for interaction testing but require
horticultural review before they can act as production constraints.

## Audit against the literature-review methodology

The current `scorePlant` function is a hand-set heuristic. It rewards matching
sun, water, approximate space, intentions and broad area, with occurrence count
as a small ordering signal. It was built to prove the interaction.

It does **not** implement the mathematical methodology set out on pages 16–22
of `SKRIPSIE_LIT_REVIEW.pdf`. The earlier documentation overstated the
relationship between the prototype and the paper; this revision corrects that.

Current hand-set points:

- sunlight match: `+4`, or `+2` for the one partial-light fallback;
- water match: `+3`, or `+2` for low-water plants under moderate-water input;
- low-water input against a moderate-water plant: `−1`;
- approximate size fit: `+3`, otherwise `−3`;
- each matching garden intention: `+2`;
- broad-area match: `+2`; and
- occurrence-count tie-breaker: capped at `+2`.

These values were not derived through stakeholder pairwise comparisons and
have no AHP consistency result.

The paper specifies this pipeline:

1. **Preserving/reject filters:** remove infeasible plants before
   optimisation.
2. **AHP calibration:** derive a weight vector from expert pairwise
   comparisons on Saaty’s 1–9 scale.
3. **Consistency gate:** reject an inconsistent comparison matrix before its
   weights are embedded.
4. **Goal Programming:** minimise weighted under- and over-achievement:
   `min Z = Σ(wᵢ⁻sᵢ⁻ + wᵢ⁺sᵢ⁺)`.
5. **Group selection:** use suitability as value and mature canopy as spatial
   cost in a multidimensional knapsack formulation.
6. **Composition constraints:** enforce total coverage, required open space,
   category minima and category maxima.
7. **Search and layout:** start with a greedy constructive heuristic, then
   move to simulated annealing and a genetic algorithm as the dataset scales;
   place the selected plants in a bounded 2D bed.

The paper also states that the conventional AHP decision score must not rank
plants directly; AHP only derives the weights used by Goal Programming.

## Data needed before implementing the model

- Reviewed hard/soft classification for every criterion
- Soil compatibility and tolerance ranges
- Reviewed sun and water rules
- Current legal exclusion status and audit date
- Mature canopy diameter or a defensible imputation rule
- Plant category used by the composition constraints
- Style membership and compatible combinations
- Expert pairwise-comparison matrix and consistency result
- Target values and penalty direction for each Goal Programming goal
- Open-space ratio and category minimum/maximum ratios
- Test cases with horticulturist-approved expected outcomes

## Guardrails

- Occurrence records show evidence of presence, not garden performance.
- A missing value cannot silently become compatibility.
- Hard exclusions must be versioned and explainable.
- Editorial fields must not be presented as source facts.
- Every recommendation output must state assumptions and data gaps.
- Legal and horticultural rules require domain review before release.
