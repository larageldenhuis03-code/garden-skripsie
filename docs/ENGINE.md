# Planning engine reference

**Audience:** implementation work and future LLM sessions

**Purpose:** data provenance, model contracts and mathematical guardrails

**Updated:** 2026-07-27

> The planning kernel is implemented and tested but not calibrated or connected
> to the live recommendations.

## Pipeline

`garden inputs → hard constraints → soft suitability → group selection → quantities → 2D placement`

| Stage | Implemented | Missing before use |
|---|---|---|
| Hard constraints | Generic executor, reject/review policy, explanation trace | Reviewed horticultural constraints and fixtures |
| AHP calibration | Matrix validation, weights, `lambdaMax`, `CI`, `CR` | Expert comparison matrix |
| Goal Programming | Directional deviations, weights and priority comparison | Reviewed goals, targets and penalties |
| Group selection | Binary feasibility check and deterministic greedy constructor | Reviewed categories, ratios and canopy areas |
| Quantities | No | Integer model and spacing assumptions |
| 2D layout | No | Placement algorithm and geometry validation |

Code lives in `app/lib/planning/`. Tests live in
`tests/planning-engine.test.ts`.

## Data foundation

| Source | Used for | Important limitation |
|---|---|---|
| SANPC 2026 | Accepted Western Cape taxonomic backbone | Taxonomy, not garden suitability |
| BODATSA 2026 | Preserved-specimen occurrence evidence | Presence is not performance |
| BioSCape GCFR | Height, growth form, phenology and measured canopy observations | Trait coverage varies by taxon |
| SANBI alien checklist and NEMBA notices | Warning and legal-review evidence | Legal status needs dated human review |
| 2018 Western Cape vegetation map | Future spatial matching | Not connected to the prototype |

Exact versions, licences and source links are in `data/sources.json`.
Reproduction and coverage are in `data/README.md` and
`data/quality_report.md`.

The visible 48 plants come from
`data/processed/garden_app_seed_catalog.csv`. Every selected record is:

- accepted by SANPC;
- native or native-endemic in the Western Cape seed;
- matched to BODATSA and BioSCape; and
- free of a machine-detected regulatory-review flag.

### Field provenance

Source-derived:

- scientific name and family;
- maximum height and available canopy observations;
- growth form and flowering period; and
- Western Cape occurrence count.

Prototype editorial fields:

- sun and water grouping;
- broad area affinity;
- garden uses and common-name presentation; and
- descriptive copy.

Editorial fields cannot become production constraints until reviewed.

## Current heuristic

`scorePlant` still controls the visible order.

| Match | Points |
|---|---:|
| Sunlight | `+4`; partial fallback `+2` |
| Water | `+3`; low-water plant under moderate input `+2` |
| Low-water input against moderate-water plant | `−1` |
| Approximate size fit | `+3`; otherwise `−3` |
| Each garden intention | `+2` |
| Broad area | `+2` |
| Occurrence tie-breaker | up to `+2` |

These numbers are interaction scaffolding. They are not AHP weights and do not
implement Goal Programming.

## Model contracts

### 1. Hard constraints

Run before optimisation. Every rule returns `pass`, `fail` or `unknown` plus a
plain-language reason and optional evidence.

Unknown evidence follows an explicit policy:

- `reject` keeps it out of recommendations; or
- `review` prevents a feasibility claim and asks for resolution.

Unknown never means compatible.

### 2. AHP calibration

Use expert pairwise comparisons on Saaty's 1–9 scale. Normalise each matrix
column and average each row to derive the weight vector.

Calculate the principal eigenvalue, consistency index and ratio:

`CI = (lambdaMax − n) / (n − 1)`

`CR = CI / RI`

Accept only `CR < 0.10`. A larger matrix needs an explicitly sourced random
index; do not extrapolate.

| Matrix size | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Random index | 0 | 0 | 0.58 | 0.90 | 1.12 | 1.24 | 1.32 | 1.41 | 1.45 | 1.51 |

AHP derives weights only. Do not use the conventional AHP decision score to
rank plants.

### 3. Goal Programming

For each soft goal:

`target = actual + underDeviation − overDeviation`

Minimise:

`sum(underWeight × underDeviation + overWeight × overDeviation)`

All goals can share priority 1 for the weighted model. If pre-emptive
priorities are used, compare the complete penalty at priority 1 before
priority 2. Lower-priority gains cannot erase higher-priority damage.

### 4. Group selection

The provisional binary model uses:

- `x_i` — whether species `i` is selected;
- `v_i` — Goal Programming suitability;
- `a_i` — mature canopy area;
- `B` — bed area;
- `rho` — required open-space ratio; and
- category minimum and maximum area ratios.

Objective:

`max sum(v_i × x_i)`

Constraints:

- `sum(a_i × x_i) <= B × (1 − rho)`;
- each category remains within its reviewed minimum and maximum; and
- `x_i` is binary.

The greedy constructor is deterministic and replaceable. Failure means the
greedy procedure found no solution; it is not proof that none exists.

### 5. Quantities and layout

Binary `x_i` cannot produce plant counts. The next model needs an integer
quantity such as `q_i >= 0`, linked to species inclusion and reviewed spacing.

Version one then places circular mature-canopy footprints in a rectangular bed
and returns counts, centre coordinates, spacing, legend, unused area and an
assumption trace.

## Literature-review corrections

Obvious errors are documented and overridden instead of copied into code.

| Issue in the review | Implementation |
|---|---|
| Page 20 shows a malformed group objective | Use `max sum(v_i × x_i)`, matching the surrounding explanation |
| Binary `x_i` is expected to produce quantities | Label it species-subset selection; add integer `q_i` before promising counts |
| Page 21 gives `sum(alpha_c) <= 1 − rho` as a consistency condition | Do not enforce it; the global allowance and individual category bounds already express the operative constraints |

## Required before live integration

- Final garden-input schema
- Reviewed hard/soft classification
- Soil, sun and water compatibility rules
- Current legal audit and effective dates
- Mature canopy or an approved imputation rule
- Plant categories and design roles
- Expert AHP comparison matrix
- Goal targets and directional penalties
- Open-space and category ratios
- Horticulturist-reviewed expected outcomes

## Non-negotiable guardrails

- Missing data cannot silently become compatibility.
- Occurrence cannot be presented as evidence that a plant will thrive.
- Every exclusion and penalty must name its rule and evidence.
- Legal rules must be versioned and dated.
- Model output must expose material assumptions and gaps.
- No expert weight, spacing rule or horticultural threshold may be invented to
  make the interface appear complete.
