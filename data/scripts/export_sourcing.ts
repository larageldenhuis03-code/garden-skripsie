/**
 * Snapshot of the nursery sourcing settings for the DEPLOYED app, which
 * cannot read the workbook on Lara's laptop:
 *
 *   Nursery_Sourcing_Search_Spec.xlsx -> app/data/sourcing_spec.generated.json
 *   parsed PDF catalogues             -> app/data/catalogues.generated.json
 *
 * On the dev server the workbook is read live on every run instead; this
 * snapshot is also its "last good" config when the workbook is invalid.
 * Run by sync_dataset.mjs, or: node --experimental-strip-types
 * data/scripts/export_sourcing.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalogues, SpecLoader } from "../../app/lib/sourcing/specLoader.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SOURCING_SPEC_PATH = resolve(
  process.env.SOURCING_SPEC_PATH ?? resolve(REPO_ROOT, "..", "Nursery_Sourcing_Search_Spec.xlsx"),
);
export const PDF_DIRS = [
  resolve(process.env.SOURCING_PDF_DIR ?? resolve(REPO_ROOT, "..", "accessiblity pdf's")),
  resolve(REPO_ROOT, "data", "raw", "catalogues"),
];

const loaded = new SpecLoader({ path: SOURCING_SPEC_PATH, log: () => undefined }).load();
if (!loaded.spec || loaded.warning) {
  console.error(`[sourcing] ${loaded.warning ?? "no valid settings"} - snapshot NOT updated.`);
  process.exit(1);
}
const { catalogues, notices } = loadCatalogues({
  spec: loaded.spec,
  pdfDirs: PDF_DIRS,
  parsedDir: resolve(REPO_ROOT, "data", "processed", "catalogues"),
  repoRoot: REPO_ROOT,
});
writeFileSync(
  resolve(REPO_ROOT, "app/data/sourcing_spec.generated.json"),
  `${JSON.stringify({ version: loaded.version, spec: loaded.spec }, null, 1)}\n`,
);
writeFileSync(resolve(REPO_ROOT, "app/data/catalogues.generated.json"), JSON.stringify(Object.fromEntries(catalogues)));
for (const line of [...loaded.notices, ...notices]) console.log(`[sourcing] ${line}`);
console.log(`[sourcing] snapshot written: ${loaded.spec.sources.length} sources, ${catalogues.size} catalogues.`);
