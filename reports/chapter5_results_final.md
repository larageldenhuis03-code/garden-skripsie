# Chapter 5 test results

Run: 2026-10-13T18:07:09.343Z

| | |
|---|---|
| Rulebook hash | `4722b1c43a87` |
| Dataset hash | `6c081d3d2f60` |
| Catalogue | 2843 species |
| stage4.ts hash | `64838fe71639` |

**Deviations from the brief.** There is no `scenarios.csv` or `engine-adapter.ts` in this repo:
the 100 scenarios are generated deterministically by `scripts/batch-test/scenarios.ts`, and the
engine is called directly, so no adapter can disagree with it. `tsx` is not installed, so the
runner uses Node's own type stripping (`npm run chapter5`).

## T1 Batch summary

### Status

| Status | Count |
|---|---|
| SUCCESS | 58 |
| SUCCESS_DEGRADED | 34 |
| INFEASIBLE | 8 |
| **Feasible total** | **92 / 100** |

### Infeasible scenarios

| ID | sun/water/soil | Bed | Pool after Stage 0 | Relaxations offered | Reason |
|---|---|---|---|---|---|
| S006 | full/moderate/loam | 12x8 | 706 | none offered | B2639 left out: footprint 28.27 m2 > 24.00 m2 (0.25 x bed area) - too big to be the only structural plant in a bed this size. |
| S026 | sheltered/low/loam | 4x2 | 15 | none offered | B2435 left out: footprint 3.14 m2 > 2.00 m2 (0.25 x bed area) - too big to be the only structural plant in a bed this size. |
| S027 | sheltered/low/clay | 6x4 | 3 | soil -> 8, water -> 8, sun -> 21 | No feasible mix: only 0 species fit together, and this bed size needs at least 5. |
| S062 | sheltered/low/loam | 4x2 | 7 | soil -> 13, water -> 20, sun -> 56 | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |
| S063 | sheltered/low/clay | 6x4 | 4 | soil -> 16, water -> 14, sun -> 23 | No feasible mix: only 0 species fit together, and this bed size needs at least 5. |
| S075 | full/moderate/sandy | 30x0.5 | 348 | none offered | B0217 could not be placed (failure 1). |
| S090 | sheltered/low/clay | 3x3 | 3 | soil -> 7, water -> 8, sun -> 21 | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |
| S096 | part/moderate/loam | 6x1 | 141 | none offered | The placed layout broke a hard rule. |

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
| 555 ms | 1397 ms | 2411 ms | 100% |

### Relaxation

0 of 100 plans ran with a relaxed filter (soil 0, water 0, sun 0).

The scenario set carries no pre-relaxed briefs, so a count of 0 means no scenario needed one
at build time; relaxation is offered to the user rather than applied automatically.

### Option distinctness (species Jaccard)

| Pairs with J <= 0.70 | Mean J | Scenarios whose options differ only in group sizes |
|---|---|---|
| 225 / 265 | 0.395 | 2 |

### Goal achievement

| Goal | Mean | Min |
|---|---|---|
| A1 | 0.856 | 0.331 |
| A2 | 0.943 | 0.250 |
| A3 | 0.981 | 0.444 |
| A4 | 0.709 | 0.348 |
| A5 | 1.000 | 1.000 |

Mean total tier gap, sum over tiers of |p_t - tau_t|, by style:

| Style | Mean gap | Scenarios |
|---|---|---|
| fynbos | 0.393 | 24 |
| mediterranean | 0.120 | 21 |
| cottage | 0.357 | 22 |
| generic | 0.264 | 25 |

### Repeatability, Z and group sizes

| Identical re-runs | Median Z | Median plants per species | Plans with every group the same size |
|---|---|---|---|
| 10 / 10 | 0.9089 | 3.50 | 2 |

## T2 Stage 0 exclusion trace

614 recommended species checked across 92 plans.

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

291 unique species were recommended across the T1 plans.

Run against http://localhost:3000/api/sourcing (sourcing settings 2026-10-13T17:34:43.311Z): 888 s to check the species, 1176 s in all.

| measure | value |
|---|---|
| species with at least one listing | 70 / 291 (24.1%) |
| species with a price (retail, Found, budget class) | 67 / 291 (23.0%) |
| median share of a plan's budget that is estimated or outdated | 58.5% (over 92 plans) |
| median bed budget, Low / Typical / High | R580 / R580 / R605 |

Nurseries not fully checked on every request:

- Stodels: checked: platform detected: woocommerce
- Tulbagh Nursery: checked: platform detected: woocommerce; failed: TypeError: fetch failed
- Garden Route Botanical Garden nursery: checked: 339 rows, may be outdated
- Kraaibosch: checked: 443 rows, current
- Samgro (plugs): checked: 82 rows, current
- Prime Trees: checked: 76 rows, may be outdated

## T4 Sensitivity analysis

20 fixed scenarios (every 5th, which walks all three blocks): S001, S006, S011, S016, S021, S026, S031, S036, S041, S046, S051, S056, S061, S066, S071, S076, S081, S086, S091, S096

