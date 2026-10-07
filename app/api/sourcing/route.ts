import catalogues from "../../data/catalogues.generated.json" with { type: "json" };
import snapshot from "../../data/sourcing_spec.generated.json" with { type: "json" };
import type { ParsedCatalogue } from "../../lib/sourcing/catalogues.ts";
import { PoliteClient } from "../../lib/sourcing/http.ts";
import { handleSourcing, type SourcingRequest } from "../../lib/sourcing/server.ts";
import type { SourcingSpec } from "../../lib/sourcing/spec.ts";

/**
 * POST /api/sourcing on the deployed worker. The worker cannot read the
 * workbook on Lara's laptop, so it uses the settings snapshot from the last
 * build (data:sync); the nursery websites are still searched live. The dev
 * server answers this route itself with the live workbook (see
 * build/sourcing-dev-plugin.ts).
 */
const client = new PoliteClient();
const parsed = new Map(Object.entries(catalogues as unknown as Record<string, ParsedCatalogue>));

export async function POST(request: Request): Promise<Response> {
  let body: SourcingRequest;
  try {
    body = (await request.json()) as SourcingRequest;
  } catch {
    return Response.json({ ok: false, error: "Bad request.", specWarning: null }, { status: 400 });
  }
  const result = await handleSourcing(body, {
    spec: (snapshot as unknown as { spec: SourcingSpec }).spec,
    specVersion: (snapshot as unknown as { version: string }).version,
    specWarning: null,
    catalogues: parsed,
    client,
  });
  return Response.json(result);
}
