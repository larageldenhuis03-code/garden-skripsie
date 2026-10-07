"""Convert data/processed/plant_database_full.csv into the JSON shape
app/data/plants.ts imports and types as Plant[].

Run with the working directory at the repo root:
    python data/scripts/generate_plants_json.py

This is the final "app assembly" step. The catalogue itself comes from
FINAL.DATASET.FINAL.xlsx via import_final_dataset.py (the older R merge
that used to build it is retired - see data/scripts/retired/README.md).
This script just reshapes the result to match the TypeScript Plant type,
defaulting missing fields to null/"" rather than guessing, per this
project's rule against inventing horticultural evidence, and carries each
value's *_source / *_confidence provenance through so the interface can
tell a measurement from an estimate.
"""

import csv
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_CSV = REPO_ROOT / "data" / "processed" / "plant_database_western_cape.csv"
INATURALIST_CSV = REPO_ROOT / "data" / "processed" / "inaturalist_photos.csv"
OUTPUT_JSON = REPO_ROOT / "app" / "data" / "plant_database.generated.json"
LOAD_WARNINGS_JSON = REPO_ROOT / "data" / "processed" / "data_load_warnings.json"

ACCENTS = ["ochre", "coral", "rose", "sky", "lime", "sand"]

# The coarse `biome` field is still carried through as supporting/display
# info (see build_note) even though `bioregion` is the real match key now -
# still validated against the same fixed national vocabulary it always was.
VALID_BIOMES = {
    "Fynbos", "Succulent Karoo", "Nama Karoo", "Grassland", "Savanna",
    "Albany Thicket", "Indian Ocean Coastal Belt", "Forest", "Desert",
}
VALID_SUN = {"full", "part", "sheltered"}
VALID_WATER = {"low", "moderate", "moist"}

# ---- Multi-value parsing (spec 0.1) --------------------------------
#
# Per-column delimiters, NOT one global split. Every "/" in this dataset
# belongs to a compound token rather than separating two values -
# "Hedge/screen" (167), "Bi/Annual" (96), "Mauve/Lilac" (238) and
# "Brack/saline" (23) - so "/" is never a delimiter here. Splitting on it
# would corrupt 524 records into invalid tokens.
COLUMN_DELIMITERS = {
    "sun": [";"],
    "water": [";"],
    "soil_type": [","],
    "biome": [";"],
    "flower_colour": [","],
    "plant type": [","],
    "special_features": [";"],
}

# Raw -> canonical (spec 0.2). Anything that fails to map is reported in
# data_load_warnings.json rather than dropped silently.
SUN_VOCABULARY = {
    "full": "full", "full sun": "full", "sun": "full",
    "part": "part", "partial": "part", "part sun": "part",
    "semi-shade": "part", "semi shade": "part", "dappled": "part",
    "morning sun": "part",
    "sheltered": "sheltered", "shade": "sheltered", "full shade": "sheltered",
    "deep shade": "sheltered",
}
WATER_VOCABULARY = {
    "low": "low", "dry": "low",
    "moderate": "moderate", "medium": "moderate", "average": "moderate",
    "moist": "moist", "wet": "moist", "high": "moist",
}
SOIL_VOCABULARY = {
    "sandy": "sandy", "sand": "sandy",
    "loam": "loam", "loamy": "loam",
    "clay": "clay", "clayey": "clay",
}
# Retained on the record but not exposed as filter options (spec 0.2).
MINOR_SOIL_TYPES = {"brack/saline", "gravelly", "metal-rich", "peaty", "chalky"}

# Tags that bar a species from outdoor bed recommendations (spec 0.3).
# They stay browsable in the plant library, flagged - they are simply
# never recommended.
EXCLUSION_TAGS = {"poisonous": "poisonous", "indoor plant": "indoor"}

# spread_source -> the three confidence levels the layout view needs
# (spec 8.5). Only "original" is a real measurement.
SPREAD_CONFIDENCE = {
    "original": "original",
    "web-research": "researched",
    "lookup": "imputed",
    "group-median": "imputed",
    "ratio-imputed": "imputed",
}

# Text that must not survive the load (spec 0.3.3).
FORBIDDEN_PATTERNS = [
    "poison", "poisonous", "toxic", "toxicity", "harmful if", "do not ingest",
    "invasive", "nemba", "category 1", "category 1b", "declared weed",
    "alien invasive",
    "endangered", "critically endangered", "vulnerable", "red list",
    "threatened",
]

load_warnings: list[dict[str, str]] = []