### Baseline seed noise

Each brief re-planned under 5 Regenerate seeds; the spread of Z is the engine's own
run-to-run variation, and the floor any variant effect has to clear to mean anything.

| Brief | mean Z | SD across 5 seeds |
|---|---|---|
| S001 | 0.9552 | 0.0055 |
| S006 | 0.9549 | 0.0088 |
| S011 | 0.9474 | 0.0125 |
| S016 | 0.4748 | 0.0059 |
| S021 | 0.9684 | 0.0146 |
| S031 | 0.9396 | 0.0037 |
| S036 | 0.9795 | 0.0070 |
| S041 | 0.9537 | 0.0076 |
| S046 | 0.9658 | 0.0123 |
| S051 | 0.9680 | 0.0052 |
| S056 | 0.9568 | 0.0025 |
| S061 | 0.9486 | 0.0045 |
| S066 | 0.9569 | 0.0124 |
| S071 | 0.9557 | 0.0000 |
| S076 | 0.8700 | 0.0153 |
| S081 | 0.8928 | 0.0187 |
| S086 | 0.9282 | 0.0132 |
| S091 | 0.9401 | 0.0059 |
| **Mean of the SDs** | | **0.0086** |

| Variant | mean J (option 1) | J >= 0.70 | top-10 kept (mean / min) | median dZ | feasible | violations | annealing |
|---|---|---|---|---|---|---|---|
| AHP equal weights (style = extras = colour = 1/3) | 0.628 | 10/18 | 0.99 / 0.80 | +0.0000 | 18/20 | 0 | - |
| lambda = 0.4 | 0.376 | 5/17 | - | -0.0089 | 17/20 | 0 | - |
| lambda = 0.6 | 0.457 | 5/18 | - | +0.0056 | 18/20 | 0 | - |
| T0 x 0.5 | 0.346 | 3/18 | - | -0.0005 | 18/20 | 0 | 121 worse moves, T<1% at 90 iters |
| T0 x 2 | 0.328 | 3/18 | - | +0.0000 | 18/20 | 0 | 213 worse moves, T<1% at 90 iters |
| alpha = 0.998 | 0.329 | 4/17 | - | +0.0000 | 17/20 | 0 | 3441 worse moves, T<1% at 2300 iters |
| delta = 0.10 | 0.425 | 4/18 | - | -0.0007 | 18/20 | 0 | - |
| delta = 0.20 | 0.450 | 4/17 | - | +0.0000 | 17/20 | 0 | - |
| k_headroom = 1.5 | 1.000 | 17/17 | - | +0.0000 | 17/20 | 0 | - |
| k_headroom = 2.5 | 1.000 | 17/17 | - | +0.0000 | 17/20 | 0 | - |
| b_wind -20% (wind scenarios) | 0.479 | 5/12 | 1.00 / 1.00 | +0.0000 | 12/14 | 0 | - |
| b_wind +20% (wind scenarios) | 0.482 | 5/12 | 0.99 / 0.80 | +0.0000 | 12/14 | 0 | - |

### Mean change in each goal

Mean of (variant goal - baseline goal) over the briefs that stayed feasible, so a
positive number means the variant scored that goal better. These are the five goal
terms Z is built from, which shows which one a parameter actually moves.

| Variant | dA1 height balance | dA2 colour | dA3 variety | dA4 ground cover | dA5 flowering |
|---|---|---|---|---|---|
| AHP equal weights (style = extras = colour = 1/3) | -0.0254 | +0.0000 | -0.0065 | +0.0143 | +0.0000 |
| lambda = 0.4 | +0.0017 | +0.0000 | +0.0000 | -0.0244 | +0.0000 |
| lambda = 0.6 | -0.0033 | +0.0000 | -0.0065 | -0.0330 | +0.0000 |
| T0 x 0.5 | +0.0008 | +0.0000 | -0.0196 | -0.0440 | +0.0000 |
| T0 x 2 | +0.0131 | +0.0000 | -0.0065 | -0.0243 | +0.0000 |
| alpha = 0.998 | +0.0156 | +0.0000 | +0.0069 | -0.0018 | +0.0000 |
| delta = 0.10 | +0.0041 | +0.0147 | +0.0065 | -0.0233 | +0.0000 |
| delta = 0.20 | -0.0122 | +0.0000 | -0.0131 | +0.0192 | +0.0000 |
| k_headroom = 1.5 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| k_headroom = 2.5 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| b_wind -20% (wind scenarios) | -0.0199 | +0.0000 | +0.0101 | +0.0301 | +0.0000 |
| b_wind +20% (wind scenarios) | -0.0229 | +0.0000 | +0.0000 | +0.0029 | +0.0000 |

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
| Unit tests | 127 passed, 0 failed |
| Typecheck (`tsc --noEmit`) | clean |
| Lint (`eslint`) | clean |

## T7 Data-error propagation

