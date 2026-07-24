import type { FastifyInstance } from "fastify";
import type { Database } from "bun:sqlite";

/// Search component. Clients only ever call OUR api; the upstream engine is an
/// implementation detail (public Photon today, self-hosted Photon later — the
/// response format is identical, so swapping is an env-var change).
const CACHE_TTL_S = 24 * 3600;
const UA = "maps.privatenas.nl/0.1 (self-hosted hobby map; contact: leemojix@gmail.com)";

const now = () => Math.floor(Date.now() / 1000);

/** Category browsing ("Restaurants in der Nähe") — Photon osm_tag filters. */
export const NEARBY_CATEGORIES: Record<string, { term: string; tag: string }> = {
  restaurant: { term: "Restaurant", tag: "amenity:restaurant" },
  cafe: { term: "Café", tag: "amenity:cafe" },
  supermarket: { term: "Supermarkt", tag: "shop:supermarket" },
  fuel: { term: "Tankstelle", tag: "amenity:fuel" },
  pharmacy: { term: "Apotheke", tag: "amenity:pharmacy" },
  hotel: { term: "Hotel", tag: "tourism:hotel" },
  parking: { term: "Parken", tag: "amenity:parking" },
  atm: { term: "Geldautomat", tag: "amenity:atm" },
};

interface GeoResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  osmId?: number;
}

/** Photon GeoJSON → compact results the clients render directly. */
function normalize(json: unknown): GeoResult[] {
  const features = (json as { features?: unknown[] })?.features ?? [];
  const out: GeoResult[] = [];
  for (const f of features as Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: Record<string, unknown>;
  }>) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const name = (p.name as string) ?? [p.street, p.housenumber].filter(Boolean).join(" ");
    if (!name) continue;
    const label = [
      name,
      [p.street, p.housenumber].filter(Boolean).join(" ") !== name
        ? [p.street, p.housenumber].filter(Boolean).join(" ")
        : "",
      p.postcode,
      p.city ?? p.county,
      p.country,
    ]
      .filter((s) => s && String(s).trim())
      .join(", ");
    out.push({
      name,
      label,
      lat: coords[1],
      lon: coords[0],
      kind: (p.osm_value as string) ?? (p.type as string) ?? "place",
      osmId: p.osm_id as number | undefined,
    });
  }
  return out;
}

/** Serialize upstream calls and keep a polite minimum gap (public-API fair use). */
let upstreamChain: Promise<unknown> = Promise.resolve();
let lastUpstream = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = 250 - (Date.now() - lastUpstream);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastUpstream = Date.now();
    return fn();
  };
  const p = upstreamChain.then(run, run);
  upstreamChain = p.catch(() => {});
  return p;
}

export function registerGeocodeRoutes(app: FastifyInstance, db: Database, geocoderUrls: string[]) {
  const getCached = db.query(`SELECT response, created_at AS createdAt FROM geocode_cache WHERE key = ?`);
  const putCached = db.query(
    `INSERT INTO geocode_cache (key, response, created_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET response = excluded.response, created_at = excluded.created_at`
  );

  async function fetchOne(url: string): Promise<{ results: GeoResult[] } | null> {
    try {
      const res = await throttled(() =>
        fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) })
      );
      if (!res.ok) return null;
      return { results: normalize(await res.json()) };
    } catch {
      return null; // unreachable/timeout — try the next upstream
    }
  }

  /// Regional indexes fuzzy-match badly out of area (a Germany index answers
  /// "Times Square New York" with a Dresden venue). A result set only "wins"
  /// when most significant query words actually appear in it.
  function coversQuery(results: GeoResult[], query: string | null): boolean {
    if (results.length === 0) return false;
    if (!query) return true; // reverse lookups have no words to cover
    const tokens = query.toLowerCase().split(/[\s,]+/).filter((t) => t.length > 2);
    if (tokens.length === 0) return true;
    const haystack = results.slice(0, 3).map((r) => `${r.name} ${r.label}`.toLowerCase()).join(" ");
    const covered = tokens.filter((t) => haystack.includes(t)).length;
    return covered / tokens.length >= 0.6;
  }

  /// Upstream CHAIN: e.g. self-hosted Photon (Germany, unlimited) first, the
  /// public instance as worldwide fallback. Next upstream is tried when one
  /// is down, empty, OR its matches don't cover the query; only a full-chain
  /// failure is a 502.
  async function cachedFetch(
    key: string,
    path: string,
    query: string | null,
  ): Promise<{ results: GeoResult[] } | null> {
    const hit = getCached.get(key) as { response: string; createdAt: number } | null;
    if (hit && now() - hit.createdAt < CACHE_TTL_S) return JSON.parse(hit.response);
    let best: { results: GeoResult[] } | null = null;
    for (const base of geocoderUrls) {
      const payload = await fetchOne(`${base}${path}`);
      if (payload && (best === null || payload.results.length > 0)) best = payload;
      if (payload && coversQuery(payload.results, query)) { best = payload; break; }
    }
    if (best) putCached.run(key, JSON.stringify(best), now());
    return best;
  }

  app.get("/geocode", async (req, reply) => {
    const q = ((req.query as Record<string, string>).q ?? "").trim();
    if (q.length < 2) return { results: [] };
    const { lang = "de", lat, lon } = req.query as Record<string, string>;
    const limit = Math.min(parseInt((req.query as Record<string, string>).limit ?? "8", 10) || 8, 15);

    const params = new URLSearchParams({ q, lang, limit: String(limit) });
    // Optional camera bias — rounded so the cache still hits while panning.
    let biasKey = "";
    if (lat && lon) {
      const la = Number(lat), lo = Number(lon);
      if (Number.isFinite(la) && Number.isFinite(lo)) {
        params.set("lat", la.toFixed(1));
        params.set("lon", lo.toFixed(1));
        biasKey = `|${la.toFixed(1)},${lo.toFixed(1)}`;
      }
    }
    const key = `s|${q.toLowerCase()}|${lang}|${limit}${biasKey}`;
    const payload = await cachedFetch(key, `/api?${params}`, q);
    if (!payload) return reply.code(502).send({ error: "geocoder_unavailable" });
    return payload;
  });

  app.get("/nearby", async (req, reply) => {
    const { cat, lat, lon } = req.query as Record<string, string>;
    const category = NEARBY_CATEGORIES[cat ?? ""];
    if (!category) return reply.code(400).send({ error: "unknown_category" });
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180)
      return reply.code(400).send({ error: "invalid_coordinates" });

    const key = `n|${cat}|${la.toFixed(2)},${lo.toFixed(2)}`;
    const params = new URLSearchParams({
      q: category.term,
      osm_tag: category.tag,
      lat: la.toFixed(4),
      lon: lo.toFixed(4),
      limit: "15",
      lang: "de",
    });
    // query=null → no token-coverage check (POI names rarely contain the term),
    // but an empty local result still falls through to the next upstream.
    const payload = await cachedFetch(key, `/api?${params}`, null);
    if (!payload) return reply.code(502).send({ error: "geocoder_unavailable" });
    return payload;
  });

  app.get("/reverse", async (req, reply) => {
    const { lat, lon, lang = "de" } = req.query as Record<string, string>;
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180)
      return reply.code(400).send({ error: "invalid_coordinates" });
    const key = `r|${la.toFixed(5)},${lo.toFixed(5)}|${lang}`;
    const params = new URLSearchParams({ lat: la.toFixed(6), lon: lo.toFixed(6), lang });
    const payload = await cachedFetch(key, `/reverse?${params}`, null);
    if (!payload) return reply.code(502).send({ error: "geocoder_unavailable" });
    return payload;
  });
}