def split_values(value: str | None, column: str) -> list[str]:
    """Split a multi-valued cell using that column's own delimiters."""
    value = blank_to_none(value)
    if value is None:
        return []
    parts = [value]
    for delimiter in COLUMN_DELIMITERS.get(column, [";"]):
        parts = [piece for part in parts for piece in part.split(delimiter)]
    # " and " is a documented separator in the spec; it does not occur in
    # the current dataset but costs nothing to honour.
    parts = [piece for part in parts for piece in part.split(" and ")]
    return [part.strip() for part in parts if part.strip()]


def canonicalise(
    values: list[str],
    vocabulary: dict[str, str],
    column: str,
    scientific_name: str,
    *,
    allow: set[str] | None = None,
) -> list[str]:
    """Map raw values onto the canonical vocabulary, recording anything
    that fails to map instead of discarding it quietly (spec 0.2)."""
    mapped: list[str] = []
    for raw in values:
        key = raw.lower()
        if key in vocabulary:
            canonical = vocabulary[key]
        elif allow is not None and key in allow:
            canonical = key
        else:
            load_warnings.append(
                {"species": scientific_name, "column": column, "value": raw}
            )
            continue
        if canonical not in mapped:
            mapped.append(canonical)
    return mapped

def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value if value and value != "NA" else None


# PlantZAfrica's own placeholder text for "we don't have a common name" -
# these leak through as if they were real names unless caught here. Scoped
# to just common_name: "none" is legitimate real data elsewhere (e.g.
# parasitic_type's "none" means "not parasitic", not "unknown").
COMMON_NAME_PLACEHOLDERS = {"none", "none recorded", "none known"}


def common_name_or_none(value: str | None) -> str | None:
    value = blank_to_none(value)
    if value is not None and value.lower() in COMMON_NAME_PLACEHOLDERS:
        return None
    return value


def split_list(value: str | None) -> list[str] | None:
    value = blank_to_none(value)
    if value is None:
        return None
    parts = [p.strip() for p in value.split(";") if p.strip()]
    return parts or None


# soil_type is comma-separated ("Sandy, Loam"), unlike sun/biome which use
# semicolons.
def split_comma_list(value: str | None) -> list[str] | None:
    value = blank_to_none(value)
    if value is None:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
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


def load_inaturalist_photos() -> dict[str, dict[str, str | None]]:
    if not INATURALIST_CSV.exists():
        return {}
    with INATURALIST_CSV.open(encoding="utf-8", newline="") as f:
        by_name = {}
        for row in csv.DictReader(f):
            url = blank_to_none(row.get("photo_url"))
            if url is None:
                continue  # a fetch attempt that found no photo - not a fallback
            taxon_id = blank_to_none(row.get("inaturalist_taxon_id"))
            by_name[row["scientific_name"].strip()] = {
                "photo_url": url,
                "photo_attribution": blank_to_none(row.get("photo_attribution")),
                "photo_source_url": (
                    f"https://www.inaturalist.org/taxa/{taxon_id}" if taxon_id else None
                ),
                # iNaturalist licences vary per contributor (some are
                # non-commercial or no-derivatives), so the terms have to
                # travel with the photo (spec 0.5).
                "photo_license": blank_to_none(row.get("photo_license")),
            }
        return by_name


