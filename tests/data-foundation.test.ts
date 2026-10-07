import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { plants } from "../app/data/plants.ts";

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
  return values
    .filter((cells) => cells.some((cell) => cell.length > 0))
    .map((cells) =>
      Object.fromEntries(
        headers.map((header, index) => [header, cells[index] ?? ""]),
      ),
    );
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed && trimmed !== "NA" ? trimmed : null;
}

function toNumberOrNull(value: string | undefined): number | null {
  const text = blankToNull(value);
  if (text === null) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

// data/scripts/generate_plants_json.py is the single source of truth for
// app/data/plant_database.generated.json; this test re-derives the same
// fields from the CSV it reads and checks app/data/plants.ts's exported
// `plants` still matches, so a source-data change or a generator change
// can't silently drift from what the app actually renders.
test("the plant library is auditable against the Western Cape-filtered database", async () => {
  const csv = await readFile(
    new URL("../data/processed/plant_database_western_cape.csv", import.meta.url),
    "utf8",
  );
  const rows = parseCsv(csv);
  const byName = new Map(rows.map((row) => [row.scientific_name, row]));

  assert.equal(plants.length, rows.length);
  assert.ok(plants.length > 2500, "expected the Western Cape-filtered database, not a stub list");

  const drift: string[] = [];
  plants.forEach((plant) => {
    const source = byName.get(plant.scientificName);
    assert.ok(source, `${plant.scientificName} is missing from plant_database_full.csv.`);
    if (!source) return;

    if (blankToNull(source.family) !== (plant.family || null)) {
      drift.push(`${plant.id} family: ${plant.family} != ${source.family}`);
    }
    if (toNumberOrNull(source.height_cm) !== plant.heightCm) {
      drift.push(`${plant.id} height: ${plant.heightCm} != ${source.height_cm}`);
    }
    if (toNumberOrNull(source.spread_cm) !== plant.spreadCm) {
      drift.push(`${plant.id} spread: ${plant.spreadCm} != ${source.spread_cm}`);
    }
    const sourceWater = blankToNull(source.water);
    if (sourceWater !== plant.water) {
      drift.push(`${plant.id} water: ${plant.water} != ${sourceWater}`);
    }
    const sourceSun = blankToNull(source.sun);
    const expectedSun = sourceSun ? sourceSun.split(";") : null;
    if (JSON.stringify(expectedSun) !== JSON.stringify(plant.sun)) {
      drift.push(`${plant.id} sun: ${plant.sun} != ${expectedSun}`);
    }
    const sourceBiome = blankToNull(source.biome);
    const expectedBiome = sourceBiome ? sourceBiome.split(";") : null;
    if (JSON.stringify(expectedBiome) !== JSON.stringify(plant.biome)) {
      drift.push(`${plant.id} biome: ${plant.biome} != ${expectedBiome}`);
    }
    const sourceBioregion = blankToNull(source.bioregion);
    if (sourceBioregion !== plant.bioregion) {
      drift.push(`${plant.id} bioregion: ${plant.bioregion} != ${sourceBioregion}`);
    }
  });

  assert.deepEqual(drift, []);
});
