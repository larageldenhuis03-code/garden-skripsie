# Chapter 5 test results

Run: 2026-10-01T06:32:49.108Z

| | |
|---|---|
| Rulebook hash | `c7d06d358091` |
| Dataset hash | `e5d14caf5ca0` |
| Catalogue | 2843 species |
| stage4.ts hash | `dc02b3d2c8a5` |

**Deviations from the brief.** There is no `scenarios.csv` or `engine-adapter.ts` in this repo:
the 100 scenarios are generated deterministically by `scripts/batch-test/scenarios.ts`, and the
engine is called directly, so no adapter can disagree with it. `tsx` is not installed, so the
runner uses Node's own type stripping (`npm run chapter5`).

## T1 Batch summary

### Status

| Status | Count |
|---|---|
| SUCCESS | 90 |
| SUCCESS_DEGRADED | 5 |
| INFEASIBLE | 5 |
| **Feasible total** | **95 / 100** |

### Infeasible scenarios

| ID | sun/water/soil | Bed | Pool after Stage 0 | Relaxations offered | Reason |
|---|---|---|---|---|---|
| S026 | sheltered/low/loam | 4x2 | 15 | none offered | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |
| S027 | sheltered/low/clay | 6x4 | 3 | soil -> 8, water -> 8, sun -> 21 | No feasible mix: only 0 species fit together, and this bed size needs at least 5. |
| S062 | sheltered/low/loam | 4x2 | 7 | soil -> 13, water -> 20, sun -> 56 | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |
| S063 | sheltered/low/clay | 6x4 | 4 | soil -> 16, water -> 14, sun -> 23 | No feasible mix: only 0 species fit together, and this bed size needs at least 5. |
| S090 | sheltered/low/clay | 3x3 | 3 | soil -> 7, water -> 8, sun -> 21 | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |

### Constraint violations, recomputed by this runner

| Check | Violations |
|---|---|
| H1 | 0 |
| H2 | 0 |
| H3 | 0 |
| H3b | 0 |
| H4 | 0 |
| H5 | 0 |
| P1 (out of bounds) | 0 |
| P2 (overlap) | 0 |

### Run time

| Median | 95th pct | Max | Under 5 s |
|---|---|---|---|
| 457 ms | 832 ms | 1427 ms | 100% |

### Relaxation

0 of 100 plans ran with a relaxed filter (soil 0, water 0, sun 0).

The scenario set carries no pre-relaxed briefs, so a count of 0 means no scenario needed one
at build time; relaxation is offered to the user rather than applied automatically.

### Option distinctness (species Jaccard)

| Pairs with J <= 0.70 | Mean J | Scenarios whose options differ only in group sizes |
|---|---|---|
| 236 / 273 | 0.393 | 4 |

### Goal achievement

| Goal | Mean | Min |
|---|---|---|
| A1 | 0.890 | 0.400 |
| A2 | 0.944 | 0.250 |
| A3 | 0.981 | 0.444 |
| A4 | 0.949 | 0.390 |
| A5 | 1.000 | 1.000 |

Mean total tier gap, sum over tiers of |p_t - tau_t|, by style:

| Style | Mean gap | Scenarios |
|---|---|---|
| fynbos | 0.261 | 24 |
| mediterranean | 0.092 | 22 |
| cottage | 0.290 | 24 |
| generic | 0.222 | 25 |

### Repeatability, Z and group sizes

| Identical re-runs | Median Z | Median plants per species | Plans with every group the same size |
|---|---|---|---|
| 10 / 10 | 0.9336 | 3.00 | 4 |

## T2 Stage 0 exclusion trace

617 recommended species checked across 95 plans.

| Check | Violations (expected 0) |
|---|---|
| Not layout-eligible (indoor or poisonous) | 0 |
| Parasitic | 0 |
| Aquatic | 0 |
| Data incomplete (no sun, water or soil) | 0 |
| No biome in common with the place | 0 |
| Fails F1-F3 (light, water, soil) | 0 |

A permanent version of this check is in `tests/planning-engine.test.ts`
("every recommended species passes every Stage 0 gate").

## T3 Sourcing coverage

295 unique species were recommended across the T1 plans.

