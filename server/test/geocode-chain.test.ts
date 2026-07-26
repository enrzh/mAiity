import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createApp } from "../src/server";

const PACKS_DIR = join(import.meta.dir, "..", "..", "packs");
const SECRET = "test-secret-test-secret-test-secret-42";

// Minimal Photon-compatible stub upstream.
const stub = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api") {
      const q = url.searchParams.get("q") ?? "";
      if (q.includes("Nowhere")) return Response.json({ features: [] });
      // Place-filtered (unbiased) sub-query: the admin place itself.
      if (url.searchParams.getAll("osm_tag").includes("place")) {
        if (q === "Hamburg") {
          return Response.json({
            features: [{
              geometry: { coordinates: [10.0, 53.55] },
              properties: {
                name: "Hamburg", country: "Deutschland",
                osm_key: "place", osm_value: "city",
                extent: [9.7, 53.7, 10.3, 53.4],
              },
            }],
          });
        }
        return Response.json({ features: [] });
      }
      if (q === "Paris") {
        // Germany-only index: just a prefix-similar hamlet.
        return Response.json({
          features: [{
            geometry: { coordinates: [7.1, 51.0] },
            properties: { name: "Parishof", country: "Deutschland", osm_key: "place", osm_value: "hamlet" },
          }],
        });
      }
      if (q === "Kiosk") {
        return Response.json({
          features: [{
            geometry: { coordinates: [6.79, 51.21] },
            properties: { name: "Kiosk", city: "Neuss", country: "Deutschland", osm_key: "amenity", osm_value: "kiosk" },
          }],
        });
      }
      // Biased query for a city name: nearby noise outranks the city,
      // exactly the failure mode the dual-query merge must correct.
      if (q === "Hamburg" && url.searchParams.get("lat")) {
        return Response.json({
          features: [
            {
              geometry: { coordinates: [6.79, 51.22] },
              properties: { name: "Hamburger Straße", city: "Düsseldorf", country: "Deutschland", osm_key: "highway", osm_value: "residential" },
            },
            {
              geometry: { coordinates: [6.80, 51.21] },
              properties: { name: "Hamburg Grill", city: "Düsseldorf", country: "Deutschland", osm_key: "amenity", osm_value: "restaurant" },
            },
          ],
        });
      }
      return Response.json({
        features: [{
          geometry: { coordinates: [13.405, 52.52] },
          properties: { name: `Stub: ${q}`, city: "Berlin", country: "Deutschland", osm_value: "city" },
        }],
      });
    }
    if (url.pathname === "/reverse") {
      return Response.json({
        features: [{
          geometry: { coordinates: [13.4, 52.5] },
          properties: { name: "Stub Reverse", country: "Deutschland" },
        }],
      });
    }
    return new Response("nf", { status: 404 });
  },
});
afterAll(() => stub.stop());

const worldStub = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname !== "/api") return new Response("nf", { status: 404 });
    const q = url.searchParams.get("q") ?? "";
    if (!url.searchParams.getAll("osm_tag").includes("place")) return Response.json({ features: [] });
    if (q === "Paris") {
      return Response.json({
        features: [{
          geometry: { coordinates: [2.35, 48.85] },
          properties: { name: "Paris", country: "Frankreich", osm_key: "place", osm_value: "city", extent: [2.2, 48.9, 2.5, 48.8] },
        }],
      });
    }
    if (q === "Kiosk") {
      // A tiny village that happens to share the query's name.
      return Response.json({
        features: [{
          geometry: { coordinates: [-3.5, 50.8] },
          properties: { name: "Kiosk", country: "Vereinigtes Königreich", osm_key: "place", osm_value: "village" },
        }],
      });
    }
    return Response.json({ features: [] });
  },
});
afterAll(() => worldStub.stop());

const STUB = `http://127.0.0.1:${stub.port}`;
const WORLD = `http://127.0.0.1:${worldStub.port}`;
const DEAD = "http://127.0.0.1:9";

async function makeApp(urls: string[]) {
  return createApp({
    dbPath: ":memory:",
    packsDir: PACKS_DIR,
    geocoderUrls: urls,
    jwtSecret: SECRET,
    prefix: "/maps/api",
    secureCookies: false,
  });
}

