import { describe, expect, test, beforeAll } from "bun:test";
import { join } from "node:path";
import { createApp } from "../src/server";

const PACKS_DIR = join(import.meta.dir, "..", "..", "packs");
const SECRET = "test-secret-test-secret-test-secret-42";

async function makeApp() {
  return createApp({
    dbPath: ":memory:",
    packsDir: PACKS_DIR,
    // Unreachable on purpose: geocode tests must be served from cache only.
    geocoderUrls: ["http://127.0.0.1:9"],
    jwtSecret: SECRET,
    prefix: "/maps/api",
    secureCookies: false,
  });
}

type App = Awaited<ReturnType<typeof makeApp>>;

async function registerUser(app: App, email = "a@b.de") {
  const res = await app.inject({
    method: "POST",
    url: "/maps/api/auth/register",
    payload: { email, password: "password-123" },
  });
  return res;
}

describe("health + packs", () => {
  let app: App;
  beforeAll(async () => { app = await makeApp(); });

  test("healthz", async () => {
    const res = await app.inject({ method: "GET", url: "/maps/api/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  test("packs lists first-party packs with style URLs", async () => {
    const res = await app.inject({ method: "GET", url: "/maps/api/packs" });
    expect(res.statusCode).toBe(200);
    const ids = res.json().packs.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["dark", "gta", "gtav", "light", "minecraft", "paper", "sanandreas"]);
    const light = res.json().packs.find((p: { id: string }) => p.id === "light");
    expect(light.styleUrl).toBe("/maps/packs/light/style.json");
  });

  test("MapKit token accepts a same-origin GET without an Origin header", async () => {
    const app = await createApp({
      dbPath: ":memory:",
      packsDir: PACKS_DIR,
      geocoderUrls: [],
      jwtSecret: SECRET,
      prefix: "/maps/api",
      secureCookies: false,
      appleMaps: {
        mapKitToken: async () => ({ token: "domain-bound-token", expiresInSeconds: 60 }),
      } as never,
    });
    const ok = await app.inject({
      method: "GET",
      url: "/maps/api/mapkit-token",
      headers: { host: "maps.aiity.de" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBe("domain-bound-token");

    const foreign = await app.inject({
      method: "GET",
      url: "/maps/api/mapkit-token",
      headers: { host: "attacker.example" },
    });
    expect(foreign.statusCode).toBe(403);
  });
});

describe("auth", () => {
  test("Apple web OAuth start and callback issue a web session", async () => {
    const app = await createApp({
      dbPath: ":memory:",
      packsDir: PACKS_DIR,
      geocoderUrls: [],
      jwtSecret: SECRET,
      prefix: "/maps/api",
      secureCookies: false,
      appleAudiences: ["de.aiity.maps.web"],
      appleWebOAuth: {
        clientId: "de.aiity.maps.web",
        redirectUri: "https://maps.aiity.de/maps/api/auth/apple/callback",
        exchangeCode: async (code: string) => {
          expect(code).toBe("valid-code");
          return { identityToken: "verified-apple-token" };
        },
      },
      socialVerifier: {
        verifyApple: async (token: string) => {
          expect(token).toBe("verified-apple-token");
          return {
            sub: "apple-web-user",
            email: "apple@aiity.de",
            emailVerified: true,
            name: null,
          };
        },
        verifyGoogle: async () => { throw new Error("unused"); },
      },
    } as any);

    const start = await app.inject({
      method: "GET",
      url: "/maps/api/auth/apple/start",
    });
    expect(start.statusCode).toBe(302);
    const authorization = new URL(start.headers.location!);
    expect(authorization.origin).toBe("https://appleid.apple.com");
    expect(authorization.searchParams.get("client_id")).toBe("de.aiity.maps.web");
    expect(authorization.searchParams.get("response_mode")).toBe("form_post");
    const state = authorization.searchParams.get("state");
    expect(state).toBeTruthy();
    const stateCookie = start.cookies.find((cookie) => cookie.name === "maps_apple_state");
    expect(stateCookie?.httpOnly).toBe(true);
    expect(stateCookie?.sameSite).toBe("None");

    const callback = await app.inject({
      method: "POST",
      url: "/maps/api/auth/apple/callback",
      headers: {
        cookie: `maps_apple_state=${stateCookie!.value}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      payload: `code=valid-code&state=${encodeURIComponent(state!)}`,
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("/maps/?apple_login=success");
    expect(callback.cookies.find((cookie) => cookie.name === "maps_rt")?.httpOnly).toBe(true);
  });

  test("Apple web OAuth rejects a mismatched state before token exchange", async () => {
    let exchanged = false;
    const app = await createApp({
      dbPath: ":memory:",
      packsDir: PACKS_DIR,
      geocoderUrls: [],
      jwtSecret: SECRET,
      prefix: "/maps/api",
      secureCookies: false,
      appleAudiences: ["de.aiity.maps.web"],
      appleWebOAuth: {
        clientId: "de.aiity.maps.web",
        redirectUri: "https://maps.aiity.de/maps/api/auth/apple/callback",
        exchangeCode: async () => {
          exchanged = true;
          return { identityToken: "should-not-run" };
        },
      },
      socialVerifier: {
        verifyApple: async () => { throw new Error("should-not-run"); },
        verifyGoogle: async () => { throw new Error("unused"); },
      },
    } as any);

    const callback = await app.inject({
      method: "POST",
      url: "/maps/api/auth/apple/callback",
      headers: {
        cookie: "maps_apple_state=expected",
        "content-type": "application/x-www-form-urlencoded",
      },
      payload: "code=valid-code&state=wrong",
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("/maps/?apple_login=invalid_oauth_state");
    expect(exchanged).toBe(false);
  });

  test("register → me roundtrip", async () => {
    const app = await makeApp();
    const reg = await registerUser(app);
    expect(reg.statusCode).toBe(201);
    const body = reg.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy(); // non-web client gets it in the body
    const me = await app.inject({
      method: "GET",
      url: "/maps/api/auth/me",
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("a@b.de");
  });

  test("web client gets cookie, not body refresh token", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/maps/api/auth/register",
      headers: { "x-client-platform": "web" },
      payload: { email: "web@b.de", password: "password-123" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().refreshToken).toBeUndefined();
    const cookie = res.cookies.find((c) => c.name === "maps_rt");
    expect(cookie).toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.path).toBe("/maps/api/auth");
  });

  test("validation: bad email, short password, duplicate", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "POST", url: "/maps/api/auth/register", payload: { email: "nope", password: "password-123" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/maps/api/auth/register", payload: { email: "x@y.de", password: "short" } })).statusCode).toBe(400);
    await registerUser(app, "dup@b.de");
    expect((await registerUser(app, "dup@b.de")).statusCode).toBe(409);
  });

  test("login wrong password 401, right password 200", async () => {
    const app = await makeApp();
    await registerUser(app, "log@b.de");
    const bad = await app.inject({ method: "POST", url: "/maps/api/auth/login", payload: { email: "log@b.de", password: "wrong-password" } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/maps/api/auth/login", payload: { email: "log@b.de", password: "password-123" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accessToken).toBeTruthy();
  });

  test("refresh rotates; ANY reuse of a rotated token revokes the family", async () => {
    // Clients single-flight refreshes (web navigator.locks / iOS actor), so
    // reuse can only be replay of a stolen token — no grace window.
    const app = await makeApp();
    const reg = await registerUser(app, "rot@b.de");
    const rt1 = reg.json().refreshToken as string;

    const r1 = await app.inject({ method: "POST", url: "/maps/api/auth/refresh", payload: { refreshToken: rt1 } });
    expect(r1.statusCode).toBe(200);
    const rt2 = r1.json().refreshToken as string;
    expect(rt2).not.toBe(rt1);

    const reuse = await app.inject({ method: "POST", url: "/maps/api/auth/refresh", payload: { refreshToken: rt1 } });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().error).toBe("refresh_token_reused");
    const afterTheft = await app.inject({ method: "POST", url: "/maps/api/auth/refresh", payload: { refreshToken: rt2 } });
    expect(afterTheft.statusCode).toBe(401);
  });

  test("cookie-presented token can never be downgraded to a body token", async () => {
    const app = await makeApp();
    const reg = await app.inject({
      method: "POST", url: "/maps/api/auth/register",
      headers: { "x-client-platform": "web" },
      payload: { email: "cookie@b.de", password: "password-123" },
    });
    const cookie = reg.cookies.find((c) => c.name === "maps_rt")!;
    // Refresh presenting the cookie but WITHOUT the web platform header —
    // the rotated token must still arrive as an httpOnly cookie, not JSON.
    const r = await app.inject({
      method: "POST", url: "/maps/api/auth/refresh",
      headers: { cookie: `maps_rt=${cookie.value}` },
      payload: {},
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().refreshToken).toBeUndefined();
    const rotated = r.cookies.find((c) => c.name === "maps_rt");
    expect(rotated).toBeTruthy();
    expect(rotated!.httpOnly).toBe(true);
  });
});

describe("bookmarks + settings", () => {
  let app: App;
  let token: string;

  beforeAll(async () => {
    app = await makeApp();
    const reg = await registerUser(app, "bm@b.de");
    token = reg.json().accessToken;
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  test("unauthorized without token", async () => {
    expect((await app.inject({ method: "GET", url: "/maps/api/bookmarks" })).statusCode).toBe(401);
  });

  test("create, list, patch, delete", async () => {
    const created = await app.inject({
      method: "POST", url: "/maps/api/bookmarks", headers: auth(),
      payload: { name: "Alexanderplatz", lat: 52.5219, lon: 13.4132, icon: "star", note: "Treffpunkt" },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const list = await app.inject({ method: "GET", url: "/maps/api/bookmarks", headers: auth() });
    expect(list.json().length).toBe(1);
    expect(list.json()[0].name).toBe("Alexanderplatz");

    const patched = await app.inject({
      method: "PATCH", url: `/maps/api/bookmarks/${id}`, headers: auth(),
      payload: { name: "Alex" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().name).toBe("Alex");

    const del = await app.inject({ method: "DELETE", url: `/maps/api/bookmarks/${id}`, headers: auth() });
    expect(del.statusCode).toBe(204);
    const empty = await app.inject({ method: "GET", url: "/maps/api/bookmarks", headers: auth() });
    expect(empty.json().length).toBe(0);
  });

  test("coordinate validation", async () => {
    const res = await app.inject({
      method: "POST", url: "/maps/api/bookmarks", headers: auth(),
      payload: { name: "bad", lat: 123, lon: 500 },
    });
    expect(res.statusCode).toBe(400);
  });

  test("settings roundtrip", async () => {
    const put = await app.inject({
      method: "PUT", url: "/maps/api/user/settings", headers: auth(),
      payload: { activePack: "dark", camera: { lat: 52.52, lon: 13.4, zoom: 11 } },
    });
    expect(put.statusCode).toBe(200);
    const got = await app.inject({ method: "GET", url: "/maps/api/user/settings", headers: auth() });
    expect(got.json().activePack).toBe("dark");
    expect(got.json().camera.zoom).toBe(11);
  });
});

describe("geocode", () => {
  test("short query returns empty without upstream", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=a" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([]);
  });

  test("served from cache without hitting upstream", async () => {
    const app = await makeApp();
    const payload = JSON.stringify({ results: [{ name: "Berlin", label: "Berlin, Deutschland", lat: 52.52, lon: 13.405, kind: "city" }] });
    app.db.query(`INSERT INTO geocode_cache (key, response, created_at) VALUES (?, ?, ?)`)
      .run("s2|berlin|de|8", payload, Math.floor(Date.now() / 1000));
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Berlin" });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[0].name).toBe("Berlin");
  });

  test("unreachable upstream → 502 (not a crash)", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/maps/api/geocode?q=Uncached Query" });
    expect(res.statusCode).toBe(502);
  });

  test("reverse validates coordinates", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/maps/api/reverse?lat=999&lon=0" });
    expect(res.statusCode).toBe(400);
  });
});