**Not run.** Sourcing is live: `app/lib/sourcing/run.ts` fetches each nursery over HTTP at
request time (robots-respecting, 1 request/second/host), and prices are never stored as a
dataset. Measuring listing and price coverage for every recommended species would mean
thousands of live requests against real nurseries, which the politeness budget forbids and
which this environment cannot reach. The shares below therefore cannot be produced offline:

- share with at least one nursery listing;
- share with an indicative price;
- mean share per plan.

To run it: start the dev server and POST each plan to `/api/sourcing`, or extend
`scripts/batch-test/` with a sourcing pass and a much longer time budget.

## T4 Sensitivity analysis

20 fixed scenarios (every 5th, which walks all three blocks): S001, S006, S011, S016, S021, S026, S031, S036, S041, S046, S051, S056, S061, S066, S071, S076, S081, S086, S091, S096

### Baseline seed noise

Each brief re-planned under 5 Regenerate seeds; the spread of Z is the engine's own
run-to-run variation, and the floor any variant effect has to clear to mean anything.

| Brief | mean Z | SD across 5 seeds |
|---|---|---|
| S001 | 0.9931 | 0.0038 |
| S006 | 0.9955 | 0.0083 |
| S011 | 0.9794 | 0.0161 |
| S016 | 0.4979 | 0.0014 |
| S021 | 0.9954 | 0.0011 |
| S031 | 0.9480 | 0.0095 |
| S036 | 0.9972 | 0.0019 |
| S041 | 0.9804 | 0.0139 |
| S046 | 0.9986 | 0.0007 |
| S051 | 0.9820 | 0.0031 |
| S056 | 0.9918 | 0.0033 |
| S061 | 0.9922 | 0.0019 |
| S066 | 0.9995 | 0.0003 |
| S071 | 0.9776 | 0.0049 |
| S076 | 0.8879 | 0.0157 |
| S081 | 0.9202 | 0.0128 |
| S086 | 0.9515 | 0.0243 |
| S091 | 0.9640 | 0.0056 |
| S096 | 0.9591 | 0.0156 |
| **Mean of the SDs** | | **0.0076** |

| Variant | mean J (option 1) | J >= 0.70 | top-10 kept (mean / min) | median dZ | feasible | violations | annealing |
|---|---|---|---|---|---|---|---|
| AHP equal weights (style = extras = colour = 1/3) | 0.598 | 9/19 | 0.99 / 0.80 | +0.0000 | 19/20 | 0 | - |
| lambda = 0.4 | 0.615 | 10/19 | - | -0.0020 | 19/20 | 0 | - |
| lambda = 0.6 | 0.625 | 11/19 | - | +0.0008 | 19/20 | 0 | - |
| T0 x 0.5 | 0.506 | 7/19 | - | +0.0000 | 19/20 | 0 | 112 worse moves, T<1% at 90 iters |
| T0 x 2 | 0.413 | 5/19 | - | +0.0000 | 19/20 | 0 | 185 worse moves, T<1% at 90 iters |
| alpha = 0.998 | 0.258 | 3/19 | - | +0.0011 | 19/20 | 0 | 3860 worse moves, T<1% at 2300 iters |
| delta = 0.10 | 0.602 | 10/19 | - | +0.0000 | 19/20 | 0 | - |
| delta = 0.20 | 0.671 | 11/19 | - | +0.0000 | 19/20 | 0 | - |
| k_headroom = 1.5 | 1.000 | 19/19 | - | +0.0000 | 19/20 | 0 | - |
| k_headroom = 2.5 | 1.000 | 19/19 | - | +0.0000 | 19/20 | 0 | - |
| b_wind -20% (wind scenarios) | 0.519 | 5/13 | 1.00 / 1.00 | +0.0008 | 13/14 | 0 | - |
| b_wind +20% (wind scenarios) | 0.542 | 6/13 | 0.99 / 0.80 | +0.0000 | 13/14 | 0 | - |

### Mean change in each goal

Mean of (variant goal - baseline goal) over the briefs that stayed feasible, so a
positive number means the variant scored that goal better. These are the five goal
terms Z is built from, which shows which one a parameter actually moves.

