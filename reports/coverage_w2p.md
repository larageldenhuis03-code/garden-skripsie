# Coverage test - V0 / W2p

**Measurement only. No engine change, no rulebook change, nothing deployed.**

Rulebook as imported: `098c8d085f61`. Dataset: `e5d14caf5ca0`. The workbook
on disk was never read or re-imported by this run.

| version | what it changes |
|---|---|
| **V0** | baseline, as imported |
| **W2p** | V0 settings (book cover values, no floor, contact bonus 0.05) + the W2 sweep packing, in-band contact weight 0.15 |

V1 and V2 are in-memory overrides applied around each run and undone
afterwards - the same technique the Chapter 5 sensitivity study uses.

Every figure is the median with the 10th-90th percentile in brackets,
over the plans that produced a layout. Percentiles are PERCENTILE.INC.

## All 100 scenarios

| measure | V0 | W2p |
|---|---|---|
| cover | 0.665 (0.506-0.777) | 0.679 (0.560-0.767) |
| real cover (1 - empty share) | 0.660 (0.507-0.762) | 0.671 (0.566-0.767) |
| empty-cell share | 0.340 (0.238-0.493) | 0.329 (0.233-0.434) |
| largest empty patch | 0.165 (0.079-0.360) | 0.165 (0.073-0.320) |
| square metres >= 50% planted | 0.775 (0.508-0.980) | 0.801 (0.595-1.000) |
| quadrant CV | 0.212 (0.088-0.425) | 0.169 (0.069-0.389) |
| species | 6.0 (3.0-12.0) | 6.0 (4.0-12.0) |
| plants | 20.0 (9.4-44.6) | 20.0 (10.0-43.7) |
| Z | 0.9196 (0.8389-0.9790) | 0.9300 (0.8325-0.9783) |
| A1 height balance | 0.929 (0.738-0.990) | 0.924 (0.713-0.990) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.914 (0.701-1.000) | 0.939 (0.732-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (11-70) | 29 (14-74) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 631 (499-1146) | 561 (455-912) |
| **feasible** | 95 / 100 | 94 / 100 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 32 / 95 | 34 / 94 |
| **flagged cover_short** | 0 / 95 | 0 / 94 |

## By style

### cottage

| measure | V0 | W2p |
|---|---|---|
| cover | 0.669 (0.559-0.757) | 0.692 (0.582-0.764) |
| real cover (1 - empty share) | 0.657 (0.558-0.742) | 0.690 (0.583-0.767) |
| empty-cell share | 0.343 (0.258-0.442) | 0.310 (0.233-0.417) |
| largest empty patch | 0.149 (0.067-0.350) | 0.133 (0.063-0.227) |
| square metres >= 50% planted | 0.722 (0.638-0.897) | 0.854 (0.622-1.000) |
| quadrant CV | 0.152 (0.075-0.366) | 0.137 (0.053-0.269) |
| species | 4.5 (3.0-10.8) | 5.0 (4.0-9.8) |
| plants | 18.0 (9.3-54.8) | 18.0 (10.6-41.4) |
| Z | 0.9084 (0.8503-0.9566) | 0.9174 (0.8293-0.9702) |
| A1 height balance | 0.867 (0.765-0.984) | 0.864 (0.767-0.967) |
| A2 colour | 1.000 (0.667-1.000) | 1.000 (0.692-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.922-1.000) |
| A4 ground cover | 0.787 (0.658-0.890) | 0.814 (0.685-0.899) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (8-66) | 29 (15-53) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 595 (500-925) | 563 (450-814) |
| **feasible** | 24 / 26 | 24 / 26 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 1 / 24 | 1 / 24 |
| **flagged cover_short** | 0 / 24 | 0 / 24 |

### fynbos

| measure | V0 | W2p |
|---|---|---|
| cover | 0.656 (0.557-0.749) | 0.694 (0.589-0.755) |
| real cover (1 - empty share) | 0.651 (0.558-0.752) | 0.682 (0.585-0.749) |
| empty-cell share | 0.349 (0.247-0.442) | 0.318 (0.251-0.415) |
| largest empty patch | 0.164 (0.086-0.265) | 0.115 (0.077-0.349) |
| square metres >= 50% planted | 0.854 (0.589-1.000) | 0.875 (0.667-1.000) |
| quadrant CV | 0.179 (0.089-0.349) | 0.145 (0.083-0.305) |
| species | 4.5 (3.0-7.7) | 5.0 (3.0-8.0) |
| plants | 15.5 (9.0-34.0) | 16.0 (9.0-30.0) |
| Z | 0.9250 (0.8438-0.9821) | 0.9342 (0.8383-0.9799) |
| A1 height balance | 0.879 (0.700-0.974) | 0.900 (0.700-0.961) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.937 (0.796-1.000) | 0.991 (0.842-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 24 (10-57) | 26 (8-54) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 621 (497-1036) | 535 (454-721) |
| **feasible** | 24 / 25 | 23 / 25 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 7 / 24 | 8 / 23 |
| **flagged cover_short** | 0 / 24 | 0 / 23 |

### mediterranean

| measure | V0 | W2p |
|---|---|---|
| cover | 0.634 (0.497-0.717) | 0.642 (0.523-0.700) |
| real cover (1 - empty share) | 0.628 (0.484-0.714) | 0.644 (0.527-0.691) |
| empty-cell share | 0.372 (0.286-0.516) | 0.356 (0.309-0.473) |
| largest empty patch | 0.251 (0.103-0.418) | 0.229 (0.114-0.354) |
| square metres >= 50% planted | 0.700 (0.501-0.874) | 0.682 (0.527-0.775) |
| quadrant CV | 0.258 (0.104-0.434) | 0.242 (0.128-0.499) |
| species | 6.5 (5.0-12.0) | 7.0 (5.0-12.0) |
| plants | 28.5 (14.2-41.6) | 27.0 (14.2-42.9) |
| Z | 0.9461 (0.8909-0.9866) | 0.9522 (0.8906-0.9899) |
| A1 height balance | 0.981 (0.901-0.990) | 0.984 (0.895-0.990) |
| A2 colour | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.829-1.000) | 1.000 (0.873-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 36 (16-59) | 41 (14-75) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 676 (529-1295) | 557 (450-1019) |
| **feasible** | 22 / 24 | 22 / 24 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 15 / 22 | 16 / 22 |
| **flagged cover_short** | 0 / 22 | 0 / 22 |

### undecided

| measure | V0 | W2p |
|---|---|---|
| cover | 0.733 (0.505-0.809) | 0.705 (0.550-0.809) |
| real cover (1 - empty share) | 0.715 (0.507-0.791) | 0.720 (0.540-0.800) |
| empty-cell share | 0.285 (0.208-0.492) | 0.280 (0.200-0.460) |
| largest empty patch | 0.140 (0.075-0.370) | 0.172 (0.047-0.292) |
| square metres >= 50% planted | 0.823 (0.502-0.866) | 0.800 (0.646-0.892) |
| quadrant CV | 0.213 (0.097-0.439) | 0.169 (0.092-0.356) |
| species | 7.0 (4.0-13.2) | 6.0 (4.0-13.6) |
| plants | 30.0 (10.0-45.2) | 24.0 (12.8-45.2) |
| Z | 0.9015 (0.7126-0.9651) | 0.8994 (0.7126-0.9593) |
| A1 height balance | 0.950 (0.800-0.995) | 0.932 (0.720-0.994) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.822-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.978 (0.673-1.000) | 0.940 (0.734-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (14-99) | 28 (19-88) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 660 (495-1303) | 583 (468-907) |
| **feasible** | 25 / 25 | 25 / 25 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 9 / 25 | 9 / 25 |
| **flagged cover_short** | 0 / 25 | 0 / 25 |

## By bed-size band

### small (<6 m2)

| measure | V0 | W2p |
|---|---|---|
| cover | 0.651 (0.560-0.684) | 0.644 (0.583-0.661) |
| real cover (1 - empty share) | 0.647 (0.561-0.683) | 0.635 (0.586-0.675) |
| empty-cell share | 0.352 (0.317-0.439) | 0.365 (0.325-0.414) |
| largest empty patch | 0.160 (0.105-0.233) | 0.254 (0.140-0.340) |
| square metres >= 50% planted | 1.000 (0.800-1.000) | 1.000 (0.883-1.000) |
| quadrant CV | 0.124 (0.060-0.260) | 0.212 (0.143-0.302) |
| species | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) |
| plants | 9.0 (7.8-11.4) | 9.0 (7.6-9.0) |
| Z | 0.8756 (0.5604-0.8994) | 0.8212 (0.5499-0.8945) |
| A1 height balance | 0.700 (0.520-0.793) | 0.767 (0.700-0.880) |
| A2 colour | 1.000 (0.700-1.000) | 1.000 (0.825-1.000) |
| A3 variety | 0.778 (0.578-0.889) | 0.778 (0.700-0.856) |
| A4 ground cover | 0.887 (0.800-0.969) | 0.898 (0.826-0.924) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 25 (15-38) | 24 (12-27) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 608 (546-830) | 517 (498-641) |
| **feasible** | 5 / 5 | 4 / 5 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 0 / 5 | 0 / 4 |
| **flagged cover_short** | 0 / 5 | 0 / 4 |

### medium (6-30 m2)

| measure | V0 | W2p |
|---|---|---|
| cover | 0.660 (0.500-0.753) | 0.686 (0.552-0.757) |
| real cover (1 - empty share) | 0.657 (0.495-0.749) | 0.675 (0.546-0.755) |
| empty-cell share | 0.343 (0.251-0.505) | 0.325 (0.245-0.454) |
| largest empty patch | 0.165 (0.080-0.341) | 0.135 (0.073-0.304) |
| square metres >= 50% planted | 0.750 (0.500-0.967) | 0.833 (0.610-1.000) |
| quadrant CV | 0.183 (0.085-0.408) | 0.159 (0.061-0.357) |
| species | 5.0 (3.0-7.0) | 5.0 (4.0-7.0) |
| plants | 16.0 (9.4-34.0) | 16.0 (10.0-28.6) |
| Z | 0.9105 (0.8389-0.9784) | 0.9133 (0.8328-0.9757) |
| A1 height balance | 0.900 (0.752-0.963) | 0.883 (0.670-0.969) |
| A2 colour | 1.000 (0.700-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.864 (0.666-1.000) | 0.889 (0.729-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 23 (8-58) | 27 (12-61) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 620 (491-1033) | 555 (441-730) |
| **feasible** | 55 / 60 | 55 / 60 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 11 / 55 | 13 / 55 |
| **flagged cover_short** | 0 / 55 | 0 / 55 |

### large (>=30 m2)

| measure | V0 | W2p |
|---|---|---|
| cover | 0.696 (0.513-0.809) | 0.668 (0.574-0.796) |
| real cover (1 - empty share) | 0.672 (0.517-0.791) | 0.662 (0.568-0.789) |
| empty-cell share | 0.328 (0.208-0.483) | 0.338 (0.211-0.432) |
| largest empty patch | 0.168 (0.075-0.429) | 0.193 (0.061-0.321) |
| square metres >= 50% planted | 0.771 (0.525-0.865) | 0.725 (0.573-0.848) |
| quadrant CV | 0.218 (0.104-0.431) | 0.169 (0.092-0.433) |
| species | 10.0 (6.0-14.0) | 10.0 (6.0-14.0) |
| plants | 35.0 (16.0-49.2) | 33.0 (16.0-47.2) |
| Z | 0.9426 (0.8629-0.9790) | 0.9445 (0.8629-0.9860) |
| A1 height balance | 0.984 (0.879-0.998) | 0.982 (0.926-0.998) |
| A2 colour | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.781-1.000) | 1.000 (0.757-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 46 (19-90) | 49 (20-79) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 666 (516-1626) | 579 (471-1031) |
| **feasible** | 35 / 35 | 35 / 35 |
| **hard violations** | 0 | 0 |
| **reached its target cover** | 21 / 35 | 21 / 35 |
| **flagged cover_short** | 0 / 35 | 0 / 35 |

## What stopped a plan reaching its target cover

`count` - even at the largest group size H3 allows for each species it
chose, the canopy could not add up to the target.

`placement` - it selected enough canopy, but Stage 4 could not fit it in.

`pool` - it used fewer species than H2 would have allowed.

Tested in that order, first match wins. The per-plan flags are in
`reports/coverage_test.csv` so overlaps stay visible.

| group | version | short of target | count | placement | pool | pool: exhausted | pool: stopped early |
|---|---|---|---|---|---|---|---|
| all | V0 | 63 | 5 | 0 | 50 | 0 | 50 |
| all | W2p | 60 | 5 | 0 | 51 | 0 | 51 |
| small (<6 m2) | V0 | 5 | 0 | 0 | 5 | 0 | 5 |
| small (<6 m2) | W2p | 4 | 0 | 0 | 4 | 0 | 4 |
| medium (6-30 m2) | V0 | 44 | 3 | 0 | 33 | 0 | 33 |
| medium (6-30 m2) | W2p | 42 | 2 | 0 | 36 | 0 | 36 |
| large (>=30 m2) | V0 | 14 | 2 | 0 | 12 | 0 | 12 |
| large (>=30 m2) | W2p | 14 | 3 | 0 | 11 | 0 | 11 |

## Figures

`reports/figures/coverage_w2p/` - one small, one medium and one large
bed, plus a Mediterranean and a Cottage example, each in V0, W2p
on the same seed.

## Decision table

Medians over plans that produced a layout. The best on each measure is
named under the table, with ties shown. Lower is better for empty share,
largest patch and quadrant CV; higher
is better for cover, square metres at least half planted, Z, A1 and A4.

| | cover | empty | largest patch | m2 >=50% | quadrant CV | Z | A1 | A4 | feasible | reached target | plants | ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **V0** | 0.665 | 0.340 | 0.165 | 0.775 | 0.212 | 0.9196 | 0.929 | 0.914 | 95 | 32 | 20 | 631 |
| **W2p** | 0.679 | 0.329 | 0.165 | 0.801 | 0.169 | 0.9300 | 0.924 | 0.939 | 94 | 34 | 20 | 561 |

Best on each spatial measure: quadrant CV **W2p**, largest empty
patch **V0 and W2p, tied at 0.165**, empty-cell share **W2p**, square
metres at least half planted **W2p**. Highest Z: **W2p**.

Note that "reached target" is not comparable across every column: V1
asks for 0.95 cover where the others ask for the style's cover_min.

## What each version does, and what it costs

**V2 - contact bonus 0 (D26).** The simplest change, and the base for V3
and the ground-cover mat study. Against V0 it moves quadrant CV
0.212 to - (NaN%) and the largest
empty patch 0.165 to - (NaN%),
with Z 0.9196 to - and no loss of feasibility. The
contact bonus was packing plants against the bed edge and each other,
which is what reads as a clump.

**V1 - cover_max 1.0, cover_min 0.95.** Does not work. Median cover
0.665 to -, and
0 plans of 0 reach 0.95.
H1 was never the limit. It costs A4, because A4 is measured against
cover_min and the target moved (0.914 to
-), and 95
feasible scenario(s).

**V3 - V2 plus the emptiest-block preference.** No better than V2 on the
largest empty patch (- to -). Pushing
each group's anchor into an empty block scatters the anchors, and the
drift rule then drags each group after its anchor. The weight sweep
(scripts/block-weight-sweep.ts) found no weight that beats V2.

## What stops a bed reaching its target cover

**Corrected 13 October.** This section used to say Stage 4 fits what
it is given. That was wrong: the `placement` check looked only at each
plan's final mix, which the fail rule had already cut down, so it hid
every failed attempt. Measured directly (scripts/coverage-wall.ts, commit 2b784e7), the
packer cannot fit the first mix the search picks in 57 of 95 plans
under today's rules, and in 71 of 93 with every style forced to an 80%
floor. Each time, the fail rule lowers the cover ceiling and searches
again, so the plan comes out sparser than the search intended. Turning
off H5 or doubling H2 does not help. The limit on cover is the packer
and the fail rule's response to it - which is why V1, which only raises
the target, changes nothing. The candidate pool never runs out.

## V4 was not run

The combination rules exist - 14 combos in 8_Species_Reference rows
5-18, the Stage 4 rule at row 23 - and 55 of their 56 species are in the
catalogue. But Stage 2 selects same-combo species together in only 2
plans of 95, so a Stage 4 neighbour bonus has almost nothing to act on
and could not be measured against the 2-point guard. The Stage 2 half
(row 22) is also NOT IMPLEMENTED; it has to come first.

## Step 4b decision: W2p (D27) is not adopted

Rulebook `098c8d085f61` (book cover values), dataset `6c081d3d2f60`, the same
100 scenarios and seeds. W2 is the W study's W2 (`reports/coverage_w.md`:
largest patch 0.142, quadrant CV 0.148).

| criterion | needed | W2p | |
|---|---|---|---|
| largest empty patch | <= W2 + 0.01 = 0.152 | 0.165 | fails |
| quadrant CV | <= W2 + 0.01 = 0.158 | 0.169 | fails |
| Z drop vs V0 (0.9196) | <= 0.02 | +0.010 (0.9300) | passes |
| A1 | >= 0.90 | 0.924 | passes |
| feasible, violations | no worse than V0 (95, 0) | 94, 0 | fails |

The plan W2p loses is S073, the 0.5 x 0.5 m fynbos bed. Against V0, W2p
lowers quadrant CV from 0.212 to 0.169 and leaves the largest empty patch at
0.165; plants to buy are unchanged (median 20, 90th percentile 44.6 -> 43.7).
D27 (sweep packing) goes to Future Work.
