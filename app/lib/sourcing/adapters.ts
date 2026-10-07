import type { PoliteClient } from "./http.ts";
import type { Platform, Source } from "./spec.ts";
import { cleanTitle } from "./sizes.ts";

/**
 * One adapter per PLATFORM, not per nursery (1_Sources): adding a nursery
 * on a known platform is one row in the workbook. Each adapter searches,
 * and can then expand a matched product into its sellable variants (the
 * size/price combinations).
 */

export type Product = {
  key: string;
  /** When this search result was fetched (ms) - the "date checked". */
  at: number;
  title: string;
  url: string;
  /** Lowest price the search shows (for variable products this is "from"). */
  price: number | null;
  inStock: boolean | null;
  description: string;
  /** Shopify handle or WooCommerce variation ids, for expansion. */
  handle?: string;
  variationIds?: number[];
};

export type Variant = {
  title: string;
  variant: string | null;
  url: string;
  price: number | null;
  inStock: boolean | null;
  description: string;
};

export type SearchResult = { ok: true; products: Product[] } | { ok: false; error: string };

const stripHtml = (html: string) => cleanTitle(html ?? "");

// ---------------------------------------------------------------- Shopify

type ShopifySuggest = {
  resources?: { results?: { products?: { title: string; url: string; price?: string; price_min?: string; available?: boolean; handle?: string; body?: string }[] } };
};

async function shopifySearch(client: PoliteClient, source: Source, query: string): Promise<SearchResult> {
  const origin = source.website!;
  const url = `${origin}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=10`;
  const result = await client.get<ShopifySuggest>(url, `${source.id}|${url}`);
  if (result.ok && result.data.resources?.results?.products) {
    return {
      ok: true,
      products: result.data.resources.results.products.map((p) => {
        const path = p.url.split("?")[0];
        return {
          key: path, at: result.at, title: cleanTitle(p.title), url: `${origin}${path}`,
          price: Number(p.price_min ?? p.price) || null, inStock: p.available ?? null,
          description: stripHtml(p.body ?? ""), handle: p.handle ?? path.split("/").pop(),
        };
      }),
    };
  }
  // Fallback: the catalogue feed, filtered by the query words.
  const feedUrl = `${origin}/products.json?limit=250`;
  const feed = await client.get<{ products: { title: string; handle: string; body_html: string; variants: { price: string; available?: boolean }[] }[] }>(
    feedUrl, `${source.id}|${feedUrl}`,
  );
  if (!feed.ok) return { ok: false, error: result.ok ? "search returned no data" : result.error };
  const words = query.toLowerCase().split(/\s+/);
  return {
    ok: true,
    products: feed.data.products
      .filter((p) => words.every((word) => p.title.toLowerCase().includes(word)))
      .map((p) => ({
        key: `/products/${p.handle}`, at: feed.at, title: cleanTitle(p.title), url: `${origin}/products/${p.handle}`,
        price: Math.min(...p.variants.map((v) => Number(v.price))) || null,
        inStock: p.variants.some((v) => v.available !== false), description: stripHtml(p.body_html), handle: p.handle,
      })),
  };
}

async function shopifyVariants(client: PoliteClient, source: Source, product: Product): Promise<Variant[]> {
  const url = `${source.website}/products/${product.handle}.js`;
  const result = await client.get<{ title: string; description: string; variants: { title: string; price: number; available: boolean }[] }>(
    url, `${source.id}|${url}`,
  );
  if (!result.ok) return [{ title: product.title, variant: null, url: product.url, price: product.price, inStock: product.inStock, description: product.description }];
  const description = stripHtml(result.data.description ?? "");
  return result.data.variants.map((v) => ({
    title: product.title,
    variant: v.title && v.title !== "Default Title" ? cleanTitle(v.title) : null,
    url: product.url, price: v.price / 100, inStock: v.available, description,
  }));
}

// ---------------------------------------------------------------- WooCommerce

type WooProduct = {
  id: number; name: string; permalink: string; type: string; is_in_stock: boolean;
  short_description?: string; description?: string;
  prices: { price: string; currency_minor_unit: number };
  variations?: { id: number; attributes: { name: string; value: string }[] }[];
  attributes?: { name: string; terms?: { name: string }[] }[];
};

const wooPrice = (prices: WooProduct["prices"]) =>
  prices?.price ? Number(prices.price) / 10 ** (prices.currency_minor_unit ?? 2) : null;

async function wooSearch(client: PoliteClient, source: Source, query: string): Promise<SearchResult> {
  const url = `${source.website}/wp-json/wc/store/products?search=${encodeURIComponent(query)}&per_page=20`;
  const result = await client.get<WooProduct[]>(url, `${source.id}|${url}`);
  if (!result.ok) return { ok: false, error: result.error };
  if (!Array.isArray(result.data)) return { ok: false, error: "unexpected response" };
  return {
    ok: true,
    products: result.data.map((p) => ({
      key: String(p.id), at: result.at, title: cleanTitle(p.name), url: p.permalink, price: wooPrice(p.prices),
      inStock: p.is_in_stock ?? null, description: stripHtml(p.short_description ?? ""),
      variationIds: (p.variations ?? []).map((v) => v.id),
    })),
  };
}

async function wooVariants(client: PoliteClient, source: Source, product: Product): Promise<Variant[]> {
  const base = { title: product.title, url: product.url, description: product.description };
  if (!product.variationIds?.length) {
    return [{ ...base, variant: null, price: product.price, inStock: product.inStock }];
  }
  const variants: Variant[] = [];
  for (const id of product.variationIds.slice(0, 6)) {
    const url = `${source.website}/wp-json/wc/store/products/${id}`;
    const result = await client.get<WooProduct & { variation?: string }>(url, `${source.id}|${url}`);
    if (!result.ok) continue;
    const attributes = (result.data.variations ?? []).length ? "" : cleanTitle(String(result.data.variation ?? ""));
    variants.push({ ...base, variant: attributes || cleanTitle(result.data.name).replace(product.title, "").trim() || null, price: wooPrice(result.data.prices), inStock: result.data.is_in_stock ?? null });
  }
  return variants.length ? variants : [{ ...base, variant: null, price: product.price, inStock: product.inStock }];
}

// ---------------------------------------------------------------- detection

/** For "TO CONFIRM" platforms (owner decision): try Shopify, then
 * WooCommerce, then give up - and report which was found. */
export async function detectPlatform(client: PoliteClient, source: Source): Promise<Platform> {
  const origin = source.website!;
  const shopify = await client.get<ShopifySuggest>(
    `${origin}/search/suggest.json?q=plant&resources[type]=product&resources[limit]=1`, `${source.id}|detect-shopify`,
  );
  if (shopify.ok && shopify.data?.resources) return "shopify";
  const woo = await client.get<unknown>(`${origin}/wp-json/wc/store/products?per_page=1`, `${source.id}|detect-woo`);
  if (woo.ok && Array.isArray(woo.data)) return "woocommerce";
  return "none";
}

export const adapters = {
  shopify: { search: shopifySearch, variants: shopifyVariants },
  woocommerce: { search: wooSearch, variants: wooVariants },
} as const;
