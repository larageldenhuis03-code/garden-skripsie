import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { PoliteClient } from "../app/lib/sourcing/http.ts";
import { handleSourcing, nurseryLocations, type SourcingRequest } from "../app/lib/sourcing/server.ts";
import type { SourcingSpec } from "../app/lib/sourcing/spec.ts";
import { FileCache, loadCatalogues, SpecLoader } from "../app/lib/sourcing/specLoader.ts";

/**
 * Dev server only: POST /api/sourcing, answered in Node so it can read the
 * workbook on this laptop LIVE - edit Nursery_Sourcing_Search_Spec.xlsx and
 * the next layout uses the change, with no code change and no restart.
 * (The dev worker runtime cannot read local files; the deployed worker
 * answers the same route from the build-time snapshot.)
 */
export function sourcingDevServer(): Plugin {
  const root = process.cwd(); // the project root when `npm run dev` runs
  const snapshot = (() => {
    try {
      return JSON.parse(readFileSync(resolve(root, "app/data/sourcing_spec.generated.json"), "utf8")) as { version: string; spec: SourcingSpec };
    } catch {
      return null;
    }
  })();
  const loader = new SpecLoader({
    path: resolve(process.env.SOURCING_SPEC_PATH ?? resolve(root, "..", "Nursery_Sourcing_Search_Spec.xlsx")),
    lastGood: snapshot?.spec ?? null,
    lastGoodVersion: snapshot?.version,
  });
  const pdfDirs = [
    resolve(process.env.SOURCING_PDF_DIR ?? resolve(root, "..", "accessiblity pdf's")),
    resolve(root, "data", "raw", "catalogues"),
  ];
  const cache = new FileCache(resolve(root, ".sourcing-cache.json"));
  const client = new PoliteClient({ cache });

  return {
    name: "sourcing-dev-server",
    apply: "serve",
    configureServer(server) {
      // GET /api/nurseries: branch pins for the step 1 map, from the live
      // workbook (geocoded once per address, cached).
      server.middlewares.use("/api/nurseries", async (req, res, next) => {
        if (req.method !== "GET") return next();
        let payload: unknown;
        try {
          const loaded = loader.load();
          payload = loaded.spec
            ? { ok: true, ...(await nurseryLocations(loaded.spec, client)) }
            : { ok: false, pins: [], notMapped: [] };
          cache.save();
        } catch (error) {
          console.error("[sourcing]", error);
          payload = { ok: false, pins: [], notMapped: [] };
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(payload));
      });
      server.middlewares.use("/api/sourcing", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          let payload: unknown;
          try {
            const request = JSON.parse(body || "{}") as SourcingRequest;
            const loaded = loader.load(); // re-reads only when the file changed
            const { catalogues } = loaded.spec
              ? loadCatalogues({ spec: loaded.spec, pdfDirs, parsedDir: resolve(root, "data/processed/catalogues"), repoRoot: root })
              : { catalogues: new Map() };
            payload = await handleSourcing(request, {
              spec: loaded.spec, specVersion: loaded.version, specWarning: loaded.warning, catalogues, client,
            });
            cache.save();
          } catch (error) {
            // Never crash the dev server over sourcing.
            console.error("[sourcing]", error);
            payload = { ok: false, error: "Sourcing failed on the server.", specWarning: null };
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        });
      });
    },
  };
}
