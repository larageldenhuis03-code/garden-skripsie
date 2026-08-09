# Where the project is now

**Audience:** the user and anyone joining the project

**Purpose:** current status, material limitations and next decisions

**Updated:** 2026-08-10

## The short version

Silly Goose now runs the full planning sequence:

`garden brief -> feasibility -> AHP weights -> Goal Programming -> species group -> quantities -> rectangular layout`

The result is a working **provisional plan**, not yet reviewed horticultural
advice. Every unsupported field and model assumption stays visible.

The public MVP is available at
<https://silly-goose-mvp.nanema.chatgpt.site>.

## Status

| Area | Status | Meaning |
|---|---|---|
| Garden brief | Working | Biome, soil, drainage, light, water, dimensions, density and goals; stored locally |
| Plant library | Working | Thousands of plants (BioSCape + PlantZAfrica) with search, profiles and source notes; sun/water/biome coverage varies by plant |
| Mined-data link | Tested | Every visible plant's taxonomy, height, spread, sun, water and biome is audited against `data/processed/plant_database_full.csv` |
| Feasibility | Working, provisional | Every plant returns pass/fail/unknown with reasons and evidence |
| AHP | Working, uncalibrated | Matrix audit is live; selected goals currently receive equal weight |
| Goal Programming | Working, provisional | Directional penalties rank non-excluded plants |
| Group selection | Working, provisional | Deterministic binary constructor respects area, open space and species limit |
| Quantities | Working, provisional | Integer counts use field-canopy area as the capacity proxy |
| 2D layout | Working, provisional | Conservative rectangular packer returns non-overlapping coordinates |
| Saved plants | Working | Stored on the current device |
| Responsive layouts | Working | Core flow, plan, library and plant profiles adapt to phone-sized touch screens |
| Visual system | In review | Cape botanical print direction is integrated and still being refined |

## What is source-backed

- Accepted Western Cape taxonomy from SANPC
- Western Cape specimen occurrence counts from BODATSA
- Height, growth form, flowering and available canopy measurements from
  BioSCape
- Biome, derived from real occurrence coordinates via a point-in-polygon join
  against SANBI's National Vegetation Map 2018 (majority vote across a
  species' occurrences); species with no BioSCape occurrence record instead
  get a lower-confidence biome inferred from PlantZAfrica's horticultural
  zone text, tagged as such
- Sun, water, soil, spread, common names and photo URLs from PlantZAfrica
  (SANBI) horticultural profiles, where a PlantZAfrica match exists
- Every visible plant's membership in the combined, invasive-species-filtered
  plant database (`data/processed/plant_database_full.csv`)

An automated test prevents those visible fields from drifting away from the
processed data.

Coverage is uneven by design rather than filled in with guesses: about 72% of
plants have sun data, 79% have water, 94% have a biome. Missing fields show as
"unknown" in the planning engine (never silently treated as a pass or fail).

The end-to-end regression suite also caught a bad 2 × 5 m result in which tiny
canopy records produced 26 copies of one geophyte and 99% open space. The
planner now rejects sub-15 cm values as spacing evidence, selects across
provisional planting layers and tests that tiny records cannot dominate.

## What remains provisional

- Plant-level soil and drainage compatibility are missing.
- Sun, water and biome are sourced (BioSCape occurrence data and PlantZAfrica
  horticultural profiles) but not expert-reviewed, and are missing for a
  meaningful share of plants (about 28% lack sun, 21% lack water, 6% lack a
  biome) — shown as "unknown," not guessed.
- Biome inferred from PlantZAfrica's horticultural zone text (rather than a
  real occurrence coordinate) is lower confidence than an occurrence-derived
  biome; each plant's `biomeSource` records which applies.
- Garden-use labels (goals) are only auto-derived for "flowers," from a
  recorded bloom window or colour; the rest need manual curation.
- Field-canopy medians are not reviewed nursery spacing.
- Equal AHP weights are not expert priorities.
- Open-space and maximum-species defaults are interface settings, not
  horticultural standards.
- Density-based plant-count ceilings prevent implausible quantities but are not
  reviewed spacing guidance.
- The 15 cm spacing-evidence floor and layer ratios are defensive prototype
  rules, not horticultural thresholds.
- The greedy selector and shelf packer are deterministic constructors, not
  global optimisers.

## Next evidence work

### 1. Horticultural enrichment

For each plant, add sourced soil, drainage, light, water, mature spread and
spacing values with confidence and review status.

### 2. Expert calibration

Collect pairwise comparisons, accept only an AHP matrix with `CR < 0.10`, then
review the Goal Programming targets and penalties.

### 3. Composition rules

Define plant roles, category minimums/maximums, density defaults and expected
plant combinations with a Western Cape horticultural reviewer.

### 4. Reviewed garden cases

Create feasible, infeasible and missing-evidence fixtures. Compare the app's
group, quantities and coordinates with expert expectations.

### 5. Algorithm refinement

Only after reviewed cases exist, compare the current deterministic phase-one
constructors with Simulated Annealing or another justified search method.

## Input needed from the user

- Help identify or reach a Western Cape horticultural reviewer.
- Approve the final garden questions and plan presentation.

## Not now

- Accounts or cross-device history
- Nursery stock, prices or purchasing
- Irregular or multi-bed geometry
- Computer-vision site measurement
- Ongoing garden-care diaries
- A clickable map picker for biome (still a searchable dropdown; the
  dissolved-biome map GeoJSON exists at
  `data/processed/south_africa_biome_regions.geojson` but isn't wired into
  the UI yet)

These do not improve the credibility of the current plan and remain outside the
MVP.

**Scope change, 2026-08-10:** nationwide coverage was on this "not now" list
until today. It's now in scope because the plant database gained real
national biome data (a point-in-polygon join against SANBI's National
Vegetation Map 2018, covering all 9 South African biomes) and PlantZAfrica
horticultural profiles, which together made a Western-Cape-only limit
unnecessary rather than protective. The "pilot area" concept (4 fixed
Western Cape regions) is gone; matching is biome-based everywhere in the
country now, though plant coverage outside the Cape Floristic Region is
thinner since BioSCape's occurrence sampling was Western-Cape-focused.
