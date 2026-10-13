# Chapter 5: every number that changed

Old: `reports/chapter5_results.json` (run 2026-10-01T06:32Z - the "30 Sep" results; rulebook `c7d06d358091`, dataset `e5d14caf5ca0`).
New: `reports/chapter5_results_final.json` (run 2026-10-13T18:07Z; rulebook `4722b1c43a87`, dataset `6c081d3d2f60`, stage4.ts `64838fe71639`; T3 live against the dev server with sourcing settings 2026-10-13T17:34:43Z).
Produced by `scripts/chapter5/diff-results.ts`. T4GOALS and T4SEEDNOISE are parts of T4.

245 values differ.

| value | old (30 Sep / 1 Oct run) | new (final) | test |
|---|---|---|---|
| `versions.rulebook` | c7d06d358091 | 4722b1c43a87 | versions |
| `versions.dataset` | e5d14caf5ca0 | 6c081d3d2f60 | versions |
| `versions.stage4` | dc02b3d2c8a5 | 64838fe71639 | versions |
| `t1.status.SUCCESS` | 90 | 58 | T1 |
| `t1.status.SUCCESS_DEGRADED` | 5 | 34 | T1 |
| `t1.status.INFEASIBLE` | 5 | 8 | T1 |
| `t1.feasible` | 95 | 92 | T1 |
| `t1.timesMs.median` | 457.3921 | 555.3649 | T1 |
| `t1.timesMs.p95` | 831.6205 | 1396.8043 | T1 |
| `t1.timesMs.max` | 1426.8663 | 2410.6498 | T1 |
| `t1.jaccard.pairs` | 273 | 265 | T1 |
| `t1.jaccard.distinct` | 236 | 225 | T1 |
| `t1.jaccard.mean` | 0.393343 | 0.395286 | T1 |
| `t1.jaccard.sameSpeciesDifferentSizes` | 4 | 2 | T1 |
| `t1.goals.mean.0` | 0.890482 | 0.856496 | T1 |
| `t1.goals.mean.1` | 0.94386 | 0.942935 | T1 |
| `t1.goals.mean.2` | 0.981287 | 0.980676 | T1 |
| `t1.goals.mean.3` | 0.949391 | 0.709405 | T1 |
| `t1.goals.min.0` | 0.4 | 0.330769 | T1 |
| `t1.goals.min.3` | 0.390107 | 0.347534 | T1 |
| `t1.tierGap.fynbos` | 0.261195 | 0.392819 | T1 |
| `t1.tierGap.mediterranean` | 0.092337 | 0.119751 | T1 |
| `t1.tierGap.cottage` | 0.289952 | 0.357401 | T1 |
| `t1.tierGap.generic` | 0.221977 | 0.263983 | T1 |
| `t1.medianZ` | 0.93357 | 0.908859 | T1 |
| `t1.medianPlantsPerSpecies` | 3 | 3.5 | T1 |
| `t1.allSameSize` | 4 | 2 | T1 |
| `t2.checked` | 617 | 614 | T2 |
| `t3.uniqueSpecies` | 295 | 291 | T3 |
| `t3.run` | false | true | T3 |
| `t3.reason` | sourcing is live HTTP; not runnable offline within the politeness budget | - | T3 |
| `t4SeedNoise.perBrief.0.sd` | 0.003779 | 0.005525 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.0.mean` | 0.993137 | 0.955183 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.1.sd` | 0.0083 | 0.008788 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.1.mean` | 0.99546 | 0.954889 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.2.sd` | 0.016136 | 0.012477 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.2.mean` | 0.979429 | 0.947379 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.3.sd` | 0.001437 | 0.005902 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.3.mean` | 0.497933 | 0.474843 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.4.sd` | 0.001053 | 0.014588 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.4.mean` | 0.995392 | 0.968382 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.5.sd` | 0.009485 | 0.003655 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.5.mean` | 0.948007 | 0.939603 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.6.sd` | 0.001929 | 0.006999 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.6.mean` | 0.997225 | 0.979542 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.7.sd` | 0.013937 | 0.007606 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.7.mean` | 0.980438 | 0.953741 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.8.sd` | 0.000702 | 0.012318 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.8.mean` | 0.998637 | 0.965769 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.9.sd` | 0.00312 | 0.005236 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.9.mean` | 0.981954 | 0.968029 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.10.sd` | 0.003342 | 0.00247 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.10.mean` | 0.991822 | 0.956828 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.11.sd` | 0.001884 | 0.004527 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.11.mean` | 0.992242 | 0.948606 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.12.sd` | 0.000336 | 0.012394 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.12.mean` | 0.9995 | 0.956932 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.13.sd` | 0.004851 | 0 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.13.mean` | 0.977574 | 0.955677 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.14.sd` | 0.015712 | 0.015308 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.14.mean` | 0.887905 | 0.869998 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.15.sd` | 0.01277 | 0.018745 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.15.mean` | 0.920174 | 0.892806 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.16.sd` | 0.024306 | 0.013205 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.16.mean` | 0.951542 | 0.928209 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.17.sd` | 0.005634 | 0.005907 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.17.mean` | 0.964044 | 0.940136 | T4SEEDNOISE |
| `t4SeedNoise.perBrief.18.id` | S096 | - | T4SEEDNOISE |
| `t4SeedNoise.perBrief.18.sd` | 0.015616 | - | T4SEEDNOISE |
| `t4SeedNoise.perBrief.18.mean` | 0.959114 | - | T4SEEDNOISE |
| `t4SeedNoise.meanSd` | 0.007596 | 0.008647 | T4SEEDNOISE |
| `t4Goals.0.deltas.0` | -0.01503 | -0.025441 | T4GOALS |
| `t4Goals.0.deltas.1` | -0.013158 | 0 | T4GOALS |
| `t4Goals.0.deltas.2` | -0.011696 | -0.006536 | T4GOALS |
| `t4Goals.0.deltas.3` | -0.023578 | 0.014269 | T4GOALS |
| `t4Goals.1.deltas.0` | -0.018347 | 0.001688 | T4GOALS |
| `t4Goals.1.deltas.2` | -0.011696 | 0 | T4GOALS |
| `t4Goals.1.deltas.3` | -0.036652 | -0.024355 | T4GOALS |
| `t4Goals.2.deltas.0` | -0.006693 | -0.003325 | T4GOALS |
| `t4Goals.2.deltas.2` | -0.005848 | -0.006536 | T4GOALS |
| `t4Goals.2.deltas.3` | -0.006989 | -0.033044 | T4GOALS |
| `t4Goals.3.deltas.0` | -0.012556 | 0.000786 | T4GOALS |
| `t4Goals.3.deltas.2` | -0.017544 | -0.019608 | T4GOALS |
| `t4Goals.3.deltas.3` | -0.001972 | -0.043969 | T4GOALS |
| `t4Goals.4.deltas.0` | -0.012532 | 0.01308 | T4GOALS |
| `t4Goals.4.deltas.2` | 0 | -0.006536 | T4GOALS |
| `t4Goals.4.deltas.3` | -0.022283 | -0.024269 | T4GOALS |
| `t4Goals.5.deltas.0` | -0.002503 | 0.015601 | T4GOALS |
| `t4Goals.5.deltas.1` | -0.013158 | 0 | T4GOALS |
| `t4Goals.5.deltas.2` | -0.005848 | 0.006944 | T4GOALS |
| `t4Goals.5.deltas.3` | -0.025679 | -0.001764 | T4GOALS |
| `t4Goals.6.deltas.0` | -0.006202 | 0.004096 | T4GOALS |
| `t4Goals.6.deltas.1` | 0 | 0.014706 | T4GOALS |
| `t4Goals.6.deltas.2` | -0.017544 | 0.006536 | T4GOALS |
| `t4Goals.6.deltas.3` | -0.02222 | -0.023277 | T4GOALS |
| `t4Goals.7.deltas.0` | 0.002683 | -0.012188 | T4GOALS |
| `t4Goals.7.deltas.2` | 0 | -0.013072 | T4GOALS |
| `t4Goals.7.deltas.3` | 0.007841 | 0.01923 | T4GOALS |
| `t4Goals.10.deltas.0` | -0.004291 | -0.019886 | T4GOALS |
| `t4Goals.10.deltas.1` | -0.019231 | 0 | T4GOALS |
| `t4Goals.10.deltas.2` | 0 | 0.010101 | T4GOALS |
| `t4Goals.10.deltas.3` | 0.017904 | 0.030132 | T4GOALS |
| `t4Goals.11.deltas.0` | -0.005852 | -0.022869 | T4GOALS |
| `t4Goals.11.deltas.3` | 0.017218 | 0.002948 | T4GOALS |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanJ` | 0.597752 | 0.628385 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).atLeast070` | 9 | 10 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).feasible` | 19 | 18 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).worseMoves` | 131 | 171 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.0` | -0.01503 | -0.025441 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.1` | -0.013158 | 0 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.2` | -0.011696 | -0.006536 | T4 |
| `t4.variants.AHP equal weights (style = extras = colour = 1/3).meanDeltaGoals.3` | -0.023578 | 0.014269 | T4 |
| `t4.variants.lambda = 0.4.meanJ` | 0.615424 | 0.376422 | T4 |
| `t4.variants.lambda = 0.4.atLeast070` | 10 | 5 | T4 |
| `t4.variants.lambda = 0.4.medianDeltaZ` | -0.002 | -0.008865 | T4 |
| `t4.variants.lambda = 0.4.feasible` | 19 | 17 | T4 |
| `t4.variants.lambda = 0.4.worseMoves` | 137 | 109 | T4 |
| `t4.variants.lambda = 0.4.meanDeltaGoals.0` | -0.018347 | 0.001688 | T4 |
| `t4.variants.lambda = 0.4.meanDeltaGoals.2` | -0.011696 | 0 | T4 |
| `t4.variants.lambda = 0.4.meanDeltaGoals.3` | -0.036652 | -0.024355 | T4 |
| `t4.variants.lambda = 0.6.meanJ` | 0.625269 | 0.456983 | T4 |
| `t4.variants.lambda = 0.6.atLeast070` | 11 | 5 | T4 |
| `t4.variants.lambda = 0.6.medianDeltaZ` | 0.00079 | 0.005589 | T4 |
| `t4.variants.lambda = 0.6.feasible` | 19 | 18 | T4 |
| `t4.variants.lambda = 0.6.worseMoves` | 133 | 150 | T4 |
| `t4.variants.lambda = 0.6.meanDeltaGoals.0` | -0.006693 | -0.003325 | T4 |
| `t4.variants.lambda = 0.6.meanDeltaGoals.2` | -0.005848 | -0.006536 | T4 |
| `t4.variants.lambda = 0.6.meanDeltaGoals.3` | -0.006989 | -0.033044 | T4 |
| `t4.variants.T0 x 0.5.meanJ` | 0.506202 | 0.345544 | T4 |
| `t4.variants.T0 x 0.5.atLeast070` | 7 | 3 | T4 |
| `t4.variants.T0 x 0.5.medianDeltaZ` | 0 | -0.0005 | T4 |
| `t4.variants.T0 x 0.5.feasible` | 19 | 18 | T4 |
| `t4.variants.T0 x 0.5.worseMoves` | 112 | 121 | T4 |
| `t4.variants.T0 x 0.5.meanDeltaGoals.0` | -0.012556 | 0.000786 | T4 |
| `t4.variants.T0 x 0.5.meanDeltaGoals.2` | -0.017544 | -0.019608 | T4 |
| `t4.variants.T0 x 0.5.meanDeltaGoals.3` | -0.001972 | -0.043969 | T4 |
| `t4.variants.T0 x 2.meanJ` | 0.412849 | 0.327765 | T4 |
| `t4.variants.T0 x 2.atLeast070` | 5 | 3 | T4 |
| `t4.variants.T0 x 2.feasible` | 19 | 18 | T4 |
| `t4.variants.T0 x 2.worseMoves` | 185 | 213 | T4 |
| `t4.variants.T0 x 2.meanDeltaGoals.0` | -0.012532 | 0.01308 | T4 |
| `t4.variants.T0 x 2.meanDeltaGoals.2` | 0 | -0.006536 | T4 |
| `t4.variants.T0 x 2.meanDeltaGoals.3` | -0.022283 | -0.024269 | T4 |
| `t4.variants.alpha = 0.998.meanJ` | 0.258093 | 0.329412 | T4 |
| `t4.variants.alpha = 0.998.atLeast070` | 3 | 4 | T4 |
| `t4.variants.alpha = 0.998.medianDeltaZ` | 0.001053 | 0 | T4 |
| `t4.variants.alpha = 0.998.feasible` | 19 | 17 | T4 |
| `t4.variants.alpha = 0.998.worseMoves` | 3860 | 3441 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.0` | -0.002503 | 0.015601 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.1` | -0.013158 | 0 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.2` | -0.005848 | 0.006944 | T4 |
| `t4.variants.alpha = 0.998.meanDeltaGoals.3` | -0.025679 | -0.001764 | T4 |
| `t4.variants.delta = 0.10.meanJ` | 0.60227 | 0.425461 | T4 |
| `t4.variants.delta = 0.10.atLeast070` | 10 | 4 | T4 |
| `t4.variants.delta = 0.10.medianDeltaZ` | 0 | -0.000702 | T4 |
| `t4.variants.delta = 0.10.feasible` | 19 | 18 | T4 |
| `t4.variants.delta = 0.10.worseMoves` | 135 | 152 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.0` | -0.006202 | 0.004096 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.1` | 0 | 0.014706 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.2` | -0.017544 | 0.006536 | T4 |
| `t4.variants.delta = 0.10.meanDeltaGoals.3` | -0.02222 | -0.023277 | T4 |
| `t4.variants.delta = 0.20.meanJ` | 0.671126 | 0.450099 | T4 |
| `t4.variants.delta = 0.20.atLeast070` | 11 | 4 | T4 |
| `t4.variants.delta = 0.20.feasible` | 19 | 17 | T4 |
| `t4.variants.delta = 0.20.worseMoves` | 127 | 148 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.0` | 0.002683 | -0.012188 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.2` | 0 | -0.013072 | T4 |
| `t4.variants.delta = 0.20.meanDeltaGoals.3` | 0.007841 | 0.01923 | T4 |
| `t4.variants.k_headroom = 1.5.atLeast070` | 19 | 17 | T4 |
| `t4.variants.k_headroom = 1.5.feasible` | 19 | 17 | T4 |
| `t4.variants.k_headroom = 1.5.worseMoves` | 148 | 156 | T4 |
| `t4.variants.k_headroom = 2.5.atLeast070` | 19 | 17 | T4 |
| `t4.variants.k_headroom = 2.5.feasible` | 19 | 17 | T4 |
| `t4.variants.k_headroom = 2.5.worseMoves` | 148 | 156 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanJ` | 0.51938 | 0.478619 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).medianDeltaZ` | 0.000751 | 0 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).feasible` | 13 | 12 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).worseMoves` | 103 | 95 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.0` | -0.004291 | -0.019886 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.1` | -0.019231 | 0 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.2` | 0 | 0.010101 | T4 |
| `t4.variants.b_wind -20% (wind scenarios).meanDeltaGoals.3` | 0.017904 | 0.030132 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanJ` | 0.541931 | 0.482292 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).atLeast070` | 6 | 5 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).feasible` | 13 | 12 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanDeltaGoals.0` | -0.005852 | -0.022869 | T4 |
| `t4.variants.b_wind +20% (wind scenarios).meanDeltaGoals.3` | 0.017218 | 0.002948 | T4 |
| `t6.unitPass` | 104 | 127 | T6 |
| `t7.feasible` | 571 | 537 | T7 |
| `t7.meanDeltaZ` | -0.011796 | -0.007544 | T7 |
| `t7.p05DeltaZ` | -0.06079 | -0.050142 | T7 |
| `t7.meanJaccard` | 0.218346 | 0.223273 | T7 |
| `t7.atLeast070` | 57 | 50 | T7 |
| `t7.jaccardCount` | 571 | 537 | T7 |
| `t7b.baselines` | 19 | 17 | T7B |
| `t7b.plansChecked` | 570 | 510 | T7B |
| `t7b.withOverlap` | 541 | 478 | T7B |
| `t7b.meanWorstOverlapM` | 0.409772 | 0.43831 | T7B |
| `t7b.withBreach` | 544 | 483 | T7B |
| `t7b.outsideCover` | 428 | 460 | T7B |
| `t7b.placedTotal` | 13740 | 12990 | T7B |
| `t7b.tierChanged` | 593 | 652 | T7B |
| `t7b.speciesChecked` | 3240 | 3120 | T7B |
| `t8.unique` | 295 | 291 | T8 |
| `t8.slots` | 617 | 614 | T8 |
| `t8.top10Share` | 0.168558 | 0.166124 | T8 |
| `t8.gini` | 0.924703 | 0.926089 | T8 |
| `t8.positions.n` | 617 | 614 | T8 |
| `t8.positions.mean` | 0.479476 | 0.47732 | T8 |
| `t8.positions.median` | 0.470173 | 0.451477 | T8 |
| `t8.positions.ksD` | 0.048524 | 0.060811 | T8 |
| `t8.positions.p` | 0.10627 | 0.020369 | T8 |
| `t8.curve.100` | 295 | 291 | T8 |
| `t8.curve.200` | 389 | 396 | T8 |
| `t8.curve.500` | 545 | 537 | T8 |
| `t9.appearing` | 14 | 13 | T9 |
| `t9.meanCombo` | 0.490196 | 0.431373 | T9 |
| `t9.plans` | 95 | 92 | T9 |
| `t10.curve.250` | 776 | 762 | T10 |
| `t10.curve.500` | 998 | 975 | T10 |
| `t10.curve.1000` | 1223 | 1190 | T10 |
| `t10.neverSelected` | 537 | 570 | T10 |
| `t10.selected` | 1223 | 1190 | T10 |
| `t10.meanScoreNever` | 0.575791 | 0.576742 | T10 |
| `t10.meanScoreSelected` | 0.686117 | 0.688721 | T10 |
| `t10.funnel.selectable` | 1223 | 1190 | T10 |
| `t10.funnel.recommendedT1` | 295 | 291 | T10 |
| `t3.url` | - | http://localhost:3000/api/sourcing | T3 |
| `t3.specVersion` | - | 2026-10-13T17:34:43.311Z | T3 |
| `t3.checkSeconds` | - | 888 | T3 |
| `t3.totalSeconds` | - | 1176 | T3 |
| `t3.withListing` | - | 70 | T3 |
| `t3.withPrice` | - | 67 | T3 |
| `t3.medianEstimatedOrOutdatedShare` | - | 0.584566 | T3 |
| `t3.medianBudget.low` | - | 579.65 | T3 |
| `t3.medianBudget.typical` | - | 579.65 | T3 |
| `t3.medianBudget.high` | - | 605 | T3 |
| `t3.plans` | - | 92 | T3 |
| `t3.nurseryNotes.Stodels.0` | - | checked: platform detected: woocommerce | T3 |
| `t3.nurseryNotes.Tulbagh Nursery.0` | - | checked: platform detected: woocommerce | T3 |
| `t3.nurseryNotes.Tulbagh Nursery.1` | - | failed: TypeError: fetch failed | T3 |
| `t3.nurseryNotes.Garden Route Botanical Garden nursery.0` | - | checked: 339 rows, may be outdated | T3 |
| `t3.nurseryNotes.Kraaibosch.0` | - | checked: 443 rows, current | T3 |
| `t3.nurseryNotes.Samgro (plugs).0` | - | checked: 82 rows, current | T3 |
| `t3.nurseryNotes.Prime Trees.0` | - | checked: 76 rows, may be outdated | T3 |