30 draws x 20 briefs = 600 runs. Every species' height and spread
multiplied by an independent log-uniform factor in [0.67, 1.5], seeded per draw.

| Measure | Value |
|---|---|
| Mean dZ | -0.0075 |
| 5th percentile dZ | -0.0501 |
| Still feasible | 537 / 600 (89.5%) |
| Total violations | 0 |
| Mean species Jaccard vs baseline | 0.223 |
| Runs with J >= 0.70 | 50 / 537 (9.3%) |

Violations by check: H1 0, H2 0, H3 0, H3b 0, H4 0, H5 0, P1 0, P2 0.

## T7b Fixed-plan suitability under size error

17 baseline plans x 30 draws = 510 fixed plans re-checked,
using the same draws as T7. Positions and species unchanged; only sizes differ.

| Measure | Value |
|---|---|
| Plans with any P2 overlap beyond delta | 478 / 510 (93.7%) |
| Mean largest overlap, where one occurs | 0.438 m |
| Plans with any P1 boundary breach | 483 / 510 (94.7%) |
| Plans outside the style's cover band | 460 / 510 (90.2%) |
| Placed plants whose height tier changes | 652 / 3120 species-draws (20.9%) |
| Feature flags that flip | 0 of 3120 species-draws |

Overlap is reported as metres of centre distance short of r_i + r_j - delta*MIN(r_i, r_j), delta = 0.15 (P2 as revised 2026-10-05).

## T8 Catalogue coverage

### (a) Breadth

| Unique species recommended | Layout-eligible species | Share |
|---|---|---|
| 291 | 2343 | 12.4% |

### (b) Concentration

| Slots | Top 10 species take | Gini (all eligible species) |
|---|---|---|
| 614 | 16.6% | 0.926 |

Most-recommended species: B2697 (13), B1604 (11), B2167 (11), B0772 (10), B1712 (10).

### (c) Tie-order bias

Percentile position of each recommended species within its brief's Stage 0 pool,
ordered by plantId - the order ties are actually broken in.

| n | Mean position | Median | KS D | p |
|---|---|---|---|---|
| 614 | 47.7% | 45.1% | 0.061 | 0.020 |

**Positions are not uniform.** The tie order is favouring part of the pool.

### (d) Coverage curve

| Plans | Unique species |
|---|---|
| 100 | 291 |
| 200 | 396 |
| 500 | 537 |

After 500 plans the engine has used 537 of 2343 layout-eligible species
(22.9%).

## T9 Combination library (8_Species_Reference)

**Not read by the engine.** `data/scripts/import_rulebook.py` imports three sheets only -
`1_Parameters` (line 124), `2_Style_Rules` (line 236) and `4_Stage1_Score` (line 301).
`8_Species_Reference` is not among them, nothing in `app/lib/planning/` mentions a combination,
and `engine_rules.generated.json` carries no combination key. So there is no preference to
size and nothing is read from `RULES`: any co-occurrence below is chance, not design.

Sheet **8_Species_Reference**: 61 rows naming catalogue species, 61 distinct species.

| Measure | Value |
|---|---|
| Combo species appearing in a T1 plan | 13 of 61 |
| Mean recommendations, combo species (in pools) | 0.43 |
| Mean recommendations, non-combo species (same pools) | 0.34 |
| Plans with 2+ members of one combo | 0 of 92 |

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
| 250 | 762 |
| 500 | 975 |
| 1000 | 1190 |

### (c) Reachable but never selected

570 species reached a Stage 0 pool at least once but were never selected;
1190 were selected at least once.

| Measure | Never selected | Selected |
|---|---|---|
| Mean Stage 1 score in the pools they appeared in | 0.577 | 0.689 |
| Growth form (top) | Shrub 265, Shrub, Tree 60, Tree 52, Perennial 33, Succulent 21, Bi/Annual 18 | Shrub 474, Succulent 77, Shrub, Tree 70, Tree 59, Perennial 57, Shrub, Succulent 51 |
| Height tier | tall 393, medium 99, short 78 | tall 558, medium 344, short 288 |
| Spread band | band 3 318, band 2 144, band 1 108 | band 2 588, band 3 308, band 1 294 |
| Style fit | fynbos/mediterranean/cottage 342, fynbos/mediterranean 64, fynbos/cottage 59, fynbos 46, mediterranean/cottage 41, mediterranean 12 | fynbos/mediterranean/cottage 789, fynbos/mediterranean 158, fynbos/cottage 122, fynbos 66, mediterranean/cottage 30, mediterranean 19 |

### Funnel

| Stage | Species | Share of catalogue |
|---|---|---|
| Catalogue | 2843 | 100% |
| Layout-eligible | 2343 | 82.4% |
| Reachable (in some Stage 0 pool) | 1754 | 61.7% |
| Selectable (chosen in 1,000 briefs x 3 seeds) | 1190 | 41.9% |
| Recommended in T1 (100 scenarios) | 291 | 10.2% |
