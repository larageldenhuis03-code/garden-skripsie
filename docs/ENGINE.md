# Planning engine reference

**Audience:** implementation work and future LLM sessions

**Purpose:** data provenance, runtime contracts and mathematical guardrails

**Updated:** 2026-07-27

## Runtime pipeline

`garden brief -> hard checks -> Goal Programming -> binary species selection -> integer quantities -> rectangular placement`

| Stage | Implementation | Current limitation |
|---|---|---|
| Brief | Typed validation for area, soil, drainage, light, water, dimensions, density and goals | Rectangular beds only |
| Hard checks | `pass`, `fail` or `unknown`; complete reason/evidence trace | Several horticultural fields are editorial or missing |
| AHP | Reciprocity, weights, `lambdaMax`, `CI` and `CR`; rejects `CR >= 0.10` | Runtime uses an equal-weight baseline |
| Goal Programming | Directional deviations and pre-emptive priority comparison | Soft targets still need expert review |
| Group selection | Deterministic phase-one binary constructor with capacity, species limits and provisional layer ratios | Layer ratios need expert review |
| Quantities | Integer `q_i`; canopy-capacity allocation with diminishing returns | Canopy is a field-measurement proxy |
| Layout | Deterministic rectangular shelf packer with coordinate and overlap audit | Feasible and conservative, not globally optimal |

Code lives in `app/lib/planning/`. Mathematical tests live in
`tests/planning-engine.test.ts`.

## Data foundation

| Source | Runtime use | Limitation |
|---|---|---|
| SANPC 2026 | Accepted Western Cape taxonomy | Taxonomy is not garden suitability |
| BODATSA 2026 | Western Cape specimen occurrence count | Presence is not performance |
| BioSCape GCFR | Height, form, flowering and available canopy values | Field measurements are not nursery spacing |
| SANBI alien checklist and NEMBA notices | Seed-catalogue warning gate | Current legal enforcement still needs dated human review |
| Vegetation Map 2018 | Retained for future spatial matching | Not connected to garden locations |

The processed foundation contains:

- 13,491 accepted Western Cape SANPC taxa;
- 17,613 BODATSA taxon summaries;
- 2,213 BioSCape trait rows; and
- 1,909 native/native-endemic exact joins in
  `data/processed/garden_app_seed_catalog.csv`.

The app uses a curated 48-plant pilot. `tests/data-foundation.test.ts` proves
that every visible scientific name, family, height, occurrence count and canopy
value matches the mined seed catalogue. It also checks native status and the
machine-detected legal-review flag.

### Provenance boundary

Source-derived:

- scientific name and family;
- maximum height;
- available field-canopy axis;
- growth form and flowering period; and
- Western Cape occurrence count.

Provisional editorial:

- common-name presentation and descriptive copy;
- light and summer-water grouping;
- broad regional affinity; and
- garden uses/goals.

Missing:

- comprehensive plant-level soil compatibility;
- drainage tolerance;
- reviewed nursery spacing; and
- reviewed design-role taxonomy.

## Runtime contracts

### Garden brief

The rectangular bed must have width and length between `0.5 m` and `30 m`.
At least one soft goal is required. The validated brief is stored on the
current device.

The density choice currently maps to an explicit provisional open-space target:

| Density | Open space | Maximum species |
|---|---:|---:|
| Open | 45% | 5 |
| Balanced | 30% | 7 |
| Lush | 18% | 9 |

To stop tiny field-canopy records from generating absurd counts, the prototype
also caps totals at 3, 5 or 7 plants per square metre for open, balanced or lush
briefs respectively, with an absolute rendering ceiling of 240. These are
visible defensive defaults, not horticultural standards.

Field-canopy values below `0.15 m` remain visible recommendations but cannot
enter quantity or placement calculations. At that scale the current source
value is not reliable enough to stand in for planting spacing.

### Hard checks

Every rule returns:

- `pass`, `fail` or `unknown`;
- a plain-language reason;
- source;
- observed and required values; and
- confidence.

