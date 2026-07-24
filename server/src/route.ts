import type { FastifyInstance } from "fastify";
import type { Database } from "bun:sqlite";

/// Directions component. Same philosophy as search: clients call OUR api;
/// the engine (public FOSSGIS Valhalla today, self-hosted Valhalla later) is
/// an env-swappable implementation detail with an identical request shape.
const CACHE_TTL_S = 10 * 60;
const UA = "maps.privatenas.nl/0.1 (self-hosted hobby map; contact: leemojix@gmail.com)";

const now = () => Math.floor(Date.now() / 1000);

const COSTINGS: Record<string, string> = {
  car: "auto",
  bike: "bicycle",
  foot: "pedestrian",
};

/** Decode a Valhalla polyline6 shape into [lon, lat] pairs. */
export function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let lat = 0, lon = 0, i = 0;
  while (i < encoded.length) {
    for (const which of [0, 1] as const) {
      let shift = 0, result = 0, byte: number;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta; else lon += delta;
    }
    coords.push([lon / 1e6, lat / 1e6]);
  }
  return coords;
}

interface RouteStep { instruction: string; distanceM: number; durationS: number }
export interface RouteResult {
  mode: string;
  distanceM: number;
  durationS: number;
  geometry: [number, number][];
  steps: RouteStep[];
}

function normalize(mode: string, trip: {
  legs?: Array<{
    shape?: string;
    maneuvers?: Array<{ instruction?: string; length?: number; time?: number }>;
  }>;
  summary?: { length?: number; time?: number };
}): RouteResult | null {
  const legs = trip?.legs ?? [];
  if (legs.length === 0) return null;
  const geometry: [number, number][] = [];
  const steps: RouteStep[] = [];
  for (const leg of legs) {
    if (leg.shape) geometry.push(...decodePolyline6(leg.shape));
    for (const m of leg.maneuvers ?? []) {
      steps.push({
        instruction: m.instruction ?? "",
        distanceM: Math.round((m.length ?? 0) * 1000),
        durationS: Math.round(m.time ?? 0),
      });
    }
  }
  return {
    mode,
    distanceM: Math.round((trip.summary?.length ?? 0) * 1000),
    durationS: Math.round(trip.summary?.time ?? 0),
    geometry,
    steps,
  };
}

export function registerRouteRoutes(app: FastifyInstance, db: Database, valhallaUrls: string[]) {
  const getCached = db.query(`SELECT response, created_at AS createdAt FROM geocode_cache WHERE key = ?`);
  const putCached = db.query(
    `INSERT INTO geocode_cache (key, response, created_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET response = excluded.response, created_at = excluded.created_at`
  );

  app.post("/route", async (req, reply) => {
    const b = (req.body ?? {}) as {
      from?: { lat?: number; lon?: number };
      to?: { lat?: number; lon?: number };
      mode?: string;
    };
    const ok = (p?: { lat?: number; lon?: number }) =>
      p && typeof p.lat === "number" && typeof p.lon === "number" &&
      p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180;
    if (!ok(b.from) || !ok(b.to)) return reply.code(400).send({ error: "invalid_coordinates" });
    const costing = COSTINGS[b.mode ?? "car"];
    if (!costing) return reply.code(400).send({ error: "invalid_mode" });

    const key = `route|${b.from!.lat!.toFixed(5)},${b.from!.lon!.toFixed(5)}|${b.to!.lat!.toFixed(5)},${b.to!.lon!.toFixed(5)}|${costing}`;
    const hit = getCached.get(key) as { response: string; createdAt: number } | null;
    if (hit && now() - hit.createdAt < CACHE_TTL_S) return JSON.parse(hit.response);

    const payload = JSON.stringify({
      locations: [
        { lat: b.from!.lat, lon: b.from!.lon },
        { lat: b.to!.lat, lon: b.to!.lon },
      ],
      costing,
      directions_options: { language: "de-DE", units: "kilometers" },
    });

    // Upstream chain: self-hosted engine first; a DOWN upstream falls through,
    // a definitive "no route" (HTTP 400) is authoritative and does not.
    let sawNoRoute = false;
    for (const base of valhallaUrls) {
      try {
        const res = await fetch(`${base}/route`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(10_000),
          body: payload,
        });
        // 400 = "this engine found no route" — authoritative for THIS engine
        // only (a regional graph may lack the area); still try the next one.
        if (res.status === 400) { sawNoRoute = true; continue; }
        if (!res.ok) continue;
        const json = (await res.json()) as { trip?: Parameters<typeof normalize>[1] };
        const result = json.trip ? normalize(b.mode ?? "car", json.trip) : null;
        if (!result) { sawNoRoute = true; continue; }
        putCached.run(key, JSON.stringify(result), now());
        return result;
      } catch {
        continue; // unreachable/timeout — try the next engine
      }
    }
    return reply
      .code(sawNoRoute ? 404 : 502)
      .send({ error: sawNoRoute ? "no_route_found" : "routing_unavailable" });
  });
}
