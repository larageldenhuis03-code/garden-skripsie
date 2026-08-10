"""Fetch a fallback photo from iNaturalist for species that have no
PlantZAfrica (SANBI) photo already.

PlantZAfrica photos are preferred everywhere they exist (data/processed/
plant_database_full.csv's photo_url column, ~76% of species) - they're
already tied to the same species profile we sourced sun/water/soil from.
This script only covers the remaining gap: species with no PlantZAfrica
match at all, or a match with no photo.

Run with the working directory at the repo root:
    python data/scripts/fetch_inaturalist_photos.py

Resumable: re-running skips scientific names already present in the output
CSV, so an interrupted run can just be restarted. Writes incrementally so a
Ctrl-C part-way through doesn't lose earlier results.
"""

import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_CSV = REPO_ROOT / "data" / "processed" / "plant_database_full.csv"
OUTPUT_CSV = REPO_ROOT / "data" / "processed" / "inaturalist_photos.csv"

API_URL = "https://api.inaturalist.org/v1/taxa"
REQUEST_DELAY_SECONDS = 1.0  # be a polite, well-behaved API citizen
FIELDNAMES = [
    "scientific_name",
    "inaturalist_taxon_id",
    "photo_url",
    "photo_attribution",
    "photo_license",
]


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value if value and value != "NA" else None


def load_species_needing_a_photo() -> list[str]:
    with SOURCE_CSV.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    return [
        row["scientific_name"].strip()
        for row in rows
        if blank_to_none(row.get("photo_url")) is None
    ]


def load_already_fetched() -> dict[str, dict[str, str]]:
    if not OUTPUT_CSV.exists():
        return {}
    with OUTPUT_CSV.open(encoding="utf-8", newline="") as f:
        return {row["scientific_name"]: row for row in csv.DictReader(f)}


def fetch_taxon_photo(scientific_name: str) -> dict[str, str] | None:
    query = urllib.parse.urlencode({"q": scientific_name, "rank": "species", "per_page": 3})
    request = urllib.request.Request(
        f"{API_URL}?{query}",
        headers={"User-Agent": "silly-goose-garden-planner/1.0 (student thesis project)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
        print(f"  request failed for {scientific_name!r}: {error}")
        return None

    results = payload.get("results") or []
    # Prefer an exact (case-insensitive) name match over the API's first guess.
    exact = [r for r in results if (r.get("name") or "").lower() == scientific_name.lower()]
    candidates = exact or results
    for candidate in candidates:
        photo = candidate.get("default_photo")
        if photo and photo.get("medium_url"):
            return {
                "scientific_name": scientific_name,
                "inaturalist_taxon_id": str(candidate.get("id", "")),
                "photo_url": photo["medium_url"],
                "photo_attribution": (photo.get("attribution") or "").strip(),
                "photo_license": photo.get("license_code") or "",
            }
    return None


def main() -> None:
    species = load_species_needing_a_photo()
    already_fetched = load_already_fetched()
    remaining = [name for name in species if name not in already_fetched]

    print(f"{len(species)} species need a fallback photo; {len(already_fetched)} already fetched; {len(remaining)} remaining.")

    write_header = not OUTPUT_CSV.exists()
    matched = 0
    with OUTPUT_CSV.open("a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()

        for index, name in enumerate(remaining, start=1):
            result = fetch_taxon_photo(name)
            if result:
                writer.writerow(result)
                matched += 1
            else:
                # Still record a (photo-less) row so a re-run doesn't retry
                # a species iNaturalist genuinely has no photo for.
                writer.writerow({"scientific_name": name, "inaturalist_taxon_id": "", "photo_url": "", "photo_attribution": "", "photo_license": ""})
            f.flush()

            if index % 50 == 0 or index == len(remaining):
                print(f"  {index}/{len(remaining)} processed, {matched} matched so far")

            time.sleep(REQUEST_DELAY_SECONDS)

    print(f"Done. {matched} new photo matches written to {OUTPUT_CSV.relative_to(REPO_ROOT)}.")


if __name__ == "__main__":
    main()
