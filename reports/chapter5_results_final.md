# Chapter 5 test results

Run: 2026-10-19T17:41:54.005Z

| | |
|---|---|
| Rulebook hash | `713f9bad5bec` |
| Dataset hash | `1e15fe4470f8` |
| Catalogue | 2843 species |
| stage4.ts hash | `6d83fcfdf2be` |

**Deviations from the brief.** There is no `scenarios.csv` or `engine-adapter.ts` in this repo:
the 100 scenarios are generated deterministically by `scripts/batch-test/scenarios.ts`, and the
engine is called directly, so no adapter can disagree with it. `tsx` is not installed, so the
runner uses Node's own type stripping (`npm run chapter5`).

## T1 Batch summary

### Status

| Status | Count |
|---|---|
| SUCCESS | 61 |
| SUCCESS_DEGRADED | 31 |
| INFEASIBLE | 8 |
| **Feasible total** | **92 / 100** |

### Infeasible scenarios

| ID | sun/water/soil | Bed | Pool after Stage 0 | Relaxations offered | Reason |
|---|---|---|---|---|---|
| S026 | sheltered/low/loam | 4x2 | 15 | none offered | B2435 left out: footprint 3.14 m2 > 2.00 m2 (0.25 x bed area) - too big to be the only structural plant in a bed this size. |
| S027 | sheltered/low/clay | 6x4 | 3 | soil -> 8, water -> 8, sun -> 21 | No feasible mix: only 0 species fit together, and this bed size needs at least 5. |
| S062 | sheltered/low/loam | 4x2 | 7 | soil -> 13, water -> 20, sun -> 55 | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |
| S063 | sheltered/low/clay | 6x4 | 4 | soil -> 16, water -> 14, sun -> 23 | No feasible mix: only 0 species fit together, and this bed size needs at least 5. |
| S075 | full/moderate/sandy | 30x0.5 | 340 | none offered | B0409 could not be placed (failure 1). |
| S083 | full/moderate/sandy | 15x2 | 962 | none offered | B1553 could not be placed (failure 1). |
| S090 | sheltered/low/clay | 3x3 | 3 | soil -> 7, water -> 8, sun -> 21 | No feasible mix: only 0 species fit together, and this bed size needs at least 3; no hedge or tall species fits to form the windward row. |
| S096 | part/moderate/loam | 6x1 | 132 | none offered | B1676 could not be placed (failure 1). |

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
| 712 ms | 1571 ms | 2561 ms | 100% |

### Relaxation

0 of 100 plans ran with a relaxed filter (soil 0, water 0, sun 0).

The scenario set carries no pre-relaxed briefs, so a count of 0 means no scenario needed one
at build time; relaxation is offered to the user rather than applied automatically.

### Option distinctness (species Jaccard)

| Pairs with J <= 0.70 | Mean J | Scenarios whose options differ only in group sizes |
|---|---|---|
| 242 / 264 | 0.359 | 1 |

### Goal achievement

| Goal | Mean | Min |
|---|---|---|
| A1 | 0.867 | 0.163 |
| A2 | 0.924 | 0.250 |
| A3 | 0.967 | 0.444 |
| A4 | 0.731 | 0.338 |
| A5 | 1.000 | 1.000 |

Mean total tier gap, sum over tiers of |p_t - tau_t|, by style:

| Style | Mean gap | Scenarios |
|---|---|---|
| fynbos | 0.433 | 24 |
| mediterranean | 0.328 | 22 |
| cottage | 0.371 | 21 |
| generic | 0.388 | 25 |

### Repeatability, Z and group sizes

| Identical re-runs | Median Z | Median plants per species | Plans with every group the same size |
|---|---|---|---|
| 10 / 10 | 0.8994 | 3.57 | 2 |

## T2 Stage 0 exclusion trace

762 recommended species checked across 92 plans.

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

367 unique species were recommended across the T1 plans.

