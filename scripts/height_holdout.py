"""Hold-out validation of the growth-form median as a height predictor.

Most spread values in the catalogue are imputed rather than measured, and a
smaller share of heights are too (425 by genus median, 221 by morph-group
median). This script asks how well the morph-group median would have done on
the heights we DO have a source for, which is the only honest way to put an
error bar on the imputed ones.

Method
------
Population: the 2,126 rows whose `height_source` is `original`.

Predictor: leave-one-out. For each sourced row i, predict its height as the
median of the OTHER sourced heights in the same group - never including row
i's own value, and never including an already-imputed height, which would
make the check circular.

Tolerance: the same factor band used for the data-error study (T7),
`predicted / actual` in [0.67, 1.5].

Reported: share within tolerance with a Wilson 95% interval (Wilson rather
than normal-approximation because per-group shares run close to 0 and 1),
median absolute error in cm, and median absolute percentage error.

Run: python scripts/height_holdout.py
"""

from __future__ import annotations

import csv
import math
from collections import defaultdict
from pathlib import Path

CSV = Path("data/processed/plant_database_western_cape.csv")

# The same band as the T7 size-error study, so the two are comparable.
TOL_LO = 0.67
TOL_HI = 1.5


def median(values: list[float]) -> float:
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    return ordered[mid] if n % 2 else (ordered[mid - 1] + ordered[mid]) / 2


def wilson(successes: int, n: int, z: float = 1.959963985) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def load() -> list[dict[str, str]]:
    with CSV.open(encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def evaluate(
    rows: list[dict[str, str]], group_field: str
) -> tuple[dict[str, dict[str, object]], dict[str, object]]:
    """Leave-one-out evaluation, grouped by `group_field`."""
    groups: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for row in rows:
        key = (row.get(group_field) or "").strip() or "(blank)"
        groups[key].append((row["scientific_name"], float(row["height_cm_original"])))

    per_group: dict[str, dict[str, object]] = {}
    all_hits = 0
    all_n = 0
    all_abs: list[float] = []
    all_pct: list[float] = []
    unpredictable = 0

    for key, members in sorted(groups.items()):
        heights = [h for _, h in members]
        if len(heights) < 2:
            # A group of one has nothing to predict from once its own value is
            # held out. Reported, never silently dropped.
            unpredictable += len(heights)
            per_group[key] = {"n": len(heights), "predictable": 0}
            continue

        hits = 0
        abs_errors: list[float] = []
        pct_errors: list[float] = []
        for _, actual in members:
            others = list(heights)
            others.remove(actual)
            predicted = median(others)
            if actual > 0 and TOL_LO <= predicted / actual <= TOL_HI:
                hits += 1
            abs_errors.append(abs(predicted - actual))
            pct_errors.append(abs(predicted - actual) / actual * 100)

        lo, hi = wilson(hits, len(members))
        per_group[key] = {
            "n": len(members),
            "predictable": len(members),
            "hits": hits,
            "share": hits / len(members),
            "ci": (lo, hi),
            "mae": median(abs_errors),
            "mape": median(pct_errors),
            "group_median": median(heights),
        }
        all_hits += hits
        all_n += len(members)
        all_abs.extend(abs_errors)
        all_pct.extend(pct_errors)

    lo, hi = wilson(all_hits, all_n)
    overall = {
        "n": all_n,
        "hits": all_hits,
        "share": all_hits / all_n if all_n else float("nan"),
        "ci": (lo, hi),
        "mae": median(all_abs) if all_abs else float("nan"),
        "mape": median(all_pct) if all_pct else float("nan"),
        "unpredictable": unpredictable,
        "groups": len([g for g in per_group.values() if g.get("predictable")]),
    }
    return per_group, overall


def genus_of(name: str) -> str:
    return name.strip().split(" ")[0] if name.strip() else "(blank)"


def main() -> None:
    rows = load()
    sourced = [
        row
        for row in rows
        if (row.get("height_source") or "").strip() == "original"
        and (row.get("height_cm_original") or "").strip()
        and float(row["height_cm_original"]) > 0
    ]
    print(f"Catalogue rows: {len(rows)}")
    print(f"Sourced heights evaluated: {len(sourced)}")
    print(f"Tolerance: predicted / actual in [{TOL_LO}, {TOL_HI}]")
    print()

    # Genus is added for context only: the pipeline imputes more heights by
    # genus median (425) than by morph-group median (221), so the comparison
    # says whether the group being validated is the better of the two.
    for label, field in (
        ("morph_group (growth form)", "morph_group"),
        ("plant type (raw PZA string)", "plant type"),
        ("genus", "__genus__"),
    ):
        working = sourced
        if field == "__genus__":
            working = [dict(row, __genus__=genus_of(row["scientific_name"])) for row in sourced]
            field = "__genus__"
        per_group, overall = evaluate(working, field)

        lo, hi = overall["ci"]
        print(f"=== {label} ===")
        print(
            f"  within tolerance: {overall['hits']}/{overall['n']} = "
            f"{overall['share'] * 100:.1f}%  (95% CI {lo * 100:.1f}-{hi * 100:.1f}%)"
        )
        print(f"  median absolute error: {overall['mae']:.0f} cm")
        print(f"  median absolute percentage error: {overall['mape']:.1f}%")
        print(f"  groups used: {overall['groups']}, rows with no prediction possible: {overall['unpredictable']}")
        print()

        if field == "morph_group":
            print("  Per growth form:")
            print(f"  {'group':<22}{'n':>6}{'within tol':>12}{'95% CI':>18}{'MAE cm':>9}{'MAPE':>8}{'median':>9}")
            for key, stats in sorted(
                per_group.items(),
                key=lambda item: -(item[1].get("n") or 0),
            ):
                if not stats.get("predictable"):
                    print(f"  {key:<22}{stats['n']:>6}{'n/a (single)':>12}")
                    continue
                glo, ghi = stats["ci"]
                print(
                    f"  {key:<22}{stats['n']:>6}{stats['share'] * 100:>11.1f}%"
                    f"{f'{glo * 100:.0f}-{ghi * 100:.0f}%':>18}"
                    f"{stats['mae']:>9.0f}{stats['mape']:>7.0f}%{stats['group_median']:>9.0f}"
                )
            print()


if __name__ == "__main__":
    main()
