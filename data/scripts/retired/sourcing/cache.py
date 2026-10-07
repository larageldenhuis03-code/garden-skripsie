"""robots.txt-respecting, polite, conditionally-cached HTTP fetch for the
nursery scraper.

Cache state lives in data/processed/nursery_cache/ and is committed,
because a GitHub Actions runner has no persistent disk between weekly runs
- the repo itself is the cache. It deliberately does NOT live under
data/raw/, which .gitignore excludes wholesale (those are the multi-hundred
-MB source archives); this cache is small derived bookkeeping, which is
what data/processed/ is for.
"""

from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from urllib.robotparser import RobotFileParser

REPO_ROOT = Path(__file__).resolve().parents[3]
CACHE_DIR = REPO_ROOT / "data" / "processed" / "nursery_cache"
STATE_PATH = CACHE_DIR / "state.json"
USER_AGENT = "SillyGooseGardenPlanner/1.0 (+https://silly-goose-mvp.nanema.chatgpt.site)"
DEFAULT_CRAWL_DELAY_SECONDS = 2.0

_robots_cache: dict[str, RobotFileParser] = {}
_last_request_time: dict[str, float] = {}


@dataclass
class FetchResult:
    content: bytes | None
    changed: bool
    error: str | None = None


def _load_state() -> dict[str, dict]:
    if not STATE_PATH.exists():
        return {}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def _save_state(state: dict[str, dict]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, indent=2, sort_keys=True), encoding="utf-8"
    )


def robots_ok(url: str) -> tuple[bool, float]:
    """Check robots.txt for `url`; returns (allowed, crawl_delay_seconds)."""
    parsed = urllib.parse.urlsplit(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    parser = _robots_cache.get(origin)
    if parser is None:
        parser = RobotFileParser()
        parser.set_url(urllib.parse.urljoin(origin, "/robots.txt"))
        try:
            parser.read()
        except (urllib.error.URLError, OSError):
            # No readable robots.txt - default to allowed, still rate-limited.
            parser.allow_all = True
        _robots_cache[origin] = parser

    allowed = parser.allow_all or parser.can_fetch(USER_AGENT, url)
    delay = parser.crawl_delay(USER_AGENT) or DEFAULT_CRAWL_DELAY_SECONDS
    return allowed, float(delay)


def _wait_politely(url: str, delay: float) -> None:
    origin = urllib.parse.urlsplit(url).netloc
    last = _last_request_time.get(origin)
    if last is not None:
        elapsed = time.monotonic() - last
        if elapsed < delay:
            time.sleep(delay - elapsed)
    _last_request_time[origin] = time.monotonic()


def fetch(
    source_key: str | None, url: str, *, use_conditional_cache: bool
) -> FetchResult:
    """Fetch `url`, respecting robots.txt and a polite per-domain delay.

    When `use_conditional_cache` is True (PDFs), sends the last recorded
    ETag/Last-Modified for `source_key` and, on a 304 or an unchanged
    SHA-256 checksum of the body, returns `changed=False` with no content -
    callers should reuse their previous extraction rather than re-parse.
    """
    allowed, delay = robots_ok(url)
    if not allowed:
        return FetchResult(None, False, error=f"robots.txt disallows {url}")

    state = _load_state()
    previous = state.get(source_key, {}) if source_key else {}

    headers = {"User-Agent": USER_AGENT}
    if use_conditional_cache:
        if previous.get("etag"):
            headers["If-None-Match"] = previous["etag"]
        if previous.get("last_modified"):
            headers["If-Modified-Since"] = previous["last_modified"]

    _wait_politely(url, delay)
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            etag = response.headers.get("ETag")
            last_modified = response.headers.get("Last-Modified")
    except urllib.error.HTTPError as error:
        if error.code == 304:
            return FetchResult(None, False)
        return FetchResult(None, False, error=f"HTTP {error.code} fetching {url}")
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return FetchResult(None, False, error=f"{error} fetching {url}")

    checksum = hashlib.sha256(body).hexdigest()
    unchanged = use_conditional_cache and previous.get("sha256") == checksum

    # Pagination follow-ups and one-off probes pass source_key=None: they
    # still get robots.txt and rate limiting, but must not write a state
    # entry, or every paginated page URL accumulates in state.json forever.
    if source_key:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        state[source_key] = {
            "url": url,
            "etag": etag,
            "last_modified": last_modified,
            "sha256": checksum,
            "last_checked": now,
            "last_success": previous.get("last_success") if unchanged else now,
        }
        _save_state(state)

    return FetchResult(None if unchanged else body, changed=not unchanged)


def last_success_date(source_key: str) -> str | None:
    """ISO date (YYYY-MM-DD) of `source_key`'s last successful fetch, per
    the committed cache state - used as the sourcing row's last_updated so
    a carried-over listing never claims today's date."""
    state = _load_state()
    entry = state.get(source_key, {})
    last_success = entry.get("last_success")
    if not last_success:
        return None
    return last_success[:10]


def record_success(source_key: str, url: str) -> None:
    """Mark `source_key` as successfully scraped right now, even when
    `fetch()` wasn't used directly (e.g. an HTML page fetched fresh every
    run with no conditional caching)."""
    state = _load_state()
    previous = state.get(source_key, {})
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    state[source_key] = {**previous, "url": url, "last_checked": now, "last_success": now}
    _save_state(state)
