"""Convert data/processed/plant_database_full.csv into the JSON shape
app/data/plants.ts imports and types as Plant[].

Run with the working directory at the repo root:
    python data/scripts/generate_plants_json.py

This is the final "app assembly" step: build_bioscape_traits.R and
combine_plant_database.R do the domain-specific data work (GIS join,
PlantZAfrica merge); this script just reshapes the result to match the
TypeScript Plant type, defaulting missing fields to null/"" rather than
guessing, per this project's rule against inventing horticultural
evidence.
"""

import csv
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_CSV = REPO_ROOT / "data" / "processed" / "plant_database_full.csv"
OUTPUT_JSON = REPO_ROOT / "app" / "data" / "plant_database.generated.json"

ACCENTS = ["ochre", "coral", "rose", "sky", "lime", "sand"]

VALID_BIOMES = {
    "Fynbos", "Succulent Karoo", "Nama Karoo", "Grassland", "Savanna",
    "Albany Thicket", "Indian Ocean Coastal Belt", "Forest", "Desert",
}
VALID_SUN = {"full", "part", "sheltered"}
VALID_WATER = {"low", "moderate", "moist"}


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value if value and value != "NA" else None


def split_list(value: str | None) -> list[str] | None:
    value = blank_to_none(value)
    if value is None:
        return None
    parts = [p.strip() for p in value.split(";") if p.strip()]
    return parts or None


def to_float(value: str | None) -> float | None:
    value = blank_to_none(value)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def build_note(form: str, care_instructions: str | None, special_features: str | None) -> str:
    segments = []
    if form:
        segments.append(f"A {form.replace('_', ' ').lower()} species.")
    if care_instructions:
        segments.append(care_instructions.strip())
    if special_features:
        segments.append(f"Notable features: {special_features.strip()}.")
    if not segments:
        segments.append("No horticultural description available yet for this species.")
    return " ".join(segments)


def main() -> None:
    with SOURCE_CSV.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    plants = []
    bad_biomes: set[str] = set()
    bad_sun: set[str] = set()
    bad_water: set[str] = set()

    for index, row in enumerate(rows):
        scientific_name = row["scientific_name"].strip()
        common_name = blank_to_none(row["common_name"]) or scientific_name
        family = blank_to_none(row["family"]) or ""
        form = blank_to_none(row["growth_form"]) or blank_to_none(row["plant_type_pza"]) or ""

        sun = split_list(row["sun"])
        if sun:
            bad_sun |= {s for s in sun if s not in VALID_SUN}

        water = blank_to_none(row["water"])
        if water and water not in VALID_WATER:
            bad_water.add(water)
            water = None

        biome = split_list(row["biome"])
        if biome:
            bad_biomes |= {b for b in biome if b not in VALID_BIOMES}
            biome = [b for b in biome if b in VALID_BIOMES] or None

        flower_begin = blank_to_none(row["flower_begin"]) or ""
        flower_end = blank_to_none(row["flower_end"]) or ""
        flower_colour = blank_to_none(row["flower_colour"])

        # Only "flowers" is derived automatically - it's directly
        # evidenced by a recorded bloom window or colour. The other
        # goal tags (structure, screening, fragrance, low-care, ...)
        # are design-intent judgements this data doesn't support, so
        # they're left for manual curation rather than guessed.
        goals = []
        if flower_colour or (flower_begin and flower_end):
            goals.append("flowers")

        plant = {
            "id": f"B{index + 1:04d}",
            "commonName": common_name,
            "scientificName": scientific_name,
            "family": family,
            "heightCm": to_float(row["height_cm"]),
            "spreadCm": to_float(row["spread_cm"]),
            "form": form,
            "flowerStart": flower_begin,
            "flowerEnd": flower_end,
            "occurrenceCount": int(to_float(row["biome_occurrence_count"]) or 0),
            "sun": sun,
            "water": water,
            "biome": biome,
            "goals": goals,
            "accent": ACCENTS[index % len(ACCENTS)],
            "note": build_note(form, blank_to_none(row["care_instructions"]), blank_to_none(row["special_features"])),
            "dataSource": row["data_source"],
            "biomeSource": blank_to_none(row["biome_source"]),
        }
        plants.append(plant)

    if bad_biomes:
        print(f"WARNING: unexpected biome value(s) dropped: {sorted(bad_biomes)}")
    if bad_sun:
        print(f"WARNING: unexpected sun value(s) found (kept as-is): {sorted(bad_sun)}")
    if bad_water:
        print(f"WARNING: unexpected water value(s) dropped: {sorted(bad_water)}")

    OUTPUT_JSON.write_text(json.dumps(plants, indent=2, ensure_ascii=False), encoding="utf-8")

    with_sun = sum(1 for p in plants if p["sun"])
    with_water = sum(1 for p in plants if p["water"])
    with_biome = sum(1 for p in plants if p["biome"])
    print(
        f"Wrote {len(plants)} plants to {OUTPUT_JSON.relative_to(REPO_ROOT)} "
        f"({with_sun} with sun, {with_water} with water, {with_biome} with biome)."
    )


if __name__ == "__main__":
    main()
