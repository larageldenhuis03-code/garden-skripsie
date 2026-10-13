/**
 * Polite HTTP for live sourcing (0_README fixed rule 5): robots.txt is
 * respected, at most one request per second per site, a 5-second timeout,
 * and sites are queried in parallel (each host has its own queue).
 *
 * Results are cached with a timestamp for speed only (TTL 7 days). The cache
 * is never hand-edited and never treated as data.
 */

export const USER_AGENT =
  "SillyGooseGardenPlanner/0.1 (Stellenbosch University skripsie; garden bed planner)";
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The error a capped client returns instead of sending a request that
 * would take it past maxRequests. Callers treat it as "not checked this
 * time", never as a failure of the nursery. */
export const OUT_OF_REQUESTS = "request limit reached";

export type CacheEntry = { at: number; value: unknown };

export interface SourcingCache {
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  /** Drops every entry whose key starts with the prefix. */
  clear(prefix: string): void;
}

export class MemoryCache implements SourcingCache {
  readonly entries = new Map<string, CacheEntry>();
  get(key: string) {
    return this.entries.get(key);
  }
  set(key: string, entry: CacheEntry) {
    this.entries.set(key, entry);
  }
  clear(prefix: string) {
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.entries.delete(key);
  }
}

export type FetchResult<T> =
  | { ok: true; data: T; at: number; fromCache: boolean }
  | { ok: false; error: string };

type Robots = { allow: string[]; disallow: string[] } | "all" | "none";

/** Parses the rules that apply to us: our own agent group if present,
 * else the "*" group. */
export function parseRobots(text: string, agent = "sillygoose"): Robots {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" && value) current.allow.push(value);
    if (field === "disallow" && value) current.disallow.push(value);
  }
  const mine =
    groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a))) ??
    groups.find((g) => g.agents.includes("*"));
  return mine ? { allow: mine.allow, disallow: mine.disallow } : "all";
}

function ruleMatches(rule: string, path: string): boolean {
  const pattern = rule
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  return new RegExp(`^${pattern}`).test(path);
}

/** Longest matching rule wins; Allow wins a tie. */
export function robotsAllows(robots: Robots, url: string): boolean {
  if (robots === "all") return true;
  if (robots === "none") return false;
  const { pathname, search } = new URL(url);
  const path = pathname + search;
  const longest = (rules: string[]) =>
    Math.max(-1, ...rules.filter((rule) => ruleMatches(rule, path)).map((rule) => rule.length));
  const allow = longest(robots.allow);
  const disallow = longest(robots.disallow);
  return disallow < 0 || allow >= disallow;
}

export type PoliteClientOptions = {
  fetch?: typeof fetch;
  cache?: SourcingCache;
  minIntervalMs?: number;
  timeoutMs?: number;
  ttlMs?: number;
  now?: () => number;
  /** Skips the per-host wait (tests with a mocked fetch). */
  noDelay?: boolean;
  /**
   * The most network requests this client may send, robots.txt included.
   * A Cloudflare worker on the free plan may make 50 subrequests per
   * incoming request, so the deployed route gives every request its own
   * capped client. Unset (the dev server, scripts) means no cap.
   */
  maxRequests?: number;
};

export class PoliteClient {
  private readonly fetchImpl: typeof fetch;
  readonly cache: SourcingCache;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly noDelay: boolean;
  private readonly maxRequests: number;
  /** Requests promised to callers that passed the cap check, so parallel
   * callers cannot all pass it at once. */
  private planned = 0;
  private readonly robotsPlanned = new Set<string>();
  /** Set once a request has been refused because of the cap. */
  outOfRequests = false;
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly lastStart = new Map<string, number>();
  private readonly robots = new Map<string, Promise<Robots>>();
  /** Why robots.txt could not be read, per origin, for the message. */
  private readonly robotsFailure = new Map<string, string>();
  /** Requests actually sent (not served from cache), for reporting. */
  requests = 0;

