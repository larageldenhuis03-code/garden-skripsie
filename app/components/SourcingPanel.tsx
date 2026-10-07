"use client";

import { useEffect, useState } from "react";
import type { Offer, SourcingReport, SpeciesReport } from "../lib/sourcing/run.ts";
import type { SourcingResponse } from "../lib/sourcing/server.ts";

/**
 * "Where to buy" - the live nursery sourcing panel (workbook tab 9_Output).
 * It ANNOTATES a layout: it reads the plants and quantities and never
 * changes what was selected or where it sits. Prices are fetched live from
 * the nursery sites on each run (cached up to 7 days for speed only).
 */

type Item = { plantId: string; n: number; label: string };

const money = (value: number) => `R${value.toFixed(2)}`;
const rand = (value: number) => `R${Math.round(value).toLocaleString("en-ZA").replace(/\u00a0/g, " ")}`;
const date = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });

/** One cell per 9_Output field, keyed by the field name in the workbook. */
const CELLS: Record<string, (offer: Offer) => React.ReactNode> = {
  nursery: (o) => (
    <>
      <strong>{o.nursery}</strong>
      {o.branch && !o.online ? <small>{o.branch}</small> : null}
    </>
  ),
  distance: (o) =>
    o.online ? (
      <span>online{o.deliversTo ? `, delivers ${o.deliversTo}` : ""}</span>
    ) : o.distanceKm !== null ? (
      <span>
        {Math.round(o.distanceKm)} km{o.approximate ? " (town)" : ""} · {o.bandLabel}
      </span>
    ) : (
      <span>distance unknown</span>
    ),
  size: (o) => <span>{o.size}</span>,
  "price per plant": (o) =>
    o.pricePerPlant !== null ? (
      <span>
        {money(o.pricePerPlant)}
        {o.pack > 1 && o.packPrice !== null ? <small> ({money(o.packPrice)} ÷ {o.pack})</small> : null}
      </span>
    ) : (
      <span>—</span>
    ),
  stock: (o) => <span>{o.stock ?? "not stated"}</span>,
  link: (o) =>
    o.link ? (
      <a href={o.link} target="_blank" rel="noreferrer">
        View
      </a>
    ) : (
      <span>PDF list</span>
    ),
  checked: (o) => <span>{date(o.checked)}</span>,
  "match label": (o) => <span className={`match-label match-${o.matchLabel === "Found" ? "found" : "related"}`}>{o.matchLabel}</span>,
  "snapshot note": (o) => <span>{o.snapshotNote ?? ""}</span>,
};

function offerFields(fields: string[]): string[] {
  return fields.map((f) => f.toLowerCase()).filter((f) => f in CELLS);
}

