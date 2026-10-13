/**
 * reports/final_comparison.md, the numeric part: the baseline run against
 * the final run (same 100 scenarios, same seeds), and any ablation runs.
 *
 * Run: node --experimental-strip-types scripts/final-compare.ts \
 *        before=reports/final_baseline.csv after=reports/final_after.csv \
 *        ["D26 off (contact_bonus 0.05)=reports/final_ablate_d26.csv" ...]
 * Prints markdown to stdout.
 */
import { readFileSync } from "node:fs";

type Row = Record<string, string>;
const load = (path: string): Row[] => {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const keys = head.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i], v])));
};
const runs = process.argv.slice(2).map((arg) => {
  const at = arg.lastIndexOf("=");
  return { label: arg.slice(0, at), rows: load(arg.slice(at + 1)) };
});
const [before, after, ...ablations] = runs;

const pct = (values: number[], q: number) => {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const r = q * (s.length - 1);
  const lo = Math.floor(r);
  return s[lo] + (s[Math.ceil(r)] - s[lo]) * (r - lo);
};
const fmt = (v: number, dp: number) => (Number.isFinite(v) ? v.toFixed(dp) : "-");
const cell = (values: number[], dp: number) => `${fmt(pct(values, 0.5), dp)} (${fmt(pct(values, 0.1), dp)}-${fmt(pct(values, 0.9), dp)})`;
const ok = (rows: Row[]) => rows.filter((r) => r.status === "provisional-plan");
const num = (key: string) => (r: Row) => (r[key] === "" || r[key] === undefined ? NaN : Number(r[key]));

const METRICS: [string, (r: Row) => number, number][] = [
  ["cover", num("cover"), 3],
  ["empty-cell share", num("empty_cell_share"), 3],
  ["largest empty patch", num("largest_empty_patch"), 3],
  ["quadrant CV", num("quadrant_cv"), 3],
  ["unknown-colour share (plants, colours chosen)", num("unknown_colour_share"), 3],
  ["species", num("species"), 1],
  ["plants", num("plants"), 1],
  ["Z", num("z"), 4],
  ["A1 height balance", num("A1"), 3],
  ["A2 colour", num("A2"), 3],
  ["A3 variety", num("A3"), 3],
  ["A4 ground cover", num("A4"), 3],
  ["A5 flowering", num("A5"), 3],
  ["run time per brief, ms (all options)", num("brief_ms"), 0],
  ["unplaced plants", num("unplaced"), 1],
];

function table(filter: (r: Row) => boolean): string {
  const b = before.rows.filter(filter);
  const a = after.rows.filter(filter);
  const lines = [`| measure | ${before.label} | ${after.label} |`, "|---|---|---|"];
  for (const [name, get, dp] of METRICS) {
    lines.push(`| ${name} | ${cell(ok(b).map(get), dp)} | ${cell(ok(a).map(get), dp)} |`);
  }
  const scenariosWithPlan = (rows: Row[]) => new Set(ok(rows).filter((r) => r.option === "1").map((r) => r.scenario)).size;
  const scenarios = (rows: Row[]) => new Set(rows.map((r) => r.scenario)).size;
  lines.push(`| **scenarios with a plan** | ${scenariosWithPlan(b)} / ${scenarios(b)} | ${scenariosWithPlan(a)} / ${scenarios(a)} |`);
  lines.push(`| **option rows with a plan** | ${ok(b).length} | ${ok(a).length} |`);
  const withUnknown = (rows: Row[]) => {
    const chosen = ok(rows).filter((r) => r.colours_chosen === "true");
    const hit = chosen.filter((r) => Number(r.unknown_colour_share) > 0).length;
    return `${hit} / ${chosen.length} (mean share ${fmt(chosen.reduce((s, r) => s + Number(r.unknown_colour_share || 0), 0) / Math.max(1, chosen.length), 3)})`;
  };
  lines.push(`| **rows (colours chosen) with an unknown-colour plant** | ${withUnknown(b)} | ${withUnknown(a)} |`);
  const violations = (rows: Row[]) => {
    const bad = ok(rows).filter((r) => r.hard_failures);
    if (bad.length === 0) return "0";
    const counts = new Map<string, number>();
    for (const r of bad) for (const id of r.hard_failures.split("+")) counts.set(id, (counts.get(id) ?? 0) + 1);
    return `${bad.length} (${[...counts].map(([k, n]) => `${k} x${n}`).join(", ")})`;
  };
  lines.push(`| **hard violations (H1-H5, H3b, H7, P1, P2, P3 ...)** | ${violations(b)} | ${violations(a)} |`);
  return lines.join("\n");
}

const out: string[] = [];
const say = (line = "") => out.push(line);
const hashes = (rows: Row[]) => `rulebook \`${rows[0]?.rulebook}\`, dataset \`${rows[0]?.dataset}\``;
say(`**${before.label}:** ${hashes(before.rows)}. **${after.label}:** ${hashes(after.rows)}.`);
say("Same 100 scenarios and seeds; one row per scenario and option. Medians with the 10th-90th percentile, over option rows with a plan.");
say();
say("### All scenarios");
say();
say(table(() => true));
say();
for (const style of [...new Set(after.rows.map((r) => r.style))].sort()) {
  say(`### ${style}`);
  say();
  say(table((r) => r.style === style));
  say();
}
for (const band of ["small", "medium", "large"]) {
  say(`### ${band} beds (H2 band)`);
  say();
  say(table((r) => r.band === band));
  say();
}
if (ablations.length > 0) {
  say("### One decision at a time");
  say();
  say("Each row is the final engine with one decision undone, in memory, on the same seeds.");
  say();
  say("| run | scenarios with a plan | option rows | violations | cover | largest patch | quadrant CV | Z | A1 | plants |");
  say("|---|---|---|---|---|---|---|---|---|---|");
  for (const run of [after, ...ablations]) {
    const rows = ok(run.rows);
    say(
      `| ${run.label} | ${new Set(rows.filter((r) => r.option === "1").map((r) => r.scenario)).size} | ${rows.length} | ${rows.filter((r) => r.hard_failures).length} | ` +
        `${fmt(pct(rows.map(num("cover")), 0.5), 3)} | ${fmt(pct(rows.map(num("largest_empty_patch")), 0.5), 3)} | ${fmt(pct(rows.map(num("quadrant_cv")), 0.5), 3)} | ` +
        `${fmt(pct(rows.map(num("z")), 0.5), 4)} | ${fmt(pct(rows.map(num("A1")), 0.5), 3)} | ${fmt(pct(rows.map(num("plants")), 0.5), 0)} |`,
    );
  }
  say();
}
const lost = [...new Set(ok(before.rows).filter((r) => r.option === "1").map((r) => r.scenario))].filter(
  (id) => !ok(after.rows).some((r) => r.scenario === id && r.option === "1"),
);
const gained = [...new Set(ok(after.rows).filter((r) => r.option === "1").map((r) => r.scenario))].filter(
  (id) => !ok(before.rows).some((r) => r.scenario === id && r.option === "1"),
);
say(`Scenarios that lost their plan: ${lost.length ? lost.map((id) => `${id} (${after.rows.find((r) => r.scenario === id)?.bed})`).join(", ") : "none"}. Gained one: ${gained.length ? gained.join(", ") : "none"}.`);
say(`D28 band fallbacks in the final run: ${ok(after.rows).reduce((s, r) => s + Number(r.band_fallbacks || 0), 0)} species-placements in ${ok(after.rows).filter((r) => Number(r.band_fallbacks || 0) > 0).length} option rows.`);
console.log(out.join("\n"));
