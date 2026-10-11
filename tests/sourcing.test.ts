import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, openSync, closeSync, readFileSync, rmSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import { buildGardenPlan, type GardenBrief } from "../app/lib/planning/index.ts";
import { computeBudget, budgetText } from "../app/lib/sourcing/budget.ts";
import { catalogueStatus, type ParsedCatalogue } from "../app/lib/sourcing/catalogues.ts";
import { bandFor, haversineKm } from "../app/lib/sourcing/geo.ts";
import { MemoryCache, PoliteClient } from "../app/lib/sourcing/http.ts";
import { buildNameIndex, classifyListing } from "../app/lib/sourcing/matching.ts";
import { budgetPrices, runSourcing, type Offer } from "../app/lib/sourcing/run.ts";
import { cmToLitres, litresToCm, parsePrice, parseSize, perPlant, sizeClassOf, className } from "../app/lib/sourcing/sizes.ts";
import { parseSpec, TABS, type SourcingSpec } from "../app/lib/sourcing/spec.ts";
import { SpecLoader } from "../app/lib/sourcing/specLoader.ts";
import { readWorkbook, unzip } from "../app/lib/sourcing/xlsx.ts";

/**
 * Nursery sourcing - the owner's 11 acceptance tests. The real workbook
 * (Nursery_Sourcing_Search_Spec.xlsx, beside the repo) is only ever COPIED
 * here; tests that change it change a temporary copy.
 */

const WORKBOOK = resolve(process.env.SOURCING_SPEC_PATH ?? resolve("..", "Nursery_Sourcing_Search_Spec.xlsx"));
const haveWorkbook = existsSync(WORKBOOK);
const skip = haveWorkbook ? false : "workbook not available on this machine";

function realSpec(): SourcingSpec {
  const result = parseSpec(readWorkbook(readFileSync(WORKBOOK)));
  assert.ok(result.ok, result.ok ? "" : JSON.stringify(result.errors));
  return structuredClone(result.spec);
}

// --------------------------------------------------------------------------
// A tiny zip writer (stored, no compression) to write edited workbook copies.
// --------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: Map<string, Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** Path of a named sheet's XML inside the workbook. */
function sheetPath(files: Map<string, Buffer>, sheet: string): string {
  const workbook = files.get("xl/workbook.xml")!.toString("utf8");
  const rid = new RegExp(`<sheet\\b[^>]*name="${sheet}"[^>]*r:id="([^"]+)"`).exec(workbook)![1];
  const rels = files.get("xl/_rels/workbook.xml.rels")!.toString("utf8");
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
    ?? new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)![1];
  return target.replace(/^\//, "").startsWith("xl/") ? target.replace(/^\//, "") : `xl/${target}`;
}

/** Writes an edited copy of the workbook: `edits` replace single cells. */
function editedWorkbook(source: Buffer, edits: { sheet: string; ref: string; value: string | null }[]): Buffer {
  const files = unzip(source);
  for (const { sheet, ref, value } of edits) {
    const path = sheetPath(files, sheet);
    let xml = files.get(path)!.toString("utf8");
    const cell = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
    assert.ok(cell.test(xml), `cell ${sheet}!${ref} not found`);
    const replacement =
      value === null ? `<c r="${ref}"/>`
      : /^-?\d+(\.\d+)?$/.test(value) ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
    xml = xml.replace(cell, replacement);
    files.set(path, Buffer.from(xml, "utf8"));
  }
  return zip(files);
}

function tempWorkbook(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "sourcing-test-"));
  const path = join(dir, "Nursery_Sourcing_Search_Spec.xlsx");
  copyFileSync(WORKBOOK, path);
  return { dir, path };
}

let clock = Date.now();
function touch(path: string) {
  clock += 10_000;
  utimesSync(path, new Date(clock), new Date(clock));
}

// --------------------------------------------------------------------------
// Workbook mapping
// --------------------------------------------------------------------------