| Variant | dA1 height balance | dA2 colour | dA3 variety | dA4 ground cover | dA5 flowering |
|---|---|---|---|---|---|
| AHP equal weights (style = extras = colour = 1/3) | -0.0150 | -0.0132 | -0.0117 | -0.0236 | +0.0000 |
| lambda = 0.4 | -0.0183 | +0.0000 | -0.0117 | -0.0367 | +0.0000 |
| lambda = 0.6 | -0.0067 | +0.0000 | -0.0058 | -0.0070 | +0.0000 |
| T0 x 0.5 | -0.0126 | +0.0000 | -0.0175 | -0.0020 | +0.0000 |
| T0 x 2 | -0.0125 | +0.0000 | +0.0000 | -0.0223 | +0.0000 |
| alpha = 0.998 | -0.0025 | -0.0132 | -0.0058 | -0.0257 | +0.0000 |
| delta = 0.10 | -0.0062 | +0.0000 | -0.0175 | -0.0222 | +0.0000 |
| delta = 0.20 | +0.0027 | +0.0000 | +0.0000 | +0.0078 | +0.0000 |
| k_headroom = 1.5 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| k_headroom = 2.5 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| b_wind -20% (wind scenarios) | -0.0043 | -0.0192 | +0.0000 | +0.0179 | +0.0000 |
| b_wind +20% (wind scenarios) | -0.0059 | +0.0000 | +0.0000 | +0.0172 | +0.0000 |

`delta` is now runnable: `minCentreDistance` and `auditRectangularLayout` read
`RULES.stage4.overlapDelta` at call time (2026-09-30), so an override reaches both the
placement and the independent check. The value is unchanged at the default, and the
104-test suite passes either way.

## T5 Interface and offline check

**Not run.** Playwright is not a dependency of this repo (`node_modules/playwright` is absent),
so no browser automation can be started and no screenshots can be captured. Installing it is a
dependency change, which this run is not permitted to make. Manual checklist instead:

| # | Step | Expected | Pass? |
|---|---|---|---|
| 1 | `npm run dev`, open the layout tool | The bed step draws to scale | |
| 2 | Build a plan for scenario S001 (Fynbos, full sun, low water, sandy, 2 x 3 m) | Three options appear | |
| 3 | Hover a circle in the layout | The plant's name appears in a tooltip | |
| 4 | Read the plant list beside the layout | Each plant shows its mature height and spread | |
| 5 | Find a plant whose spread is imputed | The measurement reads "(estimated)" | |
| 6 | Read the Care paragraph | Care information is shown for the bed's plants | |
| 7 | Click "Save this layout" | It appears under Saved gardens | |
| 8 | Go offline (DevTools > Network > Offline) and reload | The saved plan still opens from local storage | |

## T6 Suite status

| Check | Result |
|---|---|
| Unit tests | 104 passed, 0 failed |
| Typecheck (`tsc --noEmit`) | clean |
| Lint (`eslint`) | clean |

## T7 Data-error propagation

30 draws x 20 briefs = 600 runs. Every species' height and spread
multiplied by an independent log-uniform factor in [0.67, 1.5], seeded per draw.

| Measure | Value |
|---|---|
| Mean dZ | -0.0118 |
| 5th percentile dZ | -0.0608 |
| Still feasible | 571 / 600 (95.2%) |
| Total violations | 0 |
| Mean species Jaccard vs baseline | 0.218 |
| Runs with J >= 0.70 | 57 / 571 (10.0%) |

Violations by check: H1 0, H2 0, H3 0, H3b 0, H4 0, H5 0, P1 0, P2 0.

## T7b Fixed-plan suitability under size error

19 baseline plans x 30 draws = 570 fixed plans re-checked,
using the same draws as T7. Positions and species unchanged; only sizes differ.

| Measure | Value |
|---|---|
| Plans with any P2 overlap beyond delta | 541 / 570 (94.9%) |
| Mean largest overlap, where one occurs | 0.410 m |
| Plans with any P1 boundary breach | 544 / 570 (95.4%) |
| Plans outside the style's cover band | 428 / 570 (75.1%) |
| Placed plants whose height tier changes | 593 / 3240 species-draws (18.3%) |
| Feature flags that flip | 0 of 3240 species-draws |

Overlap is reported as metres of centre distance short of (1 - delta)(r_i + r_j), delta = 0.15.

