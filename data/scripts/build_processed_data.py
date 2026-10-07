#!/usr/bin/env python3
"""Build compact, app-oriented CSV extracts from the downloaded source datasets."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import statistics
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
MISSING = {"", "NA", "NE", "N/A", "null", "None"}
XLSX_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def write_csv(path: Path, fieldnames: list[str], rows) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            count += 1
    print(f"Wrote {path.relative_to(ROOT)} ({count:,} rows)")
    return count


def clean(value: str | None) -> str:
    value = (value or "").strip()
    value = value.replace("Ã—", "×")
    return "" if value in MISSING else value


def number(value: str | None) -> float | None:
    value = clean(value)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def canonical_name(scientific_name: str | None) -> str:
    """Remove authorship while retaining a species or infraspecies name."""
    tokens = clean(scientific_name).replace("\xa0", " ").split()
    if not tokens:
        return ""
    start = 1 if tokens[0] == "×" else 0
    if len(tokens) <= start + 1:
        return " ".join(tokens)
    end = start + 2
    if len(tokens) > end and tokens[end].lower() in {
        "subsp.",
        "ssp.",
        "var.",
        "f.",
        "forma",
    }:
        end = min(len(tokens), end + 2)
    return " ".join(tokens[:end])


def zip_dict_rows(path: Path, member: str):
    with zipfile.ZipFile(path) as archive, archive.open(member) as raw:
        lines = (line.decode("utf-8-sig") for line in raw)
        yield from csv.DictReader(lines, delimiter="\t")


def build_sanpc() -> None:
    archive = RAW / "sanbi" / "sanpc-2026" / "dwca-sanpc-2026-v1.3.zip"
    distributions = {
        row["id"]: row for row in zip_dict_rows(archive, "distribution.txt")
    }
    fields = [
        "taxon_id",
        "scientific_name",
        "canonical_name",
        "scientific_name_authorship",
        "family",
        "genus",
        "taxon_rank",
        "taxonomic_status",
        "provinces",
        "country_code",
        "establishment_means",
        "degree_of_establishment",
        "threat_status",
        "source_dataset",
    ]

    def rows():
        for taxon in zip_dict_rows(archive, "taxon.txt"):
            distribution = distributions.get(taxon["id"], {})
            if taxon.get("kingdom") != "Plantae":
                continue
            if taxon.get("taxonomicStatus", "").lower() != "accepted":
                continue
            provinces = distribution.get("locality", "")
            if "Western Cape" not in provinces:
                continue
            scientific_name = clean(taxon.get("scientificName"))
            yield {
                "taxon_id": taxon.get("taxonID", ""),
                "scientific_name": scientific_name,
                "canonical_name": canonical_name(scientific_name),
                "scientific_name_authorship": taxon.get(
                    "scientificNameAuthorship", ""
                ),
                "family": taxon.get("family", ""),
                "genus": taxon.get("genus", ""),
                "taxon_rank": taxon.get("taxonRank", ""),
                "taxonomic_status": taxon.get("taxonomicStatus", ""),
                "provinces": provinces,
                "country_code": distribution.get("countryCode", ""),
                "establishment_means": distribution.get(
                    "establishmentMeans", ""
                ),
                "degree_of_establishment": distribution.get(
                    "degreeOfEstablishment", ""
                ),
                "threat_status": distribution.get("threatStatus", ""),
                "source_dataset": "SANPC 2026 v1.3 (doi:10.15468/e8spft)",
            }

    write_csv(PROCESSED / "sanpc_western_cape_accepted_taxa.csv", fields, rows())


def build_bodatsa() -> None:
    archive = RAW / "sanbi" / "bodatsa-2026" / "dwca-bodatsa-v1.32.zip"
    summaries: dict[tuple[str, str], dict] = {}
    for row in zip_dict_rows(archive, "occurrence.txt"):
        if row.get("country") != "South Africa":
            continue
        if row.get("stateProvince") != "Western Cape":
            continue
        key = (row.get("taxonID", ""), row.get("scientificName", ""))
        if key not in summaries:
            scientific_name = clean(row.get("scientificName"))
            summaries[key] = {
                "taxon_id": key[0],
                "scientific_name": scientific_name,
                "canonical_name": canonical_name(scientific_name),
                "family": row.get("family", ""),
                "order": row.get("order", ""),
                "occurrence_count": 0,
                "georeferenced_count": 0,
                "earliest_year": None,
                "latest_year": None,
                "min_latitude": None,
                "max_latitude": None,
                "min_longitude": None,
                "max_longitude": None,
            }
        item = summaries[key]
        item["occurrence_count"] += 1
        lat = number(row.get("decimalLatitude"))
        lon = number(row.get("decimalLongitude"))
        if lat is not None and lon is not None:
            item["georeferenced_count"] += 1
            for field, value, fn in (
                ("min_latitude", lat, min),
                ("max_latitude", lat, max),
                ("min_longitude", lon, min),
                ("max_longitude", lon, max),
            ):
                item[field] = value if item[field] is None else fn(item[field], value)
        year = number(row.get("year"))
        if year is not None:
            year = int(year)
            item["earliest_year"] = (
                year if item["earliest_year"] is None else min(item["earliest_year"], year)
            )
            item["latest_year"] = (
                year if item["latest_year"] is None else max(item["latest_year"], year)
            )

    fields = [
        "taxon_id",
        "scientific_name",
        "canonical_name",
        "family",
        "order",
        "occurrence_count",
        "georeferenced_count",
        "earliest_year",
        "latest_year",
        "min_latitude",
        "max_latitude",
        "min_longitude",
        "max_longitude",
        "source_dataset",
    ]
    rows = []
    for item in summaries.values():
        item["source_dataset"] = "BODATSA 2026 v1.32 (doi:10.15468/2aki0q)"
        rows.append(item)
    rows.sort(key=lambda row: (-row["occurrence_count"], row["scientific_name"]))
    write_csv(PROCESSED / "bodatsa_western_cape_species_summary.csv", fields, rows)


def growth_forms(row: dict[str, str]) -> str:
    labels = [
        ("herb", "herb"),
        ("geophyte", "geophyte"),
        ("graminoid", "graminoid"),
        ("low_shrub", "low shrub"),
        ("mid_shrub", "mid shrub"),
        ("tall_shrub", "tall shrub"),
        ("tree", "tree"),
        ("scrambler", "scrambler"),
        ("liana", "liana"),
        ("hemiparasite", "hemiparasite"),
        ("parasite", "parasite"),
    ]
    return "|".join(label for field, label in labels if clean(row.get(field)) == "1")


def build_bioscape_species_traits() -> None:
    source = (
        RAW
        / "bioscape-gcfr-2026"
        / "BioSCape_foliar_species_traits.csv"
    )
    fields = [
        "scientific_name",
        "canonical_name",
        "scientific_name_original",
        "family",
        "max_height_cm",
        "growth_forms",
        "lifecycle",
        "evergreen",
        "deciduous",
        "flower_begin",
        "flower_end",
        "succulent",
        "plant_longevity_class",
        "flammability",
        "pollination",
        "dispersal",
        "source_dataset",
    ]
    grouped: dict[str, dict] = {}
    originals: dict[str, set[str]] = defaultdict(set)
    with source.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            scientific_name = clean(row.get("scientific_name_WFO")) or clean(
                row.get("scientific_name_MG")
            )
            if not scientific_name:
                continue
            name = canonical_name(scientific_name)
            original = clean(row.get("scientific_name_original"))
            if original:
                originals[name].add(original)
            candidate = {
                "scientific_name": scientific_name,
                "canonical_name": name,
                "scientific_name_original": original,
                "family": clean(row.get("family_WFO"))
                or clean(row.get("family_MG")),
                "max_height_cm": clean(row.get("max_height_cm")),
                "growth_forms": growth_forms(row),
                "lifecycle": clean(row.get("lifecycle_POSA")),
                "evergreen": clean(row.get("evergreen")),
                "deciduous": clean(row.get("deciduous")),
                "flower_begin": clean(row.get("flower_begin")),
                "flower_end": clean(row.get("flower_end")),
                "succulent": clean(row.get("succulent")),
                "plant_longevity_class": clean(row.get("plant_longevity")),
                "flammability": clean(row.get("flammability")),
                "pollination": clean(row.get("pollination")),
                "dispersal": clean(row.get("dispersal")),
                "source_dataset": (
                    "BioSCape GCFR traits v1 (doi:10.3334/ORNLDAAC/2482)"
                ),
            }
            current = grouped.get(name)
            if current is None:
                grouped[name] = candidate
                continue
            current_height = number(current.get("max_height_cm"))
            candidate_height = number(candidate.get("max_height_cm"))
            if candidate_height is not None and (
                current_height is None or candidate_height > current_height
            ):
                current["max_height_cm"] = candidate["max_height_cm"]
            for field in fields:
                if not clean(current.get(field)) and clean(candidate.get(field)):
                    current[field] = candidate[field]
            forms = set(filter(None, current["growth_forms"].split("|")))
            forms.update(filter(None, candidate["growth_forms"].split("|")))
            current["growth_forms"] = "|".join(sorted(forms))

    rows = list(grouped.values())
    for row in rows:
        row["scientific_name_original"] = "|".join(
            sorted(originals[row["canonical_name"]])
        )
    rows.sort(key=lambda row: row["canonical_name"])
    write_csv(PROCESSED / "bioscape_gcfr_species_traits.csv", fields, rows)


def build_bioscape_canopy_summary() -> None:
    source = (
        RAW
        / "bioscape-gcfr-2026"
        / "BioSCape_foliar_canopy_leaf_chemistry.csv"
    )
    grouped: dict[tuple[str, str], dict[str, list[float]]] = defaultdict(
        lambda: {"height": [], "axis_1": [], "axis_2": [], "cover": []}
    )
    families: dict[tuple[str, str], str] = {}
    with source.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            scientific_name = clean(row.get("scientific_name_WFO")) or clean(
                row.get("scientific_name_original")
            )
            if not scientific_name:
                continue
            key = (scientific_name, clean(row.get("scientific_name_original")))
            families[key] = clean(row.get("family_WFO")) or clean(row.get("family_MG"))
            for target, source_field in (
                ("height", "height_cm"),
                ("axis_1", "canopy_axis_1_cm"),
                ("axis_2", "canopy_axis_2_cm"),
                ("cover", "canopy_cover_cm2"),
            ):
                value = number(row.get(source_field))
                if value is not None:
                    grouped[key][target].append(value)

    fields = [
        "scientific_name",
        "canonical_name",
        "scientific_name_original",
        "family",
        "measurement_count",
        "median_height_cm",
        "max_height_cm",
        "median_canopy_axis_1_cm",
        "median_canopy_axis_2_cm",
        "median_canopy_cover_cm2",
        "source_dataset",
    ]
    rows = []
    for key, values in grouped.items():
        rows.append(
            {
                "scientific_name": key[0],
                "canonical_name": canonical_name(key[0]),
                "scientific_name_original": key[1],
                "family": families[key],
                "measurement_count": max(len(v) for v in values.values()),
                "median_height_cm": (
                    round(statistics.median(values["height"]), 3)
                    if values["height"]
                    else ""
                ),
                "max_height_cm": (
                    round(max(values["height"]), 3) if values["height"] else ""
                ),
                "median_canopy_axis_1_cm": (
                    round(statistics.median(values["axis_1"]), 3)
                    if values["axis_1"]
                    else ""
                ),
                "median_canopy_axis_2_cm": (
                    round(statistics.median(values["axis_2"]), 3)
                    if values["axis_2"]
                    else ""
                ),
                "median_canopy_cover_cm2": (
                    round(statistics.median(values["cover"]), 3)
                    if values["cover"]
                    else ""
                ),
                "source_dataset": "BioSCape GCFR traits v1 (doi:10.3334/ORNLDAAC/2482)",
            }
        )
    rows.sort(key=lambda row: row["scientific_name"])
    write_csv(PROCESSED / "bioscape_gcfr_canopy_summary.csv", fields, rows)


def column_number(cell_reference: str) -> int:
    letters = re.match(r"[A-Z]+", cell_reference)
    if not letters:
        raise ValueError(f"Invalid cell reference: {cell_reference}")
    result = 0
    for char in letters.group(0):
        result = result * 26 + ord(char) - ord("A") + 1
    return result - 1


def xlsx_sheet_part(archive, name: str) -> str | None:
    """The worksheet part backing a named sheet, or None if there is no
    such sheet. Sheet order is not sheet file order, so the name has to be
    resolved through workbook.xml and its relationships."""
    import re

    workbook = archive.read("xl/workbook.xml").decode("utf-8", "ignore")
    match = re.search(
        r'<sheet[^>]*name="' + re.escape(name) + r'"[^>]*r:id="(rId\d+)"',
        workbook,
    )
    if not match:
        return None
    rels = archive.read("xl/_rels/workbook.xml.rels").decode("utf-8", "ignore")
    target = re.search(
        r'Id="' + match.group(1) + r'"[^>]*Target="([^"]+)"', rels
    )
    if not target:
        return None
    path = target.group(1).lstrip("/")
    return path if path.startswith("xl/") else "xl/" + path


def xlsx_first_sheet_rows(path: Path, sheet_name: str | None = None):
    """Rows from `sheet_name` when given and present, else the first sheet.

    The dataset workbook grew from 3 sheets to 23 on 2026-09-30, and
    FINAL_DATASET stopped being the first one - reading sheet1.xml then
    returned the Summary tab and zero species. Naming the sheet makes the
    import independent of tab order.
    """
    namespace = {"m": XLSX_MAIN_NS}
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", namespace):
                shared.append(
                    "".join(
                        node.text or ""
                        for node in item.iter(f"{{{XLSX_MAIN_NS}}}t")
                    )
                )
        part = xlsx_sheet_part(archive, sheet_name) if sheet_name else None
        if part is None:
            part = "xl/worksheets/sheet1.xml"
        sheet = ET.fromstring(archive.read(part))
        for row in sheet.findall(".//m:sheetData/m:row", namespace):
            values: dict[int, str] = {}
            for cell in row.findall("m:c", namespace):
                index = column_number(cell.attrib["r"])
                cell_type = cell.attrib.get("t")
                value_node = cell.find("m:v", namespace)
                if cell_type == "inlineStr":
                    value = "".join(
                        node.text or ""
                        for node in cell.iter(f"{{{XLSX_MAIN_NS}}}t")
                    )
                elif value_node is None:
                    value = ""
                elif cell_type == "s":
                    value = shared[int(value_node.text or "0")]
                else:
                    value = value_node.text or ""
                values[index] = value
            yield values


def build_alien_plants() -> None:
    source = (
        RAW
        / "sanbi"
        / "alien-species-2025"
        / "A_checklist_of_alien_taxa_for_South_Africa_v20250520.xlsx"
    )
    row_iterator = xlsx_first_sheet_rows(source)
    header_cells = next(row_iterator)
    header = {
        index: value.strip() for index, value in header_cells.items() if value.strip()
    }
    wanted = [
        "scientificName",
        "taxonRank",
        "family",
        "vernacularName",
        "RegulatoryListing",
        "regulatoryGrouping",
        "legallyImported",
        "isNative",
        "isNativeConfidence",
        "occurrenceStatus",
        "occurrenceStatusConfidence",
        "degreeOfEstablishment",
        "IntroductionStatus",
        "pathway",
        "impactEICATSouthAfrica",
        "impactSEICATSouthAfrica",
        "RiskAnalysis",
        "RiskAssessmentCompleted",
        "speciesTreated",
        "Realm",
        "recordID216",
    ]
    fields = ["canonical_name"] + [
        re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower() for name in wanted
    ] + ["source_dataset"]

    def rows():
        for cells in row_iterator:
            row = {header[index]: value for index, value in cells.items() if index in header}
            if clean(row.get("kingdom")) != "Plantae":
                continue
            output = {
                re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower(): clean(row.get(name))
                for name in wanted
            }
            output["canonical_name"] = canonical_name(row.get("scientificName"))
            output["source_dataset"] = (
                "SANBI alien taxa checklist 2025 v20250520 "
                "(doi:10.5281/zenodo.14937470)"
            )
            yield output

    write_csv(PROCESSED / "sanbi_alien_plants_2025.csv", fields, rows())


def merge_bodatsa_rows(rows: list[dict[str, str]]) -> dict[str, str]:
    first = dict(rows[0])
    first["occurrence_count"] = str(
        sum(int(row["occurrence_count"]) for row in rows)
    )
    first["georeferenced_count"] = str(
        sum(int(row["georeferenced_count"]) for row in rows)
    )
    early = [int(row["earliest_year"]) for row in rows if row.get("earliest_year")]
    late = [int(row["latest_year"]) for row in rows if row.get("latest_year")]
    first["earliest_year"] = str(min(early)) if early else ""
    first["latest_year"] = str(max(late)) if late else ""
    return first


def read_processed(name: str) -> list[dict[str, str]]:
    with (PROCESSED / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def build_seed_catalog() -> None:
    sanpc = read_processed("sanpc_western_cape_accepted_taxa.csv")
    bodatsa_grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in read_processed("bodatsa_western_cape_species_summary.csv"):
        bodatsa_grouped[row["canonical_name"]].append(row)
    bodatsa = {
        name: merge_bodatsa_rows(rows) for name, rows in bodatsa_grouped.items()
    }
    traits = {
        row["canonical_name"]: row
        for row in read_processed("bioscape_gcfr_species_traits.csv")
    }
    canopy = {
        row["canonical_name"]: row
        for row in read_processed("bioscape_gcfr_canopy_summary.csv")
    }
    alien_grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in read_processed("sanbi_alien_plants_2025.csv"):
        alien_grouped[row["canonical_name"]].append(row)

    fields = [
        "sanpc_taxon_id",
        "scientific_name",
        "family",
        "taxon_rank",
        "provinces",
        "sanpc_establishment_means",
        "bodatsa_occurrence_count",
        "bodatsa_georeferenced_count",
        "earliest_record_year",
        "latest_record_year",
        "max_height_cm",
        "growth_forms",
        "lifecycle",
        "evergreen",
        "deciduous",
        "flower_begin",
        "flower_end",
        "succulent",
        "flammability",
        "canopy_measurement_count",
        "median_canopy_axis_1_cm",
        "median_canopy_axis_2_cm",
        "alien_checklist_match",
        "alien_is_native_values",
        "alien_regulatory_listings",
        "legal_review_required",
        "source_note",
    ]
    rows = []
    for taxon in sanpc:
        name = taxon["canonical_name"]
        if taxon.get("establishment_means") not in {"native", "nativeEndemic"}:
            continue
        occurrence = bodatsa.get(name)
        trait = traits.get(name)
        if occurrence is None or trait is None:
            continue
        canopy_row = canopy.get(name, {})
        alien_rows = alien_grouped.get(name, [])
        regulatory = sorted(
            {
                row["regulatory_listing"]
                for row in alien_rows
                if row.get("regulatory_listing")
            }
        )
        native_values = sorted(
            {row["is_native"] for row in alien_rows if row.get("is_native")}
        )
        review_required = any(
            value not in {"Not.listed", "Not.listed:was.listed"}
            for value in regulatory
        )
        rows.append(
            {
                "sanpc_taxon_id": taxon["taxon_id"],
                "scientific_name": taxon["scientific_name"],
                "family": taxon["family"],
                "taxon_rank": taxon["taxon_rank"],
                "provinces": taxon["provinces"],
                "sanpc_establishment_means": taxon["establishment_means"],
                "bodatsa_occurrence_count": occurrence["occurrence_count"],
                "bodatsa_georeferenced_count": occurrence["georeferenced_count"],
                "earliest_record_year": occurrence["earliest_year"],
                "latest_record_year": occurrence["latest_year"],
                "max_height_cm": trait["max_height_cm"],
                "growth_forms": trait["growth_forms"],
                "lifecycle": trait["lifecycle"],
                "evergreen": trait["evergreen"],
                "deciduous": trait["deciduous"],
                "flower_begin": trait["flower_begin"],
                "flower_end": trait["flower_end"],
                "succulent": trait["succulent"],
                "flammability": trait["flammability"],
                "canopy_measurement_count": canopy_row.get(
                    "measurement_count", ""
                ),
                "median_canopy_axis_1_cm": canopy_row.get(
                    "median_canopy_axis_1_cm", ""
                ),
                "median_canopy_axis_2_cm": canopy_row.get(
                    "median_canopy_axis_2_cm", ""
                ),
                "alien_checklist_match": "1" if alien_rows else "0",
                "alien_is_native_values": "|".join(native_values),
                "alien_regulatory_listings": "|".join(regulatory),
                "legal_review_required": "1" if review_required else "0",
                "source_note": (
                    "Exact canonical-name join across SANPC, BODATSA and BioSCape; "
                    "review taxonomic matches before production use"
                ),
            }
        )
    rows.sort(
        key=lambda row: (-int(row["bodatsa_occurrence_count"]), row["scientific_name"])
    )
    write_csv(PROCESSED / "garden_app_seed_catalog.csv", fields, rows)


def build_vegetation_type_index() -> None:
    source = RAW / "spatial" / "western-cape-vegetation-map-2018.geojson"
    with source.open(encoding="utf-8") as handle:
        collection = json.load(handle)
    grouped: dict[tuple[str, str, str, str, str], int] = defaultdict(int)
    for feature in collection["features"]:
        properties = feature.get("properties", {})
        key = (
            clean(properties.get("Name_18")),
            clean(properties.get("MAPCODE18")),
            clean(properties.get("BIOME_18")),
            clean(properties.get("BIOREGION_")),
            clean(properties.get("SUBTYPNM_1")),
        )
        grouped[key] += 1
    fields = [
        "vegetation_name_2018",
        "map_code_2018",
        "biome_2018",
        "bioregion_2018",
        "subtype_name_2018",
        "polygon_count",
        "source_dataset",
    ]
    rows = [
        {
            "vegetation_name_2018": key[0],
            "map_code_2018": key[1],
            "biome_2018": key[2],
            "bioregion_2018": key[3],
            "subtype_name_2018": key[4],
            "polygon_count": count,
            "source_dataset": "SANBI National Vegetation Map 2018 - Western Cape clip",
        }
        for key, count in grouped.items()
    ]
    rows.sort(key=lambda row: (row["biome_2018"], row["vegetation_name_2018"]))
    write_csv(PROCESSED / "western_cape_vegetation_types_2018.csv", fields, rows)


def write_checksums() -> None:
    files = sorted(path for path in RAW.rglob("*") if path.is_file())
    destination = ROOT / "data" / "checksums.sha256"
    with destination.open("w", encoding="utf-8", newline="\n") as handle:
        for path in files:
            digest = hashlib.sha256()
            with path.open("rb") as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(chunk)
            relative = path.relative_to(ROOT).as_posix()
            handle.write(f"{digest.hexdigest()}  {relative}\n")
    print(f"Wrote {destination.relative_to(ROOT)} ({len(files):,} files)")


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    build_sanpc()
    build_bodatsa()
    build_bioscape_species_traits()
    build_bioscape_canopy_summary()
    build_alien_plants()
    build_seed_catalog()
    build_vegetation_type_index()
    write_checksums()


if __name__ == "__main__":
    main()