test("the real workbook maps onto the sourcing config", { skip }, () => {
  const spec = realSpec();
  assert.equal(spec.sources.length, 14);

  // Ferox Nursery (S10, added 2026-09-30): outside the Western Cape and
  // delivery-only, so it carries no branch row. Wholesale, therefore
  // availability only - it signals that a species is in commercial
  // supply and never reaches the budget.
  const ferox = spec.sources.find((source) => source.nursery === "Ferox Nursery");
  assert.ok(ferox, "Ferox Nursery must be in the workbook");
  assert.equal(ferox.enabled, true);
  assert.equal(ferox.role, "availability");
  assert.match(ferox.deliversTo, /nationwide/i);
  assert.equal(
    spec.branches.filter((branch) => branch.sourceId === ferox.id).length,
    0,
    "a delivery-only nursery has no branch to map",
  );
  assert.deepEqual(
    spec.sources.filter((s) => s.enabled && s.role === "pricing" && s.website).map((s) => s.id).sort(),
    ["S01", "S02", "S06", "S07", "S08"],
  );
  assert.equal(spec.sources.find((s) => s.id === "S09")?.role, "accessibility");
  assert.equal(spec.k, 1700);
  assert.equal(spec.pdfWindowDays, 90);
  assert.equal(className(spec.referenceClass), "Standard");
  assert.deepEqual(spec.bands.map((b) => [b.fromKm, b.toKm]), [[0, 15], [15, 50], [50, null]]);
  assert.equal(spec.outputFields[0], "Nursery");
  assert.equal(TABS.sources, "1_Sources");
});

// --------------------------------------------------------------------------
// 1-3: the live loader
// --------------------------------------------------------------------------