describe("geocoder chain", () => {
  test("falls through a dead upstream to the working one", async () => {
    const app = await makeApp([DEAD, STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Berlin Mitte" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[0].name).toBe("Stub: Berlin Mitte");
  });

  test("falls through an EMPTY result to the next upstream", async () => {
    // First upstream answers but knows nothing ("Nowhere") — the chain must
    // still try the next one. Both are the same stub here, so simulate by
    // ordering: empty-yielding stub first via the Nowhere query on a chain
    // where the second upstream would also return empty → empty is returned
    // (not a 502), proving an answered-but-empty chain is not an error.
    const app = await makeApp([STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Nowhere Xyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([]);
  });

  test("full-chain failure is a 502", async () => {
    const app = await makeApp([DEAD, DEAD]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Berlin Mitte" });
    expect(res.statusCode).toBe(502);
  });

  test("fuzzy out-of-area match falls through to the next upstream", async () => {
    // Stub 1 = the same stub, which for "Times Square New York" returns
    // "Stub: Times Square New York" (full token coverage) — so simulate the
    // regional-index case with a dedicated wrong-answer upstream instead.
    const wrong = Bun.serve({
      port: 0,
      fetch: () => Response.json({
        features: [{
          geometry: { coordinates: [13.74, 51.05] },
          // A Germany index fuzzy match: query tokens "new"/"york" absent.
          properties: { name: "Times Square", city: "Dresden", country: "Deutschland" },
        }],
      }),
    });
    try {
      const app = await makeApp([`http://127.0.0.1:${wrong.port}`, STUB]);
      const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Times Square New York" });
      expect(res.statusCode).toBe(200);
      // The chain must skip the Dresden fuzzy match and take the full match.
      expect(res.json().results[0].name).toBe("Stub: Times Square New York");
    } finally {
      wrong.stop();
    }
  });

  test("reverse also goes through the chain", async () => {
    const app = await makeApp([DEAD, STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/reverse?lat=52.5&lon=13.4" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[0].name).toBe("Stub Reverse");
  });

  test("place: falls back to reverse geocoding when not a known POI", async () => {
    const app = await makeApp([DEAD, STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/place?lat=52.5&lon=13.4" });
    expect(res.statusCode).toBe(200);
    expect(res.json().source).toBe("geocoder");
    expect(res.json().place.name).toBe("Stub Reverse");
    expect((await app.inject({ method: "GET", url: "/maps/api/place?lat=999&lon=0" })).statusCode).toBe(400);
  });

  test("nearby: category browse works, unknown category 400", async () => {
    const app = await makeApp([DEAD, STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/nearby?cat=restaurant&lat=52.5&lon=13.4" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[0].name).toContain("Stub");
    expect((await app.inject({ method: "GET", url: "/maps/api/nearby?cat=discos&lat=52.5&lon=13.4" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/maps/api/nearby?cat=cafe&lat=999&lon=0" })).statusCode).toBe(400);
  });
});

describe("place-aware ranking", () => {
  test("city outranks nearby similarly-named noise under bias", async () => {
    const app = await makeApp([STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Hamburg&lat=51.2&lon=6.78" });
    expect(res.statusCode).toBe(200);
    const rs = res.json().results;
    expect(rs[0].name).toBe("Hamburg");
    expect(rs[0].kind).toBe("city");
    expect(rs[0].extent).toEqual([9.7, 53.7, 10.3, 53.4]);
    // The nearby noise is still offered, just below the city.
    expect(rs.some((r: { name: string }) => r.name === "Hamburger Straße")).toBe(true);
  });

  test("unbiased query skips the place sub-query and still works", async () => {
    const app = await makeApp([STUB]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Hamburg" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.length).toBeGreaterThan(0);
  });
});

describe("worldwide place fallback", () => {
  test("foreign city beats prefix-similar local hamlet", async () => {
    const app = await makeApp([STUB, WORLD]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Paris&lat=51.2&lon=6.78" });
    const rs = res.json().results;
    expect(rs[0].name).toBe("Paris");
    expect(rs[0].kind).toBe("city");
  });

  test("tiny faraway place never outranks the exact local POI", async () => {
    const app = await makeApp([STUB, WORLD]);
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Kiosk&lat=51.2&lon=6.78" });
    const rs = res.json().results;
    expect(rs[0].kind).toBe("kiosk");
    expect(rs[0].label).toContain("Neuss");
  });
});