def main() -> None:
    with SOURCE_CSV.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    inaturalist_photos = load_inaturalist_photos()

    plants = []
    bad_biomes: set[str] = set()
    bad_sun: set[str] = set()
    bad_water: set[str] = set()
    bioregions_found: set[str] = set()

    for index, row in enumerate(rows):
        scientific_name = row["scientific_name"].strip()
        common_name = common_name_or_none(row["common_name"]) or scientific_name
        family = blank_to_none(row["family"]) or ""
        # FINAL.DATASET.FINAL.xlsx replaced the old growth_form /
        # plant_type_pza pair with one "plant type" column.
        form = blank_to_none(row["plant type"]) or ""

        # Multi-valued: a species belongs to every value it lists, so these
        # stay arrays and hard filters use any-match (spec 0.1).
        sun = canonicalise(
            split_values(row["sun"], "sun"),
            SUN_VOCABULARY,
            "sun",
            scientific_name,
        ) or None
        if sun:
            bad_sun |= {s for s in sun if s not in VALID_SUN}

        water_values = canonicalise(
            split_values(row["water"], "water"),
            WATER_VOCABULARY,
            "water",
            scientific_name,
        )
        water = water_values[0] if water_values else None
        if water and water not in VALID_WATER:
            bad_water.add(water)
            water = None

        biome = split_values(row["biome"], "biome") or None
        if biome:
            bad_biomes |= {b for b in biome if b not in VALID_BIOMES}
            biome = [b for b in biome if b in VALID_BIOMES] or None

        raw_soil = split_values(row["soil_type"], "soil_type")
        soil_type = canonicalise(
            [s for s in raw_soil if s.lower() not in MINOR_SOIL_TYPES],
            SOIL_VOCABULARY,
            "soil_type",
            scientific_name,
        )
        # Minor soil types stay on the record but are not filter options.
        soil_minor = [s for s in raw_soil if s.lower() in MINOR_SOIL_TYPES]

        plant_type = [p.lower() for p in split_values(row["plant type"], "plant type")]
        flower_colour = split_values(row["flower_colour"], "flower_colour")
        special_features = split_values(row["special_features"], "special_features")

        # Exclusion pass (spec 0.3): poisonous and indoor species are never
        # recommended for an outdoor bed.
        exclusion_reason = None
        for feature in special_features:
            reason = EXCLUSION_TAGS.get(feature.lower())
            if reason:
                exclusion_reason = reason
                break

        spread_confidence = SPREAD_CONFIDENCE.get(
            (blank_to_none(row["spread_source"]) or "").lower()
        )

        # Layout eligibility (spec 0.7): everything the layout stage needs.
        # An ineligible species stays browsable, tagged "data incomplete".
        layout_eligible = all(
            [
                scientific_name,
                common_name,
                biome,
                plant_type,
                sun,
                water,
                soil_type,
                to_float(row["height_cm"]) is not None,
                to_float(row["spread_cm"]) is not None,
            ]
        )

        # bioregion is the real match key now - a single value (not a
        # list like biome), since there's only one source for it
        # (occurrence coordinates against the Western Cape vegetation
        # layer) with no zone-inference equivalent the way biome has.
        bioregion = blank_to_none(row["bioregion"])
        if bioregion:
            bioregions_found.add(bioregion)

        flower_begin = blank_to_none(row["flower_begin"]) or ""
        flower_end = blank_to_none(row["flower_end"]) or ""

        # Only "flowers" is derived automatically - it's directly
        # evidenced by a recorded bloom window or colour. The other
        # goal tags (structure, screening, fragrance, low-care, ...)
        # are design-intent judgements this data doesn't support, so
        # they're left for manual curation rather than guessed.
        goals = []
        if flower_colour or (flower_begin and flower_end):
            goals.append("flowers")

        pza_photo_url = blank_to_none(row["photo_url"])
        if pza_photo_url:
            photo_url = pza_photo_url
            photo_attribution = "PlantZAfrica (SANBI)"
            photo_source_url = blank_to_none(row["photo_source_url"])
            photo_source = "plantzafrica"
            # BGIS/PlantZAfrica material is published CC BY-NC-SA 4.0 (see
            # data/sources.json); it is one licence for the whole set,
            # unlike iNaturalist's per-contributor terms.
            photo_license = "CC BY-NC-SA 4.0"
        else:
            fallback = inaturalist_photos.get(scientific_name)
            if fallback:
                photo_url = fallback["photo_url"]
                photo_attribution = fallback["photo_attribution"] or "iNaturalist contributor"
                photo_source_url = fallback["photo_source_url"]
                photo_source = "inaturalist"
                photo_license = fallback["photo_license"]
            else:
                photo_url = None
                photo_attribution = None
                photo_source_url = None
                photo_source = None
                photo_license = None

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
            "occurrenceCount": int(
                to_float(row["bioregion_occurrence_count"])
                or to_float(row["biome_occurrence_count"])
                or 0
            ),
            "sun": sun,
            "water": water,
            "biome": biome,
            "bioregion": bioregion,
            "bioregionSource": blank_to_none(row["bioregion_source"]),
            "soilType": soil_type or None,
            "soilTypeMinor": soil_minor or None,
            "plantType": plant_type or None,
            "flowerColour": flower_colour or None,
            "specialFeatures": special_features or None,
            # Supporting evidence for the "low maintenance" and
            # "flowers & pollinators" preferences (spec 6). Neither is the
            # primary source - special_features is - but both sharpen the
            # ranking where present.
            "gardeningSkill": blank_to_none(row["gardening_skill"]),
            "floweringSeason": blank_to_none(row["flowering_season_pza"]),
            # Never recommended for an outdoor bed, but still browsable in
            # the plant library with a warning (spec 0.3).
            "excludedFromLayout": exclusion_reason,
            # Has every attribute the layout stage needs (spec 0.7).
            "layoutEligible": layout_eligible,
            "spreadConfidence": spread_confidence,
            # Provenance for the completed measurement fields. Most spread
            # and many height values in FINAL.DATASET.FINAL.xlsx are
            # imputed rather than measured, so the app has to be able to
            # say which is which instead of presenting all of them as
            # recorded evidence.
            "spreadSource": blank_to_none(row["spread_source"]),
            "spreadOutlierFlag": blank_to_none(row["outlier_flag"]),
            "spreadNote": blank_to_none(row["spread_note"]),
            "heightSource": blank_to_none(row["height_source"]),
            "sunSource": blank_to_none(row["sun_source"]),
            "sunConfidence": blank_to_none(row["sun_confidence"]),
            "waterSource": blank_to_none(row["water_source"]),
            "waterConfidence": blank_to_none(row["water_confidence"]),
            "soilTypeSource": blank_to_none(row["soil_type_source"]),
            "soilTypeConfidence": blank_to_none(row["soil_type_confidence"]),
            "goals": goals,
            "accent": ACCENTS[index % len(ACCENTS)],
            "note": build_note(form, blank_to_none(row["care_instructions"]), blank_to_none(row["special_features"])),
            "dataSource": row["data_source"],
            "biomeSource": blank_to_none(row["biome_source"]),
            "photoUrl": photo_url,
            "photoAttribution": photo_attribution,
            "photoSourceUrl": photo_source_url,
            "photoSource": photo_source,
            "photoLicense": photo_license,
        }
        plants.append(plant)

    # ---- Exclusions and integrity assertion (spec 0.3) --------------
    excluded = [p for p in plants if p["excludedFromLayout"]]
    # Counted per tag, not per primary reason, so each figure is citable on
    # its own - a species carrying both tags is counted under both here but
    # only once in the total.
    for reason in sorted(set(EXCLUSION_TAGS.values())):
        count = sum(
            1
            for plant in plants
            if any(
                EXCLUSION_TAGS.get(feature.lower()) == reason
                for feature in (plant["specialFeatures"] or [])
            )
        )
        print(f"{count} records excluded from layouts: {reason}")
    print(f"{len(excluded)} records excluded in total (some carry both tags)")

    # Scan the free-text fields of everything still recommendable. A hit
    # means a species the tag-based exclusion missed, so fail the build.
    offenders: list[str] = []
    for plant, row in zip(plants, rows):
        if plant["excludedFromLayout"]:
            continue
        haystack = " ".join(
            filter(
                None,
                [
                    plant["note"],
                    row.get("care_instructions", ""),
                    row.get("special_features", ""),
                ],
            )
        ).lower()
        hits = [pattern for pattern in FORBIDDEN_PATTERNS if pattern in haystack]
        if hits:
            offenders.append(f"{plant['scientificName']}: {', '.join(sorted(set(hits)))}")

    if offenders:
        print(
            f"INTEGRITY CHECK FAILED - {len(offenders)} recommendable record(s) "
            "match a poisonous/invasive/threatened keyword:"
        )
        for offender in offenders[:25]:
            print(f"  {offender}")
        raise SystemExit(1)
    print(
        f"Integrity check passed: {len(plants) - len(excluded)} recommendable "
        "records, none matching poisonous, invasive or threatened keywords."
    )

    if load_warnings:
        LOAD_WARNINGS_JSON.write_text(
            json.dumps(load_warnings, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(
            f"{len(load_warnings)} unmapped value(s) written to "
            f"{LOAD_WARNINGS_JSON.relative_to(REPO_ROOT)}"
        )
    elif LOAD_WARNINGS_JSON.exists():
        LOAD_WARNINGS_JSON.unlink()

    if bad_biomes:
        print(f"WARNING: unexpected biome value(s) dropped: {sorted(bad_biomes)}")
    if bad_sun:
        print(f"WARNING: unexpected sun value(s) found (kept as-is): {sorted(bad_sun)}")
    if bad_water:
        print(f"WARNING: unexpected water value(s) dropped: {sorted(bad_water)}")

    # Compact, not pretty-printed: this file ships to the browser as-is
    # (see docs/NOW.md's "Next evidence work" for the bigger index/detail
    # split that would cut this further - not done yet, deliberately).
    OUTPUT_JSON.write_text(
        json.dumps(plants, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    with_sun = sum(1 for p in plants if p["sun"])
    with_water = sum(1 for p in plants if p["water"])
    with_biome = sum(1 for p in plants if p["biome"])
    with_bioregion = sum(1 for p in plants if p["bioregion"])
    with_photo = sum(1 for p in plants if p["photoUrl"])
    with_pza_photo = sum(1 for p in plants if p["photoSource"] == "plantzafrica")
    with_inat_photo = sum(1 for p in plants if p["photoSource"] == "inaturalist")
    print(
        f"Wrote {len(plants)} plants to {OUTPUT_JSON.relative_to(REPO_ROOT)} "
        f"({with_sun} with sun, {with_water} with water, {with_biome} with biome, "
        f"{with_bioregion} with a Western Cape bioregion, "
        f"{with_photo} with a photo: {with_pza_photo} PlantZAfrica + {with_inat_photo} iNaturalist)."
    )
    print(f"Distinct bioregions found ({len(bioregions_found)}):")
    for name in sorted(bioregions_found):
        print(f"  - {name}")


if __name__ == "__main__":
    main()
