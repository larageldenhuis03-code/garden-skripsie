"""Weekly nursery-sourcing scrape - run by .github/workflows/nursery-sourcing.yml,
never at request time (this app has no backend; it ships a static,
build-time plant catalogue to a Cloudflare Worker).

For every active source in sources.py: fetch its catalogue (respecting
robots.txt and a polite per-domain delay; PDFs use a conditional
ETag/Last-Modified/checksum cache so an unchanged PDF is never
re-downloaded or re-parsed), extract raw listings via the source's adapter,
normalise and match each one against the plant catalogue's lookup index
(built once - see matching.py), and write
data/processed/nursery_sourcing.csv.

A source that errors or extracts zero raw listings keeps its previous rows
from the existing CSV rather than blanking that nursery's data - a bad
scrape must never look like "this nursery stopped carrying anything".

Run with the working directory at the repo root:
    python data/scripts/sourcing/scrape.py
"""

from __future__ import annotations

import csv
import logging
import sys
import time
from pathlib import Path

SOURCING_DIR = Path(__file__).resolve().parent
if str(SOURCING_DIR) not in sys.path:
    sys.path.insert(0, str(SOURCING_DIR))

import cache  # noqa: E402
import matching  # noqa: E402
import pdf_adapter  # noqa: E402
from sources import SOURCES, NurserySource  # noqa: E402

REPO_ROOT = SOURCING_DIR.parents[2]
OUTPUT_CSV = REPO_ROOT / "data" / "processed" / "nursery_sourcing.csv"
PDF_CACHE_DIR = REPO_ROOT / "data" / "processed" / "nursery_cache"

FIELDS = [
    "scientific_name",
    "nursery",
    "matched_via",
    "confidence",
    "price_low",
    "price_high",
    "pot_size",
    "source_url",
    "last_updated",
]

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def _load_existing_rows() -> dict[str, list[dict[str, str]]]:
    if not OUTPUT_CSV.exists():
        return {}
    by_nursery: dict[str, list[dict[str, str]]] = {}
    with OUTPUT_CSV.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            by_nursery.setdefault(row["nursery"], []).append(row)
    return by_nursery


def _cached_pdf_rows_path(source_key: str) -> Path:
    return PDF_CACHE_DIR / f"{source_key}.extracted.txt"


def _load_cached_pdf_rows(source_key: str) -> list[str]:
    path = _cached_pdf_rows_path(source_key)
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def _save_cached_pdf_rows(source_key: str, rows: list[str]) -> None:
    PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _cached_pdf_rows_path(source_key).write_text(
        "\n".join(rows), encoding="utf-8"
    )


def _fetch_more(url: str) -> bytes | None:
    result = cache.fetch(None, url, use_conditional_cache=False)
    if result.error:
        logger.warning("  follow-up fetch failed for %s: %s", url, result.error)
        return None
    return result.content


def _extract_listings(
    source: NurserySource,
) -> list[pdf_adapter.RawListing] | None:
    """Returns None when the source should be skipped entirely this run
    (fetch error, or an unchanged PDF with no cached extraction to fall
    back on) - callers keep the previous rows for that nursery in that
    case."""
    url = source.urls[0]

    if source.format == "pdf":
        result = cache.fetch(source.key, url, use_conditional_cache=True)
        if result.error:
            logger.warning("[%s] fetch failed: %s", source.key, result.error)
            return None
        if not result.changed:
            cached = _load_cached_pdf_rows(source.key)
            logger.info(
                "[%s] PDF unchanged since last run - reusing %d cached row(s)",
                source.key,
                len(cached),
            )
            return [
                pdf_adapter.RawListing(text, None, None, None, url) for text in cached
            ]
        rows = pdf_adapter.extract_rows(result.content, url)
        _save_cached_pdf_rows(source.key, rows)
        return [pdf_adapter.RawListing(text, None, None, None, url) for text in rows]

    result = cache.fetch(source.key, url, use_conditional_cache=False)
    if result.error:
        logger.warning("[%s] fetch failed: %s", source.key, result.error)
        return None
    return source.parse(result.content, url, _fetch_more)


def _match_listings(
    source: NurserySource,
    listings: list[pdf_adapter.RawListing],
    index: matching.PlantIndex,
) -> list[dict[str, str]]:
    last_updated = cache.last_success_date(source.key) or time.strftime("%Y-%m-%d")
    rows: list[dict[str, str]] = []
    tier_counts = {"high": 0, "medium": 0, "low": 0}
    unmatched = 0

    for listing in listings:
        normalized = matching.normalize(listing.raw_text)
        result = matching.match(normalized, listing.raw_text, index)
        if result is None:
            unmatched += 1
            continue
        tier_counts[result.confidence] += 1
        rows.append(
            {
                "scientific_name": result.scientific_name,
                "nursery": source.display_name,
                "matched_via": result.matched_via,
                "confidence": result.confidence,
                "price_low": "" if listing.price_low is None else listing.price_low,
                "price_high": "" if listing.price_high is None else listing.price_high,
                "pot_size": listing.pot_size or "",
                "source_url": listing.source_url,
                "last_updated": last_updated,
            }
        )

    logger.info(
        "[%s] %d listing(s): %d high, %d medium, %d low (disambiguation-only), "
        "%d unmatched",
        source.key,
        len(listings),
        tier_counts["high"],
        tier_counts["medium"],
        tier_counts["low"],
        unmatched,
    )
    return rows


def main() -> None:
    existing_rows = _load_existing_rows()
    index = matching.build_index()

    final_rows: list[dict[str, str]] = []
    for source in SOURCES:
        if not source.active:
            continue

        listings = _extract_listings(source)
        if listings is None:
            final_rows.extend(existing_rows.get(source.display_name, []))
            continue
        if not listings:
            logger.warning(
                "[%s] extracted zero listings - keeping previous data for this "
                "nursery rather than blanking it",
                source.key,
            )
            final_rows.extend(existing_rows.get(source.display_name, []))
            continue

        final_rows.extend(_match_listings(source, listings, index))

    REPO_ROOT.joinpath("data", "processed").mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for row in final_rows:
            writer.writerow({field: row.get(field, "") for field in FIELDS})

    logger.info(
        "Wrote %d nursery-listing row(s) to %s",
        len(final_rows),
        OUTPUT_CSV.relative_to(REPO_ROOT),
    )


if __name__ == "__main__":
    main()
