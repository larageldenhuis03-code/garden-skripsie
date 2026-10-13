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

## Final import, 13 October 2026 (owner decisions of 19:10 and 19:20)

The owner authorised one edit of each workbook (19:20). Backups:
`Algorithm_rulebook_backup_2026-10-13_1920.xlsx` (`313de68beada`) and
`Nursery_Sourcing_Search_Spec_backup_2026-10-13_1920.xlsx` (`854bbdb47117`).
The rulebook was edited in its XML (sheets 1_Parameters and Change_Log only;
the other 77 package parts byte-identical, all 23 comment/drawing parts kept,
0 formula-error cells, sheet names, headers and the 139 existing parameter IDs
unchanged). The sourcing workbook was replaced by the PROPOSED copy.

Imported: rulebook **`4722b1c43a87`**, dataset `6c081d3d2f60`, sourcing
workbook `81d75c295190` (snapshot 2026-10-13T17:34:43Z).

| check | value | |
|---|---|---|
| cover_min / cover_max, every style | 0.90 / 1.0, AGREED (D23 final) | ok |
| contact_bonus (row 139) | 0, AGREED (D26 adopted) | ok |
| sweep_weight (row 140, new) | 0.15, AGREED (D27) | ok |
| colour_unknown_score | 0.5 | ok |
| viewer_option_count / viewer_windbreak_edge | SUPERSEDED / SUPERSEDED | ok |
| P3, P16, C18, C32, D95 | option C wording (Change_Log 13 Oct) | ok |
| b_shade | absent | ok |
| lambda, goal weights, Stage 1 weights | 0.5; 0.2 x 5; 0.637 / 0.105 / 0.258 / 0.105 / 0.637 | unchanged |
| N_min, delta, depth_tol, alpha, iterations | 15, 0.15, 0.10, 0.95, 2000 | unchanged |
| H2 bands, H3 sizes, size_var_min | unchanged | unchanged |
| 3_PDF_Sources source ids | P01, P02, P03, P04 | ok |

Brief fingerprints after this import (engine still has contact 0.05 hard-coded
until Step 3.2): 07cd4b79d1fac576 / 766bb36011b209c6 - unchanged.
