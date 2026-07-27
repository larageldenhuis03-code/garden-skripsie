# Where the project is now

**Audience:** the user and anyone joining the project

**Purpose:** current status, material limitations and next decisions

**Updated:** 2026-07-27

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
| Garden brief | Working | Area, soil, drainage, light, water, dimensions, density and goals; stored locally |
| Plant library | Working | 48 curated plants with search, profiles and source notes |
| Mined-data link | Tested | All 48 taxonomy, height, occurrence and canopy values are audited against the 1,909-taxon seed catalogue |
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
- The 48 visible plants' membership in the conservative mined seed catalogue

An automated test prevents those visible fields from drifting away from the
processed data. It already found and corrected five rounded canopy values.

The end-to-end regression suite also caught a bad 2 × 5 m result in which tiny
canopy records produced 26 copies of one geophyte and 99% open space. The
planner now rejects sub-15 cm values as spacing evidence, selects across
provisional planting layers and tests that tiny records cannot dominate.

## What remains provisional

- Plant-level soil and drainage compatibility are missing.
- Sun, water, area and garden-use labels are editorial pilot fields.
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
- Nationwide coverage
- Irregular or multi-bed geometry
- Computer-vision site measurement
- Ongoing garden-care diaries

These do not improve the credibility of the current plan and remain outside the
MVP.
