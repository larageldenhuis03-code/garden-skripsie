import snapshot from "../../data/sourcing_spec.generated.json" with { type: "json" };
import { PoliteClient } from "../../lib/sourcing/http.ts";
import { nurseryLocations } from "../../lib/sourcing/server.ts";
import type { SourcingSpec } from "../../lib/sourcing/spec.ts";

/** GET /api/nurseries on the deployed worker (settings snapshot from the
 * last build; the dev server answers from the live workbook). */
const client = new PoliteClient();

export async function GET(): Promise<Response> {
  const spec = (snapshot as unknown as { spec: SourcingSpec }).spec;
  return Response.json({ ok: true, ...(await nurseryLocations(spec, client)) });
}
