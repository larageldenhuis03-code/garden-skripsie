import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { ParsedCatalogue } from "./catalogues.ts";
import type { CacheEntry, SourcingCache } from "./http.ts";
import { parseSpec, type SourcingSpec } from "./spec.ts";
import { readWorkbook } from "./xlsx.ts";

/**
 * Node-only live loading (dev server, sync step, tests). The deployed worker
 * has no access to Lara's laptop and uses the generated snapshot instead.
 *
 * - The workbook is re-read on a run only when its modified time changed.
 * - It is read from a temporary copy, so an open Excel file never blocks it.
 * - An invalid workbook never crashes anything: the last valid config is
 *   kept and a visible warning names the tab and cell.
 */

export type LoadedSpec = {
  spec: SourcingSpec | null;
  /** Modified time of the workbook the spec came from. */
  version: string;
  /** Shown in the app when set. */
  warning: string | null;
  notices: string[];
};

export class SpecLoader {
  private lastMtime = -1;
  private lastGood: SourcingSpec | null;
  private lastGoodVersion: string;
  private current: LoadedSpec;
  readonly path: string;
  private readonly log: (message: string) => void;

  constructor(options: { path: string; lastGood?: SourcingSpec | null; lastGoodVersion?: string; log?: (message: string) => void }) {
    this.path = options.path;
    this.lastGood = options.lastGood ?? null;
    this.lastGoodVersion = options.lastGoodVersion ?? "snapshot";
    this.log = options.log ?? ((message) => console.warn(`[sourcing] ${message}`));
    this.current = { spec: this.lastGood, version: this.lastGoodVersion, warning: null, notices: [] };
  }

  load(): LoadedSpec {
    let mtime: number;
    try {
      mtime = statSync(this.path).mtimeMs;
    } catch {
      return this.fail(`Sourcing settings file not found at ${this.path} — using last good version`);
    }
    if (mtime === this.lastMtime) return this.current;
    this.lastMtime = mtime;

    const dir = mkdtempSync(join(tmpdir(), "sourcing-spec-"));
    try {
      const copy = join(dir, basename(this.path));
      copyFileSync(this.path, copy);
      const result = parseSpec(readWorkbook(readFileSync(copy)));
      if (!result.ok) {
        const first = result.errors[0];
        this.log(result.errors.map((e) => `${e.tab}/${e.cell}: ${e.message}`).join("; "));
        return this.fail(`Sourcing settings file has an error in ${first.tab}/${first.cell} (${first.message}) — using last good version`);
      }
      this.lastGood = result.spec;
      this.lastGoodVersion = new Date(mtime).toISOString();
      this.current = {
        spec: result.spec,
        version: this.lastGoodVersion,
        warning: null,
        notices: result.warnings.map((w) => `${w.tab}/${w.cell}: ${w.message}`),
      };
      return this.current;
    } catch (error) {
      this.log(String(error));
      return this.fail(`Sourcing settings file could not be read (${String(error).slice(0, 80)}) — using last good version`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  private fail(warning: string): LoadedSpec {
    this.log(warning);
    this.current = { spec: this.lastGood, version: this.lastGoodVersion, warning, notices: this.current.notices };
    return this.current;
  }
}

// ---------------------------------------------------------------------------
// PDF catalogues: parsed once per PDF version (file modified time)
// ---------------------------------------------------------------------------

function findFile(dirs: string[], name: string): string | null {
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const direct = join(dir, name);
    if (existsSync(direct)) return direct;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const found = findFile([join(dir, entry.name)], name);
        if (found) return found;
      }
    }
  }
  return null;
}

export function loadCatalogues(options: {
  spec: SourcingSpec;
  pdfDirs: string[];
  parsedDir: string;
  repoRoot: string;
  python?: string;
}): { catalogues: Map<string, ParsedCatalogue>; notices: string[] } {
  const catalogues = new Map<string, ParsedCatalogue>();
  const notices: string[] = [];
  for (const pdf of options.spec.pdfSources) {
    const jsonPath = join(options.parsedDir, `${pdf.fileName}.json`);
    const pdfPath = findFile(options.pdfDirs, pdf.fileName);
    let parsed: ParsedCatalogue | null = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8")) : null;
    if (pdfPath) {
      const mtime = Math.floor(statSync(pdfPath).mtimeMs);
      if (!parsed || Math.abs(parsed.sourceMtimeMs - mtime) > 1000) {
        // Added or changed: parse once now, never again until it changes.
        const run = spawnSync(options.python ?? "python", [resolve(options.repoRoot, "data/scripts/ingest_catalogues.py"), pdfPath], {
          cwd: options.repoRoot, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });
        if (run.status === 0 && existsSync(jsonPath)) {
          parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
          notices.push(run.stdout.trim());
        } else {
          notices.push(`${pdf.fileName}: parse failed (${(run.stderr || run.error?.message || "").trim().slice(0, 120)})`);
        }
      }
    } else if (!parsed) {
      notices.push(`${pdf.fileName}: PDF not found and never parsed`);
    }
    if (parsed) catalogues.set(pdf.fileName, parsed);
  }
  return { catalogues, notices };
}

// ---------------------------------------------------------------------------
// Cache persisted to a file between dev-server runs (speed only)
// ---------------------------------------------------------------------------

export class FileCache implements SourcingCache {
  private readonly entries: Map<string, CacheEntry>;
  private readonly path: string;
  constructor(path: string) {
    this.path = path;
    let data: Record<string, CacheEntry>;
    try {
      data = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      data = {};
    }
    this.entries = new Map(Object.entries(data));
  }
  get(key: string) {
    return this.entries.get(key);
  }
  set(key: string, entry: CacheEntry) {
    this.entries.set(key, entry);
  }
  clear(prefix: string) {
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.entries.delete(key);
  }
  save() {
    try {
      writeFileSync(this.path, JSON.stringify(Object.fromEntries(this.entries)));
    } catch {
      // Speed only: a cache that cannot be written is simply not kept.
    }
  }
}
