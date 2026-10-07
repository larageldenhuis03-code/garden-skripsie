#!/usr/bin/env python3
"""Download every named Western Cape area used by the location picker, from
four government GIS layers, and normalize them into one GeoJSON with a
common {name, category} shape (plus geometry).

Sources:
- Communities Area (ndagis.nda.agric.za, Western_Cape/MapServer layer 16):
  862 named towns, suburbs and rural settlements. Category "Urban"/"Rural".
  Good province-wide coverage, but aggregates most of the Cape Town metro
  into a handful of broad blobs ("Cape Central", "Cape Town South") rather
  than naming individual suburbs.
- Official Planning Suburbs, Feb 2019 (gis.westerncape.gov.za,
  SpatialDataWarehouse/CoCT_Management_Boundaries/MapServer layer 23): 776
  City of Cape Town suburb boundaries (Rondebosch, Claremont, ...) - fills
  exactly the gap the Communities layer leaves in the metro. Category
  "Suburb". Native projection is UTM Zone 34S; requested here reprojected
  to WGS84 (outSR=4326).
- Local Municipalities (ndagis.nda.agric.za layer 41): 25 municipality
  boundaries (Cederberg, Stellenbosch, ...). Category "Municipality".
- District Municipalities (ndagis.nda.agric.za layer 37): 6 district
  boundaries (West Coast, Cape Winelands, ...). Category "District".

Run with the working directory at the repo root:
    python data/scripts/download_western_cape_places.py
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Source:
    key: str
    query_url: str
    name_field: str
    # Either a fixed category string, or another field to read the
    # category from per-feature (Communities Area has Urban vs Rural).
    category: str | None
    category_field: str | None
    label: str


SOURCES = [
    Source(
        key="communities",
        query_url="https://ndagis.nda.agric.za/arcgis/rest/services/Western_Cape/MapServer/16/query",
        name_field="UserName",
        category=None,
        category_field="Category",
        label="Communities Area (towns, suburbs, rural settlements)",
    ),
    Source(
        key="coct_suburbs",
        query_url=(
            "https://gis.westerncape.gov.za/server2/rest/services/"
            "SpatialDataWarehouse/CoCT_Management_Boundaries/MapServer/23/query"
        ),
        name_field="OFC_SBRB_N",
        category="Suburb",
        category_field=None,
        label="City of Cape Town Official Planning Suburbs (Feb 2019)",
    ),
    Source(
        key="local_municipalities",
        query_url="https://ndagis.nda.agric.za/arcgis/rest/services/Western_Cape/MapServer/41/query",
        name_field="ADM3_EN",
        category="Municipality",
        category_field=None,
        label="Local Municipalities",
    ),
    Source(
        key="district_municipalities",
        query_url="https://ndagis.nda.agric.za/arcgis/rest/services/Western_Cape/MapServer/37/query",
        name_field="ADM2_EN",
        category="District",
        category_field=None,
        label="District Municipalities",
    ),
]


def request_json(query_url: str, params: dict[str, object], attempts: int = 4) -> dict:
    url = f"{query_url}?{urllib.parse.urlencode(params)}"
    error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "garden-app-data-loader/1.0"}
            )
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.load(response)
            if "error" in payload:
                raise RuntimeError(payload["error"])
            return payload
        except Exception as exc:  # pragma: no cover - network retry path
            error = exc
            if attempt + 1 < attempts:
                time.sleep(2**attempt)
    raise RuntimeError(f"ArcGIS request failed after {attempts} attempts") from error


def download_source(source: Source, page_size: int) -> list[dict]:
    out_fields = [source.name_field] + (
        [source.category_field] if source.category_field else []
    )
    count = request_json(
        source.query_url, {"where": "1=1", "returnCountOnly": "true", "f": "json"}
    )["count"]

    raw_features: list[dict] = []
    for offset in range(0, count, page_size):
        page = request_json(
            source.query_url,
            {
                "where": "1=1",
                "outFields": ",".join(out_fields),
                "returnGeometry": "true",
                "outSR": "4326",
                "resultOffset": offset,
                "resultRecordCount": page_size,
                "f": "geojson",
            },
        )
        raw_features.extend(page.get("features", []))
        print(f"  {source.key}: {len(raw_features):,}/{count:,}")

    if len(raw_features) != count:
        raise RuntimeError(
            f"{source.key}: expected {count} features, received {len(raw_features)}"
        )

    features = []
    for feature in raw_features:
        properties = feature["properties"]
        name = properties.get(source.name_field)
        category = (
            source.category
            if source.category is not None
            else properties.get(source.category_field)
        )
        if not name or not category:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": feature["geometry"],
                "properties": {
                    "name": name,
                    "category": category,
                    "source": source.key,
                },
            }
        )
    return features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/spatial/western-cape-places-2018.geojson"),
    )
    parser.add_argument("--page-size", type=int, default=1_000)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output.exists() and args.output.stat().st_size > 0 and not args.force:
        print(f"Already present: {args.output}")
        return

    all_features: list[dict] = []
    for source in SOURCES:
        print(f"Downloading {source.label}...")
        all_features.extend(download_source(source, args.page_size))

    output = {
        "type": "FeatureCollection",
        "name": "Western Cape named areas (settlements, suburbs, municipalities, districts)",
        "sources": [
            {"key": s.key, "label": s.label, "query_url": s.query_url} for s in SOURCES
        ],
        "features": all_features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {args.output} ({len(all_features):,} features)")


if __name__ == "__main__":
    main()
