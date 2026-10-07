"""Normalise nursery listing text and match it against the plant catalogue.

Tiered cascade, short-circuiting on the first tier that resolves to exactly
one species:
    1. scientific name (binomial)  -> confidence "high"
    2. common name                 -> confidence "medium"
    3. family (disambiguation only)-> confidence "low"

Tier 3 is NOT an independent full-catalogue family search - a bare family
name matches dozens of species on its own, so that would almost never
resolve safely. It only narrows an ambiguous tier-2 result (several species
sharing one common name); if the narrowed set is still not exactly one
species, or no family text is present, the listing gets no match at all.
Never guess: an unresolved listing is dropped, not attached to a guessed
species.

build_index() is meant to run ONCE per scrape run; match() then does a
handful of dict lookups per listing (sliding word-windows over the short
listing text) rather than scanning the ~2,800-species catalogue per
listing.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PLANT_CSV = REPO_ROOT / "data" / "processed" / "plant_database_western_cape.csv"

POT_SIZE_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:l|litre|litres|ml)\b", re.IGNORECASE)
CULTIVAR_RE = re.compile(r"['‘’][^'‘’]*['‘’]")
TRADE_SUFFIX_RE = re.compile(r"\s*[-–—]\s*[^-–—]*$|\s*\([^)]*\)\s*$")
WHITESPACE_RE = re.compile(r"\s+")

# A nursery listing carrying one of these words is explicitly telling us the
# product isn't one identified species (e.g. "Leucospermum (mixed)" is an
# assortment of whichever Leucospermum species the nursery has on hand).
# Common-name/family matching must not paper over that with a confident
# single-species guess, even when the common name happens to resolve
# uniquely in the catalogue - a bare genus name reads as "mixed" too, since
# it names a whole genus rather than one species. Tier 1 (an exact
# scientific binomial) is unaffected: naming the actual species overrides
# an unrelated "mixed" elsewhere in the listing (e.g. "mixed colours").
AMBIGUITY_MARKER_RE = re.compile(
    r"\b(mixed|assorted|assortment|various|selection|our choice)\b",
    re.IGNORECASE,
)

# Common names run at most this many words in the catalogue (checked at
# index-build time); scientific binomials are always exactly 2.
MAX_COMMON_NAME_WORDS = 4


def normalize(text: str) -> str:
    """lowercase, squish whitespace, strip pot sizes / cultivar quotes / a
    single trailing trade or marketing suffix (after a dash, or in
    parentheses)."""
    value = text.strip().lower()
    value = POT_SIZE_RE.sub(" ", value)
    value = CULTIVAR_RE.sub(" ", value)
    value = TRADE_SUFFIX_RE.sub("", value)
    value = WHITESPACE_RE.sub(" ", value).strip()
    return value


def _binomial(scientific_name: str) -> str:
    """First two whitespace tokens of a scientific name, lowercased - the
    genus+species binomial, ignoring authorship/subsp./var. suffixes."""
    tokens = scientific_name.strip().split()
    return " ".join(tokens[:2]).lower()


def _word_windows(text: str, max_words: int) -> list[str]:
    """Every contiguous word window of length 1..max_words in `text`, in a
    fixed order (unused directly, but keeps output deterministic)."""
    words = text.split(" ")
    windows = []
    for size in range(1, max_words + 1):
        for start in range(0, len(words) - size + 1):
            windows.append(" ".join(words[start : start + size]))
    return windows


@dataclass
class PlantIndex:
    by_scientific_name: dict[str, str] = field(default_factory=dict)
    by_common_name: dict[str, list[str]] = field(default_factory=dict)
    species_to_family: dict[str, str] = field(default_factory=dict)
    max_common_name_words: int = 1


@dataclass
class MatchResult:
    scientific_name: str
    matched_via: str  # "scientific" | "common" | "family"
    confidence: str  # "high" | "medium" | "low"


def build_index(rows: list[dict[str, str]] | None = None) -> PlantIndex:
    """Build the lookup dicts ONCE per run from
    plant_database_western_cape.csv - callers should build this a single
    time and pass it into match() for every listing, not rescan the CSV."""
    if rows is None:
        with PLANT_CSV.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))

    index = PlantIndex()
    max_common_words = 1
    for row in rows:
        scientific_name = row.get("scientific_name", "").strip()
        if not scientific_name:
            continue
        index.by_scientific_name[_binomial(scientific_name)] = scientific_name

        family = (row.get("family") or "").strip()
        if family and family.upper() != "NA":
            index.species_to_family[scientific_name] = family.lower()

        common_name = (row.get("common_name") or "").strip()
        if common_name and common_name.upper() != "NA":
            key = common_name.lower()
            word_count = len(key.split())
            if word_count <= MAX_COMMON_NAME_WORDS:
                index.by_common_name.setdefault(key, []).append(scientific_name)
                max_common_words = max(max_common_words, word_count)

    index.max_common_name_words = max_common_words
    return index


def match(normalized_text: str, raw_text: str, index: PlantIndex) -> MatchResult | None:
    """Match a single normalised listing against a pre-built PlantIndex.
    `raw_text` (pre-normalisation) is used only for the family-tier scan,
    since normalize() strips the parenthetical/trailing text that would
    carry a family name."""
    for window in _word_windows(normalized_text, 2):
        scientific_name = index.by_scientific_name.get(window)
        if scientific_name:
            return MatchResult(scientific_name, "scientific", "high")

    if AMBIGUITY_MARKER_RE.search(raw_text):
        return None

    candidates: list[str] | None = None
    for window in _word_windows(normalized_text, index.max_common_name_words):
        species = index.by_common_name.get(window)
        if species:
            candidates = species
            break

    if candidates is None:
        return None
    if len(candidates) == 1:
        return MatchResult(candidates[0], "common", "medium")

    lowered_raw = raw_text.lower()
    narrowed = sorted(
        {
            name
            for name in candidates
            if index.species_to_family.get(name)
            and index.species_to_family[name] in lowered_raw
        }
    )
    if len(narrowed) == 1:
        return MatchResult(narrowed[0], "family", "low")

    return None
