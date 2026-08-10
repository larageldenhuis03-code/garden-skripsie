"""Convert data/processed/south_africa_biome_regions.geojson (9 dissolved
biome shapes, produced by build_bioscape_traits.R) into a small SVG path
per biome for the clickable map UI.

Run with the working directory at the repo root:
    python data/scripts/generate_biome_map_svg.py

Why this trims polygon parts: dissolving the source vegetation map by
biome collapses ~48,700 fine-grained polygons down to 9 shapes, but some
biomes (Forest especially - real, scattered indigenous forest patches
along the coast, not a rendering artifact) are still made of thousands of
disconnected pieces. For a flat, click-to-select map (not a cartographic
tool), each biome keeps only its largest pieces - enough to cover 90% of
its real area, capped at 150 pieces - and drops the rest as visually
insignificant slivers.

No geospatial library is used (none is installed) - just plain-Python
shoelace-formula areas and an equirectangular projection with a
cosine-latitude correction, which is more than accurate enough at this
simplification level.
"""

import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_GEOJSON = REPO_ROOT / "data" / "processed" / "south_africa_biome_regions.geojson"
OUTPUT_JSON = REPO_ROOT / "app" / "data" / "biome_map.generated.json"

# Approximate coordinates of each province's best-known major city, used
# only as an orientation label on the map (not a real boundary) - well-known
# public facts, not sourced from any project dataset.
PROVINCE_LABELS = [
    ("Western Cape", -33.9249, 18.4241),       # Cape Town
    ("Eastern Cape", -33.9608, 25.6022),       # Gqeberha
    ("Northern Cape", -28.7282, 24.7499),      # Kimberley
    ("Free State", -29.0852, 26.1596),         # Bloemfontein
    ("North West", -25.8560, 25.6403),         # Mahikeng
    ("Gauteng", -26.2041, 28.0473),            # Johannesburg
    ("Mpumalanga", -25.4753, 30.9694),         # Mbombela
    ("Limpopo", -23.9045, 29.4689),            # Polokwane
    ("KwaZulu-Natal", -29.8587, 31.0218),      # Durban
]

MAX_PARTS_PER_BIOME = 150
AREA_COVERAGE_TARGET = 0.90
VIEWBOX_WIDTH = 800
VIEWBOX_HEIGHT = 800
PADDING = 12
# Points closer together than this (in final SVG pixels) are indistinguishable
# on screen, so Douglas-Peucker simplification collapses them away. The
# source rings are absurdly dense (R's st_simplify didn't meaningfully
# reduce point count under its spherical geometry engine), so this pixel-
# space pass is where the real size reduction happens.
SIMPLIFY_TOLERANCE_PX = 1.2


