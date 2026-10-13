# Final engine changes - Step 2 check

Baseline rulebook (imported): `098c8d085f61`.
Updated workbook (dry import only, NOT imported into the app): `6f37affddbc2`.
Dataset: `6c081d3d2f60`.

The workbook was imported into a scratch file and compared value by value
with the baseline import. 17 values differ.

## Checklist

| check | expected | workbook 6f37affddbc2 | |
|---|---|---|---|
| cover_min, cover_max back to the book values | fynbos 0.70/0.85, mediterranean 0.60/0.80, cottage 0.85/0.90, generic 0.75/0.85 | **0.90 / 1.0 for every style** | **FAIL** |
| contact-point bonus | 0 | **no such parameter anywhere in the workbook; no D26 entry in Change_Log** | **FAIL** |
| colour_unknown_score | 0.5 | 0.5 (1_Parameters row 81, ASSUMPTION) | ok |
| viewer_option_count | 2 | 2 (CHANGED) | ok |
| P3, P16, C18, C32 carry the revised D24 wording | yes | yes (Change_Log "D24 revised" rows) | ok |
| viewer_windbreak_edge | SUPERSEDED | SUPERSEDED 2026-10-12 (D24) | ok |
| b_shade | absent | absent | ok |

Unchanged from the baseline (no difference in the dry import): lambda 0.5;
goal weights 0.2 each; Stage 1 weights (style 0.637, colour 0.105, extras
0.258, saved 0.105, wind 0.637); N_min 15; delta 0.15; depth_tol 0.10;
alpha 0.95 (T0 is derived in code, not a rulebook value); H2 bands; H3
group sizes; size_var_min 3.

## Owner decision, 13 October 2026

**Keep cover_min 0.90 and cover_max 1.0 for every style** ("we are still
testing and trying to improve the spatial layout"). This overrides the
prompt's "D23 reverted" line; the workbook is imported as it stands.
Imported: rulebook `6f37affddbc2`. The one unit test that pinned a cover
value (cottage cover_min 0.85) now pins 0.90 and cover_max 1.0.

The contact bonus (D26) is still open: see below.

## Why this stopped first

1. **D23 is not reverted in the workbook.** Change_Log shows the D23 change
   (cover_min 0.95, cover_max 1.0) and the style rows now read 0.90 / 1.0;
   there is no revert entry. 5_Stage2_Constraints C5 (H1 in words) still
   reads "Planted area <= bed area (style limit removed, D23)".
2. **D26 is not in the workbook.** There is no contact-bonus parameter to
   read, so Step 3.2 ("make the engine read it from the rulebook") has no
   source.

The importer also does not yet read `colour_unknown_score` or
`viewer_option_count` as values (only their status); that is expected and
belongs to Steps 4 and 5.
