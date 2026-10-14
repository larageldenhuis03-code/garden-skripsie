# layout-v2 - Step 0 checks

Branch `layout-v2` from tag `engine-final` (a294ed2). No engine code changed in this step.

**Rulebook frozen for all of layout-v2: `713f9bad5bec`** (Algorithm_rulebook.xlsx as
saved 2026-10-14 11:19:48; archive copy beside the repo:
`Algorithm_rulebook_713f9bad5bec_layout-v2.xlsx`). Dataset `6c081d3d2f60`.
Every later run uses the committed import (`RULEBOOK_PATH` guarded), so a later save
of the workbook cannot change these results.

| check | result |
|---|---|
| 2026-10-14 Change_Log fields | all present: D29/D30 rows 143-153 (band_edge_front_mid 0.35, band_edge_mid_back 0.65, h_front_max 60 cm, h_middle_min 30 cm, h_middle_max 120 cm, h_back_min 80 cm, h_grass_front_half_max 120 cm, band_curve_k 0.15, band_curve_asym_max 0.25, band_share_min 0.8, canopy_band_overlap_max 1), D31 rows 156-158, rules R2-R15 |
| contact_bonus | **0**, AGREED (owner final decision 14 Oct) |
| sweep_weight | 0, NOT ADOPTED (D27: W2p failed) |
| where engine-final reads sweep_weight | `app/lib/planning/stage4.ts`, `choose()`: `const sweep = RULES.stage4.sweepWeight` - it ran with **0.15** (rulebook 4722b1c43a87) |
| archived engine-final rulebook | the 4722b1c43a87 file itself was edited in place and later re-saved, so no copy of that file exists; its import is in tag `engine-final` (`app/data/engine_rules.generated.json`, version 4722b1c43a87). Config (a) uses that import, which reproduces the recorded results. |
| plant height units | `heightCm`, centimetres; 0 of 2843 missing; 717 imputed or estimated (heightSource) |
| habit / maintenance / specimen | habit: `form` and `plantType` 100% filled; maintenance: no field (`gardeningSkill` is skill, 71% filled; no maintenance entries in `specialFeatures`); specimen flag: none (`accent` is a display colour). Neither is used. |
| layering-check script | not found anywhere; skipped (owner, 14 Oct) - Step 3 tests and the Step 4 "tall centred in front" count replace it |
| Combo_Rules, Data Sources tabs | not read by the importer (it reads only 1_Parameters, 2_Style_Rules and 4_Stage1_Score); the rulebook hash changes because of them, as expected |
| L7 | specialist layer: carnivorous plants and orchids (20 species, 10-230 cm, median 60 cm), no depth target; in 4 of 270 option plans. Owner decision: assign by height under R3 like every layer; in overlap zones L7 -> middle |

Engine values that differ from the engine-final import: `stage4.sweepWeight` 0.15 -> 0,
plus status entries for the new parameters. The importer does not yet read the D29/D30
values; Steps 1-2 add them.

**Tests on the frozen rulebook, engine-final code:** 126 of 127 pass. The 12-case
layering test passes (D28 is still in the code). **D24 (b) fails**: windy 8 x 6 m
fynbos ramp bed, east view, option 1 - tall plants 5.33 m from the viewer against 5.35 m
for short ones. It passed in engine-final only because sweep packing (0.15) was on; it
is a consequence of the rulebook change, not of code, and is re-tested after D29.

Brief fingerprints: A `1a5c33adac243d2e`, B `4bda439a0fed9ec3`.
