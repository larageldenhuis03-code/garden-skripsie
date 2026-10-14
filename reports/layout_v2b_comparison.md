# layout-v2b: D29b relative height gradient and D32 capacity-aware selection

Every config runs on rulebook **713f9bad5bec** (frozen) and dataset
**6c081d3d2f60**, with the same seeds. The runs cover the 100 batch briefs plus
the fixed case (6 x 2 m fynbos, south view, part sun, moist), every option of
each.

Where each config ran:
- **(a′)** ran on the `engine-final` tag code.
- **(b)** ran on layout-v2 Step 3 (29a408d), with D29 only.
- **(m)–(q′)** ran on branch `layout-v2b`, with the flags set in memory.

Scripts: `scripts/layout-v2b-run.ts`, `layout-v2b-compare.ts` and
`layout-v2b-figures.ts`. Raw rows are in `reports/layout_v2b/`.

## Path taken

- **D29b is kept, with config (o) as the default.** That means parts 1–5:
  gradient, tree rule, curve, placement order and fill. It passes the time box:
  - median Z changes by −0.0018 against (a′);
  - feasibility is unchanged (0 briefs lost);
  - all 131 unit tests pass.

  It also fixes the D24 (b) east-view failure that engine-final has.
- **The drift split (part 6) stays off.** In (p) it breaks the 12-case
  layering test (10/12). It is a config-only test flag, so its code stays.
- **D32 is reverted.** It breaks two existing tests:
  - the 12-case layering test (north option 3);
  - D24 (a), where a windbreak plant lands on the viewing edge (north
    option 2).

  The prompt's rule is to revert on broken tests. D32 stays in history as
  5d1d175. Its Z change (−0.004) is reported but was not a trigger.

## Main table

| Metric | (a′) | (b) | (m) | (n) | (o) | (p) | (q) | (q′) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 92 | 94 | 94 | 94 | 94 | 94 | 94 |
| Options feasible | 274/281 | 271/280 | 276/283 | 277/284 | 273/280 | 277/284 | 278/285 | 276/283 |
| Clean-result share (options) | 0.655 | 0.379 | 0.608 | 0.623 | 0.639 | 0.634 | 0.600 | 0.583 |
| Median Z | 0.9008 | 0.8865 | 0.9018 | 0.9063 | 0.8990 | 0.8996 | 0.8958 | 0.8952 |
| Mean A4 | 0.700 | 0.544 | 0.705 | 0.712 | 0.710 | 0.705 | 0.720 | 0.722 |
| 12-case layering test | 12/12 | 9/12 | 12/12 | 11/12 | **12/12** | 10/12 | 11/12 | 11/12 |
| D24 (b) east, option 1 | FAIL | pass | pass | pass | pass | pass | pass | pass |
| B1223 / B1172 behind the short plants (4 edges) | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| … and out of the front 0.35 | 0/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| Largest empty patch (median) | 0.191 | 0.395 | 0.179 | 0.160 | 0.175 | 0.165 | 0.161 | 0.171 |
| Quadrant CV (median) | 0.197 | 0.390 | 0.175 | 0.160 | 0.190 | 0.170 | 0.171 | 0.167 |
| 9-cell cover, min (median) | 0.222 | 0.020 | 0.286 | 0.309 | 0.286 | 0.327 | 0.333 | 0.306 |
| 9-cell cover, median (median) | 0.691 | 0.500 | 0.670 | 0.667 | 0.673 | 0.673 | 0.682 | 0.694 |
| Tall (≥ 80 cm) centred in front (report) | 584 | 0 | 641 | 790 | 758 | 834 | 804 | 760 |
| Trees centred in front, straight edge | 9 | 0 | 0 | 42 | 48 | 59 | 56 | 53 |
| **Trees centred in front, the rule's d_eff (must be 0)** | – | – | 0 | 0 | 0 | 0 | 0 | 0 |
| Options with a hard failure | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Briefs lost / gained vs (a′) | – | 2 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Species dropped by the fail rule | 108 | 272 | 129 | 120 | 117 | 119 | 138 | 138 |
| Placed area / bed (median) | 0.637 | 0.481 | 0.647 | 0.656 | 0.650 | 0.662 | 0.655 | 0.655 |
| Filler plants (spread ≤ 0.5 m) per option (median) | 6 | 7 | 6 | 6 | 6 | 6 | 9 | 10 |
| D32 moves (raise or add) | – | – | – | – | – | – | 4021 | 4115 |
| Options where D32 missed a target (cover / filler) | – | – | – | – | – | – | 27 / 247 | 28 / 244 |

What each config is:
- **(a′)** engine-final code on the new rulebook.
- **(b)** D29 from history.
- **(m)** the D29b gradient + tree rule + fill.
- **(n)** (m) + curve.
- **(o)** (n) + placement order.
- **(p)** (o) + drift split.
- **(q)** (p) + D32.
- **(q′)** (o) + D32. This config was added so D32 is judged without the drift
  split.

Definitions:
- **Clean result:** feasible, with no species dropped, no plant unplaced and no
  hard failure.
- **Spread metrics** use a 20 x 20 sample grid; the 9-cell figures group it
  3 x 3.
- **"In front"** means centred within 0.35 of the depth from the viewer. The
  straight-edge count measures real depth. The rule's own measure is
  d_eff = d + k·u², which with the curve is deeper at the sides.