function SpeciesBlock({ species, label, fields }: { species: SpeciesReport; label: string; fields: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? species.offers : species.offers.slice(0, 4);
  return (
    <div className="sourcing-species">
      <h4>
        {label} <em>{species.scientificName}</em> <span>× {species.n}</span>
        <span className={`match-label match-${species.label.toLowerCase().replace(/\s+/g, "-")}`}>{species.label}</span>
        {species.classFallback ? <small> priced in {species.classFallback} (not sold in the standard size)</small> : null}
      </h4>
      {shown.length > 0 ? (
        <div className="sourcing-table" role="table">
          <div role="row" className="sourcing-row sourcing-head">
            {fields.map((f) => (
              <span key={f} role="columnheader">{f[0].toUpperCase() + f.slice(1)}</span>
            ))}
          </div>
          {shown.map((offer, i) => (
            <div role="row" className="sourcing-row" key={`${offer.sourceId}-${offer.title}-${i}`}>
              {fields.map((f) => (
                <span key={f} role="cell">{CELLS[f](offer)}</span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="sourcing-empty">No nursery listing found for this plant.</p>
      )}
      {species.offers.length > 4 && (
        <button className="text-link" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${species.offers.length} listings`}
        </button>
      )}
      {species.availability.map((a) => (
        <p key={a.nursery} className="sourcing-availability">
          {a.nursery}: {a.note}. <small>{a.snapshotNote}</small>
        </p>
      ))}
    </div>
  );
}

export function SourcingPanel({
  items,
  place,
  compact = false,
  onBudget,
}: {
  items: Item[];
  place: string | null;
  /** Plant detail view: one plant, no bed budget. */
  compact?: boolean;
  /** Called with the bed budget line once it arrives (for saving). */
  onBudget?: (budget: { text: string; checkedAt: string; place: string | null }) => void;
}) {
  // The town field starts from the finder's place; the panel is keyed on
  // that place by its parent's props, so a new place starts a new panel.
  const [town, setTown] = useState(place ?? "");
  const [runKey, setRunKey] = useState(0);
  const signature = JSON.stringify(items.map(({ plantId, n }) => [plantId, n]));
  const requestKey = `${signature}|${runKey}`;
  // Each result remembers which request it answers, so "loading" is simply
  // "no result for the current request yet" - no state reset in the effect.
  const [result, setResult] = useState<
    | { key: string; status: "error"; message: string; specWarning: string | null }
    | { key: string; status: "done"; report: SourcingReport; specWarning: string | null }
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    const key = requestKey;
    fetch("/api/sourcing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: (JSON.parse(signature) as [string, number][]).map(([plantId, n]) => ({ plantId, n })),
        place: town || null,
      }),
    })
      .then((response) => response.json() as Promise<SourcingResponse>)
      .then((response) => {
        if (cancelled) return;
        if (response.ok) {
          onBudget?.({ text: response.report.budgetText, checkedAt: response.report.checkedAt, place: town || null });
        }
        setResult(
          response.ok
            ? { key, status: "done", report: response.report, specWarning: response.specWarning }
            : { key, status: "error", message: response.error, specWarning: response.specWarning },
        );
      })
      .catch(() => {
        if (!cancelled) setResult({ key, status: "error", message: "Couldn't reach the sourcing service.", specWarning: null });
      });
    return () => {
      cancelled = true;
    };
    // `town` is applied only when the user asks to check again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const state = result && result.key === requestKey ? result : { status: "loading" as const };

  const labels = new Map(items.map((item) => [item.plantId, item.label]));
  const report = state.status === "done" ? state.report : null;
  const fields = report ? offerFields(report.outputFields) : [];
  // 9_Output's section ORDER is no longer followed: the budget always
  // leads and the per-nursery detail is collapsed behind it, because the
  // full tables were the main source of overwhelm on this page. The
  // workbook still decides which offer FIELDS appear (see `fields`).

  const budget = report && !compact && (
    <div className="sourcing-budget" key="budget">
      <h4>Bed budget</h4>
      <p>
        <strong>{report.budgetText}</strong>
      </p>
      <p>
        Prices incl. VAT, excl. delivery · checked {date(report.checkedAt)}
        {report.budget.estimatedSpecies > 0 ? ` · ${report.budget.estimatedSpecies} species estimated` : ""}
        {report.budget.notFoundSpecies > 0 ? ` · ${report.budget.notFoundSpecies} not found` : ""}
        {report.budget.outdatedPrices > 0 ? ` · ${report.budget.outdatedPrices} prices may be outdated` : ""}
      </p>
      {report.basket && (
        <p>
          One-stop option: {report.basket.nursery} stocks {report.basket.speciesStocked} of{" "}
          {report.basket.speciesTotal} species, about {rand(report.basket.total)}.
        </p>
      )}
    </div>
  );
  const walkIn = report && report.walkIn.length > 0 && (
    <div className="sourcing-walkin" key="walkin">
      <h4>Walk-in only nurseries</h4>
      <ul>
        {report.walkIn.map((w) => (
          <li key={w.branch}>
            {w.nursery} · {w.town} · {w.contact}
            {w.distanceKm !== null ? ` · ${Math.round(w.distanceKm)} km · ${w.bandLabel}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className={`sourcing-panel${compact ? " is-compact" : ""}`}>
      <div className="sourcing-heading">
        <h3>Where to buy</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setRunKey((k) => k + 1);
          }}
        >
          <label>
            Your town or suburb
            <input value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Stellenbosch" />
          </label>
          <button className="text-link" type="submit">
            Check again
          </button>
        </form>
      </div>
      {(state.status !== "loading" && state.specWarning) && <p className="sourcing-warning">{state.specWarning}</p>}
      {state.status === "loading" && (
        <p className="sourcing-loading">Checking nurseries live… the first check can take up to a minute.</p>
      )}
      {state.status === "error" && <p className="sourcing-warning">{state.message}</p>}
      {report && (
        <>
          {report.warnings.map((w) => (
            <p key={w} className="sourcing-warning">{w}</p>
          ))}
          {/* The total answers "what will this cost?" on its own. Every
              nursery, price and link behind it is reference material, so
              it waits until it is asked for rather than arriving as a
              wall of tables. */}
          {budget}
          {!compact && (
            <details className="sourcing-details">
              <summary>
                Where each plant is sold
                <small>
                  {report.species.length} species ·{" "}
                  {(() => {
                    const listings = report.species.reduce((n, s) => n + s.offers.length, 0);
                    return `${listings} ${listings === 1 ? "listing" : "listings"}`;
                  })()}
                  {report.walkIn.length > 0 ? ` · ${report.walkIn.length} walk-in only` : ""}
                </small>
              </summary>
              {report.species.map((s) => (
                <SpeciesBlock key={s.plantId} species={s} label={labels.get(s.plantId) ?? ""} fields={fields} />
              ))}
              {walkIn}
              <p className="sourcing-footnote">
                Sourcing never changes your layout. Prices and stock are read live from each nursery&apos;s site; PDF lists
                are labelled with their date. Always confirm with the nursery.
              </p>
            </details>
          )}
          {compact &&
            report.species.map((s) => (
              <SpeciesBlock key={s.plantId} species={s} label={labels.get(s.plantId) ?? ""} fields={fields} />
            ))}
        </>
      )}
    </section>
  );
}
