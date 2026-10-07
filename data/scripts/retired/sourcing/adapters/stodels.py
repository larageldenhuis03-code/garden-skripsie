"""Adapter for stodels.com.

UNVERIFIED against the live DOM: stodels.com sits behind bot-management
(its robots.txt references Cloudflare's Managed Content Signal and returns
403 to non-browser fetches, including the ones used to research this
adapter), so the HTML selectors below could not be confirmed against the
real page. This tries the same Shopify products.json approach that
verified cleanly for capegardencentre.py first (many small SA plant
retailers run on Shopify), then falls back to a best-effort HTML scan of
common product-card patterns. `scrape.py` logs a warning when a source
yields zero rows - the expected signal that this adapter needs a real fix
once someone can inspect stodels.com's actual markup from a connection it
doesn't block.
"""

from __future__ import annotations

import re
from typing import Callable

from bs4 import BeautifulSoup

from adapters.shopify import parse_products_json
from pdf_adapter import RawListing

PRODUCT_URL_BASE = "https://www.stodels.com/products/"

PRICE_RE = re.compile(r"R\s?([\d,]+(?:\.\d{2})?)")
POT_SIZE_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:L|ml)\b", re.IGNORECASE)

# Common Shopify/WooCommerce theme class names, tried in order until one
# yields at least one card. Update this list once the real markup is known.
CARD_SELECTORS = [
    ".product-card",
    ".product-item",
    ".grid__item",
    "li.product",
    ".product-grid-item",
]
TITLE_SELECTORS = ["h3", "h2", ".product-card__title", ".product-title", "a"]


def _parse_html(body: bytes, url: str) -> list[RawListing]:
    soup = BeautifulSoup(body, "html.parser")
    cards: list = []
    for selector in CARD_SELECTORS:
        cards = soup.select(selector)
        if cards:
            break

    listings: list[RawListing] = []
    for card in cards:
        title_el = None
        for selector in TITLE_SELECTORS:
            title_el = card.select_one(selector)
            if title_el and title_el.get_text(strip=True):
                break
        if not title_el:
            continue
        title = title_el.get_text(strip=True)

        text = card.get_text(" ", strip=True)
        prices = [float(p.replace(",", "")) for p in PRICE_RE.findall(text)]
        price_low = min(prices) if prices else None
        price_high = max(prices) if prices else None

        pot_size_match = POT_SIZE_RE.search(text)
        pot_size = pot_size_match.group(0) if pot_size_match else None

        link = card.select_one("a[href]")
        href = link.get("href", "") if link else ""
        source_url = (
            f"https://www.stodels.com{href}" if href.startswith("/") else (href or url)
        )

        listings.append(
            RawListing(
                raw_text=title,
                price_low=price_low,
                price_high=price_high,
                pot_size=pot_size,
                source_url=source_url,
            )
        )

    return listings


def parse(
    content: bytes, url: str, fetch_more: Callable[[str], "bytes | None"]
) -> list[RawListing]:
    json_result = parse_products_json(
        content, url, fetch_more, product_url_base=PRODUCT_URL_BASE
    )
    if json_result is not None:
        return json_result
    return _parse_html(content, url)
