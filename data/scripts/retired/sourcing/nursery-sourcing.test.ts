import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { plants, type PlantSourcing } from "../app/data/plants.ts";

// Same quoted-CSV parser as data-foundation.test.ts (kept self-contained,
// per this repo's convention of one file per audited dataset).
function parseCsv(source: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...values] = rows;
  if (!headers) return [];
  return values
    .filter((cells) => cells.some((cell) => cell.length > 0))
    .map((cells) =>
      Object.fromEntries(
        headers.map((header, index) => [header, cells[index] ?? ""]),
      ),
    );
}

// Mirrors data/scripts/generate_plants_json.py's load_nursery_sourcing():
// CSV rows arrive in nursery-priority order, so the first non-low-confidence
// row with a price wins priceRange (never merged across nurseries/pot
// sizes); listedAt keeps every confidence tier (the UI filters, not this
// data layer); lastUpdated is the max of contributing rows' own dates.
function expectedSourcing(
  rows: Record<string, string>[],
): Map<string, PlantSourcing> {
  const byName = new Map<string, PlantSourcing>();

  for (const row of rows) {
    const name = row.scientific_name;
    let entry = byName.get(name);
    if (!entry) {
      entry = { listedAt: [], priceRange: null, lastUpdated: "" };
      byName.set(name, entry);
    }

    if (!entry.listedAt.some((listing) => listing.nursery === row.nursery)) {
      entry.listedAt.push({
        nursery: row.nursery,
        matchedVia: row.matched_via as PlantSourcing["listedAt"][number]["matchedVia"],
        confidence: row.confidence as PlantSourcing["listedAt"][number]["confidence"],
      });
    }

    if (
      !entry.priceRange &&
      row.confidence !== "low" &&
      row.price_low &&
      row.price_high
    ) {
      entry.priceRange = {
        low: Number(row.price_low),
        high: Number(row.price_high),
        potSize: row.pot_size || "",
      };
    }

    if (row.last_updated && row.last_updated > entry.lastUpdated) {
      entry.lastUpdated = row.last_updated;
    }
  }

  return byName;
}

test("nursery sourcing renders only what the processed CSV supports", async () => {
  let csv: string;
  try {
    csv = await readFile(
      new URL("../data/processed/nursery_sourcing.csv", import.meta.url),
      "utf8",
    );
  } catch {
    // No scrape has run yet in this checkout - every plant must have no
    // sourcing, never a guessed or stale value.
    assert.ok(plants.every((plant) => plant.sourcing === null));
    return;
  }

  const expected = expectedSourcing(parseCsv(csv));
  const drift: string[] = [];

  for (const plant of plants) {
    const want = expected.get(plant.scientificName) ?? null;
    const got = plant.sourcing;

    if ((want === null) !== (got === null)) {
      drift.push(`${plant.id} sourcing presence: ${got !== null} != ${want !== null}`);
      continue;
    }
    if (want === null || got === null) continue;

    if (JSON.stringify(got.listedAt) !== JSON.stringify(want.listedAt)) {
      drift.push(`${plant.id} listedAt drifted from the processed CSV`);
    }
    if (JSON.stringify(got.priceRange) !== JSON.stringify(want.priceRange)) {
      drift.push(`${plant.id} priceRange drifted from the processed CSV`);
    }
    if (got.lastUpdated !== want.lastUpdated) {
      drift.push(
        `${plant.id} lastUpdated: ${got.lastUpdated} != ${want.lastUpdated}`,
      );
    }
  }

  assert.deepEqual(drift, []);
});
