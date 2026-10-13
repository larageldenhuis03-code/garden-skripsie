# Final engine comparison - before and after

**Before:** branch `engine-final` at Step 1 (`35b1902`), rulebook `098c8d085f61`.
**After:** branch `engine-final` after Steps 2-5 and D26-D28, rulebook `4722b1c43a87`.
Dataset `6c081d3d2f60` in both. Sourcing settings `81d75c295190` (does not affect plans).

What changed between the two:

| decision | what it does |
|---|---|
| D23 | cover_min 0.90 / cover_max 1.0 for every style (was the book ranges, e.g. fynbos 0.70 / 0.85) |
| D24 option C | every option measures depth from the viewing edge, the wind ramp included; no windbreak on the viewing edge |
| D25 | an unrecorded flower colour scores 0.5 in Stage 1 (was 0) |
| D26 | contact_bonus 0 (was +0.05, hard-coded) |
| D27 | sweep packing, sweep_weight 0.15; while it is on it replaces contact_bonus on contact spots |
| D28 | a back-layer plant never lands in front: its band to the back of the bed, else one band forward, else the fail rule |
| clean-up | the shade bonus removed completely (it was never active) |

## Before / after

**before (baseline):** rulebook `098c8d085f61`, dataset `6c081d3d2f60`. **after (final):** rulebook `4722b1c43a87`, dataset `6c081d3d2f60`.
Same 100 scenarios and seeds; one row per scenario and option. Medians with the 10th-90th percentile, over option rows with a plan.

