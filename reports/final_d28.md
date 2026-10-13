# D28: depth-band fallback for back-layer plants

Rulebook `4722b1c43a87` (cover 0.90 / 1.0, contact_bonus 0), dataset `6c081d3d2f60`.

**Rule.** A back-layer plant (L1) may sit anywhere from the front edge of its
own band to the back of the bed. If no spot there fits, it steps forward ONE
band - to the middle layer's band - and no further. With no valid spot in
either, the existing fail rule applies (shrink the group, then drop the
species). Climbers stay with their host; band-less layers (L2, L3, L7) are
untouched; no other rule changes.

**Why.** At contact_bonus 0 the 12-case layering test failed for east view,
option 2 (8 x 6 m fynbos, no wind): a big tree filled the back band, so a
2.5 m back-layer shrub fell to 1.25 m from the viewer, a 2 m scrambler grew
on it, and a band-less 1 m grass scattered near the front - mean depth of tall
plants 2.36 m against 2.64 m for short ones. With D28 the test passes,
unchanged, in all 12 cases.

**Time box (same 100 scenarios and seeds; `final_d28_off.csv` / `final_d28_on.csv`).**

| | without D28 | with D28 | limit |
|---|---|---|---|
| briefs whose option-1 feasibility changes | - | 1 of 100 | 20 |
| median change in a brief's option-1 Z | - | 0.0000 | 0.01 |
| median option-1 Z | 0.9243 | 0.9195 | - |
| option rows with a plan | 272 | 275 | - |
| hard violations | 0 | 0 | 0 |

Kept (path: option 3, the engine fix).

**Still open (reported, not changed).** The 6 x 2 m fynbos bed viewed from the
south: option 1 still reads "taller plants nearer where you stand"
(height-weighted depth share 0.41). The plant is not a climber this time but
B1223, a 2 m bi/annual/perennial: the rulebook puts bi/annuals in the seasonal
layer L5 by type, whose target is 0.35 of the depth, whatever the plant's
height. That is a layer-assignment rule, outside D28.
