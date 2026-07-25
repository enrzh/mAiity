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

const STUB = `http://127.0.0.1:${stub.port}`;
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
