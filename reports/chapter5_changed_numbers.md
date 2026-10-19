# Chapter 5: every number that changed

Old: `reports/chapter5_results.json` (run 2026-10-01T06:32Z - the "30 Sep" results; rulebook `c7d06d358091`, dataset `e5d14caf5ca0`).
New: `reports/chapter5_results_final.json` (run 2026-10-19T17:41Z, the final algorithm v11o; rulebook `713f9bad5bec`, dataset `1e15fe4470f8`, stage4.ts `6d83fcfdf2be`; T3 live against the local dev server with sourcing settings 2026-10-13T17:34:43Z).
Produced by `scripts/chapter5/diff-results.ts`. T4GOALS and T4SEEDNOISE are parts of T4.
Against the previous final run (2026-10-13, engine-final, rulebook `4722b1c43a87`, dataset `6c081d3d2f60`), 221 values differ (same script; that file is in git history at a294ed2).
T6's "Lint: errors" in this run comes only from an untracked local file, `.claude/_to_delete/dbg.ts`, not from the repository; eslint now ignores `.claude/`.

250 values differ.

| value | old (30 Sep / 1 Oct run) | new (final) | test |
|---|---|---|---|
| `versions.rulebook` | c7d06d358091 | 713f9bad5bec | versions |
| `versions.dataset` | e5d14caf5ca0 | 1e15fe4470f8 | versions |
| `versions.stage4` | dc02b3d2c8a5 | 6d83fcfdf2be | versions |
| `t1.status.SUCCESS` | 90 | 61 | T1 |
| `t1.status.SUCCESS_DEGRADED` | 5 | 31 | T1 |
| `t1.status.INFEASIBLE` | 5 | 8 | T1 |
| `t1.feasible` | 95 | 92 | T1 |
| `t1.timesMs.median` | 457.3921 | 712.4519 | T1 |
| `t1.timesMs.p95` | 831.6205 | 1571.1675 | T1 |
| `t1.timesMs.max` | 1426.8663 | 2561.3787 | T1 |
| `t1.jaccard.pairs` | 273 | 264 | T1 |
| `t1.jaccard.distinct` | 236 | 242 | T1 |
| `t1.jaccard.mean` | 0.393343 | 0.359124 | T1 |
| `t1.jaccard.sameSpeciesDifferentSizes` | 4 | 1 | T1 |
| `t1.goals.mean.0` | 0.890482 | 0.867067 | T1 |
| `t1.goals.mean.1` | 0.94386 | 0.923913 | T1 |
| `t1.goals.mean.2` | 0.981287 | 0.967391 | T1 |
| `t1.goals.mean.3` | 0.949391 | 0.730788 | T1 |
| `t1.goals.min.0` | 0.4 | 0.1625 | T1 |
| `t1.goals.min.3` | 0.390107 | 0.338158 | T1 |
| `t1.tierGap.fynbos` | 0.261195 | 0.432502 | T1 |
| `t1.tierGap.mediterranean` | 0.092337 | 0.328029 | T1 |
| `t1.tierGap.cottage` | 0.289952 | 0.370958 | T1 |
| `t1.tierGap.generic` | 0.221977 | 0.387831 | T1 |
| `t1.medianZ` | 0.93357 | 0.899442 | T1 |
| `t1.medianPlantsPerSpecies` | 3 | 3.571429 | T1 |
| `t1.allSameSize` | 4 | 2 | T1 |
| `t2.checked` | 617 | 762 | T2 |
| `t3.uniqueSpecies` | 295 | 367 | T3 |
| `t3.run` | false | true | T3 |
| `t3.reason` | sourcing is live HTTP; not runnable offline within the politeness budget | - | T3 |
| `t4SeedNoise.perBrief.0.sd` | 0.003779 | 0.005068 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.0.mean` | 0.993137 | 0.957813 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.1.sd` | 0.0083 | 0.027106 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.1.mean` | 0.99546 | 0.938408 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.2.sd` | 0.016136 | 0.012518 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.2.mean` | 0.979429 | 0.966126 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.3.sd` | 0.001437 | 0.005146 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.3.mean` | 0.497933 | 0.477521 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.4.sd` | 0.001053 | 0.013201 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.4.mean` | 0.995392 | 0.967323 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.5.sd` | 0.009485 | 0.004588 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.5.mean` | 0.948007 | 0.935943 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.6.sd` | 0.001929 | 0.00657 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.6.mean` | 0.997225 | 0.980904 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.7.sd` | 0.013937 | 0.00855 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.7.mean` | 0.980438 | 0.950255 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.8.sd` | 0.000702 | 0.003397 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.8.mean` | 0.998637 | 0.974915 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.9.sd` | 0.00312 | 0.005978 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.9.mean` | 0.981954 | 0.955006 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.10.sd` | 0.003342 | 0.015331 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.10.mean` | 0.991822 | 0.947395 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.11.sd` | 0.001884 | 0.005452 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.11.mean` | 0.992242 | 0.954262 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.12.sd` | 0.000336 | 0.007411 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.12.mean` | 0.9995 | 0.967586 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.13.sd` | 0.004851 | 0 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.13.mean` | 0.977574 | 0.955677 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.14.sd` | 0.015712 | 0.008526 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.14.mean` | 0.887905 | 0.888702 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.15.sd` | 0.01277 | 0.047863 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.15.mean` | 0.920174 | 0.795397 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.16.sd` | 0.024306 | 0.004314 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.16.mean` | 0.951542 | 0.940381 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.17.sd` | 0.005634 | 0.00931 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.17.mean` | 0.964044 | 0.932286 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.18.id` | S096 | - | T4SEEDNOISE |
| `t4SeedNoise.perBrief.18.sd` | 0.015616 | - | T4SEEDNOISE |
| `t4SeedNoise.perBrief.18.mean` | 0.959114 | - | T4SEEDNOISE |
| `t4SeedNoise.meanSd` | 0.007596 | 0.010574 | T4SEEDNOISE |
| `t4Goals.0.deltas.0` | -0.01503 | -0.022944 | T4GOALS |
| `t4Goals.0.deltas.1` | -0.013158 | 0 | T4GOALS |
| `t4Goals.0.deltas.2` | -0.011696 | -0.037037 | T4GOALS |
| `t4Goals.0.deltas.3` | -0.023578 | -0.035428 | T4GOALS |
| `t4Goals.1.deltas.0` | -0.018347 | -0.017423 | T4GOALS |
| `t4Goals.1.deltas.2` | -0.011696 | 0 | T4GOALS |
| `t4Goals.1.deltas.3` | -0.036652 | -0.023015 | T4GOALS |
| `t4Goals.2.deltas.0` | -0.006693 | -0.023844 | T4GOALS |
| `t4Goals.2.deltas.2` | -0.005848 | -0.024691 | T4GOALS |
| `t4Goals.2.deltas.3` | -0.006989 | 0.002212 | T4GOALS |
| `t4Goals.3.deltas.0` | -0.012556 | -0.00444 | T4GOALS |
| `t4Goals.3.deltas.2` | -0.017544 | 0.006173 | T4GOALS |
| `t4Goals.3.deltas.3` | -0.001972 | -0.038931 | T4GOALS |
| `t4Goals.4.deltas.0` | -0.012532 | -0.010062 | T4GOALS |
| `t4Goals.4.deltas.3` | -0.022283 | 0.001777 | T4GOALS |
| `t4Goals.5.deltas.0` | -0.002503 | 0.020049 | T4GOALS |
| `t4Goals.5.deltas.1` | -0.013158 | -0.013889 | T4GOALS |
| `t4Goals.5.deltas.2` | -0.005848 | 0.018519 | T4GOALS |
| `t4Goals.5.deltas.3` | -0.025679 | 0.029305 | T4GOALS |
| `t4Goals.6.deltas.0` | -0.006202 | -0.006476 | T4GOALS |
| `t4Goals.6.deltas.2` | -0.017544 | -0.018519 | T4GOALS |
| `t4Goals.6.deltas.3` | -0.02222 | -0.059609 | T4GOALS |
| `t4Goals.7.deltas.0` | 0.002683 | 0.000311 | T4GOALS |
| `t4Goals.7.deltas.1` | 0 | -0.013889 | T4GOALS |
| `t4Goals.7.deltas.2` | 0 | 0.006173 | T4GOALS |
| `t4Goals.7.deltas.3` | 0.007841 | 0.013715 | T4GOALS |
| `t4Goals.10.deltas.0` | -0.004291 | 0.020809 | T4GOALS |
| `t4Goals.10.deltas.1` | -0.019231 | 0 | T4GOALS |
| `t4Goals.10.deltas.2` | 0 | -0.009259 | T4GOALS |
| `t4Goals.10.deltas.3` | 0.017904 | 0.013139 | T4GOALS |
| `t4Goals.11.deltas.0` | -0.005852 | 0.008468 | T4GOALS |
| `t4Goals.11.deltas.2` | 0 | -0.018519 | T4GOALS |
| `t4Goals.11.deltas.3` | 0.017218 | -0.008671 | T4GOALS |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanJ` | 0.597752 | 0.610746 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).feasible` | 19 | 18 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).worseMoves` | 131 | 127 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.0` | -0.01503 | -0.022944 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.1` | -0.013158 | 0 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.2` | -0.011696 | -0.037037 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.3` | -0.023578 | -0.035428 | T4 |
| `t4.variants.lambda = 0.4.meanJ` | 0.615424 | 0.371595 | T4 |
| `t4.variants.lambda = 0.4.atLeast070` | 10 | 5 | T4 |
| `t4.variants.lambda = 0.4.medianDeltaZ` | -0.002 | -0.008865 | T4 |
| `t4.variants.lambda = 0.4.feasible` | 19 | 18 | T4 |
| `t4.variants.lambda = 0.4.worseMoves` | 137 | 149 | T4 |
| `t4.variants.lambda = 0.4.meanDeltaGoals.0` | -0.018347 | -0.017423 | T4 |
| `t4.variants.lambda = 0.4.meanDeltaGoals.2` | -0.011696 | 0 | T4 |
| `t4.variants.lambda = 0.4.meanDeltaGoals.3` | -0.036652 | -0.023015 | T4 |
| `t4.variants.lambda = 0.6.meanJ` | 0.625269 | 0.378858 | T4 |
| `t4.variants.lambda = 0.6.atLeast070` | 11 | 4 | T4 |
| `t4.variants.lambda = 0.6.medianDeltaZ` | 0.00079 | 0.008813 | T4 |
| `t4.variants.lambda = 0.6.feasible` | 19 | 18 | T4 |
| `t4.variants.lambda = 0.6.worseMoves` | 133 | 175 | T4 |
| `t4.variants.lambda = 0.6.meanDeltaGoals.0` | -0.006693 | -0.023844 | T4 |
| `t4.variants.lambda = 0.6.meanDeltaGoals.2` | -0.005848 | -0.024691 | T4 |
| `t4.variants.lambda = 0.6.meanDeltaGoals.3` | -0.006989 | 0.002212 | T4 |
| `t4.variants.T0 x 0.5.meanJ` | 0.506202 | 0.42664 | T4 |
| `t4.variants.T0 x 0.5.atLeast070` | 7 | 5 | T4 |
| `t4.variants.T0 x 0.5.feasible` | 19 | 18 | T4 |
| `t4.variants.T0 x 0.5.worseMoves` | 112 | 109 | T4 |
| `t4.variants.T0 x 0.5.meanDeltaGoals.0` | -0.012556 | -0.00444 | T4 |
| `t4.variants.T0 x 0.5.meanDeltaGoals.2` | -0.017544 | 0.006173 | T4 |
| `t4.variants.T0 x 0.5.meanDeltaGoals.3` | -0.001972 | -0.038931 | T4 |
| `t4.variants.T0 x 2.meanJ` | 0.412849 | 0.331029 | T4 |
| `t4.variants.T0 x 2.atLeast070` | 5 | 3 | T4 |
| `t4.variants.T0 x 2.feasible` | 19 | 18 | T4 |
| `t4.variants.T0 x 2.worseMoves` | 185 | 175 | T4 |
| `t4.variants.T0 x 2.meanDeltaGoals.0` | -0.012532 | -0.010062 | T4 |
| `t4.variants.T0 x 2.meanDeltaGoals.3` | -0.022283 | 0.001777 | T4 |
| `t4.variants.alpha = 0.998.meanJ` | 0.258093 | 0.25405 | T4 |
| `t4.variants.alpha = 0.998.atLeast070` | 3 | 2 | T4 |
| `t4.variants.alpha = 0.998.medianDeltaZ` | 0.001053 | 0.011836 | T4 |
| `t4.variants.alpha = 0.998.feasible` | 19 | 18 | T4 |
| `t4.variants.alpha = 0.998.worseMoves` | 3860 | 3929 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.0` | -0.002503 | 0.020049 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.1` | -0.013158 | -0.013889 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.2` | -0.005848 | 0.018519 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.3` | -0.025679 | 0.029305 | T4 |
| `t4.variants.delta = 0.10.meanJ` | 0.60227 | 0.389495 | T4 |
| `t4.variants.delta = 0.10.atLeast070` | 10 | 4 | T4 |
| `t4.variants.delta = 0.10.feasible` | 19 | 18 | T4 |
| `t4.variants.delta = 0.10.worseMoves` | 135 | 136 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.0` | -0.006202 | -0.006476 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.2` | -0.017544 | -0.018519 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.3` | -0.02222 | -0.059609 | T4 |
| `t4.variants.delta = 0.20.meanJ` | 0.671126 | 0.378678 | T4 |
| `t4.variants.delta = 0.20.atLeast070` | 11 | 5 | T4 |
| `t4.variants.delta = 0.20.medianDeltaZ` | 0 | 0.001141 | T4 |
| `t4.variants.delta = 0.20.feasible` | 19 | 18 | T4 |
| `t4.variants.delta = 0.20.worseMoves` | 127 | 140 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.0` | 0.002683 | 0.000311 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.1` | 0 | -0.013889 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.2` | 0 | 0.006173 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.3` | 0.007841 | 0.013715 | T4 |
| `t4.variants.k_headroom = 1.5.atLeast070` | 19 | 18 | T4 |
| `t4.variants.k_headroom = 1.5.feasible` | 19 | 18 | T4 |
| `t4.variants.k_headroom = 1.5.worseMoves` | 148 | 140 | T4 |
| `t4.variants.k_headroom = 2.5.atLeast070` | 19 | 18 | T4 |
| `t4.variants.k_headroom = 2.5.feasible` | 19 | 18 | T4 |
| `t4.variants.k_headroom = 2.5.worseMoves` | 148 | 140 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanJ` | 0.51938 | 0.408261 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).atLeast070` | 5 | 4 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).medianDeltaZ` | 0.000751 | 0.002749 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).feasible` | 13 | 12 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).worseMoves` | 103 | 90 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.0` | -0.004291 | 0.020809 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.1` | -0.019231 | 0 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.2` | 0 | -0.009259 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.3` | 0.017904 | 0.013139 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanJ` | 0.541931 | 0.530815 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).atLeast070` | 6 | 4 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).feasible` | 13 | 12 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).worseMoves` | 91 | 110 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanDeltaGoals.0` | -0.005852 | 0.008468 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanDeltaGoals.2` | 0 | -0.018519 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanDeltaGoals.3` | 0.017218 | -0.008671 | T4 |
| `t6.unitPass` | 104 | 130 | T6 |
| `t6.unitFail` | 0 | 2 | T6 |
| `t6.lint` | true | false | T6 |
| `t7.feasible` | 571 | 539 | T7 |
| `t7.meanDeltaZ` | -0.011796 | -0.013117 | T7 |
| `t7.p05DeltaZ` | -0.06079 | -0.069422 | T7 |
| `t7.meanJaccard` | 0.218346 | 0.19418 | T7 |
| `t7.atLeast070` | 57 | 39 | T7 |
| `t7.jaccardCount` | 571 | 539 | T7 |
| `t7b.baselines` | 19 | 18 | T7B |
| `t7b.plansChecked` | 570 | 540 | T7B |
| `t7b.withOverlap` | 541 | 489 | T7B |
| `t7b.meanWorstOverlapM` | 0.409772 | 0.464396 | T7B |
| `t7b.withBreach` | 544 | 509 | T7B |
| `t7b.outsideCover` | 428 | 485 | T7B |
| `t7b.placedTotal` | 13740 | 17880 | T7B |
| `t7b.tierChanged` | 593 | 662 | T7B |
| `t7b.speciesChecked` | 3240 | 4050 | T7B |
| `t8.unique` | 295 | 367 | T8 |
| `t8.slots` | 617 | 762 | T8 |
| `t8.top10Share` | 0.168558 | 0.136483 | T8 |
| `t8.gini` | 0.924703 | 0.904183 | T8 |
| `t8.positions.n` | 617 | 762 | T8 |
| `t8.positions.mean` | 0.479476 | 0.460562 | T8 |
| `t8.positions.median` | 0.470173 | 0.41958 | T8 |
| `t8.positions.ksD` | 0.048524 | 0.088817 | T8 |
| `t8.positions.p` | 0.10627 | 0.000011 | T8 |
| `t8.curve.100` | 295 | 367 | T8 |
| `t8.curve.200` | 389 | 463 | T8 |
| `t8.curve.500` | 545 | 650 | T8 |
| `t9.appearing` | 14 | 15 | T9 |
| `t9.meanOther` | 0.34023 | 0.42332 | T9 |
| `t9.plans` | 95 | 92 | T9 |
| `t10.reachable` | 1754 | 1750 | T10 |
| `t10.curve.250` | 776 | 858 | T10 |
| `t10.curve.500` | 998 | 1029 | T10 |
| `t10.curve.1000` | 1223 | 1222 | T10 |
| `t10.selected` | 1223 | 1222 | T10 |
| `t10.meanScoreNever` | 0.575791 | 0.571699 | T10 |
| `t10.meanScoreSelected` | 0.686117 | 0.687033 | T10 |
| `t10.funnel.reachable` | 1754 | 1750 | T10 |
| `t10.funnel.selectable` | 1223 | 1222 | T10 |
| `t10.funnel.recommendedT1` | 295 | 367 | T10 |
| `t3.url` | - | http://localhost:3000/api/sourcing | T3 |
| `t3.specVersion` | - | 2026-10-13T17:34:43.311Z | T3 |
| `t3.checkSeconds` | - | 407 | T3 |
| `t3.totalSeconds` | - | 968 | T3 |
| `t3.withListing` | - | 81 | T3 |
| `t3.withPrice` | - | 72 | T3 |
| `t3.medianEstimatedOrOutdatedShare` | - | 0.710078 | T3 |
| `t3.medianBudget.low` | - | 699.7 | T3 |
| `t3.medianBudget.typical` | - | 729.7 | T3 |
| `t3.medianBudget.high` | - | 759.7 | T3 |
| `t3.plans` | - | 92 | T3 |
| `t3.nurseryNotes.Stodels.0` | - | checked: platform detected: woocommerce | T3 |
| `t3.nurseryNotes.Tulbagh Nursery.0` | - | checked: platform detected: woocommerce | T3 |
| `t3.nurseryNotes.Tulbagh Nursery.1` | - | failed: TypeError: fetch failed | T3 |
| `t3.nurseryNotes.Tulbagh Nursery.2` | - | failed: timed out after 5 s | T3 |
| `t3.nurseryNotes.Garden Route Botanical Garden nursery.0` | - | checked: 339 rows, may be outdated | T3 |
| `t3.nurseryNotes.Kraaibosch.0` | - | checked: 443 rows, current | T3 |
| `t3.nurseryNotes.Samgro (plugs).0` | - | checked: 82 rows, current | T3 |
| `t3.nurseryNotes.Prime Trees.0` | - | checked: 76 rows, may be outdated | T3 |
| `t3.nurseryNotes.ClicknPlant.0` | - | failed: timed out after 5 s | T3 |