Run against http://localhost:3000/api/sourcing (sourcing settings 2026-10-13T17:34:43.311Z): 407 s to check the species, 968 s in all.

| measure | value |
|---|---|
| species with at least one listing | 81 / 367 (22.1%) |
| species with a price (retail, Found, budget class) | 72 / 367 (19.6%) |
| median share of a plan's budget that is estimated or outdated | 71.0% (over 92 plans) |
| median bed budget, Low / Typical / High | R700 / R730 / R760 |

Nurseries not fully checked on every request:

- Stodels: checked: platform detected: woocommerce
- Tulbagh Nursery: checked: platform detected: woocommerce; failed: TypeError: fetch failed; failed: timed out after 5 s
- Garden Route Botanical Garden nursery: checked: 339 rows, may be outdated
- Kraaibosch: checked: 443 rows, current
- Samgro (plugs): checked: 82 rows, current
- Prime Trees: checked: 76 rows, may be outdated
- ClicknPlant: failed: timed out after 5 s

## T4 Sensitivity analysis

20 fixed scenarios (every 5th, which walks all three blocks): S001, S006, S011, S016, S021, S026, S031, S036, S041, S046, S051, S056, S061, S066, S071, S076, S081, S086, S091, S096

### Baseline seed noise

Each brief re-planned under 5 Regenerate seeds; the spread of Z is the engine's own
run-to-run variation, and the floor any variant effect has to clear to mean anything.

| Brief | mean Z | SD across 5 seeds |
|---|---|---|
| S001 | 0.9578 | 0.0051 |
| S006 | 0.9384 | 0.0271 |
| S011 | 0.9661 | 0.0125 |
| S016 | 0.4775 | 0.0051 |
| S021 | 0.9673 | 0.0132 |
| S031 | 0.9359 | 0.0046 |
| S036 | 0.9809 | 0.0066 |
| S041 | 0.9503 | 0.0086 |
| S046 | 0.9749 | 0.0034 |
| S051 | 0.9550 | 0.0060 |
| S056 | 0.9474 | 0.0153 |
| S061 | 0.9543 | 0.0055 |
| S066 | 0.9676 | 0.0074 |
| S071 | 0.9557 | 0.0000 |
| S076 | 0.8887 | 0.0085 |
| S081 | 0.7954 | 0.0479 |
| S086 | 0.9404 | 0.0043 |
| S091 | 0.9323 | 0.0093 |
| **Mean of the SDs** | | **0.0106** |

| Variant | mean J (option 1) | J >= 0.70 | top-10 kept (mean / min) | median dZ | feasible | violations | annealing |
|---|---|---|---|---|---|---|---|
| AHP equal weights (style = extras = colour = 1/3) | 0.611 | 9/18 | 0.99 / 0.80 | +0.0000 | 18/20 | 0 | - |
| lambda = 0.4 | 0.372 | 5/18 | - | -0.0089 | 18/20 | 0 | - |
| lambda = 0.6 | 0.379 | 4/18 | - | +0.0088 | 18/20 | 0 | - |
| T0 x 0.5 | 0.427 | 5/18 | - | +0.0000 | 18/20 | 0 | 109 worse moves, T<1% at 90 iters |
| T0 x 2 | 0.331 | 3/18 | - | +0.0000 | 18/20 | 0 | 175 worse moves, T<1% at 90 iters |
| alpha = 0.998 | 0.254 | 2/18 | - | +0.0118 | 18/20 | 0 | 3929 worse moves, T<1% at 2300 iters |
| delta = 0.10 | 0.389 | 4/18 | - | +0.0000 | 18/20 | 0 | - |
| delta = 0.20 | 0.379 | 5/18 | - | +0.0011 | 18/20 | 0 | - |
| k_headroom = 1.5 | 1.000 | 18/18 | - | +0.0000 | 18/20 | 0 | - |
| k_headroom = 2.5 | 1.000 | 18/18 | - | +0.0000 | 18/20 | 0 | - |
| b_wind -20% (wind scenarios) | 0.408 | 4/12 | 1.00 / 1.00 | +0.0027 | 12/14 | 0 | - |
| b_wind +20% (wind scenarios) | 0.531 | 4/12 | 0.99 / 0.80 | +0.0000 | 12/14 | 0 | - |

