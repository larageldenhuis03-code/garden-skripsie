# layout-v2f: gap fill beside its own group (v7)

Rulebook **713f9bad5bec** (frozen), dataset **6c081d3d2f60**, same seeds.
The runs cover the 100 batch briefs plus the fixed case, every option.

Branch `layout-v2f` starts from `layout-v2e` (6dc4009). Only v7 was run new.
(o), D33, v4′ and v6 are the `layout-v2e` rows, copied unchanged: with the
new flag off, the code is the same. Raw rows and tables are in
`reports/layout_v2f/`.

## What changed (config only, `RELAX.cohesionFill`)

**v7 = v6 + a gap-fill plant must stand within 10 cm of a plant of its own
species.** To find such a spot, every point of the gap is tried, not only the
12 roomiest. This closes the limitation noted in the v6 report: an added
plant standing alone.

## Result: v7 adopted as the branch default

| Metric | (o) | (o)+D33 | v4′ | v6 | **v7** |
|---|---:|---:|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 94 | 94 | 94 | 94 |
| Median Z | 0.8990 | 0.8990 | 0.8990 | 0.8990 | 0.8990 |
| Cover (median) | 0.650 | 0.650 | 0.653 | 0.655 | 0.654 |
| **Largest gap (median)** | 0.175 | 0.158 | 0.145 | 0.142 | **0.142** |
| 95th-pct gap, cm (median) | 56.5 | 51.8 | 41.4 | 45.2 | 47.0 |
| 1 m-cell cover variance (median) | 0.0597 | 0.0534 | 0.0470 | 0.0491 | 0.0496 |
| Quadrant CV (median) | 0.190 | 0.185 | 0.176 | 0.175 | 0.176 |
| 9-cell cover, min (median) | 0.286 | 0.306 | 0.333 | 0.333 | 0.327 |
| **Grouped plants > 10 cm from any group-mate (median share)** | 0.132 | 0.176 | 0.267 | 0.167 | **0.114** |
| 12-case / D24 (b) east 1 | 12/12 / pass | 12/12 / pass | 12/12 / pass | 12/12 / pass | 12/12 / pass |
| Options with a hard failure | 0 | 0 | 0 | 0 | 0 |
| Plants outside the bed / removed | 0 / – | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Plants added (gap fill) | – | – | 242 in 167 options | 239 in 168 options | 204 in 168 options |

Z per option is identical to (o) in every config.

**What v7 does:**
- Drifts are the tightest of any config, tighter even than the plan as first
  placed.
- It keeps v6's largest gap.
- The cost is small: fewer plants are added (204 vs 239), and the
  95th-percentile gap is 2 cm larger, because a plant that has to join its
  group cannot always reach the middle of a gap.

All 137 unit tests pass with v7 as the default. The gap-fill test now also
checks that every added plant stands within 10 cm of its group.

## Figures

`reports/figures/layout_v2f/{v6,v7}_{S001,S006,FIX}.png`. In S006 the
added plants now extend the purple column and the small-tree group, instead
of standing alone.