  constructor(options: PoliteClientOptions = {}) {
    // Bound to globalThis on purpose. Cloudflare Workers rejects `fetch`
    // called with the wrong `this` - storing the bare reference and
    // invoking it as `this.fetchImpl(...)` throws "Illegal invocation" for
    // every request, which is how the deployed worker came to report every
    // nursery and the geocoder as unreachable while local dev was fine
    // (Node tolerates the detached call).
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
    this.cache = options.cache ?? new MemoryCache();
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.ttlMs = options.ttlMs ?? CACHE_TTL_MS;
    this.now = options.now ?? Date.now;
    this.noDelay = options.noDelay ?? false;
    this.maxRequests = options.maxRequests ?? Number.POSITIVE_INFINITY;
  }

  /** Runs `task` in the host's queue, at least minIntervalMs after the
   * previous request to the same host started. */
  private schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(host) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(async () => {
      const wait = (this.lastStart.get(host) ?? 0) + this.minIntervalMs - Date.now();
      if (wait > 0 && !this.noDelay) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastStart.set(host, Date.now());
      return task();
    });
    this.queues.set(host, run);
    return run;
  }

  private async raw(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      this.requests += 1;
      return await this.fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/plain, */*" },
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private robotsFor(origin: string): Promise<Robots> {
    if (!this.robots.has(origin)) {
      const host = new URL(origin).host;
      this.robots.set(
        origin,
        this.schedule(host, async () => {
          try {
            const response = await this.raw(`${origin}/robots.txt`);
            if (response.status >= 400 && response.status < 500) return "all" as Robots;
            if (!response.ok) {
              this.robotsFailure.set(origin, `HTTP ${response.status}`);
              return "none" as Robots;
            }
            return parseRobots(await response.text());
          } catch (error) {
            // Unreachable robots.txt: treated as "do not crawl" (the
            // conservative reading), so the site shows as not checked. The
            // reason is kept rather than discarded - a failure nobody can
            // read is a failure nobody can fix.
            this.robotsFailure.set(
              origin,
              error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            );
            return "none" as Robots;
          }
        }),
      );
    }
    return this.robots.get(origin)!;
  }

  /** GET a URL, from the cache when fresh, politely otherwise. */
  async get<T>(url: string, cacheKey: string, parse: "json" | "text" = "json"): Promise<FetchResult<T>> {
    const cached = this.cache.get(cacheKey);
    if (cached && this.now() - cached.at < this.ttlMs) {
      return { ok: true, data: cached.value as T, at: cached.at, fromCache: true };
    }
    const { origin, host } = new URL(url);
    // The cap: this fetch, plus robots.txt if this origin has not had it.
    const needsRobots = !url.includes("nominatim.openstreetmap.org") && !this.robotsPlanned.has(origin);
    const cost = 1 + (needsRobots ? 1 : 0);
    if (this.planned + cost > this.maxRequests) {
      this.outOfRequests = true;
      return { ok: false, error: OUT_OF_REQUESTS };
    }
    this.planned += cost;
    if (needsRobots) this.robotsPlanned.add(origin);
    if (!url.includes("nominatim.openstreetmap.org")) {
      const robots = await this.robotsFor(origin);
      if (robots === "none") {
        const why = this.robotsFailure.get(origin);
        return {
          ok: false,
          error: why ? `robots.txt could not be read (${why})` : "robots.txt could not be read",
        };
      }
      if (!robotsAllows(robots, url)) return { ok: false, error: "robots.txt disallows this search" };
    }
    try {
      return await this.schedule(host, async () => {
        const response = await this.raw(url);
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}` } as FetchResult<T>;
        const data = (parse === "json" ? await response.json() : await response.text()) as T;
        const at = this.now();
        this.cache.set(cacheKey, { at, value: data });
        return { ok: true, data, at, fromCache: false } as FetchResult<T>;
      });
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "timed out after 5 s" : String(error);
      return { ok: false, error: message };
    }
  }
}
