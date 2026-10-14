# layout-v2: comparison (Step 4)

Rulebook **713f9bad5bec** (frozen 14 Oct 2026; contact_bonus 0, sweep_weight 0)
for every config except (a), which runs on the archived engine-final rulebook
**4722b1c43a87**. Dataset **6c081d3d2f60** throughout. Same seeds everywhere.

The runs cover the 100 batch briefs plus the fixed case (6 x 2 m fynbos, south
view, part sun, moist), which makes 101 briefs and every option of each.
- Configs (a) and (a′) ran on the `engine-final` tag code.
- The others ran on layout-v2 Step 3 (29a408d), with flags and k set in
  memory only.

Scripts: `scripts/layout-v2-run.ts`, `layout-v2-compare.ts` and
`layout-v2-figures.ts`. Raw rows are in `reports/layout_v2/`.

## Path taken: time box triggered, D29 and D30 reverted

The time box says to stop when (b) or (d) moves median Z by more than 0.01. Both do:

| | Median Z | Change vs (a) | Change vs (a′) |
|---|---:|---:|---:|
| (b) +D29 | 0.8865 | −0.019 | −0.014 |
| (d) +D29+D30 | 0.8882 | −0.017 | −0.013 |

The other two triggers were not hit:
- Feasibility changed for only 2 briefs (the limit is 20).
- No hard check failed.

As instructed:
- This report is kept.
- The code from Steps 1–3 is reverted: D29, D30 and the Step 3 tests that
  depend on them.
- The result is recorded as a limitation below.

The engine on `layout-v2` is back to engine-final behaviour (D28 band fallback)
on rulebook 713f9bad5bec. Steps 1–3 stay in git history (49c8ae7, b9eeca9,
29a408d) and can be restored with one revert of the revert.

## The table (old → new: (a) is engine-final as shipped)

| Metric | (a) | (a′) | (b) | (b′) | (c) | (d) | (e) | (f) | (g) | (h) | (j) | (i) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 94 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 |
| Options feasible | 275/282 | 274/281 | 271/280 | 273/282 | 272/281 | 274/283 | 271/280 | 274/283 | 271/280 | 275/284 | 272/281 | 274/283 |
| SUCCESS share (options) | 0.670 | 0.655 | 0.379 | 0.340 | 0.363 | 0.378 | 0.350 | 0.382 | 0.368 | 0.363 | 0.342 | 0.378 |
| Median Z | 0.9056 | 0.9008 | 0.8865 | 0.8859 | 0.8888 | 0.8882 | 0.8905 | 0.8879 | 0.8836 | 0.8889 | 0.8856 | 0.8882 |
| Mean A4 | 0.715 | 0.700 | 0.544 | 0.536 | 0.549 | 0.557 | 0.558 | 0.557 | 0.538 | 0.558 | 0.549 | 0.557 |
| 12-case layering test | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 |
| Largest empty patch (median) | 0.198 | 0.191 | 0.395 | 0.410 | 0.396 | 0.370 | 0.370 | 0.367 | 0.412 | 0.357 | 0.379 | 0.370 |
| Quadrant CV (median) | 0.216 | 0.197 | 0.390 | 0.378 | 0.372 | 0.369 | 0.334 | 0.366 | 0.384 | 0.346 | 0.342 | 0.369 |
| 9-cell cover, min (median) | 0.204 | 0.222 | 0.020 | 0.024 | 0.066 | 0.071 | 0.061 | 0.071 | 0.061 | 0.061 | 0.056 | 0.071 |
| 9-cell cover, median (median) | 0.714 | 0.691 | 0.500 | 0.510 | 0.524 | 0.531 | 0.528 | 0.531 | 0.476 | 0.531 | 0.500 | 0.531 |
| **Tall plants centred in front (must be 0)** | **448** | **482** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Options with a hard failure | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Briefs lost vs (a) | – | 0 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| Species dropped by the fail rule | 98 | 108 | 272 | 300 | 252 | 257 | 260 | 257 | 272 | 267 | 261 | 257 |
| Straddling plants | – | – | 1140 | 1097 | 1241 | 1216 | 1136 | 1216 | 1148 | 1206 | 1195 | 1216 |
| Fallbacks to skeleton (R15) | – | – | 0 | 0 | 86 | 123 | 135 | 118 | 67 | 43 | 101 | 123 |
| Tiebreaks (overlap zones) | – | – | 866 | 856 | 853 | 862 | 837 | 865 | 850 | 873 | 840 | 862 |
| Share violations (R10) | – | – | 100 | 94 | 70 | 85 | 85 | 82 | 82 | 93 | 76 | 85 |
| Briefs where the front fill ran out | – | – | 86 | 87 | 89 | 88 | 87 | 87 | 89 | 87 | 87 | 88 |

