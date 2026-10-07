"""Parse nursery PDF catalogues ONCE into intermediate JSON.

Nursery_Sourcing_Search_Spec.xlsx, 3_PDF_Sources: PDFs are the only
snapshot source. Each PDF is parsed once when it is added or changed
(detected by the file's modified time) - never at request time - and its
rows are stored as data/processed/catalogues/<file name>.json, together
with the PDF's modified time so a changed PDF is re-parsed.

    python data/scripts/ingest_catalogues.py <pdf> [<pdf> ...]

The layout is recognised from the PDF's own header words, so the parser
does not depend on the file name. Known layouts (parser notes in the
workbook):

    garden-route  qty, pot size, "R 50,00" comma-decimal price, 'limited'
                  flag, section headers = plant groups
    kraaibosch    two columns; container (4ℓ, 15cm, 6pk); stock icons are
                  NOT quantities; '1.2m' / '0,9m' is plant height
    samgro        plugs; qty available, price per plug and per tray, ex VAT
    prime-trees   common name, species, litre bag size, qty available

Prints the number of rows parsed per PDF.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = REPO_ROOT / "data" / "processed" / "catalogues"

SIZE_TOKEN = re.compile(r"^\d+(?:[.,]\d+)?(?:ℓ|l|L|cm|pk)$")
HEIGHT_TOKEN = re.compile(r"\d+(?:[.,]\d+)?m$")
ICON_CHARS = re.compile(r"^[{}|I]+")


def lines_of(page, tolerance: float = 3.0):
    """Words grouped into lines by their vertical position, left to right."""
    lines: list[list[dict]] = []
    for word in sorted(page.extract_words(), key=lambda w: (w["top"], w["x0"])):
        for line in lines:
            if abs(line[0]["top"] - word["top"]) <= tolerance:
                line.append(word)
                break
        else:
            lines.append([word])
    return [sorted(line, key=lambda w: w["x0"]) for line in lines]


def is_section(text: str) -> bool:
    letters = re.sub(r"[^A-Za-z]", "", text)
    return len(letters) >= 3 and letters.isupper()


def parse_price(text: str) -> float | None:
    value = text.replace("R", "").replace(" ", "")
    if "," in value and "." in value:
        value = value.replace(",", "")
    elif re.search(r",\d{1,2}$", value):
        value = value.replace(",", ".")
    else:
        value = value.replace(",", "")
    try:
        return float(value)
    except ValueError:
        return None


# --------------------------------------------------------------------------

def parse_garden_route(pdf) -> list[dict]:
    rows, section = [], None
    columns = None
    for page_number, page in enumerate(pdf.pages, 1):
        for line in lines_of(page):
            texts = [w["text"] for w in line]
            joined = " ".join(texts)
            if "Quantity:" in texts and "Price:" in texts:
                x = {w["text"]: w["x0"] for w in line}
                columns = {"qty": x["Quantity:"], "size": x["Pot"], "price": x["Price:"], "stock": x["Stock:"]}
                continue
            if columns is None:
                continue
            name = " ".join(w["text"] for w in line if w["x0"] < columns["qty"] - 5)
            qty = " ".join(w["text"] for w in line if columns["qty"] - 5 <= w["x0"] < columns["size"] - 5)
            size = " ".join(w["text"] for w in line if columns["size"] - 5 <= w["x0"] < columns["price"] - 5)
            price = "".join(w["text"] for w in line if columns["price"] - 5 <= w["x0"] < columns["stock"] - 5)
            stock = " ".join(w["text"] for w in line if w["x0"] >= columns["stock"] - 5)
            if name and not qty and not price:
                if is_section(joined):
                    section = joined.title()
                continue
            if not name or not price:
                continue
            rows.append({
                "name": name, "sizeText": size or None, "price": parse_price(price),
                "qty": int(qty) if qty.isdigit() else None, "limited": "limited" in stock.lower(),
                "section": section, "page": page_number,
            })
    return rows


def parse_kraaibosch(pdf) -> list[dict]:
    """Two columns per page. Many plants carry no container on their own line
    (the section header gives the range), so a named row is kept even
    without one - it is still an availability signal."""
    rows, section, started = [], None, False
    for page_number, page in enumerate(pdf.pages, 1):
        split = page.width / 2
        for line in lines_of(page):
            joined = " ".join(w["text"] for w in line)
            if "CONTAINER" in joined:
                started = True
                continue
            if not started:
                continue
            head = re.split(r"\s\d", joined)[0]
            if is_section(head) and len(head.split()) <= 6 and not re.search(r"[a-z]{3}", head):
                section = head.title()
                continue
            for column in ([w for w in line if w["x0"] < split - 10], [w for w in line if w["x0"] >= split - 10]):
                name_words, size, height = [], None, None
                for w in column:
                    token = ICON_CHARS.sub("", w["text"])  # stock icons are not quantities
                    if not token:
                        continue
                    if SIZE_TOKEN.match(token) and size is None:
                        size = token
                    elif HEIGHT_TOKEN.match(token):
                        height = token
                    elif re.fullmatch(r"\(\d+\)", token):
                        continue
                    elif size is None:
                        name_words.append(token)
                name = " ".join(name_words).strip()
                if len(name_words) < 2 or not re.search(r"[a-z]", name) or re.fullmatch(r"(?i)colour pots", name):
                    continue
                rows.append({
                    "name": name, "sizeText": size, "price": None, "qty": None,
                    "heightText": height, "section": section, "page": page_number,
                })
    return rows


def parse_samgro(pdf) -> list[dict]:
    rows, started = [], False
    for page_number, page in enumerate(pdf.pages, 1):
        for line in lines_of(page):
            texts = [w["text"] for w in line]
            if "SPECIES" in texts:
                started = True
                continue
            if not started:
                continue
            prices = [w for w in line if re.fullmatch(r"R[\d,]+\.\d{2}", w["text"])]
            if not prices:
                continue
            first_price_x = prices[0]["x0"]
            numbers = [w for w in line if re.fullmatch(r"\d+", w["text"]) and w["x0"] < first_price_x]
            name_words = [w["text"] for w in line if w["x0"] < (numbers[0]["x0"] if numbers else first_price_x) - 5]
            rows.append({
                "name": " ".join(name_words), "sizeText": "plug",
                "price": parse_price(prices[0]["text"]),  # per plug, ex VAT - never retail
                "trayPrice": parse_price(prices[1]["text"]) if len(prices) > 1 else None,
                "qty": int(numbers[0]["text"]) if numbers else None, "page": page_number,
            })
    return rows


def parse_prime_trees(pdf) -> list[dict]:
    rows, columns = [], None
    for page_number, page in enumerate(pdf.pages, 1):
        for line in lines_of(page):
            texts = [w["text"] for w in line]
            if "Species" in texts and "Available" in texts:
                x = {w["text"]: w["x0"] for w in line}
                columns = {"species": x["Species"], "litre": x["Liter"], "qty": x["Available"]}
                continue
            if columns is None:
                continue
            common = " ".join(w["text"] for w in line if w["x0"] < columns["species"] - 5)
            species = " ".join(w["text"] for w in line if columns["species"] - 5 <= w["x0"] < columns["litre"] + 10)
            litre = "".join(w["text"] for w in line if columns["litre"] + 10 <= w["x0"] < columns["qty"] - 20)
            qty = "".join(w["text"] for w in line if w["x0"] >= columns["qty"] + 40)
            if not species and not common:
                # A quantity that wrapped onto its own line belongs to the row above.
                if qty.isdigit() and rows and rows[-1]["qty"] is None:
                    rows[-1]["qty"] = int(qty)
                continue
            rows.append({
                "name": species or common, "commonName": common or None,
                "sizeText": f"{litre} L" if litre.isdigit() else None, "price": None,
                "qty": int(qty) if qty.isdigit() else None, "page": page_number,
            })
    return rows


LAYOUTS = [
    ("garden-route", lambda text: "Pot Size:" in text and "Price:" in text, parse_garden_route),
    ("samgro", lambda text: "PER PLUG" in text, parse_samgro),
    ("prime-trees", lambda text: "Liter Size" in text, parse_prime_trees),
    ("kraaibosch", lambda text: "AVAILABILITY LIST" in text and "CUT-OFF" in text, parse_kraaibosch),
]


def ingest(pdf_path: Path) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        first_page = pdf.pages[0].extract_text() or ""
        for layout, detect, parse in LAYOUTS:
            if detect(first_page):
                rows = parse(pdf)
                break
        else:
            raise SystemExit(f"{pdf_path.name}: layout not recognised - add a parser for it")
    record = {
        "fileName": pdf_path.name,
        "layout": layout,
        "sourceMtimeMs": int(pdf_path.stat().st_mtime * 1000),
        "parsedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "rows": rows,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / f"{pdf_path.name}.json").write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    return record


def main() -> None:
    paths = [Path(arg) for arg in sys.argv[1:]]
    if not paths:
        sys.exit("usage: ingest_catalogues.py <pdf> [<pdf> ...]")
    for path in paths:
        record = ingest(path)
        print(f"{path.name}: {record['layout']} layout, {len(record['rows'])} rows parsed")


if __name__ == "__main__":
    main()
