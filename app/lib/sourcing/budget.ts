/**
 * 8_Budget - the standard bed budget. Per species i, over the nurseries
 * that list it (retail, reference size class):
 *
 *   P_min = lowest per-plant price, P_med = median, P_max = highest
 *   Low = Σ n_i P_min   Typical = Σ n_i P_med   High = Σ n_i P_max
 *
 * A species with no listing is Estimated (median per-plant price of the
 * same plant type and class, flagged) or else Not found (excluded, counted).
 * Price coverage = plants priced from real listings / all plants.
 * Prices incl. VAT, excl. delivery; wholesale prices are never used.
 */

export type BudgetItem = {
  plantId: string;
  n: number;
  /** Per-plant retail prices, one per nursery, in the chosen class. */
  prices: number[];
  /** Used only when `prices` is empty. */
  estimate: number | null;
  /** How many of `prices` come from lists older than the window. */
  outdatedPrices: number;
};

export type BudgetLine = {
  plantId: string;
  n: number;
  status: "Found" | "Estimated" | "Not found";
  pMin: number | null;
  pMed: number | null;
  pMax: number | null;
};

export type Budget = {
  low: number;
  typical: number;
  high: number;
  /** Plants priced from real listings / all plants. */
  coverage: number;
  /** Plants the figure covers (real listings + estimates) and all plants. */
  plantsInFigure: number;
  totalPlants: number;
  /** Plants of the not-found species - NOT in the figure. */
  notFoundPlants: number;
  estimatedSpecies: number;
  notFoundSpecies: number;
  outdatedPrices: number;
  lines: BudgetLine[];
};

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeBudget(items: BudgetItem[]): Budget {
  let low = 0;
  let typical = 0;
  let high = 0;
  let pricedPlants = 0;
  let totalPlants = 0;
  let estimatedSpecies = 0;
  let notFoundSpecies = 0;
  let notFoundPlants = 0;
  let plantsInFigure = 0;
  let outdatedPrices = 0;
  const lines: BudgetLine[] = [];
  for (const item of items) {
    totalPlants += item.n;
    let values: number[] = [];
    let status: BudgetLine["status"];
    if (item.prices.length > 0) {
      values = item.prices;
      status = "Found";
      pricedPlants += item.n;
      outdatedPrices += item.outdatedPrices;
    } else if (item.estimate !== null) {
      values = [item.estimate];
      status = "Estimated";
      estimatedSpecies += 1;
    } else {
      status = "Not found";
      notFoundSpecies += 1;
      notFoundPlants += item.n;
    }
    if (values.length === 0) {
      lines.push({ plantId: item.plantId, n: item.n, status, pMin: null, pMed: null, pMax: null });
      continue;
    }
    plantsInFigure += item.n;
    const pMin = Math.min(...values);
    const pMed = median(values);
    const pMax = Math.max(...values);
    low += item.n * pMin;
    typical += item.n * pMed;
    high += item.n * pMax;
    lines.push({ plantId: item.plantId, n: item.n, status, pMin, pMed, pMax });
  }
  return {
    low, typical, high,
    coverage: totalPlants > 0 ? pricedPlants / totalPlants : 0,
    plantsInFigure, totalPlants, notFoundPlants,
    estimatedSpecies, notFoundSpecies, outdatedPrices, lines,
  };
}

const rand = (value: number) =>
  `R${Math.round(value).toLocaleString("en-ZA").replace(/\u00a0/g, " ").replace(/\s/g, ",")}`;

/** The workbook's display text, e.g. "Budget R1,157 – R1,264 (typical
 * R1,213), 56% of plants priced from live listings". When some species
 * could not be priced at all, the line says so explicitly: the figure then
 * covers only part of the bed. */
export function budgetText(budget: Budget): string {
  const range = `${rand(budget.low)} – ${rand(budget.high)} (typical ${rand(budget.typical)})`;
  const live = `${Math.round(budget.coverage * 100)}% of plants priced from live listings`;
  if (budget.notFoundSpecies === 0) return `Budget ${range}, ${live}`;
  if (budget.plantsInFigure === 0) {
    return `No budget yet — none of the ${budget.totalPlants} plants (${budget.notFoundSpecies} species) was found at the nurseries checked.`;
  }
  return (
    `Budget ${range} for ${budget.plantsInFigure} of ${budget.totalPlants} plants — ` +
    `${budget.notFoundSpecies} species (${budget.notFoundPlants} plants) not found and not in this figure. ` +
    `${live[0].toUpperCase()}${live.slice(1)}.`
  );
}
