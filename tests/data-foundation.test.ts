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

test("the visible 48 plants are auditable against the mined seed catalogue", async () => {
  const csv = await readFile(
    new URL("../data/processed/garden_app_seed_catalog.csv", import.meta.url),
    "utf8",
  );
  const rows = parseCsv(csv);
  const byName = new Map(rows.map((row) => [row.scientific_name, row]));

  assert.equal(rows.length, 1909);
  assert.equal(plants.length, 48);

  const drift: string[] = [];
  plants.forEach((plant) => {
    const source = byName.get(plant.scientificName);
    assert.ok(source, `${plant.scientificName} is missing from the seed data.`);
    if (source.family !== plant.family) {
      drift.push(`${plant.id} family: ${plant.family} != ${source.family}`);
    }
    if (Number(source.max_height_cm) !== plant.heightCm) {
      drift.push(
        `${plant.id} height: ${plant.heightCm} != ${source.max_height_cm}`,
      );
    }
    if (Number(source.bodatsa_occurrence_count) !== plant.occurrenceCount) {
      drift.push(
        `${plant.id} occurrence: ${plant.occurrenceCount} != ${source.bodatsa_occurrence_count}`,
      );
    }
    const sourceCanopy =
      source.median_canopy_axis_1_cm === ""
        ? null
        : Number(source.median_canopy_axis_1_cm);
    if (sourceCanopy !== plant.spreadCm) {
      drift.push(
        `${plant.id} canopy: ${plant.spreadCm} != ${sourceCanopy}`,
      );
    }
    assert.match(
      source.sanpc_establishment_means,
      /^native(?:Endemic)?$/,
      `${plant.id} is not marked native in the seed data.`,
    );
    assert.equal(
      source.legal_review_required,
      "0",
      `${plant.id} carries a machine-detected legal review flag.`,
    );
  });

  assert.deepEqual(drift, []);
});