### All scenarios

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.663 (0.522-0.780) | 0.657 (0.498-0.774) |
| empty-cell share | 0.343 (0.231-0.479) | 0.355 (0.238-0.515) |
| largest empty patch | 0.170 (0.077-0.361) | 0.199 (0.072-0.420) |
| quadrant CV | 0.195 (0.072-0.390) | 0.222 (0.081-0.556) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.000) |
| species | 6.0 (3.0-12.0) | 6.0 (3.0-12.0) |
| plants | 20.0 (10.0-44.0) | 21.0 (10.0-43.0) |
| Z | 0.9307 (0.8169-0.9780) | 0.9052 (0.8104-0.9567) |
| A1 height balance | 0.931 (0.700-0.990) | 0.906 (0.676-0.984) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.913 (0.723-1.000) | 0.730 (0.553-0.860) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 612 (462-1276) | 615 (468-1510) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 95 / 100 | 93 / 100 |
| **option rows with a plan** | 276 | 272 |
| **rows (colours chosen) with an unknown-colour plant** | 9 / 220 (mean share 0.005) | 18 / 221 (mean share 0.010) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### cottage

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.692 (0.576-0.799) | 0.701 (0.535-0.790) |
| empty-cell share | 0.323 (0.216-0.425) | 0.310 (0.225-0.490) |
| largest empty patch | 0.133 (0.047-0.274) | 0.142 (0.065-0.352) |
| quadrant CV | 0.154 (0.060-0.270) | 0.168 (0.077-0.315) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.000) |
| species | 5.0 (3.8-11.2) | 5.0 (3.0-10.0) |
| plants | 19.0 (10.0-57.4) | 19.0 (10.0-43.0) |
| Z | 0.9179 (0.8132-0.9646) | 0.9056 (0.8375-0.9474) |
| A1 height balance | 0.862 (0.725-0.972) | 0.867 (0.676-0.967) |
| A2 colour | 1.000 (0.633-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 0.814 (0.677-0.940) | 0.778 (0.594-0.877) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 572 (462-1276) | 576 (432-794) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 24 / 26 | 22 / 26 |
| **option rows with a plan** | 69 | 61 |
| **rows (colours chosen) with an unknown-colour plant** | 1 / 53 (mean share 0.004) | 4 / 50 (mean share 0.013) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### fynbos

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.636 (0.538-0.749) | 0.635 (0.512-0.756) |
| empty-cell share | 0.362 (0.258-0.457) | 0.383 (0.247-0.488) |
| largest empty patch | 0.185 (0.086-0.351) | 0.215 (0.097-0.404) |
| quadrant CV | 0.183 (0.091-0.385) | 0.243 (0.104-0.598) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.000) |
| species | 5.0 (3.0-8.0) | 5.0 (3.0-8.0) |
| plants | 15.0 (8.2-34.0) | 17.5 (9.0-30.0) |
| Z | 0.9306 (0.8285-0.9814) | 0.9036 (0.8200-0.9570) |
| A1 height balance | 0.887 (0.675-0.980) | 0.900 (0.650-0.975) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.909 (0.768-1.000) | 0.706 (0.569-0.840) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 610 (487-1005) | 593 (497-1197) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 24 / 25 | 24 / 25 |
| **option rows with a plan** | 67 | 70 |
| **rows (colours chosen) with an unknown-colour plant** | 1 / 54 (mean share 0.003) | 4 / 57 (mean share 0.008) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### mediterranean

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.628 (0.484-0.730) | 0.641 (0.501-0.792) |
| empty-cell share | 0.379 (0.284-0.510) | 0.364 (0.226-0.514) |
| largest empty patch | 0.270 (0.128-0.409) | 0.199 (0.064-0.402) |
| quadrant CV | 0.290 (0.136-0.455) | 0.190 (0.076-0.515) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.000) |
| species | 7.0 (4.5-12.0) | 7.0 (5.0-13.0) |
| plants | 26.0 (13.5-45.5) | 25.0 (13.5-44.5) |
| Z | 0.9487 (0.8925-0.9892) | 0.9283 (0.8706-0.9642) |
| A1 height balance | 0.976 (0.850-0.993) | 0.962 (0.800-0.992) |
| A2 colour | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.807-1.000) | 0.713 (0.556-0.880) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 582 (473-1293) | 753 (559-1766) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 22 / 24 | 22 / 24 |
| **option rows with a plan** | 66 | 66 |
| **rows (colours chosen) with an unknown-colour plant** | 1 / 51 (mean share 0.002) | 4 / 51 (mean share 0.013) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### undecided

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.704 (0.511-0.799) | 0.644 (0.435-0.744) |
| empty-cell share | 0.314 (0.218-0.487) | 0.370 (0.261-0.563) |
| largest empty patch | 0.143 (0.076-0.347) | 0.230 (0.103-0.486) |
| quadrant CV | 0.189 (0.077-0.371) | 0.276 (0.105-0.564) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.000) |
| species | 7.0 (3.3-12.0) | 7.0 (4.0-13.0) |
| plants | 25.0 (10.6-43.1) | 23.0 (10.0-43.0) |
| Z | 0.9001 (0.6966-0.9605) | 0.8830 (0.6687-0.9538) |
| A1 height balance | 0.950 (0.700-0.991) | 0.931 (0.663-0.985) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.939 (0.682-1.000) | 0.715 (0.483-0.827) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 640 (445-1301) | 717 (466-1510) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 25 / 25 | 25 / 25 |
| **option rows with a plan** | 74 | 75 |
| **rows (colours chosen) with an unknown-colour plant** | 6 / 62 (mean share 0.009) | 6 / 63 (mean share 0.006) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### small beds (H2 band)

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.643 (0.531-0.748) | 0.651 (0.493-0.759) |
| empty-cell share | 0.357 (0.265-0.471) | 0.359 (0.246-0.517) |
| largest empty patch | 0.171 (0.087-0.343) | 0.189 (0.076-0.428) |
| quadrant CV | 0.196 (0.086-0.380) | 0.198 (0.080-0.508) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.000) |
| species | 4.0 (3.0-6.0) | 4.0 (3.0-6.0) |
| plants | 14.5 (9.0-26.6) | 15.0 (9.0-24.0) |
| Z | 0.8937 (0.7794-0.9656) | 0.8821 (0.7662-0.9534) |
| A1 height balance | 0.837 (0.635-0.953) | 0.842 (0.600-0.933) |
| A2 colour | 1.000 (0.617-1.000) | 1.000 (0.667-1.000) |
| A3 variety | 1.000 (0.856-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.866 (0.712-1.000) | 0.723 (0.548-0.844) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 600 (470-831) | 576 (454-923) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 44 / 47 | 43 / 47 |
| **option rows with a plan** | 128 | 124 |
| **rows (colours chosen) with an unknown-colour plant** | 1 / 100 (mean share 0.002) | 4 / 101 (mean share 0.008) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### medium beds (H2 band)

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.678 (0.498-0.787) | 0.644 (0.500-0.774) |
| empty-cell share | 0.335 (0.217-0.507) | 0.367 (0.242-0.507) |
| largest empty patch | 0.165 (0.048-0.352) | 0.220 (0.065-0.420) |
| quadrant CV | 0.194 (0.061-0.373) | 0.230 (0.077-0.503) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.032) |
| species | 7.0 (5.0-9.0) | 7.0 (5.0-9.0) |
| plants | 22.0 (14.0-39.0) | 22.0 (13.0-36.0) |
| Z | 0.9340 (0.8560-0.9771) | 0.9094 (0.8226-0.9568) |
| A1 height balance | 0.960 (0.800-0.988) | 0.953 (0.800-0.982) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 0.962 (0.717-1.000) | 0.715 (0.555-0.860) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 579 (460-1276) | 644 (466-1197) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 32 / 34 | 31 / 34 |
| **option rows with a plan** | 91 | 91 |
| **rows (colours chosen) with an unknown-colour plant** | 4 / 75 (mean share 0.008) | 8 / 75 (mean share 0.014) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### large beds (H2 band)