### Mean change in each goal

Mean of (variant goal - baseline goal) over the briefs that stayed feasible, so a
positive number means the variant scored that goal better. These are the five goal
terms Z is built from, which shows which one a parameter actually moves.

| Variant | dA1 height balance | dA2 colour | dA3 variety | dA4 ground cover | dA5 flowering |
|---|---|---|---|---|---|
| AHP equal weights (style = extras = colour = 1/3) | -0.0229 | +0.0000 | -0.0370 | -0.0354 | +0.0000 |
| lambda = 0.4 | -0.0174 | +0.0000 | +0.0000 | -0.0230 | +0.0000 |
| lambda = 0.6 | -0.0238 | +0.0000 | -0.0247 | +0.0022 | +0.0000 |
| T0 x 0.5 | -0.0044 | +0.0000 | +0.0062 | -0.0389 | +0.0000 |
| T0 x 2 | -0.0101 | +0.0000 | +0.0000 | +0.0018 | +0.0000 |
| alpha = 0.998 | +0.0200 | -0.0139 | +0.0185 | +0.0293 | +0.0000 |
| delta = 0.10 | -0.0065 | +0.0000 | -0.0185 | -0.0596 | +0.0000 |
| delta = 0.20 | +0.0003 | -0.0139 | +0.0062 | +0.0137 | +0.0000 |
| k_headroom = 1.5 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| k_headroom = 2.5 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| b_wind -20% (wind scenarios) | +0.0208 | +0.0000 | -0.0093 | +0.0131 | +0.0000 |
| b_wind +20% (wind scenarios) | +0.0085 | +0.0000 | -0.0185 | -0.0087 | +0.0000 |

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
| Unit tests | 130 passed, 2 failed |
| Typecheck (`tsc --noEmit`) | clean |
| Lint (`eslint`) | errors |

## T7 Data-error propagation

30 draws x 20 briefs = 600 runs. Every species' height and spread
multiplied by an independent log-uniform factor in [0.67, 1.5], seeded per draw.

| Measure | Value |
|---|---|
| Mean dZ | -0.0131 |
| 5th percentile dZ | -0.0694 |
| Still feasible | 539 / 600 (89.8%) |
| Total violations | 0 |
| Mean species Jaccard vs baseline | 0.194 |
| Runs with J >= 0.70 | 39 / 539 (7.2%) |

Violations by check: H1 0, H2 0, H3 0, H3b 0, H4 0, H5 0, P1 0, P2 0.

## T7b Fixed-plan suitability under size error

18 baseline plans x 30 draws = 540 fixed plans re-checked,
using the same draws as T7. Positions and species unchanged; only sizes differ.

| Measure | Value |
|---|---|
| Plans with any P2 overlap beyond delta | 489 / 540 (90.6%) |
| Mean largest overlap, where one occurs | 0.464 m |
| Plans with any P1 boundary breach | 509 / 540 (94.3%) |
| Plans outside the style's cover band | 485 / 540 (89.8%) |
| Placed plants whose height tier changes | 662 / 4050 species-draws (16.3%) |
| Feature flags that flip | 0 of 4050 species-draws |

Overlap is reported as metres of centre distance short of r_i + r_j - delta*MIN(r_i, r_j), delta = 0.15 (P2 as revised 2026-10-05).

## T8 Catalogue coverage

### (a) Breadth

| Unique species recommended | Layout-eligible species | Share |
|---|---|---|
| 367 | 2343 | 15.7% |

### (b) Concentration

| Slots | Top 10 species take | Gini (all eligible species) |
|---|---|---|
| 762 | 13.6% | 0.904 |

