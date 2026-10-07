"""Shared PDF plant-list extraction for any source with format "pdf".

Nursery PDF plant lists are often multi-column, which breaks naive
`extract_text()` (it interleaves columns line-by-line). This instead reads
each page's words with their bounding boxes, groups words into lines by
their vertical position, and - when a page is wide enough to plausibly be
multi-column - splits each line's words into left/right column groups by an
x-coordinate gap, so each output row is one plant listing rather than a
scrambled cross-column mash.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import pdfplumber

logger = logging.getLogger(__name__)

# Below this many extracted rows, a PDF that should list dozens/hundreds of
# species is almost certainly a sign the layout broke extraction, not that
# the nursery genuinely has that few plants.
MIN_PLAUSIBLE_ROWS = 5

LINE_Y_TOLERANCE = 3.0
COLUMN_GAP_THRESHOLD = 40.0


@dataclass
class RawListing:
    raw_text: str
    price_low: float | None
    price_high: float | None
    pot_size: str | None
    source_url: str


def _group_lines(words: list[dict]) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for word in sorted(words, key=lambda w: (w["top"], w["x0"])):
        for line in lines:
            if abs(line[0]["top"] - word["top"]) <= LINE_Y_TOLERANCE:
                line.append(word)
                break
        else:
            lines.append([word])
    return lines


def _split_columns(line: list[dict]) -> list[list[dict]]:
    ordered = sorted(line, key=lambda w: w["x0"])
    columns: list[list[dict]] = [[ordered[0]]]
    for previous, current in zip(ordered, ordered[1:]):
        gap = current["x0"] - previous["x1"]
        if gap > COLUMN_GAP_THRESHOLD:
            columns.append([])
        columns[-1].append(current)
    return columns


def extract_rows(pdf_bytes: bytes, source_url: str) -> list[str]:
    """Return one raw text string per plant-list row, reading top-to-bottom
    within each detected column before moving to the next column - plain
    text, no price/pot-size parsing (that's format-specific and left to the
    caller, since price placement varies a lot between nursery PDFs)."""
    rows: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            if not words:
                continue
            lines = _group_lines(words)
            page_columns: dict[int, list[tuple[float, str]]] = {}
            for line in lines:
                for column_index, column_words in enumerate(_split_columns(line)):
                    text = " ".join(w["text"] for w in column_words).strip()
                    if text:
                        top = column_words[0]["top"]
                        page_columns.setdefault(column_index, []).append((top, text))
            for column_index in sorted(page_columns):
                for _top, text in sorted(page_columns[column_index]):
                    rows.append(text)

    if len(rows) < MIN_PLAUSIBLE_ROWS:
        logger.warning(
            "PDF at %s yielded only %d row(s) - implausibly few for a plant "
            "list; the multi-column layout may have broken extraction.",
            source_url,
            len(rows),
        )

    return rows