test("1. a changed workbook value is used on the next run, with no restart", { skip }, () => {
  const { dir, path } = tempWorkbook();
  try {
    const loader = new SpecLoader({ path, log: () => undefined });
    const first = loader.load();
    assert.equal(first.spec?.bands[0].toKm, 15);
    assert.equal(first.spec?.sources.find((s) => s.id === "S08")?.enabled, true);

    // Lara edits the Local band limit (7_Location C12) and disables Plantify
    // (1_Sources J11).
    writeFileSync(path, editedWorkbook(readFileSync(path), [
      { sheet: "7_Location", ref: "C12", value: "10" },
      { sheet: "1_Sources", ref: "J11", value: "N" },
    ]));
    touch(path);
    const second = loader.load(); // the same loader instance: no restart
    assert.equal(second.warning, null);
    assert.equal(second.spec?.bands[0].toKm, 10);
    assert.equal(second.spec?.sources.find((s) => s.id === "S08")?.enabled, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("2. a broken workbook shows a warning and keeps the last good config", { skip }, () => {
  const { dir, path } = tempWorkbook();
  try {
    const loader = new SpecLoader({ path, log: () => undefined });
    const good = loader.load();
    assert.ok(good.spec);

    // Delete a required column header (1_Sources "platform", D3).
    writeFileSync(path, editedWorkbook(readFileSync(path), [{ sheet: "1_Sources", ref: "D3", value: null }]));
    touch(path);
    const broken = loader.load();
    assert.match(broken.warning ?? "", /Sourcing settings file has an error in 1_Sources\/.*using last good version/);
    assert.deepEqual(broken.spec, good.spec, "the last good config keeps working");

    // An unreadable file (e.g. mid-save) never throws either.
    const unreadable = new SpecLoader({ path: dir, lastGood: good.spec, log: () => undefined }).load();
    assert.ok(unreadable.warning);
    assert.deepEqual(unreadable.spec, good.spec);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("3. the workbook held open by another program does not crash the loader", { skip }, () => {
  const { dir, path } = tempWorkbook();
  const handle = openSync(path, "r+"); // stands in for Excel holding it open
  try {
    const loaded = new SpecLoader({ path, log: () => undefined }).load();
    assert.ok(loaded.spec, loaded.warning ?? "");
    assert.equal(loaded.warning, null);
  } finally {
    closeSync(handle);
    rmSync(dir, { recursive: true, force: true });
  }
});

// --------------------------------------------------------------------------
// 4-5: sizes and prices
// --------------------------------------------------------------------------

test("4. the size parser reads 25+ real titles", { skip }, () => {
  const spec = realSpec();
  const cls = (text: string) => {
    const size = parseSize(text, spec);
    const found = sizeClassOf(size, spec.sizeClasses);
    return found ? className(found.name) : "not stated";
  };
  const cases: [string, string, Partial<ReturnType<typeof parseSize>>][] = [
    // ClicknPlant
    ["Agapanthus Poppin Pink 17cm Pot", "Standard", { diameterCm: 17 }],
    ["Agapanthus &#8216;Charcoal Blue&#8217; 15cm Pot", "Standard", { diameterCm: 15 }],
    ["Agapanthus Silver Suzi 19cm Pot", "Medium", { diameterCm: 19 }],
    ["Agapanthus White Ice 4lt", "Medium", { litres: 4 }],
    ["Agapanthus Praecox Blue 10lt", "Large", { litres: 10 }],
    ["Olea europaea 60lt", "Specimen", { litres: 60 }],
    // Cape Garden Centre (title + variant)
    ["Pin Cushion | Leucospermum Cordifolium 'Clockwork Orange' 15cm", "Standard", { diameterCm: 15 }],
    ["Agapanthus Praecox 'Zambezi' 6L", "Medium", { litres: 6 }],
    ["Conebush | Leucadendron Salignum x Laureolum 'Jolly Joker' 22cm", "Medium", { diameterCm: 22 }],
    ["Pin Cushion | Leucospermum Cordifolium 'Clockwork Orange' Large", "not stated", { label: null }],
    // Stodels
    ["LEUCADENDRON JUBILEE CROWN 15CM", "Standard", { diameterCm: 15 }],
    ["LEUCADENDRON RED DEVIL 22CM", "Medium", { diameterCm: 22 }],
    ["BRACHYLAENA DISCOLOR 20KG", "Specimen", { litres: 20 }],
    ["BRACHYLAENA DISCOLOR 10KG", "Large", { litres: 10 }],
    ["BRACHYLAENA DISCOLOR 5KG", "Medium", { litres: 5 }],
    // Kraaibosch (ℓ symbol, 6pk, height after the container)
    ["Salvia chamelaeagnea Blue 4ℓ", "Medium", { litres: 4 }],
    ["Rose Satchmo Std. 10ℓ 1.2m", "Large", { litres: 10, heightM: 1.2 }],
    ["Rhaphiolepis x del. Kruschenia 10ℓ 0,9m", "Large", { litres: 10, heightM: 0.9 }],
    ["Gasteria vlokii 12cm", "Small", { diameterCm: 12 }],
    ["Bacopa cordata Compact Pink 6pk", "not stated", { pack: 6 }],
    // Samgro plugs
    ["Anastrabe intergerrima plug", "Plug / seedling", { plug: true }],
    ["Dymondia margaretae plugs", "Plug / seedling", { plug: true }],
    // Garden Route (comma decimals elsewhere; units here)
    ["Agathosma ovata 14cm", "Standard", { diameterCm: 14 }],
    ["Mackaya bella 10L", "Large", { litres: 10 }],
    ["Polyxena ensifolia 12cm", "Small", { diameterCm: 12 }],
    ["Leucospernum hybrid 16", "not stated", { label: null }],
    // Packs
    ["Vygie tray of 6", "not stated", { pack: 6 }],
    ["Dymondia 6-pack", "not stated", { pack: 6 }],
  ];
  assert.ok(cases.length >= 25);
  for (const [title, expectedClass, expected] of cases) {
    const size = parseSize(title, spec);
    for (const [key, value] of Object.entries(expected)) {
      assert.deepEqual(size[key as keyof typeof size], value, `${title}: ${key}`);
    }
    assert.equal(cls(title), expectedClass, title);
  }
  // A height is never read as a pot size.
  assert.equal(parseSize("Searsia lancea 1.2m", spec).diameterCm, null);
  // Prices, including comma decimals.
  assert.equal(parsePrice("R 50,00"), 50);
  assert.equal(parsePrice("R8.90"), 8.9);
  assert.equal(parsePrice("R1,112.50"), 1112.5);
  assert.equal(parsePrice("R469.99"), 469.99);
});

test("5. pack pricing, litre <-> cm, and Standard-class budget selection", { skip }, () => {
  const spec = realSpec();
  // 5_Size_Parser calculator: R90 pack of 6 -> R15; 4 L -> 18.9 cm; 15 cm -> 2 L.
  assert.equal(perPlant(90, 6), 15);
  assert.equal(parseSize("Dymondia tray of 6", spec).pack, 6);
  assert.equal(Math.round(litresToCm(4, spec.k) * 10) / 10, 18.9);
  assert.equal(Math.round(cmToLitres(15, spec.k) * 10) / 10, 2);

  const offer = (sourceId: string, cls: string | null, price: number, label: "Found" | "Related plant" = "Found"): Offer => ({
    sourceId, nursery: sourceId, branch: null, distanceKm: null, approximate: false, band: null, bandLabel: null,
    online: false, deliversTo: "", title: "", size: "", sizeClass: cls, pricePerPlant: price, packPrice: price, pack: 1,
    stock: null, link: null, checked: "2026-09-22", rank: label === "Found" ? "exact" : "hybrid", matchLabel: label,
    snapshotNote: null, channel: "live", outdated: false,
  });
  const standard = spec.referenceClass;
  // Standard offers win; per nursery the lowest; related plants never count.
  const chosen = budgetPrices(
    [offer("A", "Medium", 50), offer("A", standard, 90), offer("A", standard, 80), offer("B", standard, 100), offer("C", standard, 10, "Related plant")],
    spec,
  );
  assert.equal(chosen.cls, standard);
  assert.deepEqual(chosen.perNursery.map((o) => o.pricePerPlant).sort(), [100, 80].sort());
  // Not sold in Standard: the smallest fallback class found is used.
  const fallback = budgetPrices([offer("A", "Large", 300), offer("B", "Medium", 200)], spec);
  assert.equal(fallback.cls, "Medium");
});

// --------------------------------------------------------------------------
// 6-8: PDFs, wholesale and failing sites (network mocked)
// --------------------------------------------------------------------------

const index = buildNameIndex(plants);
const agathosma = plants.find((p) => p.scientificName.startsWith("Agathosma ovata"))!;
const species = [{ plantId: agathosma.id, scientificName: agathosma.scientificName, commonName: agathosma.commonName, plantType: agathosma.plantType, n: 5 }];

function offlineSpec(): SourcingSpec {
  const spec = realSpec();
  for (const source of spec.sources) if (source.website) source.enabled = false;
  return spec;
}
const noNetwork = () => new PoliteClient({ fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, noDelay: true });
const catalogue = (rows: ParsedCatalogue["rows"]): ParsedCatalogue => ({ fileName: "list.pdf", layout: "test", sourceMtimeMs: 0, parsedAt: "", rows });

test("6. a PDF list turns 'may be outdated' after the window and is still shown", { skip }, async () => {
  assert.equal(catalogueStatus("2025-07-29", 90, new Date("2025-10-27T12:00:00Z")).outdated, false);
  assert.equal(catalogueStatus("2025-07-29", 90, new Date("2025-10-28T12:00:00Z")).outdated, true);

  const spec = offlineSpec();
  spec.pdfSources = [{ sourceId: "P01", fileName: "list.pdf", nursery: "Garden Route", channel: "retail", catalogueDate: "2025-07-29", parserNotes: "", row: 4 }];
  const report = await runSourcing(
    { species, place: null },
    { spec, client: noNetwork(), index, now: new Date("2026-09-22"), catalogues: new Map([["list.pdf", catalogue([{ name: "Agathosma ovata", sizeText: "14cm", price: 50, qty: 10 }])]]) },
  );
  const offer = report.species[0].offers[0];
  assert.ok(offer, "the outdated list is kept and used");
  assert.match(offer.snapshotNote ?? "", /May be outdated — as at Jul 2025, confirm with nursery/);
  assert.equal(offer.pricePerPlant, 50);
  assert.equal(report.budget.outdatedPrices, 1);
  assert.equal(report.budget.low, 250);
});

test("7. wholesale rows never reach the budget", { skip }, async () => {
  const spec = offlineSpec();
  spec.pdfSources = [{ sourceId: "P03", fileName: "list.pdf", nursery: "Samgro", channel: "wholesale", catalogueDate: "2026-09-21", parserNotes: "", row: 6 }];
  const report = await runSourcing(
    { species, place: null },
    { spec, client: noNetwork(), index, now: new Date("2026-09-22"), catalogues: new Map([["list.pdf", catalogue([{ name: "Agathosma ovata", sizeText: "plug", price: 4.5, qty: 500 }])]]) },
  );
  assert.equal(report.species[0].offers.length, 0);
  assert.equal(report.species[0].availability[0]?.note, "Grown commercially in SA — ask your nursery");
  assert.equal(report.budget.low, 0);
  assert.equal(report.budget.coverage, 0);
});

test("8. a site that is down shows \"couldn't check <nursery>\"", { skip }, async () => {
  const spec = realSpec();
  for (const source of spec.sources) source.enabled = source.id === "S07"; // ClicknPlant only
  spec.pdfSources = [];
  const down = (async (url: string) =>
    String(url).endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response("down", { status: 503 })) as typeof fetch;
  const report = await runSourcing(
    { species, place: null },
    { spec, client: new PoliteClient({ fetch: down, noDelay: true, cache: new MemoryCache() }), index, now: new Date(), catalogues: new Map() },
  );
  assert.ok(report.warnings.some((w) => /^Couldn't check ClicknPlant/.test(w)), report.warnings.join(" | "));
  assert.equal(report.sources.find((s) => s.id === "S07")?.status, "failed");
});

// --------------------------------------------------------------------------
// 9: annotate only
// --------------------------------------------------------------------------

test("9. running sourcing does not change the layout", { skip }, async () => {
  const brief: GardenBrief = {
    biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy", wind: "none",
    viewingEdge: "north", sun: "full",
    water: "moderate", bedWidthM: 4, bedLengthM: 3, style: "fynbos", colour: { mode: "none" }, extras: [],
  };
  const plan = buildGardenPlan(plants, brief);
  const before = JSON.stringify({ q: plan.quantities, l: plan.layout });
  const items = plan.quantities!.quantities.map((q) => {
    const plant = plants.find((p) => p.id === q.id)!;
    return { plantId: plant.id, scientificName: plant.scientificName, commonName: plant.commonName, plantType: plant.plantType, n: q.quantity };
  });
  await runSourcing({ species: items, place: null }, { spec: offlineSpec(), client: noNetwork(), index, now: new Date(), catalogues: new Map() });
  assert.equal(JSON.stringify({ q: plan.quantities, l: plan.layout }), before, "the plan object is untouched");
  const again = buildGardenPlan(plants, brief);
  assert.equal(JSON.stringify({ q: again.quantities, l: again.layout }), before, "same seed -> same plants and positions");
});

// --------------------------------------------------------------------------
// 10-11: the workbook's own worked calculators
// --------------------------------------------------------------------------

test("10. Stellenbosch -> Plantify Gardens is about 41 km, 'Short drive'", { skip }, () => {
  const spec = realSpec();
  const location = readWorkbook(readFileSync(WORKBOOK)).get("7_Location")!;
  const value = (row: number) => Number(location.get(row)!.get("B")!.value);
  const km = haversineKm({ lat: value(17), lon: value(18) }, { lat: value(19), lon: value(20) }, spec.earthRadiusKm);
  assert.equal(Math.round(km * 10) / 10, 41.3);
  assert.equal(bandFor(km, spec.bands)?.label, "Short drive");
});

test("11. the workbook's budget example: R1,157 / R1,213 / R1,264 and 56% coverage", { skip }, () => {
  const sheet = readWorkbook(readFileSync(WORKBOOK)).get("8_Budget")!;
  const items = [14, 15, 16, 17].map((row) => {
    const cells = sheet.get(row)!;
    const prices = ["D", "E", "F"].flatMap((col) => (cells.get(col)?.value ? [Number(cells.get(col)!.value)] : []));
    const estimated = cells.get("C")!.value === "Estimated";
    return {
      plantId: cells.get("A")!.value, n: Number(cells.get("B")!.value),
      prices: estimated ? [] : prices, estimate: estimated ? prices[0] : null, outdatedPrices: 0,
    };
  });
  const budget = computeBudget(items);
  assert.equal(Math.round(budget.low), 1157);
  assert.equal(Math.round(budget.typical), 1213);
  assert.equal(Math.round(budget.high), 1264);
  assert.equal(Math.round(budget.coverage * 100), 56);
  assert.equal(budgetText(budget), "Budget R1,157 – R1,264 (typical R1,213), 56% of plants priced from live listings");
});

// --------------------------------------------------------------------------
// Matching ladder
// --------------------------------------------------------------------------

test("match ladder: exact / cultivar / hybrid / common, never a guess", () => {
  const cordifolium = plants.find((p) => p.scientificName === "Leucospermum cordifolium")!;
  assert.equal(classifyListing("Leucospermum cordifolium 15cm", cordifolium, index), "exact");
  assert.equal(classifyListing("Pin Cushion | Leucospermum Cordifolium 'Clockwork Orange'", cordifolium, index), "cultivar");
  assert.equal(classifyListing("Leucospermum Lineare x Cordifolium 'Succession'", cordifolium, index), "hybrid");
  assert.equal(classifyListing("LEUCOSPERMUM HIGH GOLD 15CM", cordifolium, index), "unresolved"); // genus only
  assert.equal(classifyListing("PINCUSHION MEMORY 15CM", cordifolium, index), "unresolved"); // one-word common name + more
  assert.equal(classifyListing("Leucospermum cordifolium seed kit", cordifolium, index), "unresolved"); // not a plant
  assert.equal(classifyListing("Leucospermum erubescens 15cm", cordifolium, index), "unresolved"); // another species
});

test("the budget line says explicitly which plants it leaves out", () => {
  const budget = computeBudget([
    { plantId: "a", n: 5, prices: [50, 60], estimate: null, outdatedPrices: 0 },
    { plantId: "b", n: 3, prices: [], estimate: 40, outdatedPrices: 0 },
    { plantId: "c", n: 7, prices: [], estimate: null, outdatedPrices: 0 },
  ]);
  assert.equal(budget.plantsInFigure, 8);
  assert.equal(budget.totalPlants, 15);
  assert.equal(budget.notFoundPlants, 7);
  assert.equal(
    budgetText(budget),
    "Budget R370 – R420 (typical R395) for 8 of 15 plants — 1 species (7 plants) not found and not in this figure. 33% of plants priced from live listings.",
  );
});

test("with nothing priced, the budget line says so instead of R0", () => {
  const budget = computeBudget([{ plantId: "a", n: 4, prices: [], estimate: null, outdatedPrices: 0 }]);
  assert.equal(budgetText(budget), "No budget yet — none of the 4 plants (1 species) was found at the nurseries checked.");
});

// ---------------------------------------------------------------------------
// The deployed worker must be able to fetch at all (2026-10-07)
//
// Cloudflare Workers rejects `fetch` invoked with the wrong `this`:
// storing the bare global and calling it as `this.fetchImpl(...)` throws
// "Illegal invocation" on every request. Node tolerates the detached call,
// so local dev and this suite both passed while the deployed worker
// reported every nursery and the geocoder as unreachable.
//
// This reproduces the Workers rule in Node: a fetch that refuses to run
// unless called with the right receiver.
// ---------------------------------------------------------------------------

test("PoliteClient works with a fetch that rejects a detached call", async () => {
  const realm = {
    fetch(url: string | URL | Request): Promise<Response> {
      // The Workers check: `this` must be the object the function lives on.
      if (this !== realm) {
        throw new TypeError(
          "Illegal invocation: function called with incorrect `this` reference.",
        );
      }
      const href = String(url);
      if (href.endsWith("/robots.txt")) {
        return Promise.resolve(new Response("User-agent: *\nAllow: /", { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    },
  };

  // Bound, as PoliteClient's default now is.
  const client = new PoliteClient({
    fetch: realm.fetch.bind(realm),
    cache: new MemoryCache(),
    noDelay: true,
  });
  const result = await client.get<{ ok: boolean }>(
    "https://example.test/search?q=protea",
    "probe",
  );
  assert.equal(result.ok, true, `expected a successful fetch, got ${JSON.stringify(result)}`);

  // And the failure it used to produce is now reported with its reason
  // rather than as a bare "could not be read".
  const detached = new PoliteClient({
    fetch: realm.fetch as unknown as typeof fetch,
    cache: new MemoryCache(),
    noDelay: true,
  });
  // Guard the DEFAULT too: it must be a bound wrapper, never the bare
  // global, or the deployed worker breaks again while Node stays happy.
  const defaulted = new PoliteClient() as unknown as { fetchImpl: typeof fetch };
  assert.notEqual(
    defaulted.fetchImpl,
    globalThis.fetch,
    "the default fetch must be bound, not the raw global",
  );

  const broken = await detached.get("https://example.test/search?q=protea", "probe-2");
  assert.equal(broken.ok, false);
  assert.match(
    (broken as { error: string }).error,
    /Illegal invocation/,
    "the real cause must reach the message, not be swallowed",
  );
});

