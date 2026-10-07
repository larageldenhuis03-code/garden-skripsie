import type { SizeClass, SourcingSpec } from "./spec.ts";

/**
 * 5_Size_Parser and 6_Size_Classes: turn every pot / bag / pack label into
 * one standard, then into a size class. Prices are only ever compared within
 * one class.
 */

export type ParsedSize = {
  /** Pot diameter in cm, when stated or converted from litres. */
  diameterCm: number | null;
  /** Pot volume in litres, when stated (or from a kg bag). */
  litres: number | null;
  /** Plants per pack (1 unless a tray / pack is stated). */
  pack: number;
  plug: boolean;
  /** The label that was read, for display ("17 cm", "4 L", "20 kg bag"). */
  label: string | null;
  /** Plant height in metres, stated after the container - never a pot size. */
  heightM: number | null;
  notes: string[];
};

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const num = (text: string) => Number(text.replace(",", "."));

/** Text cleaned of HTML entities and the broken-dash character some
 * WooCommerce shops return (U+FFFD). */
export function cleanTitle(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&(?:#8211|ndash|mdash);/g, "-")
    .replace(/�/g, "-")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSize(rawText: string, spec: Pick<SourcingSpec, "k" | "litresPerKg">): ParsedSize {
  const notes: string[] = [];
  let text = cleanTitle(rawText);

  // Height ("1.2m", "0,9m") comes after the container on tree lists: read it
  // and remove it so it can never be taken as a pot size.
  let heightM: number | null = null;
  const height = new RegExp(String.raw`(?<![\w.,])${NUM}\s?m(?![a-z²³])`, "i").exec(text);
  if (height) {
    heightM = num(height[1]);
    text = text.replace(height[0], " ");
  }

  // Packs: "tray of 6", "pack of 12", "6-pack", "6pk", "6 pk".
  let pack = 1;
  const packOf = /\b(?:tray|pack|punnet|box)\s+of\s+(\d+)\b/i.exec(text);
  const nPack = /\b(\d+)\s*-?\s*(?:pack|pk|pcs?|punnet)\b/i.exec(text);
  if (packOf) pack = Number(packOf[1]);
  else if (nPack) pack = Number(nPack[1]);

  const plug = /\b(plugs?|seedlings?|tray cells?)\b/i.test(text);

  const cm = new RegExp(String.raw`${NUM}\s*cm\b`, "i").exec(text);
  const litre = new RegExp(String.raw`${NUM}\s*(?:litres?|liters?|ltrs?|lt|l|ℓ)(?![a-z])`, "i").exec(text);
  const kg = new RegExp(String.raw`${NUM}\s*kg\b`, "i").exec(text);

  let diameterCm: number | null = null;
  let litres: number | null = null;
  let label: string | null = null;
  if (cm) {
    diameterCm = num(cm[1]);
    label = `${diameterCm} cm`;
  } else if (litre) {
    litres = num(litre[1]);
    label = `${litres} L`;
  } else if (kg) {
    litres = num(kg[1]) * spec.litresPerKg;
    label = `${num(kg[1])} kg bag`;
    notes.push("kg bag converted with the workbook's kg rule (still to confirm)");
  }
  if (diameterCm === null && litres !== null) {
    // 5_Size_Parser: V = d^3 / k  =>  d = (k V)^(1/3).
    diameterCm = Math.round(Math.cbrt(spec.k * litres) * 10) / 10;
  }
  if (plug && !label) label = "plug";
  if (pack > 1) label = `${label ?? "size not stated"}, pack of ${pack}`;

  return { diameterCm, litres, pack, plug, label, heightM, notes };
}

/** Litres <-> cm with V = d^3 / k. */
export const litresToCm = (litres: number, k: number) => Math.cbrt(k * litres);
export const cmToLitres = (cm: number, k: number) => cm ** 3 / k;

/** 5_Size_Parser price formats: "R 50,00" -> 50, "R1,112.50" -> 1112.5,
 * "R1 850" -> 1850. */
export function parsePrice(text: string): number | null {
  const match = /R?\s*([\d\s.,]+)/i.exec(text.replace(/\u00a0/g, " "));
  if (!match) return null;
  let value = match[1].replace(/\s+/g, "");
  if (value.includes(",") && value.includes(".")) value = value.replace(/,/g, "");
  else if (/,\d{1,2}$/.test(value)) value = value.replace(",", ".");
  else value = value.replace(/,/g, "");
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Per-plant price: pack price / plants per pack. */
export const perPlant = (price: number, pack: number) => price / Math.max(1, pack);

/** The size class a parsed size falls in, or null for "size not stated".
 * Diameters are rounded to the nearest cm first, which closes the 1 cm gaps
 * between classes (12/13, 17/18, ...). */
export function sizeClassOf(size: ParsedSize, classes: SizeClass[]): SizeClass | null {
  if (size.plug && size.diameterCm === null) return classes.find((c) => c.plug) ?? null;
  if (size.diameterCm === null) return null;
  const d = Math.round(size.diameterCm);
  return (
    classes.find(
      (c) => !c.plug && c.dMin !== null && d >= c.dMin && (c.dMax === null || d <= c.dMax),
    ) ?? null
  );
}

/** "Standard (reference)" -> "Standard". */
export const className = (name: string) => name.replace(/\s*\(.*\)\s*$/, "");
