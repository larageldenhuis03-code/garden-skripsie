# Cover-bar test: the final algorithm at the book cover values

Measurement only. No rulebook, generated rules, dataset or engine default was
changed, and nothing was deployed.

| | |
|---|---|
| Code | `main` at 4a5b823: the final algorithm v11o, harmonise always applied |
| Rulebook | `713f9bad5bec` |
| Dataset | `1e15fe4470f8` |
| Run | 2026-10-20 07:09 UTC (FINAL), 2026-10-20 07:09 UTC (FINAL-BOOK) |
| Iteration 1 (reference, copied, not re-run) | `reports/chapter5_results.json`, run 2026-10-01T06:32Z; rulebook `c7d06d358091`, dataset `e5d14caf5ca0` |
| Scripts | `scripts/cover-bar-test.ts` (`COVER_BAR=final` / `book`) and `scripts/cover-bar-figures.ts` |

**What was varied.** FINAL-BOOK sets only the style cover values, in memory,
to iteration 1's book values:

| Style | coverMin | coverMax |
|---|---|---|
| fynbos | 0.70 | 0.85 |
| mediterranean | 0.60 | 0.80 |
| cottage | 0.85 | 0.90 |
| generic | 0.75 | 0.85 |

The run compares the whole rulebook before and after the override: exactly
these 8 values differ, nothing else. FINAL changed 0 values.

**Where the values take effect.** Every use reads `site.style`, which points
at `RULES.styles[...]` and is read for each plan:
- **H1 (max cover):** `coverCapM2` and `rulebookCoverCapM2` use `coverMax`.
  On the fixed case the H1 limit reads "<= 10.20 m2 (cover_max 0.85 x bed)".
- **G4/A4 (min cover):** `min(1, planted / (coverMin × bed))`. On the fixed
  case A4 = 1.000, as coverMin 0.70 gives.
- **Fail rule's cover cap:** `min(coverMax, packingCap)`.
- **The open fill's H1 check.**
- **The plan text,** which now reads "A fynbos / indigenous bed aims for 70-85% planted cover and 5-12 species at this size".

**What was run.** Both variants cover the 100 batch scenarios plus the fixed
case (6 × 2 m fynbos, south view), all options, same seeds.
- **Selection measures** follow Chapter 5's T1 exactly: option 1 per brief,
  over the 100 scenarios, with all options used for Jaccard.
- **Layout measures** use the same metric code as
  `reports/layout_v2g_comparison.md`. They are medians over every feasible
  option of the 100 scenarios and the fixed case.
- **Iteration 1's** numbers are copied, so its layout rows are "–".

**Reuse check.** The 19 Oct Chapter 5 results were not reused, because they
are not identical. This FINAL run, and a separate run of the 19 Oct code
(c2c2c18), both give median Z 0.89936; the stored 19 Oct T1 says 0.89944.
Feasibility, the infeasible briefs and mean A1–A5 (to 3 decimals) agree.
"Harmonise always applied" changes no Z and only one option-1 planting list:
in S076 a final check fails, so relaxation reverts. The 0.00008 gap in the
stored figure was not traced.

**Run times** for FINAL and FINAL-BOOK were measured with both runs side by
side on one machine, so they are slower than a lone run. Iteration 1 ran
alone.