| measure | before (baseline) | after (final) |
|---|---|---|
| cover | 0.673 (0.543-0.807) | 0.692 (0.508-0.810) |
| empty-cell share | 0.333 (0.208-0.455) | 0.323 (0.203-0.491) |
| largest empty patch | 0.200 (0.074-0.374) | 0.200 (0.090-0.411) |
| quadrant CV | 0.193 (0.098-0.469) | 0.268 (0.106-0.569) |
| unknown-colour share (plants, colours chosen) | 0.000 (0.000-0.000) | 0.000 (0.000-0.020) |
| species | 12.0 (10.0-15.4) | 12.0 (10.0-15.4) |
| plants | 38.0 (28.2-53.0) | 38.0 (28.6-52.4) |
| Z | 0.9483 (0.8996-0.9908) | 0.9258 (0.8845-0.9648) |
| A1 height balance | 0.988 (0.887-1.000) | 0.974 (0.859-0.997) |
| A2 colour | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.772-1.000) | 0.769 (0.565-0.900) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| run time per brief, ms (all options) | 739 (481-2404) | 828 (558-3016) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| **scenarios with a plan** | 19 / 19 | 19 / 19 |
| **option rows with a plan** | 57 | 57 |
| **rows (colours chosen) with an unknown-colour plant** | 4 / 45 (mean share 0.004) | 6 / 45 (mean share 0.006) |
| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | 0 | 0 |

### One decision at a time

Each row is the final engine with one decision undone, in memory, on the same seeds.

| run | scenarios with a plan | option rows | violations | cover | largest patch | quadrant CV | Z | A1 | plants |
|---|---|---|---|---|---|---|---|---|---|
| after (final) | 93 | 272 | 0 | 0.657 | 0.199 | 0.222 | 0.9052 | 0.906 | 21 |
| final, D27 undone (sweep_weight 0) | 93 | 271 | 0 | 0.637 | 0.190 | 0.197 | 0.8999 | 0.925 | 21 |
| final, D26 undone (contact_bonus 0.05) | 93 | 272 | 0 | 0.657 | 0.199 | 0.222 | 0.9052 | 0.906 | 21 |
| final, D28 undone (no band fallback) | 92 | 270 | 0 | 0.688 | 0.150 | 0.178 | 0.9045 | 0.921 | 21 |

Scenarios that lost their plan: S075 (30x0.5), S096 (6x1). Gained one: none.
D28 band fallbacks in the final run: 336 species-placements in 161 option rows.

## D26-D28, one at a time

From the table above ("one decision at a time"), against the final run:

- **D26 (contact_bonus 0)** has no effect in the final engine: undoing it gives
  an identical run, because D27's sweep weight replaces contact_bonus on every
  contact spot while it is on.
- **D27 (sweep packing)** raises cover (0.637 -> 0.657) and Z (0.8999 ->
  0.9052) but makes the spread worse here: largest patch 0.190 -> 0.199, quadrant
  CV 0.197 -> 0.222, A1 0.925 -> 0.906. This is the opposite of the W2p study,
  which was measured at book cover values with contact_bonus 0.05.
