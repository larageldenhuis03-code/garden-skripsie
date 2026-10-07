"""Convert data/processed/western_cape_bioregions.geojson (dissolved
bioregion shapes, produced by build_bioscape_traits.R) into a small SVG
path per bioregion for the clickable map UI.

Run with the working directory at the repo root:
    python data/scripts/generate_western_cape_map_svg.py

Replaces the earlier national generate_biome_map_svg.py now that the app
is scoped back to the Western Cape only - same technique (plain-Python
shoelace-formula areas, equirectangular + cosine-latitude projection,
Douglas-Peucker simplification in screen-pixel space), applied to the
finer WC-only bioregion layer instead of the coarse national biome one.
"""

import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_GEOJSON = REPO_ROOT / "data" / "processed" / "western_cape_bioregions.geojson"
OUTLINE_GEOJSON = REPO_ROOT / "data" / "processed" / "western_cape_outline.geojson"
OUTPUT_JSON = REPO_ROOT / "app" / "data" / "bioregion_map.generated.json"

# Well-known Western Cape towns, used only as orientation labels on the
# map (not a real boundary) - public facts, not sourced from any project
# dataset. Provinces don't make sense as labels anymore now the map only
# shows one province.
TOWN_LABELS = [
    ("Cape Town", -33.9249, 18.4241),
    ("Stellenbosch", -33.9346, 18.8600),
    ("Worcester", -33.6464, 19.4485),
    ("Hermanus", -34.4187, 19.2345),
    ("Knysna", -34.0363, 23.0471),
    ("Clanwilliam", -32.1811, 18.8963),
]

MAX_PARTS_PER_REGION = 150
AREA_COVERAGE_TARGET = 0.90
VIEWBOX_WIDTH = 800
VIEWBOX_HEIGHT = 800
PADDING = 12
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
    up to AREA_COVERAGE_TARGET or MAX_PARTS_PER_REGION, whichever is
    smaller."""
    outer_rings = [polygon[0] for polygon in polygons]
    ranked = sorted(outer_rings, key=ring_area, reverse=True)
    total = sum(ring_area(ring) for ring in ranked)

    kept = []
    running = 0.0
    for ring in ranked:
        if len(kept) >= MAX_PARTS_PER_REGION:
            break
        kept.append(ring)
        running += ring_area(ring)
        if total > 0 and running >= AREA_COVERAGE_TARGET * total:
            break
    return kept


def main() -> None:
    data = json.loads(SOURCE_GEOJSON.read_text(encoding="utf-8"))

    def polygons_from_geometry(geometry: dict) -> list[list[list[list[float]]]]:
        # A dissolve can yield either a single Polygon or a MultiPolygon
        # depending on how many disjoint pieces that shape has.
        return (
            geometry["coordinates"]
            if geometry["type"] == "MultiPolygon"
            else [geometry["coordinates"]]
        )

    kept_by_region: dict[str, list[list[list[float]]]] = {}
    all_points: list[list[float]] = []
    for feature in data["features"]:
        bioregion = feature["properties"]["bioregion"]
        kept = significant_parts(polygons_from_geometry(feature["geometry"]))
        kept_by_region[bioregion] = kept
        for ring in kept:
            all_points.extend(ring)

    # Backdrop shape covering the whole Western Cape extent, including the
    # ~25% of the province with no bioregion classification at all (mostly
    # azonal/transformed land - wetlands, estuaries, urban areas, farmland).
    # Rendered underneath the bioregion colors so that real gap - and any
    # thin seams from simplifying each bioregion independently - reads as
    # "not classified" rather than looking like a rendering bug.
    outline_data = json.loads(OUTLINE_GEOJSON.read_text(encoding="utf-8"))
    outline_rings = significant_parts(
        polygons_from_geometry(outline_data["features"][0]["geometry"])
    )
    for ring in outline_rings:
        all_points.extend(ring)

    all_points.extend([lon, lat] for _, lat, lon in TOWN_LABELS)

    lons = [p[0] for p in all_points]
    lats = [p[1] for p in all_points]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    mean_lat_rad = math.radians((min_lat + max_lat) / 2)
    lat_correction = math.cos(mean_lat_rad)

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
    offset_x = PADDING + (available_width - raw_width * scale) / 2
    offset_y = PADDING + (available_height - raw_height * scale) / 2

    def project(lon: float, lat: float) -> tuple[float, float]:
        raw_x, raw_y = project_raw(lon, lat)
        return (
            round(offset_x + (raw_x - raw_min_x) * scale, 2),
            round(offset_y + (raw_y - raw_min_y) * scale, 2),
        )

    def build_path(rings: list[list[list[float]]]) -> dict:
        subpaths = []
        raw_point_count = 0
        simplified_point_count = 0
        for ring in rings:
            points = [project(lon, lat) for lon, lat in ring]
            raw_point_count += len(points)
            simplified = douglas_peucker(points, SIMPLIFY_TOLERANCE_PX)
            if len(simplified) < 3:
                continue
            simplified_point_count += len(simplified)
            d = "M" + " L".join(f"{x},{y}" for x, y in simplified) + " Z"
            subpaths.append(d)
        return {
            "path": " ".join(subpaths),
            "parts": len(subpaths),
            "rawPoints": raw_point_count,
            "simplifiedPoints": simplified_point_count,
        }

    regions = []
    for bioregion, rings in kept_by_region.items():
        regions.append({"bioregion": bioregion, **build_path(rings)})

    outline = build_path(outline_rings)

    towns = []
    for name, lat, lon in TOWN_LABELS:
        x, y = project(lon, lat)
        towns.append({"name": name, "x": x, "y": y})

    output = {
        "viewBox": f"0 0 {VIEWBOX_WIDTH} {VIEWBOX_HEIGHT}",
        "outline": outline["path"],
        "regions": [
            {"bioregion": r["bioregion"], "path": r["path"], "parts": r["parts"]} for r in regions
        ],
        "townLabels": towns,
    }
    OUTPUT_JSON.write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")

    total_path_chars = sum(len(r["path"]) for r in regions) + len(outline["path"])
    print(f"Wrote {len(regions)} bioregion paths + 1 outline backdrop to {OUTPUT_JSON.relative_to(REPO_ROOT)}")
    print(
        f"  {'(outline backdrop)':38s} {outline['parts']:4d} parts, "
        f"{outline['rawPoints']:>8,} -> {outline['simplifiedPoints']:>6,} points, "
        f"{len(outline['path']):>8,} path chars"
    )
    for r in regions:
        print(
            f"  {r['bioregion']:38s} {r['parts']:4d} parts, "
            f"{r['rawPoints']:>8,} -> {r['simplifiedPoints']:>6,} points, "
            f"{len(r['path']):>8,} path chars"
        )
    print(f"Total path data: {total_path_chars:,} characters (~{total_path_chars / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
