"""Convert the reviewed place list into the JSON shape app/data/places.ts
imports and types as Place[].

Run with the working directory at the repo root:
    python data/scripts/generate_places_json.py

SOURCE (2026-09-24): data/processed/western_cape_places_reviewed.csv - the
owner's reviewed and corrected list. It supersedes western_cape_places.csv,
which came straight from download_western_cape_places.py and
assign_place_bioregions.R and is kept as the unreviewed original.

The reviewed file carries the decisions already made, so this script does
not re-derive them:

  used_in_tool        Y/N - whether the place appears in the picker. This
                      is the authority. The blocklist is still applied,
                      but only as a WARNING, so a disagreement is visible
                      rather than silently overriding the review.
  name_shown_in_app   the display name, already cased and corrected.
  biomes              the reviewed biome set, which drives the species
                      filter and so must never collapse to one value.
  preferred_water_level
                      a per-place water hint added in the review. It is
                      carried through to the app but NOT used as a filter:
                      the brief's water answer comes from the user, and
                      nothing in the engine reads this yet.

Provenance columns (biomes_original, biome_change_status, record_status,
the change notes) stay in the CSV as the audit trail and are deliberately
not shipped to the client.
"""

import csv
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_CSV = REPO_ROOT / "data" / "processed" / "western_cape_places_reviewed.csv"
OUTPUT_JSON = REPO_ROOT / "app" / "data" / "western_cape_places.generated.json"
BLOCKLIST_PATH = REPO_ROOT / "data" / "scripts" / "place_blocklist.txt"

VALID_CATEGORIES = {"Urban", "Rural", "Suburb", "Municipality", "District"}
# "imputed_nearest" joined the vocabulary in the 2026-09-24 review: places
# added by hand, whose bioregion came from the nearest classified polygon.
VALID_SOURCES = {"contains", "nearest", "majority", "imputed_nearest"}
VALID_WATER = {"low", "moderate", "moist"}


def display_name(raw: str) -> str:
    """Kept for the unreviewed original and for any ALL-CAPS name that
    slips through: title-case only names that are actually shouting, then
    patch the two cases str.title() gets wrong - the letter after an
    apostrophe (LAMBERT'S -> "Lambert'S") and the "Mc" prefix."""
    raw = raw.strip()
    if not raw.isupper():
        return raw
    titled = raw.title()
    titled = re.sub(r"'S\b", "'s", titled)
    titled = re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), titled)
    return titled


def load_blocklist() -> list[str]:
    if not BLOCKLIST_PATH.exists():
        return []
    return [
        line.strip().lower()
        for line in BLOCKLIST_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]


def main() -> None:
    with SOURCE_CSV.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    blocklist = load_blocklist()
    warnings: list[str] = []
    places = []
    seen: dict[str, str] = {}

    for row in rows:
        if row.get("used_in_tool", "").strip().upper() != "Y":
            continue

        name = display_name(row["name_shown_in_app"])
        category = row["category"].strip()
        bioregion = row["bioregion"].strip()
        source = row["bioregion_method"].strip()
        biomes = [b.strip() for b in row.get("biomes", "").split(";") if b.strip()]
        water = row.get("preferred_water_level", "").strip().lower()

        if category not in VALID_CATEGORIES:
            raise ValueError(f"Unexpected category {category!r} for {name!r}")
        if source not in VALID_SOURCES:
            raise ValueError(f"Unexpected bioregion method {source!r} for {name!r}")
        if water and water not in VALID_WATER:
            raise ValueError(f"Unexpected preferred_water_level {water!r} for {name!r}")
        if not name or not bioregion or not biomes:
            raise ValueError(f"Row kept for the tool is missing name/bioregion/biomes: {name!r}")
        if name in seen:
            raise ValueError(f"Duplicate place name kept twice: {name!r} ({seen[name]}, {category})")
        seen[name] = category

        # The review decides what appears; the blocklist only reports a
        # disagreement, so a deliberate keep is never silently undone.
        lowered = name.lower()
        hit = next((t for t in blocklist if re.search(rf"\b{re.escape(t)}\b", lowered)), None)
        if hit:
            warnings.append(f'kept despite blocklisted word "{hit}": {name} ({category})')

        place = {
            "name": name,
            "category": category,
            "biomes": biomes,
            "bioregion": bioregion,
            "bioregionSource": source,
        }
        if water:
            place["preferredWaterLevel"] = water
        places.append(place)

    places.sort(key=lambda place: place["name"])

    for warning in warnings[:15]:
        print(f"  WARNING: {warning}")
    if len(warnings) > 15:
        print(f"  ... and {len(warnings) - 15} more")

    multi = sum(1 for place in places if len(place["biomes"]) > 1)
    water_hints = sum(1 for place in places if "preferredWaterLevel" in place)
    excluded = len(rows) - len(places)
    print(f"{len(rows):,} reviewed rows -> {len(places):,} places ({excluded:,} not used in the tool)")
    print(f"{multi} place(s) span more than one biome | {water_hints} carry a water hint")

    OUTPUT_JSON.write_text(
        json.dumps(places, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(places):,} places to {OUTPUT_JSON.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
