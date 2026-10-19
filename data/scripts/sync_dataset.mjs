/**
 * Keeps the app in step with the two workbooks it is built from:
 *
 *   FINAL.DATASET.FINAL.the correctone.xlsx (the plants; owner, 19 Oct 2026:
 *   the only dataset workbook to use)
 *     -> import_final_dataset.py -> data/processed/plant_database_western_cape.csv
 *     -> generate_plants_json.py -> app/data/plant_database.generated.json
 *
 *   Algorithm_rulebook.xlsx (every engine number)
 *     -> import_rulebook.py      -> app/data/engine_rules.generated.json
 *
 * Runs automatically before `npm run dev` and `npm run build` (predev /
 * prebuild), or by hand with `npm run data:sync`. Each workbook is
 * fingerprinted and its pipeline reruns only when that workbook changed.
 * The fingerprints go to app/data/*_version.generated.json, and every
 * saved garden records both, so a result can be traced to the exact data
 * and rules that produced it.
 *
 * The app is built from the generated JSON, never from a workbook at
 * runtime: the importers validate first, and a result stays reproducible
 * until the data is deliberately rebuilt.
 *
 * Locations: $FINAL_DATASET_PATH / $RULEBOOK_PATH, else beside the repo
 * (the skripsie folder). A missing workbook (another machine, CI) means
 * the committed generated file is used unchanged. A FAILING pipeline exits
 * non-zero, so a broken workbook can never be shipped.
 *
 *   node data/scripts/sync_dataset.mjs [--force]
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const force = process.argv.includes("--force");

const SOURCES = [
  {
    label: "dataset",
    workbook: resolve(
      process.env.FINAL_DATASET_PATH ??
        resolve(REPO_ROOT, "..", "FINAL.DATASET.FINAL.the correctone.xlsx"),
    ),
    output: resolve(REPO_ROOT, "app/data/plant_database.generated.json"),
    stamp: resolve(REPO_ROOT, "app/data/dataset_version.generated.json"),
    steps: (workbook) => [
      ["import_final_dataset.py", [workbook]],
      ["generate_plants_json.py", []],
    ],
    describe: (output) => ({ plantCount: JSON.parse(readFileSync(output, "utf8")).length }),
  },
  {
    label: "rulebook",
    workbook: resolve(
      process.env.RULEBOOK_PATH ?? resolve(REPO_ROOT, "..", "Algorithm_rulebook.xlsx"),
    ),
    output: resolve(REPO_ROOT, "app/data/engine_rules.generated.json"),
    stamp: resolve(REPO_ROOT, "app/data/rules_version.generated.json"),
    steps: (workbook) => [["import_rulebook.py", [workbook]]],
    describe: () => ({}),
  },
];

const log = (label, message) => console.log(`[${label}] ${message}`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

let python;
function findPython() {
  if (python !== undefined) return python;
  python = null;
  for (const command of ["python", "py", "python3"]) {
    if (spawnSync(command, ["--version"], { encoding: "utf8" }).status === 0) {
      python = command;
      break;
    }
  }
  return python;
}

function runStep(label, script, args) {
  log(label, `running ${script}`);
  const result = spawnSync(findPython(), [resolve(REPO_ROOT, "data/scripts", script), ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  if (result.status !== 0) {
    console.error(`[${label}] ${script} failed - nothing was updated from this workbook.`);
    process.exit(1);
  }
}

for (const source of SOURCES) {
  const { label, workbook, output, stamp: stampPath } = source;
  if (!existsSync(workbook)) {
    log(label, `workbook not found at ${workbook}; using the committed file.`);
    continue;
  }

  const sha256 = createHash("sha256").update(readFileSync(workbook)).digest("hex");
  const previous = readJson(stampPath);
  if (!force && previous?.sha256 === sha256 && existsSync(output)) {
    log(label, `unchanged (${sha256.slice(0, 12)}); nothing to rebuild.`);
    continue;
  }

  if (!findPython()) {
    console.error(`[${label}] ${basename(workbook)} changed but Python was not found, so it cannot be rebuilt.`);
    process.exit(1);
  }
  log(
    label,
    previous
      ? `workbook changed (${previous.sha256.slice(0, 12)} -> ${sha256.slice(0, 12)}); rebuilding.`
      : `no version stamp yet; building from ${basename(workbook)}.`,
  );
  // Work from a temporary copy: Excel (or OneDrive) holds an open
  // workbook locked against Python, but not against a copy.
  // The copy keeps the workbook's own file name, which the importers record.
  const copyDir = mkdtempSync(resolve(tmpdir(), "garden-sync-"));
  const copy = resolve(copyDir, basename(workbook));
  copyFileSync(workbook, copy);
  try {
    for (const [script, args] of source.steps(copy)) runStep(label, script, args);
  } finally {
    rmSync(copyDir, { recursive: true, force: true });
  }

  const stamp = {
    /** Short form recorded with saved gardens. */
    version: sha256.slice(0, 12),
    sha256,
    source: basename(workbook),
    ...source.describe(output),
    builtAt: new Date().toISOString(),
  };
  writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
  log(label, `rebuilt, version ${stamp.version}.`);
}

// ---------------------------------------------------------------------------
// Nursery sourcing settings: snapshot for the deployed app. (The dev server
// reads the workbook live on every run; see app/lib/sourcing/specLoader.ts.)
// A broken workbook keeps the previous snapshot and does not stop the build.
// ---------------------------------------------------------------------------
const sourcing = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", resolve(REPO_ROOT, "data/scripts/export_sourcing.ts")], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});
if (sourcing.status !== 0) console.warn("[sourcing] snapshot kept at its previous version.");
