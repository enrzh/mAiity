import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createApp } from "../src/server";
import { decodePolyline6 } from "../src/route";

const PACKS_DIR = join(import.meta.dir, "..", "..", "packs");
const SECRET = "test-secret-test-secret-test-secret-42";

// Valhalla stub: returns a fixed 2-leg-free trip for any /route POST.
const valhalla = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/route" && req.method === "POST") {
      const body = (await req.json()) as { costing: string };
      if (body.costing === "pedestrian") {
        // Simulate "no route" for foot in this stub.
        return Response.json({ error: "No path could be found" }, { status: 400 });
      }
      return Response.json({
        trip: {
          summary: { length: 2.5, time: 300 },
          legs: [{
            // Encoded polyline6 for a short two-point line.
            shape: encodePolyline6([[52.52, 13.405], [52.53, 13.415]]),
            maneuvers: [
              { instruction: "Fahren Sie nach Norden.", length: 1.2, time: 150 },
              { instruction: "Sie haben Ihr Ziel erreicht.", length: 0, time: 0 },
            ],
          }],
        },
      });
    }
    return new Response("nf", { status: 404 });
  },
});
afterAll(() => valhalla.stop());

/** Inverse of decodePolyline6 for the stub (lat/lon input pairs). */
function encodePolyline6(latLons: [number, number][]): string {
  let out = "", prevLat = 0, prevLon = 0;
  const enc = (v: number) => {
    let value = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (value >= 0x20) {
      s += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    return s + String.fromCharCode(value + 63);
  };
  for (const [lat, lon] of latLons) {
    const ilat = Math.round(lat * 1e6), ilon = Math.round(lon * 1e6);
    out += enc(ilat - prevLat) + enc(ilon - prevLon);
    prevLat = ilat; prevLon = ilon;
  }
  return out;
}

async function makeApp() {
  return createApp({
    dbPath: ":memory:",
    packsDir: PACKS_DIR,
    geocoderUrls: ["http://127.0.0.1:9"],
    jwtSecret: SECRET,
    prefix: "/maps/api",
    secureCookies: false,
    valhallaUrls: [`http://127.0.0.1:${valhalla.port}`],
  });
}

type App = Awaited<ReturnType<typeof makeApp>>;

async function authToken(app: App): Promise<string> {
  const reg = await app.inject({
    method: "POST", url: "/maps/api/auth/register",
    payload: { email: `p${Math.random().toString(36).slice(2)}@b.de`, password: "password-123" },
  });
  return reg.json().accessToken;
}

describe("polyline6", () => {
  test("roundtrip", () => {
    const coords = decodePolyline6(encodePolyline6([[52.52, 13.405], [52.53, 13.415]]));
    expect(coords[0][0]).toBeCloseTo(13.405, 5); // lon
    expect(coords[0][1]).toBeCloseTo(52.52, 5);  // lat
    expect(coords[1][1]).toBeCloseTo(52.53, 5);
  });
});

describe("routing", () => {
  test("car route normalized with geometry + german steps", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "POST", url: "/maps/api/route",
      payload: { from: { lat: 52.52, lon: 13.405 }, to: { lat: 52.53, lon: 13.415 }, mode: "car" },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.distanceM).toBe(2500);
    expect(r.durationS).toBe(300);
    expect(r.geometry.length).toBe(2);
    expect(r.geometry[0][0]).toBeCloseTo(13.405, 5);
    expect(r.steps[0].instruction).toContain("Norden");
  });

  test("no route → 404; bad coords → 400; bad mode → 400", async () => {
    const app = await makeApp();
    const noRoute = await app.inject({
      method: "POST", url: "/maps/api/route",
      payload: { from: { lat: 52.52, lon: 13.405 }, to: { lat: 52.53, lon: 13.415 }, mode: "foot" },
    });
    expect(noRoute.statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/maps/api/route", payload: { from: { lat: 999, lon: 0 }, to: { lat: 1, lon: 1 } } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/maps/api/route", payload: { from: { lat: 1, lon: 1 }, to: { lat: 2, lon: 2 }, mode: "boat" } })).statusCode).toBe(400);
  });
});

describe("custom packs (texture pack install)", () => {
  const validStyle = { version: 8, sources: {}, layers: [] };

  test("install by JSON, listed, served publicly, deletable", async () => {
    const app = await makeApp();
    const token = await authToken(app);
    const auth = { authorization: `Bearer ${token}` };

    const created = await app.inject({
      method: "POST", url: "/maps/api/user/packs", headers: auth,
      payload: { name: "Mein Pack", styleJson: validStyle },
    });
    expect(created.statusCode).toBe(201);
    const pack = created.json();
    expect(pack.id.startsWith("u-")).toBe(true);
    expect(pack.styleUrl).toContain("/maps/api/packs/u/");

    const list = await app.inject({ method: "GET", url: "/maps/api/user/packs", headers: auth });
    expect(list.json().packs.length).toBe(1);

    // Public style fetch needs NO auth (the map renderer does this).
    const style = await app.inject({ method: "GET", url: pack.styleUrl });
    expect(style.statusCode).toBe(200);
    expect(style.json().version).toBe(8);

    const del = await app.inject({ method: "DELETE", url: `/maps/api/user/packs/${pack.id}`, headers: auth });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: pack.styleUrl })).statusCode).toBe(404);
  });

  test("install by URL must be https; url pack redirects", async () => {
    const app = await makeApp();
    const token = await authToken(app);
    const auth = { authorization: `Bearer ${token}` };
    expect((await app.inject({
      method: "POST", url: "/maps/api/user/packs", headers: auth,
      payload: { name: "http pack", styleUrl: "http://example.com/style.json" },
    })).statusCode).toBe(400);

    const ok = await app.inject({
      method: "POST", url: "/maps/api/user/packs", headers: auth,
      payload: { name: "url pack", styleUrl: "https://example.com/style.json" },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().styleUrl).toBe("https://example.com/style.json");
  });

  test("validation: wrong version, oversized, missing style", async () => {
    const app = await makeApp();
    const token = await authToken(app);
    const auth = { authorization: `Bearer ${token}` };
    expect((await app.inject({
      method: "POST", url: "/maps/api/user/packs", headers: auth,
      payload: { name: "v7", styleJson: { version: 7, sources: {}, layers: [] } },
    })).statusCode).toBe(400);
    expect((await app.inject({
      method: "POST", url: "/maps/api/user/packs", headers: auth,
      payload: { name: "big", styleJson: { version: 8, sources: {}, layers: [], pad: "x".repeat(600 * 1024) } },
    })).statusCode).toBe(413);
    expect((await app.inject({
      method: "POST", url: "/maps/api/user/packs", headers: auth,
      payload: { name: "nothing" },
    })).statusCode).toBe(400);
    // Unauthenticated install is rejected.
    expect((await app.inject({
      method: "POST", url: "/maps/api/user/packs",
      payload: { name: "anon", styleJson: validStyle },
    })).statusCode).toBe(401);
  });
});