## T8 Catalogue coverage

### (a) Breadth

| Unique species recommended | Layout-eligible species | Share |
|---|---|---|
| 295 | 2343 | 12.6% |

### (b) Concentration

| Slots | Top 10 species take | Gini (all eligible species) |
|---|---|---|
| 617 | 16.9% | 0.925 |

Most-recommended species: B1604 (16), B2697 (12), B0772 (12), B0376 (11), B2481 (10).

### (c) Tie-order bias

Percentile position of each recommended species within its brief's Stage 0 pool,
ordered by plantId - the order ties are actually broken in.

| n | Mean position | Median | KS D | p |
|---|---|---|---|---|
| 617 | 47.9% | 47.0% | 0.049 | 0.106 |

Positions are consistent with a uniform draw: no detectable tie-order bias.

### (d) Coverage curve

| Plans | Unique species |
|---|---|
| 100 | 295 |
| 200 | 389 |
| 500 | 545 |

After 500 plans the engine has used 545 of 2343 layout-eligible species
(23.3%).

## T9 Combination library (8_Species_Reference)

**Not read by the engine.** `data/scripts/import_rulebook.py` imports three sheets only -
`1_Parameters` (line 124), `2_Style_Rules` (line 236) and `4_Stage1_Score` (line 301).
`8_Species_Reference` is not among them, nothing in `app/lib/planning/` mentions a combination,
and `engine_rules.generated.json` carries no combination key. So there is no preference to
size and nothing is read from `RULES`: any co-occurrence below is chance, not design.

Sheet **8_Species_Reference**: 61 rows naming catalogue species, 61 distinct species.

| Measure | Value |
|---|---|
| Combo species appearing in a T1 plan | 14 of 61 |
| Mean recommendations, combo species (in pools) | 0.49 |
| Mean recommendations, non-combo species (same pools) | 0.34 |
| Plans with 2+ members of one combo | 0 of 95 |

## T10 Catalogue reachability

### (a) Reachable through Stage 0

12 distinct biome sets across 1558 places, x 3 sun x 3 water x 4 soil = **432 pools**.

| Measure | Value |
|---|---|
| Species in at least one pool | 1754 of 2343 eligible |
| Median pools per reachable species | 48 of 432 |
| Species in fewer than 1% of pools (< 5) | 0 |
| Reachable only with a relaxation | 0 |

### (b) Selectable by the full engine

1,000 stratified briefs (biome set x sun x water x soil x style x bed band x wind), 3 seeds each = 3000 runs; 2502 feasible.

| Briefs | Unique species recommended |
|---|---|
| 250 | 776 |
| 500 | 998 |
| 1000 | 1223 |

### (c) Reachable but never selected

537 species reached a Stage 0 pool at least once but were never selected;
1223 were selected at least once.

| Measure | Never selected | Selected |
|---|---|---|
| Mean Stage 1 score in the pools they appeared in | 0.576 | 0.686 |
| Growth form (top) | Shrub 274, Tree 51, Shrub, Tree 41, Perennial 27, Bi/Annual 20, Graminoid 15 | Shrub 465, Shrub, Tree 89, Succulent 85, Perennial 63, Tree 60, Shrub, Succulent 55 |
| Height tier | tall 382, medium 85, short 70 | tall 569, medium 358, short 296 |
| Spread band | band 3 302, band 2 143, band 1 92 | band 2 589, band 3 324, band 1 310 |
| Style fit | fynbos/mediterranean/cottage 327, fynbos/cottage 58, fynbos/mediterranean 53, mediterranean/cottage 40, fynbos 38, mediterranean 13 | fynbos/mediterranean/cottage 804, fynbos/mediterranean 169, fynbos/cottage 123, fynbos 74, mediterranean/cottage 31, mediterranean 18 |

### Funnel

| Stage | Species | Share of catalogue |
|---|---|---|
| Catalogue | 2843 | 100% |
| Layout-eligible | 2343 | 82.4% |
| Reachable (in some Stage 0 pool) | 1754 | 61.7% |
| Selectable (chosen in 1,000 briefs x 3 seeds) | 1223 | 43.0% |
| Recommended in T1 (100 scenarios) | 295 | 10.4% |