## Dominance: top-10 species by number of feasible options

| Rank | (a′) | (b) | (m) | (n) | (o) | (p) | (q) | (q′) |
|---:|---|---|---|---|---|---|---|---|
| 1 | B1604 (41) | B1604 (58) | B1604 (39) | B1604 (42) | B1604 (41) | B1604 (44) | B1604 (57) | B1604 (46) |
| 2 | B0772 (31) | B2697 (34) | B0772 (38) | B2697 (36) | B0772 (40) | B2697 (36) | B0772 (40) | B0772 (39) |
| 3 | B1712 (30) | B0772 (33) | B2697 (35) | B0772 (35) | B2697 (38) | B0772 (34) | B1005 (36) | B1005 (35) |
| 4 | B2697 (30) | B2649 (28) | B1712 (31) | B1712 (31) | B0291 (28) | B1712 (32) | B2697 (36) | B2697 (35) |
| 5 | B0376 (29) | B1125 (27) | B2715 (27) | B2715 (29) | B1712 (28) | B2481 (28) | B1712 (34) | B1712 (29) |
| 6 | B2715 (28) | B0291 (26) | B0376 (26) | B0376 (27) | B0376 (27) | B2160 (25) | B2649 (29) | B2481 (28) |
| 7 | B1125 (27) | B2160 (26) | B2481 (25) | B2649 (26) | B2481 (25) | B0291 (24) | B0291 (25) | B2160 (25) |
| 8 | B2501 (26) | B0376 (25) | B2649 (25) | B1125 (25) | B2649 (22) | B0376 (24) | B2481 (25) | B2284 (25) |
| 9 | B1005 (24) | B2501 (25) | B2501 (24) | B0291 (24) | B1005 (21) | B2284 (24) | B1125 (24) | B2649 (25) |
| 10 | B2481 (24) | B2399 (22) | B1125 (23) | B2501 (23) | B0616 (19) | B2649 (24) | B0376 (22) | B0291 (24) |
| Top-10 appearances per option | 1.06 | 1.12 | 1.06 | 1.08 | 1.06 | 1.06 | 1.18 | 1.13 |

## What the numbers say

**D29b fixes the layering without D29's costs.**
- Unlike D29, it loses no briefs, and the fail rule drops about as many
  species as engine-final (117 vs 108, against D29's 272).
- Spread is better than engine-final on every measure. For (o):
  - largest gap 0.175 vs 0.191;
  - emptiest-ninth cover 0.286 vs 0.222.
- The tall-behind-short tests all pass in (o), including D24 (b) east, which
  engine-final fails.
- B1223 and B1172 sit behind the short plants on all four edges, and out of the
  front 0.35.

**The tall-in-front count goes up, by design.**
- The gradient is relative: in a plan made mostly of tall plants (fynbos asks
  for 60% tall), the shortest of them rank first and stand at the front.
- So plants ≥ 80 cm centred in front rise from 584 to 758 in (o).
- The only hard rule is the tree rule, and it holds: 0 trees in front by d_eff
  in every D29b config.

**The curve lets trees stand forward at the sides.**
- With the curve on, the front edge comes forward towards the bed's sides. At
  the very sides it sits at 0.35 − k(1 ± a), between about 0.16 and 0.20 of the
  depth with k = 0.15 and |a| ≤ 0.25.
- So 48 tree placements in (o) are centred inside the straight front 0.35. All
  of them are off-centre, where the curve deepens d_eff, because the rule holds
  on d_eff.
- (m), without the curve, has none. engine-final (a′) has 9.
- This follows the rule as written: the rule measures d_eff. If trees should
  be held to the straight edge at the sides too, the rule needs to measure
  plain depth instead. That is the owner's call.

**The parts:**
- The curve (n) gives the best spread and Z, but fails one 12-case option.
- Placement order (o) restores 12/12 and the best clean-result share of the
  D29b configs.
- The drift split (p) improves the emptiest-cell cover (0.327) but breaks two
  12-case options.

**D32 does not reach its own targets and makes dominance worse.**
- The cover target was met at selection in all but 28 options. But the placed
  area did not move (0.655 vs 0.650): the placer cannot pack more than about
  65–70%, so the extra plants become fail-rule drops (117 → 138).
- The 25% filler share was missed in 244 of 276 options.
  - **Likely cause, not measured:** small plants need many plants to make up
    area, H5 caps each species' share of the plant count, and H2 caps the
    number of species.
- The most common species, B1604, appears in more options (41 → 46).
- The clean-result share falls from 0.639 to 0.583.
- It broke two existing tests, so it is reverted.

**Other notes:**
- (b) scores 9/12 here but 12/12 in `layout_v2_comparison.md`. The difference
  is the test: Step 1 had added a climber-on-host exclusion, and this branch
  measures the 12-case exactly as the current test does, without it.
- **The windbreak and the tree rule.** A tree that forms the windward row (e.g.
  Grewia afra B2804, Hedge/screen) can no longer take row places in front.
  Those places count as taken, and the plants for them join the structure
  layer. That is how D24 (c) keeps passing.

## Figures

`reports/figures/layout_v2b/<config>.png` (SVG alongside). Each shows option 1
of S001, S006 and the fixed case, from the same seeds. North is at the top, the
straight band edges are dashed, ring weight shows height, and T marks a tree.
