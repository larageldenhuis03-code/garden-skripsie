import type { Sheet, Workbook } from "./xlsx.ts";

/**
 * The nursery sourcing specification, as read from
 * Nursery_Sourcing_Search_Spec.xlsx. The workbook is CONFIGURATION only
 * (where and how to search) - no prices, sizes or stock live here.
 *
 * Tabs are found by name through TABS, and columns by their header text,
 * never by position: a renamed tab is a one-line change below, and moved
 * columns need no change at all.
 */

/** Tab name in the workbook -> config key. The ONE place tab names live. */
export const TABS = {
  sources: "1_Sources",
  branches: "2_Branches",
  pdfSources: "3_PDF_Sources",
  sizeParser: "5_Size_Parser",
  sizeClasses: "6_Size_Classes",
  location: "7_Location",
  output: "9_Output",
} as const;

export type Platform = "shopify" | "woocommerce" | "html_search" | "pdf" | "none" | "unconfirmed";
export type Role = "pricing" | "accessibility" | "availability" | "skip";

export type Source = {
  id: string;
  nursery: string;
  /** https://host, or null for PDF / offline sources. */
  website: string | null;
  platform: Platform;
  platformText: string;
  role: Role;
  roleText: string;
  region: string;
  deliversTo: string;
  enabled: boolean;
  notes: string;
  row: number;
};

export type Branch = {
  sourceId: string;
  name: string;
  address: string;
  town: string;
  /** Online-only shop: shown as "online, delivers <area>", no distance. */
  online: boolean;
  /** Only when the workbook gives numbers; otherwise geocoded live. */
  lat: number | null;
  lon: number | null;
  row: number;
};

export type PdfSource = {
  /** Links the PDF to its 1_Sources row; null until the column exists. */
  sourceId: string | null;
  fileName: string;
  nursery: string;
  channel: "retail" | "wholesale";
  /** ISO date (YYYY-MM-DD). */
  catalogueDate: string;
  parserNotes: string;
  row: number;
};

export type SizeClass = {
  name: string;
  /** Diameter limits in cm (V limits in the workbook are formulas of these). */
  dMin: number | null;
  dMax: number | null;
  plug: boolean;
  use: "reference" | "fallback" | "no";
};

export type Band = { name: string; fromKm: number; toKm: number | null; label: string };

export type SourcingSpec = {
  sources: Source[];
  branches: Branch[];
  pdfSources: PdfSource[];
  /** 3_PDF_Sources: days after the catalogue date before "may be outdated". */
  pdfWindowDays: number;
  /** 5_Size_Parser: V = d^3 / k. */
  k: number;
  /** 5_Size_Parser kg rule: litres per kg of bag weight. */
  litresPerKg: number;
  sizeClasses: SizeClass[];
  referenceClass: string;
  bands: Band[];
  earthRadiusKm: number;
  /** 9_Output: the fields shown, in order. */
  outputFields: string[];
};

export type SpecIssue = { tab: string; cell: string; message: string; fatal: boolean };

export type SpecResult =
  | { ok: true; spec: SourcingSpec; warnings: SpecIssue[] }
  | { ok: false; errors: SpecIssue[] };

// ---------------------------------------------------------------------------

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

function cellText(sheet: Sheet, row: number, col: string): string {
  return sheet.get(row)?.get(col)?.value ?? "";
}

/** Finds the header row containing every required header, and maps each
 * header to its column letter (matched by prefix, case-insensitive). */
function findHeader(
  sheet: Sheet,
  tab: string,
  required: string[],
  optional: string[],
  issues: SpecIssue[],
  fatal = true,
): { row: number; col: Record<string, string> } | null {
  for (const [row, cells] of [...sheet].sort((a, b) => a[0] - b[0])) {
    const col: Record<string, string> = {};
    for (const [letter, cell] of cells) {
      const text = norm(cell.value);
      for (const header of [...required, ...optional]) {
        if (!col[header] && text.startsWith(norm(header))) col[header] = letter;
      }
    }
    if (required.every((header) => col[header])) return { row, col };
    // A row with most of the headers is the header row with one missing.
    const found = required.filter((header) => col[header]);
    if (found.length >= Math.max(2, required.length - 2)) {
      for (const header of required.filter((h) => !col[h])) {
        issues.push({ tab, cell: `row ${row}`, message: `required column "${header}" is missing`, fatal });
      }
      return null;
    }
  }
  issues.push({ tab, cell: "-", message: `header row not found (needs: ${required.join(", ")})`, fatal });
  return null;
}