def douglas_peucker(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Iterative Douglas-Peucker line simplification (recursive would blow
    Python's stack on rings with hundreds of thousands of points)."""
    if len(points) < 3:
        return points

    def perpendicular_distance(point, start, end) -> float:
        x, y = point
        x1, y1 = start
        x2, y2 = end
        if (x1, y1) == (x2, y2):
            return math.hypot(x - x1, y - y1)
        num = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1)
        den = math.hypot(y2 - y1, x2 - x1)
        return num / den

    keep = bytearray(len(points))
    keep[0] = keep[-1] = 1
    stack = [(0, len(points) - 1)]
    while stack:
        start_index, end_index = stack.pop()
        if end_index <= start_index + 1:
            continue
        start, end = points[start_index], points[end_index]
        max_distance = -1.0
        max_index = -1
        for i in range(start_index + 1, end_index):
            distance = perpendicular_distance(points[i], start, end)
            if distance > max_distance:
                max_distance = distance
                max_index = i
        if max_distance > tolerance:
            keep[max_index] = 1
            stack.append((start_index, max_index))
            stack.append((max_index, end_index))

    return [p for p, k in zip(points, keep) if k]


def ring_area(ring: list[list[float]]) -> float:
    """Shoelace formula in raw lon/lat coordinate space - not a real km^2
    value, but a consistent way to compare part sizes against each other."""
    area = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def significant_parts(polygons: list[list[list[list[float]]]]) -> list[list[list[float]]]:
    """Return each polygon's outer ring only (interior holes are dropped -
    acceptable at this simplification level), keeping the largest parts
    up to AREA_COVERAGE_TARGET or MAX_PARTS_PER_BIOME, whichever is
    smaller."""
    outer_rings = [polygon[0] for polygon in polygons]
    ranked = sorted(outer_rings, key=ring_area, reverse=True)
    total = sum(ring_area(ring) for ring in ranked)

    kept = []
    running = 0.0
    for ring in ranked:
        if len(kept) >= MAX_PARTS_PER_BIOME:
            break
        kept.append(ring)
        running += ring_area(ring)
        if total > 0 and running >= AREA_COVERAGE_TARGET * total:
            break
    return kept


def main() -> None:
    data = json.loads(SOURCE_GEOJSON.read_text(encoding="utf-8"))

    kept_by_biome: dict[str, list[list[list[float]]]] = {}
    all_points: list[list[float]] = []
    for feature in data["features"]:
        biome = feature["properties"]["biome"]
        kept = significant_parts(feature["geometry"]["coordinates"])
        kept_by_biome[biome] = kept
        for ring in kept:
            all_points.extend(ring)
    all_points.extend([lon, lat] for _, lat, lon in PROVINCE_LABELS)

    lons = [p[0] for p in all_points]
    lats = [p[1] for p in all_points]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    mean_lat_rad = math.radians((min_lat + max_lat) / 2)
    lat_correction = math.cos(mean_lat_rad)

    # Project to a flat x/y space (equirectangular + cosine-latitude
    # correction), then scale that projected bounding box to fill the
    # SVG viewBox with even padding on all sides.
    def project_raw(lon: float, lat: float) -> tuple[float, float]:
        return (lon - min_lon) * lat_correction, -(lat - min_lat)

    raw_points = [project_raw(lon, lat) for lon, lat in zip(lons, lats)]
    raw_xs = [p[0] for p in raw_points]
    raw_ys = [p[1] for p in raw_points]
    raw_width = max(raw_xs) - min(raw_xs)
    raw_height = max(raw_ys) - min(raw_ys)
    raw_min_x, raw_min_y = min(raw_xs), min(raw_ys)

    available_width = VIEWBOX_WIDTH - 2 * PADDING
    available_height = VIEWBOX_HEIGHT - 2 * PADDING
    scale = min(available_width / raw_width, available_height / raw_height)
    # Center the projected shape within the viewBox on the shorter axis.
    offset_x = PADDING + (available_width - raw_width * scale) / 2
    offset_y = PADDING + (available_height - raw_height * scale) / 2

    def project(lon: float, lat: float) -> tuple[float, float]:
        raw_x, raw_y = project_raw(lon, lat)
        return (
            round(offset_x + (raw_x - raw_min_x) * scale, 2),
            round(offset_y + (raw_y - raw_min_y) * scale, 2),
        )

    regions = []
    for biome, rings in kept_by_biome.items():
        subpaths = []
        raw_point_count = 0
        simplified_point_count = 0
        for ring in rings:
            points = [project(lon, lat) for lon, lat in ring]
            raw_point_count += len(points)
            simplified = douglas_peucker(points, SIMPLIFY_TOLERANCE_PX)
            if len(simplified) < 3:
                continue  # collapsed to a sliver too small to draw
            simplified_point_count += len(simplified)
            d = "M" + " L".join(f"{x},{y}" for x, y in simplified) + " Z"
            subpaths.append(d)
        regions.append({
            "biome": biome,
            "path": " ".join(subpaths),
            "parts": len(subpaths),
            "rawPoints": raw_point_count,
            "simplifiedPoints": simplified_point_count,
        })

    provinces = []
    for name, lat, lon in PROVINCE_LABELS:
        x, y = project(lon, lat)
        provinces.append({"name": name, "x": x, "y": y})

    output = {
        "viewBox": f"0 0 {VIEWBOX_WIDTH} {VIEWBOX_HEIGHT}",
        "regions": [
            {"biome": r["biome"], "path": r["path"], "parts": r["parts"]} for r in regions
        ],
        "provinceLabels": provinces,
    }
    # Compact, not pretty-printed: this file ships to the browser as-is.
    OUTPUT_JSON.write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")

    total_path_chars = sum(len(r["path"]) for r in regions)
    print(f"Wrote {len(regions)} biome region paths to {OUTPUT_JSON.relative_to(REPO_ROOT)}")
    for r in regions:
        print(
            f"  {r['biome']:28s} {r['parts']:4d} parts, "
            f"{r['rawPoints']:>8,} -> {r['simplifiedPoints']:>6,} points, "
            f"{len(r['path']):>8,} path chars"
        )
    print(f"Total path data: {total_path_chars:,} characters (~{total_path_chars / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