What each config is:
- **(a)** engine-final, archived rulebook.
- **(a′)** engine-final code on the new rulebook.
- **(b)** +D29 height bands. **(b′)** the same without the in-band gradient.
- **(c), (d), (e)** +D29+D30 with k = 0.10, 0.15 and 0.20.
- **(f)–(j)** (d) with one modifier off: (f) straddle, (g) curve, (h) shares,
  (j) placement order.
- **(i)** (d) with contact_bonus 0. The frozen rulebook already has 0, so (i)
  equals (d) by construction. The identical results confirm the override path
  changes nothing.

Definitions:
- **SUCCESS share:** feasible, with no species dropped, no plant unplaced and no
  hard failure.
- **Spread metrics** use a 20 x 20 sample grid. The 9-cell figures group that
  grid 3 x 3.
- **"Tall in front"** means height over h_back_min (80 cm) with the centre
  within 0.35 of the depth from the viewer.
- **Lost briefs:** S073 (0.5 x 0.5 m) and S074 (0.5 x 30 m) in every D29
  config. A 0.5 m bed gives a 17.5 cm front band, which is too thin for the
  banded rules.

## What the numbers say

- **D29 does its job.** Tall plants centred in front fall from 448 (a) and
  482 (a′) to 0 in every D29 config, and B1223 and B1172 are fixed.
- **The cost is spread and completeness.** The largest gap roughly doubles,
  and the emptiest ninth of the bed falls from about 0.20 cover to 0.02–0.07.
  Fail-rule drops go up 2.5x, which halves the SUCCESS share and pulls A4 down.
  The cause shows in the figures: the front fill pass ran out of short plants
  in about 88 of 92 feasible briefs. The selected groups do not contain enough
  short species to fill a 35% front band.
- **D30 recovers part of D29's spread loss.**
  - Compared with (b), (d) improves the largest gap (0.395 → 0.370), the
    min-cell cover (0.020 → 0.071), drops (272 → 257) and Z (+0.002).
  - Of the single modifiers, the curve matters most: (g) without it is the
    worst D30 config.
  - Shares off (h) gives the best gap and CV.
  - None of them closes the gap to (a).
- **The in-band gradient** (b vs b′) costs nothing in Z and lowers drops.
- The tests pass in every config: the 12-case is 12/12, with 0 hard failures.

## Figures

`reports/figures/layout_v2/<config>.png` (SVG alongside). Each shows option 1
of S001, S006 and the fixed case, from the same seeds. North is at the top,
the straight band edges are dashed, and ring weight shows height.

## Limitation (recorded)

The height-band layout (D29, with D30 shaping) removes every tall-in-front
error. It does so at a median-Z cost of 0.013–0.019, because the selection is
not chosen with bands in mind: most groups lack enough short plants for the
front band, so the front stays sparse and more species fail to place.

Per the time box, D29 and D30 are reverted, and the engine keeps engine-final's
D28 fallback. That fallback still allows tall plants to be centred in the front
band: 482 instances across the 101 briefs on this rulebook.

The likely fix is upstream: make Stage 2/3 aware of band capacity, for example
a minimum short-plant share. That is a selection change outside this prompt.

D24 (b) (windy 8 x 6 m, east view, option 1) fails on the reverted code with
this rulebook, as recorded in Step 0. D29 had fixed it, so it fails again after
the revert.