- **D28 (band fallback)** is the largest single effect on spread: undoing it
  gives cover 0.688, largest patch 0.150, quadrant CV 0.178 - all better than
  the baseline - at one fewer feasible scenario (92). D28 holds back-layer
  plants between 0.7 of the depth and the back edge; it moved a plant forward
  one band 336 times in 161 option rows, so canopy gathers at the back and the
  front gaps grow. Its time box (feasibility and Z) was met; spread was not
  part of it.

## Tests: windbreak and layering

All 127 unit tests pass (typecheck and lint clean). The ones for this step:

| test | result |
|---|---|
| every option is laid out from the viewing edge (12 cases: 4 edges x 3 options, no wind), unchanged | pass at contact 0, east view option 2 included (fixed by D28) |
| D24: every profile, the ramp included, measures depth from the viewer | pass |
| D24 (a): no windbreak plant stands on the viewing edge, in any option | pass |
| D24 (b): layering from the viewing edge holds in every option of a windy ramp bed | pass |
| D24 (c): at exposed sites P3 holds and every windbreak plant is on a windward edge other than the viewing edge | pass |
| D25: known match > unknown (0.5) > known mismatch, from the rulebook | pass |

61 of the 100 briefs change layout under D24, all of them windy (33 ramp beds,
28 windbreak beds); 25 briefs view the bed from the south (17 of them windy).

**Not fixed, reported:** two plants still stand tall near the viewer because
the rulebook assigns their layer by type, not height - B1223 (a 2 m
bi/annual/perennial, seasonal layer L5, target 0.35 of the depth; the 6 x 2 m
bed viewed from the south) and B1172 (a 1 m "ground cover/shrub" with a 4 m
spread, ground-cover layer L6; S006). Outside D28, which is a back-layer rule.

## Fingerprints (`scripts/brief-fingerprint.ts`)

| state | A (Stellenbosch fynbos 6 x 4) | B (Cottage 10 x 6 clay) |
|---|---|---|
| main (pre-engine-final) | 149d3d6d6c0ab957 | 35c8ce503dd257d4 |
| before: Step 1 baseline (viewing-edge merged) | 149d3d6d6c0ab957 | fe77335df1c88533 |
| Step 2 import (cover 0.90 / 1.0), Steps 3.1 | 07cd4b79d1fac576 | 766bb36011b209c6 |
| Step 3.2 (D26, contact 0) | fdd10fb5d002e23f | 9c48bb787449ec8e |
| Step 3b (D28) | fdd10fb5d002e23f | 4bda439a0fed9ec3 |
| D27 (sweep packing) | 314d1d5494f67bdb | dbc9776e1d66842d |
| Step 4 (D24) | 1399c73dacbc2efc | dbc9776e1d66842d |
| **after: Step 5 (D25), final** | **5b9f1c2e6e7ee0fa** | **dbc9776e1d66842d** |

## Figures

`reports/figures/final/` - option 1, same seed, before beside after, north at
the top, ring weight = height, dashed ring = windbreak plant:

- `S001.png` - small bed (2 x 3 m fynbos, no wind, viewed from the north);
- `S003.png` - medium bed (6 x 4 m cottage, wind affected, viewed from the south);
- `S006.png` - large bed (12 x 8 m Mediterranean, wind affected, viewed from the east).

## Summary

The final engine produces a plan for 93 of the 100 test briefs (95 before),
with no hard-rule violation in any option. The two briefs that lost their plan
are the narrowest beds in the set: 30 x 0.5 m and 6 x 1 m.

Planted cover is essentially unchanged (median 0.657 against 0.663). Raising
cover_min to 0.90 for every style did not raise cover - the placement geometry
at mature spacing is the limit, as the coverage study found - but it does
lower goal A4 (0.913 -> 0.730), because A4 measures cover against cover_min.
That is most of the fall in Z (0.9307 -> 0.9052).

The layout now always faces the gardener: tall plants stand at the back in
every option, including windy beds, and no windbreak row stands in front of
the viewer. Where the wind may matter, the plan says so.

Unknown flower colours are no longer treated as a mismatch: plants with no
recorded colour now appear in 18 of 221 colour-choosing plans (9 before).

The spread of planting across the bed is worse than before (largest empty
patch 0.170 -> 0.199, quadrant CV 0.195 -> 0.222). The one-at-a-time runs show
why: D28 keeps back-layer plants at the back, and D27's sweep packing packs
them tighter, so the front of the bed opens up. D26 has no effect while D27 is
on. These are the owner's final decisions and are reported here as measured.
