import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { decodeJwt } from "jose";
import { AppleMapsClient } from "../src/applemaps";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

describe("AppleMapsClient MapKit JS authorization", () => {
  test("returns a directly signed, domain-bound MapKit JS token", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("MapKit JS token generation must not call the Server API");
    }) as typeof fetch;

    try {
      const client = new AppleMapsClient({
        teamId: "H8FW6W6K2D",
        keyId: "GB2ZY3U5KY",
        mapsId: "maps.de.aiity.web",
        privateKey: privateKeyPem,
      });

      const result = await client.mapKitToken("maps.aiity.de");
      expect(fetchCalls).toBe(0);
      expect(decodeJwt(result.token)).toMatchObject({
        iss: "H8FW6W6K2D",
        origin: "maps.aiity.de",
        scope: "mapkit_js",
      });
      expect(result.expiresInSeconds).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not expose a legacy static MapKit token", async () => {
    const client = new AppleMapsClient({
      teamId: "H8FW6W6K2D",
      keyId: "GB2ZY3U5KY",
      mapsId: "maps.de.aiity.web",
      privateKey: privateKeyPem,
      mapKitJsToken: "legacy-or-corrupted-token",
    } as any);

    const result = await client.mapKitToken("maps.aiity.de");
    expect(result.token).not.toBe("legacy-or-corrupted-token");
    expect(decodeJwt(result.token).scope).toBe("mapkit_js");
  });
});