/** The table's rows: from just below the header down to the first blank
 * row (notes and rules written under a table are not part of it). */
function dataRows(sheet: Sheet, header: { row: number; col: Record<string, string> }, key: string) {
  const rows: number[] = [];
  for (let row = header.row + 1; sheet.has(row); row += 1) {
    if (cellText(sheet, row, header.col[key]) !== "") rows.push(row);
  }
  return rows;
}

function toNumber(value: string, tab: string, cell: string, issues: SpecIssue[], fatal = true): number | null {
  const number = Number(value.replace(",", "."));
  if (value === "" || !Number.isFinite(number)) {
    issues.push({ tab, cell, message: `expected a number, found "${value}"`, fatal });
    return null;
  }
  return number;
}

/** Finds the value to the right of a label cell anywhere in a sheet. */
function labelledValue(sheet: Sheet, label: RegExp): { value: string; cell: string } | null {
  for (const [row, cells] of sheet) {
    for (const [letter, cell] of cells) {
      if (label.test(cell.value)) {
        const next = String.fromCharCode(letter.charCodeAt(0) + 1);
        return { value: cellText(sheet, row, next), cell: `${next}${row}` };
      }
    }
  }
  return null;
}

export function platformOf(text: string): Platform {
  const t = norm(text);
  if (t.startsWith("to confirm")) return "unconfirmed";
  if (t.includes("shopify")) return "shopify";
  if (t.includes("woocommerce")) return "woocommerce";
  if (t.includes("html_search") || t.includes("html search")) return "html_search";
  if (t === "pdf") return "pdf";
  return "none"; // "No online shop", "Wix", "Custom (DNN)", "-"
}

export function roleOf(text: string): Role | null {
  const t = norm(text);
  if (t.startsWith("pricing")) return "pricing";
  if (t.startsWith("accessibility only")) return "accessibility";
  if (t.startsWith("availability only")) return "availability";
  if (t.startsWith("advice link only") || t.startsWith("disabled")) return "skip";
  return null;
}

