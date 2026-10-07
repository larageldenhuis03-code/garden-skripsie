"""Adapter for capegardencentre.co.za - a Shopify store.

Verified against a live fetch of
https://www.capegardencentre.co.za/collections/plants/products.json: it
returns Shopify's standard public storefront JSON
(`{"products": [{title, handle, variants: [{title, price}, ...], ...}]}`),
paginated via `?page=N`, empty `products` array on the page past the end.
Reading this JSON endpoint directly is both more robust than parsing
rendered HTML (no markup to break) and lighter on the site than scraping
rendered category pages.
"""

from __future__ import annotations

from typing import Callable

from adapters.shopify import parse_products_json
from pdf_adapter import RawListing

PRODUCT_URL_BASE = "https://www.capegardencentre.co.za/products/"


def parse(
    content: bytes, url: str, fetch_more: Callable[[str], "bytes | None"]
) -> list[RawListing]:
    listings = parse_products_json(
        content, url, fetch_more, product_url_base=PRODUCT_URL_BASE
    )
    return listings or []
