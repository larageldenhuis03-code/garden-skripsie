#!/usr/bin/env python3
"""Download the SANBI 2018 vegetation map clip for the Western Cape as GeoJSON."""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


LAYER_URL = (
    "https://gis.westerncape.gov.za/server2/rest/services/"
    "SpatialDataWarehouse/Conservation/MapServer/20/query"
)
OUT_FIELDS = [
    "OBJECTID",
    "Name_18",
    "MAPCODE18",
    "BIOME_18",
    "BIOMEID_18",
    "BIOREGION_",
    "BRGNID_18",
    "SUBTYPNM_1",
    "MCDSUBTYPE",
    "CNSRV_TRGT",
    "Shape_Area",
    "Shape_Length",
]


def request_json(params: dict[str, object], attempts: int = 4) -> dict:
    url = f"{LAYER_URL}?{urllib.parse.urlencode(params)}"
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/spatial/western-cape-vegetation-map-2018.geojson"),
    )
    parser.add_argument("--page-size", type=int, default=1_000)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if args.output.exists() and args.output.stat().st_size > 0 and not args.force:
        print(f"Already present: {args.output}")
        return

    count = request_json({"where": "1=1", "returnCountOnly": "true", "f": "json"})[
        "count"
    ]
    features: list[dict] = []
    for offset in range(0, count, args.page_size):
        page = request_json(
            {
                "where": "1=1",
                "outFields": ",".join(OUT_FIELDS),
                "returnGeometry": "true",
                "outSR": "4326",
                "orderByFields": "OBJECTID",
                "resultOffset": offset,
                "resultRecordCount": args.page_size,
                "f": "geojson",
            }
        )
        features.extend(page.get("features", []))
        print(f"Downloaded {len(features):,}/{count:,} vegetation polygons")

    if len(features) != count:
        raise RuntimeError(f"Expected {count} features, received {len(features)}")

    output = {
        "type": "FeatureCollection",
        "name": "SANBI National Vegetation Map 2018 - Western Cape clip",
        "source": (
            "Western Cape Government ArcGIS layer 20; source/copyright SANBI; "
            "publication year 2018"
        ),
        "source_url": (
            "https://gis.westerncape.gov.za/server2/rest/services/"
            "SpatialDataWarehouse/Conservation/MapServer/20"
        ),
        "features": features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {args.output} ({len(features):,} features)")


if __name__ == "__main__":
    main()