/** Excel stores dates as day serials from 1899-12-30. */
export function excelDateToIso(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------

export function parseSpec(workbook: Workbook): SpecResult {
  const issues: SpecIssue[] = [];
  const tab = (key: keyof typeof TABS): Sheet | null => {
    const sheet = workbook.get(TABS[key]);
    if (!sheet) issues.push({ tab: TABS[key], cell: "-", message: "tab is missing", fatal: true });
    return sheet ?? null;
  };

  // ---------------------------------------------------------------- 1_Sources
  const sources: Source[] = [];
  const sourcesSheet = tab("sources");
  if (sourcesSheet) {
    const h = findHeader(sourcesSheet, TABS.sources,
      ["id", "nursery", "website", "platform", "role in app", "enabled"],
      ["region", "delivers to", "notes"], issues);
    if (h) {
      for (const row of dataRows(sourcesSheet, h, "id")) {
        const get = (key: string) => (h.col[key] ? cellText(sourcesSheet, row, h.col[key]) : "");
        const id = get("id");
        if (!/^[A-Z]\d+$/.test(id)) continue; // notes under the table
        const enabledText = get("enabled").toUpperCase();
        if (enabledText !== "Y" && enabledText !== "N") {
          issues.push({ tab: TABS.sources, cell: `${h.col.enabled}${row}`, message: `enabled must be Y or N, found "${get("enabled")}"`, fatal: true });
          continue;
        }
        const role = roleOf(get("role in app"));
        if (!role) {
          issues.push({ tab: TABS.sources, cell: `${h.col["role in app"]}${row}`, message: `unknown role "${get("role in app")}"`, fatal: true });
          continue;
        }
        const platform = platformOf(get("platform"));
        const websiteText = get("website");
        let website: string | null = null;
        if (["shopify", "woocommerce", "html_search", "unconfirmed"].includes(platform)) {
          try {
            const url = new URL(/^https?:\/\//.test(websiteText) ? websiteText : `https://${websiteText}`);
            if (!url.hostname.includes(".")) throw new Error("no domain");
            website = url.origin;
          } catch {
            if (enabledText === "Y") {
              issues.push({ tab: TABS.sources, cell: `${h.col.website}${row}`, message: `invalid website "${websiteText}"`, fatal: true });
            }
          }
        }
        if (platform === "html_search" && enabledText === "Y") {
          issues.push({ tab: TABS.sources, cell: `${h.col.platform}${row}`, message: "html_search needs CSS selector columns, which the workbook does not have yet", fatal: false });
        }
        sources.push({
          id, nursery: get("nursery"), website, platform, platformText: get("platform"),
          role, roleText: get("role in app"), region: get("region"), deliversTo: get("delivers to"),
          enabled: enabledText === "Y", notes: get("notes"), row,
        });
      }
    }
  }

  // ---------------------------------------------------------------- 2_Branches
  const branches: Branch[] = [];
  const branchSheet = tab("branches");
  if (branchSheet) {
    const h = findHeader(branchSheet, TABS.branches, ["nursery id", "branch", "street address", "town"], ["lat", "lon"], issues);
    if (h) {
      for (const row of dataRows(branchSheet, h, "nursery id")) {
        const get = (key: string) => (h.col[key] ? cellText(branchSheet, row, h.col[key]) : "");
        const lat = Number(get("lat"));
        const lon = Number(get("lon"));
        const address = get("street address");
        branches.push({
          sourceId: get("nursery id"), name: get("branch"), address, town: get("town"),
          online: /online only/i.test(address),
          lat: get("lat") && Number.isFinite(lat) ? lat : null,
          lon: get("lon") && Number.isFinite(lon) ? lon : null,
          row,
        });
      }
    }
  }

  // ---------------------------------------------------------------- 3_PDF_Sources
  const pdfSources: PdfSource[] = [];
  let pdfWindowDays = 90;
  const pdfSheet = tab("pdfSources");
  if (pdfSheet) {
    const window = labelledValue(pdfSheet, /may be outdated.*after/i);
    if (!window) {
      issues.push({ tab: TABS.pdfSources, cell: "-", message: "the 'May be outdated after (days)' cell is missing", fatal: true });
    } else {
      pdfWindowDays = toNumber(window.value, TABS.pdfSources, window.cell, issues) ?? pdfWindowDays;
    }
    const h = findHeader(pdfSheet, TABS.pdfSources, ["file name", "channel", "catalogue date"], ["nursery", "parser notes", "source id"], issues);
    if (h) {
      if (!h.col["source id"]) {
        issues.push({ tab: TABS.pdfSources, cell: `row ${h.row}`, message: "no 'source id' column yet - PDFs cannot be linked to their nursery, so they are skipped", fatal: false });
      }
      for (const row of dataRows(pdfSheet, h, "file name")) {
        const get = (key: string) => (h.col[key] ? cellText(pdfSheet, row, h.col[key]) : "");
        if (!/\.pdf$/i.test(get("file name"))) continue;
        const channelText = norm(get("channel"));
        const channel = channelText.startsWith("retail") ? "retail" : channelText.startsWith("wholesale") ? "wholesale" : null;
        if (!channel) {
          issues.push({ tab: TABS.pdfSources, cell: `${h.col.channel}${row}`, message: `channel must be Retail or Wholesale, found "${get("channel")}"`, fatal: true });
          continue;
        }
        const serial = toNumber(get("catalogue date"), TABS.pdfSources, `${h.col["catalogue date"]}${row}`, issues);
        if (serial === null) continue;
        pdfSources.push({
          sourceId: get("source id") || null, fileName: get("file name"), nursery: get("nursery"),
          channel, catalogueDate: excelDateToIso(serial), parserNotes: get("parser notes"), row,
        });
      }
    }
  }

  // ---------------------------------------------------------------- 5_Size_Parser
  let k = 1700;
  let litresPerKg = 1;
  const parserSheet = tab("sizeParser");
  if (parserSheet) {
    const kCell = labelledValue(parserSheet, /conversion constant k/i);
    if (!kCell) issues.push({ tab: TABS.sizeParser, cell: "-", message: "the 'Conversion constant k' cell is missing", fatal: true });
    else k = toNumber(kCell.value, TABS.sizeParser, kCell.cell, issues) ?? k;
    // The kg rule is stated in words, e.g. "1 kg bag ≈ 1 L".
    for (const cells of parserSheet.values()) {
      for (const cell of cells.values()) {
        const rule = /(\d+(?:[.,]\d+)?)\s*kg[^≈=]*[≈=]\s*(\d+(?:[.,]\d+)?)\s*L/i.exec(cell.value);
        if (rule) litresPerKg = Number(rule[2].replace(",", ".")) / Number(rule[1].replace(",", "."));
      }
    }
  }

  // ---------------------------------------------------------------- 6_Size_Classes
  const sizeClasses: SizeClass[] = [];
  const classSheet = tab("sizeClasses");
  if (classSheet) {
    const h = findHeader(classSheet, TABS.sizeClasses, ["class", "d min", "d max", "used for budget"], [], issues);
    if (h) {
      for (const row of dataRows(classSheet, h, "class")) {
        const get = (key: string) => cellText(classSheet, row, h.col[key]);
        const name = get("class");
        const plug = /plug|seedling/i.test(name);
        const useText = norm(get("used for budget"));
        const use = useText.includes("reference") ? "reference" : useText.startsWith("fallback") ? "fallback" : "no";
        const dMin = get("d min") ? toNumber(get("d min"), TABS.sizeClasses, `${h.col["d min"]}${row}`, issues) : null;
        const dMax = get("d max") ? toNumber(get("d max"), TABS.sizeClasses, `${h.col["d max"]}${row}`, issues) : null;
        if (!plug && dMin === null) {
          issues.push({ tab: TABS.sizeClasses, cell: `${h.col["d min"]}${row}`, message: `class "${name}" has no d min`, fatal: true });
        }
        sizeClasses.push({ name, dMin, dMax, plug, use });
      }
    }
  }
  const reference = sizeClasses.find((c) => c.use === "reference");
  if (classSheet && !reference) {
    issues.push({ tab: TABS.sizeClasses, cell: "-", message: "no class is marked as the reference class", fatal: true });
  }

  // ---------------------------------------------------------------- 7_Location
  const bands: Band[] = [];
  let earthRadiusKm = 6371;
  const locationSheet = tab("location");
  if (locationSheet) {
    const h = findHeader(locationSheet, TABS.location, ["band", "from km", "to km", "label shown"], [], issues);
    if (h) {
      for (const row of dataRows(locationSheet, h, "band")) {
        const get = (key: string) => cellText(locationSheet, row, h.col[key]);
        if (!get("from km")) break; // end of the band table
        const from = toNumber(get("from km"), TABS.location, `${h.col["from km"]}${row}`, issues);
        const to = get("to km") ? toNumber(get("to km"), TABS.location, `${h.col["to km"]}${row}`, issues) : null;
        if (from === null) continue;
        bands.push({ name: get("band"), fromKm: from, toKm: to, label: get("label shown") });
      }
    }
    const radius = labelledValue(locationSheet, /earth radius/i);
    if (radius) earthRadiusKm = toNumber(radius.value, TABS.location, radius.cell, issues) ?? earthRadiusKm;
  }

  // ---------------------------------------------------------------- 9_Output
  const outputFields: string[] = [];
  const outputSheet = tab("output");
  if (outputSheet) {
    const h = findHeader(outputSheet, TABS.output, ["field shown"], [], issues);
    if (h) for (const row of dataRows(outputSheet, h, "field shown")) outputFields.push(cellText(outputSheet, row, h.col["field shown"]));
  }

  const errors = issues.filter((issue) => issue.fatal);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    warnings: issues.filter((issue) => !issue.fatal),
    spec: {
      sources, branches, pdfSources, pdfWindowDays, k, litresPerKg, sizeClasses,
      referenceClass: reference!.name, bands, earthRadiusKm, outputFields,
    },
  };
}
