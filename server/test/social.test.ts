import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createApp } from "../src/server";
import type { SocialIdentity, SocialVerifier } from "../src/social";

const PACKS_DIR = join(import.meta.dir, "..", "..", "packs");
const SECRET = "test-secret-test-secret-test-secret-42";

function fakeVerifier(apple?: SocialIdentity, google?: SocialIdentity): SocialVerifier {
  return {
    async verifyApple(token: string) {
      if (token === "not-configured") throw new Error("apple_not_configured");
      if (!apple || token !== "valid-apple") throw new Error("bad token");
      return apple;
    },
    async verifyGoogle(token: string) {
      if (!google || token !== "valid-google") throw new Error("bad token");
      return google;
    },
  };
}

async function makeApp(verifier: SocialVerifier) {
  return createApp({
    dbPath: ":memory:",
    packsDir: PACKS_DIR,
    geocoderUrls: ["http://127.0.0.1:9"],
    jwtSecret: SECRET,
    prefix: "/maps/api",
    secureCookies: false,
    socialVerifier: verifier,
  });
}

describe("social sign-in", () => {
  test("apple: creates a user, second sign-in reuses it", async () => {
    const app = await makeApp(fakeVerifier({ sub: "apple-sub-1", email: "a@icloud.com", emailVerified: true, name: null }));
    const r1 = await app.inject({
      method: "POST", url: "/maps/api/auth/apple",
      payload: { identityToken: "valid-apple", fullName: "Enrico Test" },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().accessToken).toBeTruthy();
    expect(r1.json().user.displayName).toBe("Enrico Test");

    const r2 = await app.inject({
      method: "POST", url: "/maps/api/auth/apple",
      payload: { identityToken: "valid-apple" },
    });
    expect(r2.json().user.id).toBe(r1.json().user.id);
  });

  test("apple: links to existing verified-email account", async () => {
    const app = await makeApp(fakeVerifier({ sub: "apple-sub-2", email: "link@b.de", emailVerified: true, name: null }));
    const reg = await app.inject({
      method: "POST", url: "/maps/api/auth/register",
      payload: { email: "link@b.de", password: "password-123" },
    });
    const social = await app.inject({
      method: "POST", url: "/maps/api/auth/apple",
      payload: { identityToken: "valid-apple" },
    });
    expect(social.json().user.id).toBe(reg.json().user.id);
  });

  test("apple: does NOT link on unverified email", async () => {
    const app = await makeApp(fakeVerifier({ sub: "apple-sub-3", email: "unv@b.de", emailVerified: false, name: null }));
    const reg = await app.inject({
      method: "POST", url: "/maps/api/auth/register",
      payload: { email: "unv@b.de", password: "password-123" },
    });
    const social = await app.inject({
      method: "POST", url: "/maps/api/auth/apple",
      payload: { identityToken: "valid-apple" },
    });
    expect(social.statusCode).toBe(200);
    expect(social.json().user.id).not.toBe(reg.json().user.id);
  });

  test("invalid token → 401; missing → 400; unconfigured → 501", async () => {
    const app = await makeApp(fakeVerifier({ sub: "s", email: null, emailVerified: false, name: null }));
    expect((await app.inject({ method: "POST", url: "/maps/api/auth/apple", payload: { identityToken: "garbage" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/maps/api/auth/apple", payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/maps/api/auth/apple", payload: { identityToken: "not-configured" } })).statusCode).toBe(501);
  });

  test("google: creates user and session tokens work on protected routes", async () => {
    const app = await makeApp(fakeVerifier(undefined, { sub: "g-sub-1", email: "g@gmail.com", emailVerified: true, name: "G User" }));
    const r = await app.inject({ method: "POST", url: "/maps/api/auth/google", payload: { idToken: "valid-google" } });
    expect(r.statusCode).toBe(200);
    const me = await app.inject({
      method: "GET", url: "/maps/api/auth/me",
      headers: { authorization: `Bearer ${r.json().accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("g@gmail.com");
  });
});
