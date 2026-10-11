/**
 * `?trace=1` — the engine's working, printed to the console.
 *
 * For the demo video: one console group per stage, so the reasoning can
 * be shown rather than described. It is strictly a reader. Every number
 * here is one the engine has already computed and stored on the plan;
 * nothing is recomputed, nothing is inferred, and with the flag off not
 * a line of this file runs.
 *
 * If a figure is not on the plan, it is reported as unavailable rather
 * than estimated — a trace that guesses is worse than no trace.
 */

import type { GardenPlan, PlantAssessment } from "./gardenPlan.ts";

export function traceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("trace") === "1";
  } catch {
    return false;
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Why each excluded plant was excluded, counted by the constraint that
 * failed it. Read off the stored feasibility trace. */
function exclusionReasons(assessments: PlantAssessment[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const assessment of assessments) {
    if (assessment.status !== "excluded") continue;
    const failed = assessment.feasibility.trace.find(
      (entry) => entry.status === "fail" || entry.status === "unknown",
    );
    const key = failed ? `${failed.constraintId} (${failed.status})` : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function tracePlan(plan: GardenPlan, catalogueSize: number): void {
  const { engine } = plan;
  console.group(
    `%cSilly Goose — ${plan.character} — seed ${plan.seed}`,
    "font-weight:bold",
  );

  console.group("Stage 0 — which plants could be used at all");
  console.log(`catalogue in: ${catalogueSize}`);
  console.log(
    `candidate ${plan.counts.candidate} · review ${plan.counts.review} · excluded ${plan.counts.excluded}`,
  );
  const reasons = exclusionReasons(plan.assessments);
  if (reasons.length) {
    console.table(
      Object.fromEntries(reasons.map(([reason, n]) => [reason, { excluded: n }])),
    );
  }
  console.groupEnd();

  console.group("Stage 1 — how well each plant suits this brief");
  const top = plan.assessments
    .filter((a) => a.stage1 !== null)
    .sort((a, b) => (b.stage1?.score ?? 0) - (a.stage1?.score ?? 0))
    .slice(0, 5);
  if (top.length === 0) {
    console.log("no plant was scored (nothing survived Stage 0)");
  } else {
    console.table(
      Object.fromEntries(
        top.map((a) => {
          const t = a.stage1!.terms;
          return [
            a.plantId,
            {
              score: a.stage1!.score.toFixed(4),
              style: t.style.active ? t.style.value : "-",
              colour: t.colour.active ? t.colour.value : "-",
              extras: t.extras.active ? t.extras.value.toFixed(2) : "-",
              wind: t.wind.active ? t.wind.value : "-",
              "favourite bonus": t.saved.active ? (t.saved.value ? "yes" : "no") : "not in use",
            },
          ];
        }),
      ),
    );
  }
  console.groupEnd();

  console.group("Stages 2-3 — the mix that was chosen");
  if (!engine) {
    console.log("no plan was produced");
  } else {
    console.log(`Z ${engine.z.toFixed(4)} · mean plant score ${engine.sBar.toFixed(4)}`);
    console.table({
      "A1 height balance": { value: engine.goals.A1.toFixed(3) },
      "A2 colour": { value: engine.goals.A2.toFixed(3) },
      "A3 variety": { value: engine.goals.A3.toFixed(3) },
      "A4 ground cover": { value: engine.goals.A4.toFixed(3) },
      "A5 flowering": { value: engine.goals.A5.toFixed(3) },
    });
    console.table(
      Object.fromEntries(
        (plan.quantities?.quantities ?? []).map((q) => [q.id, { planted: q.quantity }]),
      ),
    );
    console.log(
      "hard checks:",
      engine.hard.map((h) => `${h.id} ${h.pass ? "pass" : "FAIL"}`).join(" · "),
    );
    if (engine.search) {
      console.log(
        `search: ${engine.search.acceptedWorse} worse moves accepted during annealing`,
      );
    }
    if (engine.dropped.length) {
      console.log("dropped by the fail rule:", engine.dropped.join(", "));
    }
  }
  console.groupEnd();

  console.group("Stage 4 — where each plant went");
  if (!plan.layout) {
    console.log("nothing was placed");
  } else {
    console.log(
      `placed ${plan.layout.placements.length} plants · ` +
        `planted cover ${pct(1 - plan.layout.realisedOpenSpaceRatio)} · ` +
        `open space ${pct(plan.layout.realisedOpenSpaceRatio)}`,
    );
    const unplaced = plan.layout.unplaced ?? [];
    if (unplaced.length) {
      console.table(
        Object.fromEntries(unplaced.map((u) => [u.plantId, { reason: u.reason }])),
      );
    } else {
      console.log("every plant in the mix was placed");
    }
    if (engine?.placementChecks?.length) {
      console.log(
        "placement checks:",
        engine.placementChecks.map((c) => `${c.id} ${c.pass ? "pass" : "FAIL"}`).join(" · "),
      );
    }
    if (engine) console.log(`wind profile: ${engine.windProfile}`);
  }
  console.groupEnd();

  if (plan.diagnostics.length) {
    console.group("Notes the planner recorded");
    plan.diagnostics.forEach((d) => console.log(d));
    console.groupEnd();
  }

  console.groupEnd();
}
