"""Shared parsing for Shopify's public storefront products.json endpoint,
used by any nursery whose site runs on Shopify (verified for
capegardencentre.co.za; tried opportunistically for others before falling
back to HTML parsing - see stodels.py)."""

from __future__ import annotations

import json
import re
from typing import Callable

from pdf_adapter import RawListing

PAGE_RE = re.compile(r"([?&])page=\d+")


def next_page_url(url: str, page: int) -> str:
    if PAGE_RE.search(url):
        return PAGE_RE.sub(rf"\g<1>page={page}", url)
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}page={page}"


def parse_products_json(
    content: bytes,
    url: str,
    fetch_more: Callable[[str], "bytes | None"],
    *,
    product_url_base: str,
) -> list[RawListing] | None:
    """Returns None (not a list) when `content` isn't a Shopify products.json
    payload, so callers can fall back to another parsing strategy."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return None

    products = data.get("products")
    if products is None:
        return None

    listings: list[RawListing] = []
    page = 1
    while products:
        for product in products:
            title = (product.get("title") or "").strip()
            if not title:
                continue
            variants = product.get("variants") or [{}]
            priced = [
                (float(v["price"]), v.get("title"))
                for v in variants
                if v.get("price") not in (None, "")
            ]
            price_low = min((p for p, _ in priced), default=None)
            price_high = max((p for p, _ in priced), default=None)
            pot_size = next((size for p, size in priced if p == price_low), None)

            handle = product.get("handle", "")
            listings.append(
                RawListing(
                    raw_text=title,
                    price_low=price_low,
                    price_high=price_high,
                    pot_size=pot_size,
                    source_url=f"{product_url_base}{handle}" if handle else url,
                )
            )

        page += 1
        next_body = fetch_more(next_page_url(url, page))
        if not next_body:
            break
        try:
            products = json.loads(next_body).get("products", [])
        except json.JSONDecodeError:
            break

    return listings