| Measure | Iteration 1 (1 Oct, copied) | FINAL-BOOK | FINAL |
|---|---|---|---|
| Feasible briefs (of 100) | 95 | 92 | 92 |
| Plans with a species left out or a plant unplaced | 5 | 16 | 31 |
| Infeasible IDs | S026, S027, S062, S063, S090 | S026, S027, S062, S063, S073, S075, S090, S096 | S026, S027, S062, S063, S075, S083, S090, S096 |
| Hard violations | 0 (H1–H5), P1 0, P2 0 | 0 (H1–H5), P1 0, P2 0 | 0 (H1–H5), P1 0, P2 0 |
| **Median Z** | 0.9336 | 0.9046 | 0.8994 |
| A1 mean / min | 0.890 / 0.400 | 0.866 / 0.400 | 0.867 / 0.163 |
| A2 mean / min | 0.944 / 0.250 | 0.922 / 0.250 | 0.924 / 0.250 |
| A3 mean / min | 0.981 / 0.444 | 0.971 / 0.444 | 0.967 / 0.444 |
| **A4** mean / min | 0.949 / 0.390 | 0.872 / 0.406 | 0.731 / 0.338 |
| A5 mean / min | 1.000 / 1.000 | 1.000 / 1.000 | 1.000 / 1.000 |
| Height-tier gap, fynbos | 0.261 | 0.467 | 0.433 |
| Height-tier gap, mediterranean | 0.092 | 0.320 | 0.328 |
| Height-tier gap, cottage | 0.290 | 0.358 | 0.371 |
| Height-tier gap, generic | 0.222 | 0.388 | 0.406 |
| Option pairs with J ≤ 0.70 | 236 / 273 | 237 / 252 | 242 / 264 |
| Mean J | 0.393 | 0.318 | 0.360 |
| Distinct species (option 1, feasible briefs) | 295 | 373 | 369 |
| Run time per brief, median / 95th pct / max (ms) | 457 / 832 / 1427 | 723 / 1876 / 3293 | 700 / 1698 / 2794 |
| Feasible options measured (layout rows below) | – | 266 | 275 |
| Cover, placed canopy share (median) | – | 0.694 | 0.706 |
| Options with cover ≥ 0.75 / ≥ 0.80 | – | 73 / 19 | 87 / 34 |
| Largest empty patch (median) | – | 0.109 | 0.087 |
| Empty-cell share (median) | – | 0.310 | 0.295 |
| Side-gap spread, cm (median) | – | 45.2 | 44.9 |
| Plants ≥ 80 cm centred in the front band (total) | – | 661 | 786 |
| Trees centred in front (total) | – | 37 | 36 |
| Plants / species per option (median) | – | 23 / 6.5 | 23 / 6 |

## What it says

1. **The cover bar alone explains most of the A4 drop, and part of the Z
   drop.** Putting the final algorithm back on the book cover values lifts
   mean A4 from 0.731 to 0.872 (minimum
   0.338 → 0.406) and median Z from
   0.8994 to 0.9046. Measured against the gap to iteration 1, the bar alone accounts for
   0.141 of the 0.218 A4 gap (about two-thirds) but only 0.005 of the 0.034
   Z gap (about a sixth).
2. **On the same bar, the final algorithm still scores below iteration 1.**

   | | FINAL-BOOK | Iteration 1 |
   |---|---|---|
   | Median Z | 0.9046 | 0.9336 |
   | Mean A4 | 0.872 | 0.949 |
   | Mean A1 | 0.866 | 0.890 |
   | Plans with a species left out or a plant unplaced | 16 | 5 |
   | Feasible briefs | 92 | 95 |

   Height-tier gaps are larger in every style. Iteration 1 also ran on an
   earlier rulebook and dataset (rulebook `c7d06d358091`, dataset
   `e5d14caf5ca0`, before the spread corrections), so this
   difference is not the algorithm alone.
3. **The higher bar buys a little more ground covered.** Against FINAL-BOOK,
   FINAL gains:
   - median placed cover 0.694 → 0.706;
   - options at cover ≥ 0.75 73 → 87, and ≥ 0.80
     19 → 34;
   - largest empty patch 0.109 → 0.087;
   - empty-cell share 0.310 → 0.295.

   Side-gap spread is unchanged (45.2 → 44.9 cm). The costs:
   - more plans lose a species or a plant to placement (16 → 31);
   - more tall plants are centred in front (661 → 786).
4. **Feasibility is the same count, but different briefs.** Both variants
   find 92/100 feasible briefs, against iteration 1's
   95/100.
   - FINAL loses S075, S083 and S096 beyond iteration 1's five.
   - FINAL-BOOK loses S073, S075 and S096.
   - The bar decides only one brief either way: S083 (15 × 2 m) fails at the
     high bar, and S073 (0.5 × 0.5 m) fails at the book bar.

## Figures

Option 1, FINAL-BOOK on the left and FINAL on the right, same seed and scale:
- `reports/figures/cover_bar/S001.png` (and `.svg`)
- `reports/figures/cover_bar/S006.png` (and `.svg`)
- `reports/figures/cover_bar/FIX.png` (and `.svg`)
