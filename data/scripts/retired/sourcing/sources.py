"""Nursery source config. Add or remove a nursery here without touching
scrape.py, matching.py or generate_plants_json.py - each source just needs
a key, a display name, a format, one or more catalogue URLs, and a parse
function returning list[RawListing].

Only stodels and capegardencentre are `active` for now, per the "start
with the two e-commerce sites and get the pipeline working end-to-end"
instruction. The rest are listed inactive so adding one later is a config
edit plus one adapter file.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from adapters import capegardencentre, stodels


# parse(content, url, fetch_more) -> list[RawListing]. `fetch_more(url)`
# lets a paginated adapter (e.g. Shopify's products.json) request further
# pages itself - it reuses the same robots.txt/rate-limit path as the
# initial fetch, just without PDF-style conditional caching.
ParseFn = Callable[[bytes, str, Callable[[str], "bytes | None"]], list]


@dataclass(frozen=True)
class NurserySource:
    key: str
    display_name: str
    format: str  # "html" | "pdf"
    urls: tuple[str, ...]
    parse: ParseFn
    active: bool = True


SOURCES: list[NurserySource] = [
    NurserySource(
        # "plants" is a confirmed-working Shopify collection on this store
        # (it returns real product JSON), but it turned out to be a small,
        # general-nursery-supplies collection (herbs, bulb food, bedding
        # annuals) rather than an indigenous/fynbos range - none of its
        # ~4 products matched the Western Cape catalogue in a live test
        # run. Every other plausible handle guessed while building this
        # (proteas, fynbos, indigenous, garden-plants, outdoor-plants)
        # 404'd. Someone needs to browse stodels.com's actual navigation
        # for the right collection handle(s) and update this URL - see
        # docs/NOW.md's "Nursery sourcing" section.
        key="stodels",
        display_name="Stodels",
        format="html",
        urls=("https://www.stodels.com/collections/plants/products.json?limit=250&page=1",),
        parse=stodels.parse,
        active=True,
    ),
    NurserySource(
        # Verified live: this collection is real, populated, and
        # indigenous/fynbos-themed (Protea, Leucospermum, ... - confirmed by
        # inspecting sample product titles from a live fetch), unlike the
        # store's "plants" collection which returned a single houseplant.
        key="capegardencentre",
        display_name="Cape Garden Centre",
        format="html",
        urls=(
            "https://www.capegardencentre.co.za/collections/fynbos/products.json?limit=250&page=1",
        ),
        parse=capegardencentre.parse,
        active=True,
    ),
    # Catalogue/availability-only sources - no adapters written yet.
    NurserySource(
        key="drboomslang",
        display_name="Dr Boomslang",
        format="html",
        urls=("https://drboomslang.co.za/",),
        parse=lambda *_: [],  # TODO: adapter
        active=False,
    ),
    NurserySource(
        key="livingroots",
        display_name="Living Roots",
        format="html",
        urls=("https://livingroots.co.za/",),
        parse=lambda *_: [],  # TODO: adapter
        active=False,
    ),
    NurserySource(
        key="fynboslife",
        display_name="Fynbos Life",
        format="pdf",
        urls=("https://fynboslife.com/nursery",),
        parse=lambda *_: [],  # TODO: adapter (locate PDF plant-list link)
        active=False,
    ),
    NurserySource(
        key="fernkloof",
        display_name="Fernkloof Nature Reserve Nursery",
        format="pdf",
        urls=("https://fernkloof.org.za/",),
        parse=lambda *_: [],  # TODO: adapter (locate PDF plant-list link)
        active=False,
    ),
    NurserySource(
        key="plantculture",
        display_name="Plant Culture",
        format="html",
        urls=("https://plantculture.co.za/",),
        parse=lambda *_: [],  # TODO: adapter
        active=False,
    ),
    NurserySource(
        key="tulbaghnursery",
        display_name="Tulbagh Nursery",
        format="pdf",
        urls=("https://tulbaghnursery.co.za/",),
        parse=lambda *_: [],  # TODO: adapter (locate PDF plant-list link)
        active=False,
    ),
    NurserySource(
        key="happybynature",
        display_name="Happy by Nature",
        format="html",
        urls=("https://happybynature.com/",),
        parse=lambda *_: [],  # TODO: adapter
        active=False,
    ),
    NurserySource(
        key="nonkeplants",
        display_name="Nonke Plants",
        format="html",
        urls=("https://nonkeplants.com/",),
        parse=lambda *_: [],  # TODO: adapter
        active=False,
    ),
]
