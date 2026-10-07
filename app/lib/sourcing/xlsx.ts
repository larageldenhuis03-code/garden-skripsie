import { inflateRawSync } from "node:zlib";

/**
 * Minimal .xlsx reader (Node only): unzips the workbook with node:zlib and
 * reads cell values with regular expressions. No dependency, and enough for
 * a configuration workbook of text and numbers.
 *
 * Formula cells are marked, and their cached results are NOT returned as
 * values: the spec says Excel's cached formula results may be missing or
 * stale (TODAY()), so the code recalculates every rule itself and reads
 * input cells only.
 */

export type Cell = { value: string; formula: boolean };
/** row number -> column letters -> cell */
export type Sheet = Map<number, Map<string, Cell>>;
export type Workbook = Map<string, Sheet>;

export function unzip(buffer: Buffer): Map<string, Buffer> {
  // End of central directory: signature 0x06054b50, searched from the end.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx (zip) file.");
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < entries; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt zip directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    const localName = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const data = buffer.subarray(start, start + compressedSize);
    files.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function decode(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function textOf(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
}

export function readWorkbook(buffer: Buffer): Workbook {
  const files = unzip(buffer);
  const read = (name: string) => files.get(name)?.toString("utf8") ?? "";

  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textOf(m[1]),
  );
  const rels = new Map(
    [...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/>/g)].map((m) => [
      /Id="([^"]+)"/.exec(m[1])?.[1] ?? "",
      /Target="([^"]+)"/.exec(m[1])?.[1] ?? "",
    ]),
  );

  const workbook: Workbook = new Map();
  for (const m of read("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = decode(/name="([^"]+)"/.exec(m[1])?.[1] ?? "");
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1] ?? "";
    const target = (rels.get(rid) ?? "").replace(/^\//, "");
    const xml = read(target.startsWith("xl/") ? target : `xl/${target}`);
    const sheet: Sheet = new Map();
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? "";
      const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
      if (!ref) continue;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const formula = /<f\b/.test(body);
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s" && raw !== undefined) value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (raw !== undefined) value = decode(raw);
      value = value.trim();
      if (!value && !formula) continue;
      const row = Number(ref[2]);
      if (!sheet.has(row)) sheet.set(row, new Map());
      // A formula's cached result is deliberately dropped.
      sheet.get(row)!.set(ref[1], { value: formula ? "" : value, formula });
    }
    workbook.set(name, sheet);
  }
  return workbook;
}