A failure excludes the plant. Unknown soil, drainage or canopy evidence creates
a `needs review` status; it never silently becomes compatibility. The
provisional planner may still model a review-status plant only when it has a
usable canopy value, and the resulting plan keeps the warning visible.

### AHP

Normalise each pairwise-comparison matrix column and average each row.

`CI = (lambdaMax - n) / (n - 1)`

`CR = CI / RI`

Accept only `CR < 0.10`. AHP supplies weights only. It does not directly rank
plants.

The runtime baseline uses an all-ones reciprocal matrix, producing equal
weights and `CR = 0`. Its consistency does not make it expert calibration; the
interface labels it accordingly.

### Goal Programming

For each selected user goal:

`target = actual + underDeviation - overDeviation`

Minimise:

`sum(underWeight * underDeviation + overWeight * overDeviation)`

The pilot uses binary goal achievement (`1` recorded, `0` absent), target `1`,
no over-achievement penalty and the AHP weight as the under-achievement
penalty. Suitability is the remaining percentage after the normalised penalty.

### Binary group selection

Variables:

- `x_i` - whether species `i` is selected;
- `v_i` - Goal Programming suitability;
- `a_i` - circular canopy-proxy area;
- `B` - bed area; and
- `rho` - requested open-space ratio.

Objective:

`max sum(v_i * x_i)`

Primary capacity:

`sum(a_i * x_i) <= B * (1 - rho)`

The deterministic phase-one constructor orders candidates by suitability,
favours meaningful canopy coverage when scores tie, respects the species limit
and retains a full feasibility check. The current provisional composition
bounds are:

- upper structure: 8%-45% of bed area;
- mid layer: 8%-45%;
- ground layer: at most 35%; and
- seasonal layer: at most 25%.

Failure means the greedy procedure found no solution; it is not proof that no
solution exists.

### Integer quantities

`q_i >= 0` is an integer count linked to each selected species.

The allocator:

1. gives every capacity-fitting selected species one plant;
2. assigns remaining canopy capacity by suitability and canopy coverage;
3. applies diminishing returns as a species count grows; and
4. stops at canopy capacity or the explicit density-based count ceiling.

### Rectangular layout

Each plant becomes a circle whose diameter is the sourced field-canopy axis.
The phase-one shelf packer places larger circles first in boundary-safe rows.
The layout audit checks:

- every circle remains inside the bed; and
- every pair of circles is non-overlapping.

If capacity-based quantities do not all fit geometrically, the planner reduces
the unplaceable count and records the adjustment. The returned coordinates are
feasible under this proxy model, not claimed optimal.

## Literature-review corrections

| Review issue | Implemented correction |
|---|---|
| Page 20 displays a malformed group objective | Use `max sum(v_i * x_i)`, matching the surrounding explanation |
| Binary `x_i` is expected to produce quantities | Keep `x_i` for species selection and introduce integer `q_i` |
| Page 21 proposes `sum(alpha_c) <= 1 - rho` as a consistency rule | Do not enforce it; global capacity and individual category bounds are the operative constraints |
| Page 22 does not specify an implementable layout algorithm | Use a tested conservative rectangle packer and label it phase one |
| Hard constraints are described as weighted | Reject hard failures before optimisation; weights apply to negotiable goals |

## Required before horticultural release

- Reviewed soil, drainage, light and water compatibility
- Current dated legal audit
- Mature canopy/spacing source or approved imputation rule
- Plant roles and composition ratios
- Expert AHP pairwise-comparison matrix
- Reviewed Goal Programming targets and directional penalties
- Horticulturist-approved expected outcomes for representative garden cases

## Non-negotiable guardrails

- Missing data cannot silently become compatibility.
- Occurrence cannot be presented as evidence that a plant will thrive.
- Every exclusion, unknown and penalty must be reconstructable.
- Legal rules must be versioned and dated.
- No expert weight, spacing rule or horticultural threshold may be invented to
  make the interface appear complete.
