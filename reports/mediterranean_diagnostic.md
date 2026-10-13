# Mediterranean diagnostic

**Measurement only. No engine change.** The 100 coverage-test scenarios on
the engine as imported (V0, rulebook `098c8d085f61`), Mediterranean plans
against every other style. Medians over plans that produced a layout.

## Side by side

| | cover | its cover_min | cover / cover_min | canopy diameter | species of H2 max | at the H2 ceiling | with a feature plant | largest empty patch |
|---|---|---|---|---|---|---|---|---|
| Mediterranean (22) | 0.634 | 0.60 | 1.06 | 0.63 m | 6.5 of 12 | 2 | 0 | 0.251 |
| Other styles (73) | 0.681 | 0.75 | 0.89 | 0.63 m | 6.0 of 6 | 8 | 0 | 0.158 |
| Fynbos (24) | 0.656 | 0.70 | 0.94 | 0.57 m | 4.5 of 6 | 3 | 0 | 0.164 |
| Cottage (24) | 0.669 | 0.85 | 0.79 | 0.60 m | 4.5 of 6 | 2 | 0 | 0.149 |
| Undecided (25) | 0.733 | 0.75 | 0.98 | 0.65 m | 7.0 of 12 | 3 | 0 | 0.140 |

## Plant types chosen (share of placed plants)

| type | Mediterranean | other styles |
|---|---|---|
| shrub | 42% | 40% |
| ground cover | 19% | 14% |
| tree | 15% | 13% |
| climber | 6% | 3% |
| scrambler | 5% | 5% |
| succulent | 5% | 10% |
| bi/annual | 4% | 3% |
| perennial | 3% | 6% |
| bulb | 1% | 0% |
| graminoid | 0% | 1% |
| grass | 0% | 5% |
| epiphyte | 0% | 0% |
| orchid | 0% | 0% |

## Where the largest empty patch sits

Thirds of the bed from the north edge, which this branch treats as the front.

- **Mediterranean:** 7 front (32%), 6 middle (27%), 9 back (41%); next to a feature plant in 0 (0%).
- **Other styles:** 33 front (45%), 19 middle (26%), 21 back (29%); next to a feature plant in 0 (0%).

## Most likely cause

Mediterranean has the lowest cover_min of any style (0.60), and its plans stop
close to it: median cover 0.634, 1.06x its cover_min, against 0.681
(0.89x) for the other styles. Goal A4 is min(1, planted / (cover_min x bed)), so
once a Mediterranean bed reaches 60% cover A4 is already at 1 and the search has
no reason to plant more. What is left bare collects into one large patch.

This agrees with the coverage test: V1, which raised every style's target to
0.95, was the best version for Mediterranean beds on the largest patch (0.180
against 0.251 for V0) while making most other styles worse. Raising the target
helps exactly the style whose target is lowest.

Plant size is not a factor: the median canopy is 0.63 m against 0.63 m for the other styles.

If the hole is a problem rather than the style's intended openness, the targeted
change is Mediterranean's cover_min, not a placement rule. That is a rulebook
value and is left for the owner to decide.
