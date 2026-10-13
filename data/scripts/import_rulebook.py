"""Import Algorithm_rulebook.xlsx into the engine's rule file.

Algorithm_rulebook.xlsx is the single source of every number the layout
engine uses (its 0_README says so). This script reads the tabs the engine
consumes, validates them, and writes

    app/data/engine_rules.generated.json

which the TypeScript engine imports. The app never reads the workbook at
runtime. Run automatically by data/scripts/sync_dataset.mjs whenever the
workbook changes, or by hand:

    python data/scripts/import_rulebook.py [path/to/Algorithm_rulebook.xlsx]

Validation is strict on purpose: a missing parameter, a non-number where a
number belongs, tier shares that do not sum to 1, or goal weights that do
not sum to 1 stop the build rather than ship a silently wrong engine.

Only the tabs the engine executes are read (1_Parameters, 2_Style_Rules,
4_Stage1_Score). The narrative tabs (rule library, species reference,
reviews, definitions, hand check) are documentation; the hand check is
reproduced as a unit test instead.
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WORKBOOK = REPO_ROOT.parent / "Algorithm_rulebook.xlsx"
OUTPUT_JSON = REPO_ROOT / "app" / "data" / "engine_rules.generated.json"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}


class RulebookError(Exception):
    pass


# --------------------------------------------------------------------------
# xlsx reading (stdlib only, like every other pipeline script)
# --------------------------------------------------------------------------

def column_letters(ref: str) -> str:
    return re.match(r"[A-Z]+", ref).group(0)


def row_number(ref: str) -> int:
    return int(re.search(r"\d+", ref).group(0))


def read_sheets(path: Path) -> dict[str, dict[int, dict[str, str]]]:
    """{sheet name: {row number: {column letters: text}}}"""
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(n.text or "" for n in item.iter(f"{{{MAIN_NS}}}t")))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.get("Id"): rel.get("Target") for rel in rels}

        sheets: dict[str, dict[int, dict[str, str]]] = {}
        for sheet in workbook.find("m:sheets", NS):
            target = targets[sheet.get(f"{{{REL_NS}}}id")].lstrip("/")
            member = target if target.startswith("xl/") else f"xl/{target}"
            root = ET.fromstring(archive.read(member))
            rows: dict[int, dict[str, str]] = {}
            for row in root.iter(f"{{{MAIN_NS}}}row"):
                for cell in row.findall("m:c", NS):
                    ref = cell.get("r")
                    kind = cell.get("t")
                    node = cell.find("m:v", NS)
                    if kind == "inlineStr":
                        value = "".join(n.text or "" for n in cell.iter(f"{{{MAIN_NS}}}t"))
                    elif node is None:
                        value = ""
                    elif kind == "s":
                        value = shared[int(node.text or "0")]
                    else:
                        value = node.text or ""
                    value = value.strip()
                    if value:
                        rows.setdefault(row_number(ref), {})[column_letters(ref)] = value
            sheets[sheet.get("name")] = rows
        return sheets


def sheet(sheets, name: str):
    if name not in sheets:
        raise RulebookError(f"tab '{name}' is missing from the rulebook")
    return sheets[name]


def as_number(value: str, where: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        raise RulebookError(f"{where}: expected a number, found '{value}'") from None


def as_int_list(value: str, where: str) -> list[int]:
    try:
        return [int(part) for part in re.split(r"\s*,\s*", value.strip()) if part]
    except ValueError:
        raise RulebookError(f"{where}: expected a comma-separated list of whole numbers, found '{value}'") from None


# --------------------------------------------------------------------------
# 1_Parameters
# --------------------------------------------------------------------------

def read_parameters(sheets) -> dict[str, dict]:
    """symbol -> {value, status, row}; first occurrence wins."""
    rows = sheet(sheets, "1_Parameters")
    params: dict[str, dict] = {}
    for number in sorted(rows):
        row = rows[number]
        symbol, value = row.get("A"), row.get("C")
        if not symbol or value is None or number <= 4:
            continue
        params.setdefault(symbol, {"value": value, "status": row.get("F", ""), "row": number})
    return params


def current(params, symbol: str) -> str:
    """The live row for a parameter: "<symbol> (revised)" when the
    rulebook has superseded the original row, else the original."""
    revised = f"{symbol} (revised)"
    return revised if revised in params else symbol


def param(params, symbol: str) -> str:
    symbol = current(params, symbol)
    if symbol not in params:
        raise RulebookError(f"1_Parameters: parameter '{symbol}' is missing")
    return params[symbol]["value"]


def num_optional(params, symbol: str, default: float) -> float:
    """A parameter the workbook may legitimately drop: the default is used
    when it is absent or not a number."""
    live = current(params, symbol)
    if live not in params:
        return default
    try:
        return as_number(param(params, symbol), f"1_Parameters ({live})")
    except RulebookError:
        return default


def num(params, symbol: str) -> float:
    live = current(params, symbol)
    return as_number(param(params, symbol), f"1_Parameters row {params.get(live, {}).get('row', '?')} ({live})")


def parse_feature_threshold(text: str) -> dict:
    """ "height > 150 cm OR spread > 100 cm" -> {minHeightCm, minSpreadCm}. """
    height = re.search(r"height\s*>\s*([\d.]+)", text, re.I)
    spread = re.search(r"spread\s*>\s*([\d.]+)", text, re.I)
    if not height or not spread:
        raise RulebookError(f"1_Parameters feature_threshold: cannot read '{text}'")
    return {"minHeightCm": float(height.group(1)), "minSpreadCm": float(spread.group(1)), "text": text}


FEATURE_GROUPS = {
    # The feature list mixes species with groups. Each group maps to the
    # taxon test that implements it. Only these five group names exist in
    # the rulebook; anything else is read as a species or genus name.
    "cycads": {"families": ["Zamiaceae", "Cycadaceae"]},
    "palms": {"families": ["Arecaceae"]},
    "agaves": {"genera": ["Agave"]},
    "euphorbias": {"genera": ["Euphorbia"]},
    "climbing & bush roses": {"genera": ["Rosa"]},
}


def parse_feature_list(text: str) -> dict:
    species: list[str] = []
    genera: list[str] = []
    families: list[str] = []
    entries = [line.strip() for line in text.splitlines() if line.strip()]
    for entry in entries:
        group = FEATURE_GROUPS.get(entry.lower())
        if group:
            genera += group.get("genera", [])
            families += group.get("families", [])
            continue
        inner = re.search(r"\(([^)]+)\)", entry)
        name = (inner.group(1) if inner else entry).strip()
        if name.endswith("aceae") and " " not in name:
            families.append(name)
        elif " " in name:
            species.append(name)
        else:
            genera.append(name)
    return {"entries": entries, "species": species, "genera": genera, "families": families}


# --------------------------------------------------------------------------
# 2_Style_Rules
# --------------------------------------------------------------------------

STYLE_KEYS = {
    "fynbos": "fynbos",
    "mediterranean": "mediterranean",
    "cottage": "cottage",
    "generic": "generic",
}


def style_key(name: str) -> str:
    lowered = name.lower()
    for token, key in STYLE_KEYS.items():
        if lowered.startswith(token):
            return key
    raise RulebookError(f"2_Style_Rules: unknown style '{name}'")


def read_styles(sheets) -> dict[str, dict]:
    rows = sheet(sheets, "2_Style_Rules")
    header_row = next(n for n, r in rows.items() if r.get("A") == "style")
    styles: dict[str, dict] = {}
    for number in sorted(rows):
        if number <= header_row:
            continue
        row = rows[number]
        if not row.get("A") or "B" not in row or "D" not in row:
            continue
        key = style_key(row["A"])
        where = f"2_Style_Rules row {number} ({row['A']})"
        rule = row["B"]
        allowed = row.get("C", "")
        fit: dict = {"active": True, "plantTypes": None, "biomes": None}
        if rule.lower().startswith("biome"):
            fit["biomes"] = [rule.split("=", 1)[1].strip()]
        elif rule.lower().startswith("plant type"):
            fit["plantTypes"] = [t.strip().lower() for t in allowed.split(",") if t.strip()]
        elif rule.lower().startswith("no style"):
            fit["active"] = False
        else:
            raise RulebookError(f"{where}: unrecognised style_fit rule '{rule}'")

        style = {
            "label": row["A"],
            "fit": fit,
            "coverMin": as_number(row["D"], f"{where} cover_min"),
            "coverMax": as_number(row["E"], f"{where} cover_max"),
            "openMin": as_number(row["F"], f"{where} open_min"),
            "openMax": as_number(row["G"], f"{where} open_max"),
            "tau": {
                "tall": as_number(row["I"], f"{where} tau_tall"),
                "medium": as_number(row["J"], f"{where} tau_med"),
                "short": as_number(row["K"], f"{where} tau_short"),
            },
            "tMin": as_number(row["L"], f"{where} T_min"),
            "rMax": as_number(row["M"], f"{where} r_max"),
            "structMin": as_number(row["P"], f"{where} struct_min"),
            "status": row.get("N", ""),
        }
        if abs(sum(style["tau"].values()) - 1) > 1e-6:
            raise RulebookError(f"{where}: tier shares tau must sum to 1")
        if not 0 < style["coverMin"] <= style["coverMax"] <= 1:
            raise RulebookError(f"{where}: need 0 < cover_min <= cover_max <= 1")
        styles[key] = style
    missing = set(STYLE_KEYS.values()) - set(styles)
    if missing:
        raise RulebookError(f"2_Style_Rules: missing styles {sorted(missing)}")
    return styles


# --------------------------------------------------------------------------
# 4_Stage1_Score
# --------------------------------------------------------------------------

EXTRA_KEYS = {
    "low maintenance": "low-maintenance",
    "privacy": "privacy",
    "pollinators": "pollinators",
    "fragrance": "fragrance",
    "wildlife": "wildlife",
}


def read_stage1_tables(sheets) -> tuple[dict, dict]:
    rows = sheet(sheets, "4_Stage1_Score")
    schemes: dict[str, list[str]] = {}
    extras: dict[str, list[str]] = {}
    for number in sorted(rows):
        row = rows[number]
        label, value = row.get("A", ""), row.get("B", "")
        lowered = label.lower()
        if lowered in ("warm", "cool", "neutral") and value:
            schemes[lowered] = [c.strip().title() for c in value.split(",") if c.strip()]
        if lowered in EXTRA_KEYS and value:
            extras[EXTRA_KEYS[lowered]] = [t.strip() for t in re.split(r"\s+OR\s+", value) if t.strip()]
    if set(schemes) != {"warm", "cool", "neutral"}:
        raise RulebookError("4_Stage1_Score: colour schemes Warm, Cool and Neutral are required")
    if set(extras) != set(EXTRA_KEYS.values()):
        raise RulebookError("4_Stage1_Score: the extras tag map must list all five extras")
    return schemes, extras


# --------------------------------------------------------------------------
# assemble
# --------------------------------------------------------------------------

def random_draws(params) -> dict:
    """B1 (2026-09-30): the parameter was renamed random_tries_per_plant ->
    random_draws_per_plant, and the /4 that Stage 4 applied was removed at
    the same time. Both spellings are accepted so the workbook and the code
    can be updated in either order without a silent behaviour change:

      random_draws_per_plant   the count Stage 4 draws directly
      random_tries_per_plant   the old budget; a quarter of it was drawn,
                               so it is converted here

    Once the workbook uses the new name only, this can lose the fallback.
    """
    if current(params, "random_draws_per_plant") in params:
        value = int(num(params, "random_draws_per_plant"))
        return {"randomDrawsPerPlant": value, "randomDrawsSource": "random_draws_per_plant"}
    if current(params, "random_tries_per_plant") in params:
        legacy = int(num(params, "random_tries_per_plant"))
        return {
            "randomDrawsPerPlant": legacy // 4,
            "randomDrawsSource": f"random_tries_per_plant {legacy} / 4",
        }
    # Neither spelling is in the workbook. B1 (2026-09-30) settled the
    # value at 60, so the engine keeps running rather than failing the
    # whole import - but the source string says the cell is missing so it
    # shows up in the generated file and in any audit of it.
    return {"randomDrawsPerPlant": 60, "randomDrawsSource": "ABSENT from 1_Parameters - B1 default 60"}


def build(path: Path) -> dict:
    sheets = read_sheets(path)
    p = read_parameters(sheets)
    styles = read_styles(sheets)
    schemes, extras = read_stage1_tables(sheets)

    goal_weights = [num(p, f"w{i}") for i in range(1, 6)]
    if abs(sum(goal_weights) - 1) > 1e-6:
        raise RulebookError("1_Parameters: goal weights w1..w5 must sum to 1")

    bands = []
    for index in (1, 2, 3):
        bands.append({
            "maxAreaM2": num(p, f"band_{index}_max"),
            "sMin": int(num(p, f"S_min (bed-area band {index})")),
            "sMax": int(num(p, f"S_max (bed-area band {index})")),
        })
    group_sizes = [
        as_int_list(param(p, f"n_allowed (spread band {i})"), f"1_Parameters n_allowed (spread band {i})")
        for i in (1, 2, 3)
    ]

    depth = {}
    for layer in range(1, 8):
        raw = param(p, f"depth_L{layer}")
        try:
            depth[f"L{layer}"] = float(raw)
        except ValueError:
            depth[f"L{layer}"] = None  # "On the edge" / "None": no depth band

    # T0 is optional by decision A5 (2026-09-30): an empty or absent cell
    # means the engine derives it per run (T0 = 0.05 Z / ln 2, so a move 5%
    # worse is accepted about half the time at the start). A number here
    # overrides that formula for every bed, which is why the cell is meant
    # to stay empty - see docs/NOW.md.
    t0_symbol = current(p, "T0")
    if t0_symbol not in p:
        t0 = None
    else:
        try:
            t0 = float(param(p, "T0"))
        except ValueError:
            t0 = None  # "TO TUNE" or similar text: derive it

    return {
        "source": path.name,
        "stage1": {
            "weights": {
                "style": num(p, "w_style"),
                "colour": num(p, "w_colour"),
                "extras": num(p, "w_extras"),
                "saved": num(p, "b_saved"),
                "wind": num(p, "b_wind"),
                # No shade weight: the shade bonus is future work.
            },
            "windSiteFactor": {
                "none": num(p, "W_site (No wind)"),
                "protected": num(p, "W_site (Protected from wind)"),
                "affected": num(p, "W_site (Affected by wind)"),
            },
            "lowShrubMaxHeightCm": num(p, "h_lowshrub_max"),
            "colourSchemes": schemes,
            "extraTags": extras,
        },
        "styles": styles,
        "stage2": {
            "lambda": num(p, "lambda"),
            "goalWeights": goal_weights,
            "fMin": num(p, "F_min"),
            "cMin": num(p, "C_min"),
            "nMin": num(p, "N_min"),
            # H3b (2026-09-30). Optional until 1_Parameters carries them;
            # the engine falls back to the agreed 1/2/4 and 0.6.
            **(
                {
                    "singletonKByBand": [
                        num_optional(p, "k_singleton_band_1", 1),
                        num_optional(p, "k_singleton_band_2", 2),
                        num_optional(p, "k_singleton_band_3", 4),
                    ]
                }
                if current(p, "k_singleton_band_1") in p
                else {}
            ),
            **(
                {"minGroupedShare": num(p, "min_grouped_share")}
                if current(p, "min_grouped_share") in p
                else {}
            ),
            # H7 footprint cap (2026-10-05, 1_Parameters row 103). Optional
            # so an older workbook still imports; the engine treats an
            # absent value as "no cap" rather than inventing one.
            **(
                {"footprintCap": num(p, "footprint_cap (φ)")}
                if current(p, "footprint_cap (φ)") in p
                else {}
            ),
            "kHeadroom": num(p, "k_headroom"),
            "featureExemptH5": num(p, "feature_exempt_H5") == 1,
            "speciesBands": bands,
            "groupSizes": group_sizes,
            "featureList": parse_feature_list(param(p, "feature_list")),
            "featureThreshold": parse_feature_threshold(param(p, "feature_threshold")),
            "sizeVarMin": int(num(p, "size_var_min (D_min)")),
        },
        "failRule": {
            "placementFailLimit": int(num(p, "placement_fail_limit")),
            "retryCoverFactor": num(p, "retry_cover_factor"),
        },
        "stage3": {
            "t0": t0,
            "alpha": num(p, "alpha"),
            "iterations": int(num(p, "iterations")),
            "heightSwapTolerance": num(p, "height_swap_tolerance"),
        },
        "stage4": {
            "depth": depth,
            "depthTol": num(p, "depth_tol"),
            "rowPitchM": num(p, "row_pitch"),
            "placementRestarts": int(num(p, "placement_restarts")),
            **random_draws(p),
            "overlapDelta": num(p, "delta (canopy overlap)"),
            # D26: preference for a candidate spot touching a placed plant
            # (was +0.05 hard-coded in stage4.ts).
            "contactBonus": num(p, "contact_bonus"),
            "hedgeSpacingFormalCm": [num(p, "hedge_spacing_formal_min"), num(p, "hedge_spacing_formal_max")],
            "hedgeSpacingInformalCm": [num(p, "hedge_spacing_informal_min"), num(p, "hedge_spacing_informal_max")],
            "windbreakPorosity": {
                "min": num(p, "windbreak_porosity_min"),
                "max": num(p, "windbreak_porosity_max"),
                "target": num(p, "windbreak_porosity_target"),
            },
            "windbreakMinLengthRatio": num(p, "windbreak_min_length_ratio"),
            "windbreakPrefLengthRatio": num(p, "windbreak_pref_length_ratio"),
            "shelterDepthH": num(p, "shelter_depth_H"),
            "maxWindAngleDev": num(p, "max_wind_angle_dev"),
            "minGroupWindbreakRow": int(num(p, "min_group_windbreak_row")),
        },
        "status": {symbol: entry["status"] for symbol, entry in p.items()},
    }


def main() -> None:
    workbook = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WORKBOOK
    if not workbook.exists():
        sys.exit(f"Rulebook not found: {workbook}")
    try:
        rules = build(workbook)
    except RulebookError as error:
        sys.exit(f"Rulebook invalid - engine rules NOT updated.\n  {error}")
    OUTPUT_JSON.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote engine rules from {workbook.name} to {OUTPUT_JSON.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
