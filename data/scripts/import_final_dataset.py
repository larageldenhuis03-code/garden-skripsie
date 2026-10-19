"""Import the finalised, hand-checked species workbook into the processed
catalogue the app builds from.

FINAL.DATASET.FINAL.xlsx is the authoritative species dataset: the same
2,843 Western Cape species as the earlier R/Python pipeline output, but with
the sparse measurement fields completed and every filled value carrying its
own provenance column (`spread_source`, `height_source`, `sun_source`,
`water_source`, `soil_type_source`, `flower_months_source`) plus confidence
labels and outlier flags. That provenance is the point: most spread and many
height values are imputed rather than measured, and the app has to be able
to say which is which.

This replaces the `combine_plant_database.R` output as the source of
`data/processed/plant_database_western_cape.csv`. Re-running the R pipeline
would overwrite it - treat the workbook as the upstream source now.

Run with the working directory at the repo root:
    python data/scripts/import_final_dataset.py [path/to/FINAL.DATASET.FINAL.xlsx]
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_processed_data import xlsx_first_sheet_rows  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
# Owner, 19 Oct 2026: this is the only dataset workbook to use.
DEFAULT_WORKBOOK = REPO_ROOT.parent / "FINAL.DATASET.FINAL.the correctone.xlsx"
OUTPUT_CSV = REPO_ROOT / "data" / "processed" / "plant_database_western_cape.csv"

EXPECTED_SPECIES = 2843

# Markers of text that was UTF-8 encoded and then read back as Latin-1,
# so a curly apostrophe arrives as "aEURtm". 45 rows of the workbook came
# in this way - "tailor's patches" rendered as "tailorâ€™s patches" - and
# it is visible to the user in plant names, so it is repaired here at the
# import boundary rather than papered over downstream.
MOJIBAKE_MARKERS = ("â€", "Ã", "Â")


def repair_mojibake(value: str) -> str:
    if not value or not any(marker in value for marker in MOJIBAKE_MARKERS):
        return value
    # cp1252 first: the curly quote's UTF-8 bytes come back as "a EUR tm",
    # and EUR/tm exist only in cp1252, not latin-1.
    for codec in ("cp1252", "latin-1"):
        try:
            repaired = value.encode(codec).decode("utf-8")
            break
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    else:
        return value
    # Only accept a repair that removed the markers rather than shuffling
    # them, so a genuinely accented name is never mangled.
    return repaired if not any(m in repaired for m in MOJIBAKE_MARKERS) else value


def main() -> None:
    workbook = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WORKBOOK
    if not workbook.exists():
        raise SystemExit(f"Workbook not found: {workbook}")

    # Only this sheet is read; the workbook also carries DQ, audit and
    # report tabs that are not part of the catalogue.
    rows_iter = xlsx_first_sheet_rows(workbook, "FINAL_DATASET")
    header_cells = next(rows_iter)
    columns = [header_cells[index].strip() for index in sorted(header_cells)]

    rows = []
    repaired_rows = 0
    for cells in rows_iter:
        row = {
            column: repair_mojibake((cells.get(index, "") or "").strip())
            for index, column in enumerate(columns)
        }
        repaired_rows += sum(
            1
            for index, column in enumerate(columns)
            if (cells.get(index, "") or "").strip() != row[column]
        )
        if not row.get("scientific_name"):
            continue
        rows.append(row)

    names = {row["scientific_name"] for row in rows}
    if len(names) != len(rows):
        raise SystemExit(
            f"Workbook has duplicate scientific names ({len(rows)} rows, {len(names)} unique)."
        )
    if len(rows) != EXPECTED_SPECIES:
        print(
            f"WARNING: expected {EXPECTED_SPECIES} species, found {len(rows)}. "
            "Update EXPECTED_SPECIES if the catalogue genuinely changed."
        )

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)

    filled = {
        column: sum(1 for row in rows if row[column] and row[column] != "NA")
        for column in ("spread_cm", "height_cm", "sun", "water", "soil_type")
    }
    if repaired_rows:
        print(f"  repaired {repaired_rows} mis-encoded text value(s)")
    print(f"Wrote {len(rows)} species to {OUTPUT_CSV.relative_to(REPO_ROOT)}")
    print(f"  {len(columns)} columns from {workbook.name}")
    for column, count in filled.items():
        print(f"  {column}: {100 * count / len(rows):.1f}% filled")


if __name__ == "__main__":
    main()