Most-recommended species: B0291 (16), B2697 (14), B2762 (11), B2649 (11), B0376 (10).

### (c) Tie-order bias

Percentile position of each recommended species within its brief's Stage 0 pool,
ordered by plantId - the order ties are actually broken in.

| n | Mean position | Median | KS D | p |
|---|---|---|---|---|
| 762 | 46.1% | 42.0% | 0.089 | <0.001 |

**Positions are not uniform.** The tie order is favouring part of the pool.

### (d) Coverage curve

| Plans | Unique species |
|---|---|
| 100 | 367 |
| 200 | 463 |
| 500 | 650 |

After 500 plans the engine has used 650 of 2343 layout-eligible species
(27.7%).

## T9 Combination library (8_Species_Reference)

**Not read by the engine.** `data/scripts/import_rulebook.py` imports three sheets only -
`1_Parameters` (line 124), `2_Style_Rules` (line 236) and `4_Stage1_Score` (line 301).
`8_Species_Reference` is not among them, nothing in `app/lib/planning/` mentions a combination,
and `engine_rules.generated.json` carries no combination key. So there is no preference to
size and nothing is read from `RULES`: any co-occurrence below is chance, not design.

Sheet **8_Species_Reference**: 61 rows naming catalogue species, 61 distinct species.

| Measure | Value |
|---|---|
| Combo species appearing in a T1 plan | 15 of 61 |
| Mean recommendations, combo species (in pools) | 0.49 |
| Mean recommendations, non-combo species (same pools) | 0.42 |
| Plans with 2+ members of one combo | 0 of 92 |

## T10 Catalogue reachability

### (a) Reachable through Stage 0

12 distinct biome sets across 1558 places, x 3 sun x 3 water x 4 soil = **432 pools**.

| Measure | Value |
|---|---|
| Species in at least one pool | 1750 of 2343 eligible |
| Median pools per reachable species | 48 of 432 |
| Species in fewer than 1% of pools (< 5) | 0 |
| Reachable only with a relaxation | 0 |

### (b) Selectable by the full engine

1,000 stratified briefs (biome set x sun x water x soil x style x bed band x wind), 3 seeds each = 3000 runs; 2502 feasible.

| Briefs | Unique species recommended |
|---|---|
| 250 | 858 |
| 500 | 1029 |
| 1000 | 1222 |

### (c) Reachable but never selected

537 species reached a Stage 0 pool at least once but were never selected;
1222 were selected at least once.

| Measure | Never selected | Selected |
|---|---|---|
| Mean Stage 1 score in the pools they appeared in | 0.572 | 0.687 |
| Growth form (top) | Shrub 241, Shrub, Tree 57, Tree 55, Perennial 25, Succulent 23, Bi/Annual 18 | Shrub 498, Succulent 75, Shrub, Tree 72, Perennial 65, Tree 57, Shrub, Succulent 54 |
| Height tier | tall 376, medium 89, short 72 | tall 574, medium 354, short 294 |
| Spread band | band 3 317, band 2 125, band 1 95 | band 2 587, band 3 336, band 1 299 |
| Style fit | fynbos/mediterranean/cottage 320, fynbos/mediterranean 65, fynbos/cottage 51, fynbos 42, mediterranean/cottage 35, mediterranean 17 | fynbos/mediterranean/cottage 809, fynbos/mediterranean 158, fynbos/cottage 130, fynbos 70, mediterranean/cottage 36, mediterranean 14 |

### Funnel

| Stage | Species | Share of catalogue |
|---|---|---|
| Catalogue | 2843 | 100% |
| Layout-eligible | 2343 | 82.4% |
| Reachable (in some Stage 0 pool) | 1750 | 61.6% |
| Selectable (chosen in 1,000 briefs x 3 seeds) | 1222 | 43.0% |
| Recommended in T1 (100 scenarios) | 367 | 12.9% |
