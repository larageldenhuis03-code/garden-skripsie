"""Build the Stage 0 F4 exclusion list the engine checks at run time.

Invasive species were removed from the catalogue upstream, by the anti-join in
the now-retired combine_plant_database.R. That removal is baked into
FINAL.DATASET.FINAL.xlsx and is never re-run, so nothing in the running app
verified it. This script writes the same list into
app/data/nemba_exclusions.json, where stage0Rules.ts reads it, turning F4 from
a stub into a real second check on every plant.

Source: data/raw/InvasivePlants.txt, the Darwin Core export used for that
original exclusion. It is a list of alien taxa, which is broader than - and
not identical to - the gazetted NEMBA notice. The gazetted list is still the
legal authority and still needs transcribing; see data/sources.json
(nemba-invasive-list-2020).

Only binomials are written. Genus-level entries are deliberately excluded: a
genus can hold both invasive aliens and indigenous species, and
onExclusionList() matches by prefix, so a bare genus would wrongly exclude its
indigenous members.

Run: python data/scripts/build_nemba_exclusions.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE = REPO_ROOT / "data" / "raw" / "InvasivePlants.txt"
TARGET = REPO_ROOT / "app" / "data" / "nemba_exclusions.json"


def binomials(path: Path) -> list[str]:
    """genus + specificEpithet from the Darwin Core columns.

    The scientificName column carries authorship ("Acacia acuminata Benth"),
    so the structured columns are used instead of parsing that string.
    """
    names: set[str] = set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            genus = (row.get("genus") or "").strip()
            epithet = (row.get("specificEpithet") or "").strip()
            if genus and epithet:
                names.add(f"{genus} {epithet}")
    return sorted(names)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source: {SOURCE}")

    species = binomials(SOURCE)
    TARGET.write_text(
        json.dumps(
            {
                "source": "data/raw/InvasivePlants.txt (Darwin Core alien-taxa export)",
                "built_by": "data/scripts/build_nemba_exclusions.py",
                "note": (
                    "Rulebook 11_Stage0_Filter F4. Species-level names only; a listed "
                    "name also excludes its subspecies and varieties. This is the list "
                    "used to remove invasives when the catalogue was built, re-checked "
                    "here at run time. It is an alien-taxa checklist, not the gazetted "
                    "NEMBA notice - see data/sources.json."
                ),
                "species": species,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"[nemba] {len(species)} species written to {TARGET.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
