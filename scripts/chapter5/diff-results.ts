/**
 * Every number that changed between two Chapter 5 result files, as
 * old | new | test. Arrays and objects are walked to their leaves; a leaf
 * that is only in one file is listed with "-" on the other side.
 *
 * Run: node --experimental-strip-types scripts/chapter5/diff-results.ts OLD.json NEW.json > out.md
 */
import { readFileSync } from "node:fs";

const [oldPath, newPath] = process.argv.slice(2);
const before = JSON.parse(readFileSync(oldPath, "utf8"));
const after = JSON.parse(readFileSync(newPath, "utf8"));

const leaves = (value: unknown, path: string, out: Map<string, unknown>) => {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      leaves(child, path ? `${path}.${key}` : key, out);
    }
  } else {
    out.set(path, value);
  }
  return out;
};
const a = leaves(before, "", new Map());
const b = leaves(after, "", new Map());
const show = (v: unknown) => (v === undefined ? "-" : typeof v === "number" ? String(Number(v.toFixed(6))) : String(v));
const testOf = (path: string) => {
  const head = path.split(".")[0];
  return /^t\d/i.test(head) ? head.toUpperCase() : head;
};

const rows: string[] = [];
for (const path of [...new Set([...a.keys(), ...b.keys()])]) {
  const x = a.get(path);
  const y = b.get(path);
  if (JSON.stringify(x) === JSON.stringify(y)) continue;
  rows.push(`| \`${path}\` | ${show(x)} | ${show(y)} | ${testOf(path)} |`);
}
console.log(`${rows.length} values differ.\n`);
console.log("| value | old (30 Sep / 1 Oct run) | new (final) | test |");
console.log("|---|---|---|---|");
console.log(rows.join("\n"));
