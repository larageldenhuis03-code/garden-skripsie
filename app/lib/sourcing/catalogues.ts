/**
 * 3_PDF_Sources: parsed PDF catalogues (the only snapshot source). The rows
 * come from data/scripts/ingest_catalogues.py, parsed once per PDF version;
 * whether a list "may be outdated" is calculated here, never read from the
 * workbook's formula cells.
 */

export type CatalogueRow = {
  name: string;
  commonName?: string | null;
  sizeText: string | null;
  heightText?: string | null;
  /** Retail price, or a wholesale price that must never reach the budget. */
  price: number | null;
  qty: number | null;
  limited?: boolean;
  section?: string | null;
};

export type ParsedCatalogue = {
  fileName: string;
  layout: string;
  sourceMtimeMs: number;
  parsedAt: string;
  rows: CatalogueRow[];
};

const DAY = 86_400_000;

/** "May be outdated" once today is past catalogue date + window (days). */
export function catalogueStatus(
  catalogueDate: string,
  windowDays: number,
  today: Date,
): { outdated: boolean; currentUntil: string } {
  const until = new Date(Date.parse(`${catalogueDate}T00:00:00Z`) + windowDays * DAY);
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return { outdated: day > until.getTime(), currentUntil: until.toISOString().slice(0, 10) };
}

export const monthYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** The snapshot note shown on every PDF-sourced line. */
export function snapshotNote(catalogueDate: string, outdated: boolean): string {
  return outdated
    ? `May be outdated — as at ${monthYear(catalogueDate)}, confirm with nursery`
    : `Price as at ${monthYear(catalogueDate)} — confirm with nursery`;
}

export const WHOLESALE_NOTE = "Grown commercially in SA — ask your nursery";
