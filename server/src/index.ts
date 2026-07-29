import { createApp } from "./server";
import { AppleMapsClient } from "./applemaps";
import { readFileSync } from "node:fs";
import { makeAppleWebOAuth } from "./social";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error("JWT_SECRET (>=32 chars) is required");
  process.exit(1);
}

const applePrivateKey = process.env.APPLE_MAPS_PRIVATE_KEY_FILE
  ? readFileSync(process.env.APPLE_MAPS_PRIVATE_KEY_FILE, "utf8")
  : process.env.APPLE_MAPS_PRIVATE_KEY?.replace(/\\n/g, "\n");
const appleMaps = applePrivateKey && process.env.APPLE_MAPS_KEY_ID
  && process.env.APPLE_MAPS_TEAM_ID && process.env.APPLE_MAPS_ID
  ? new AppleMapsClient({
      privateKey: applePrivateKey,
      keyId: process.env.APPLE_MAPS_KEY_ID,
      teamId: process.env.APPLE_MAPS_TEAM_ID,
      mapsId: process.env.APPLE_MAPS_ID,
    })
  : undefined;

const appleLoginPrivateKey = process.env.APPLE_LOGIN_PRIVATE_KEY_FILE
  ? readFileSync(process.env.APPLE_LOGIN_PRIVATE_KEY_FILE, "utf8")
  : process.env.APPLE_LOGIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const appleWebOAuth = appleLoginPrivateKey && process.env.APPLE_LOGIN_KEY_ID
  && process.env.APPLE_LOGIN_TEAM_ID
  ? await makeAppleWebOAuth({
      privateKey: appleLoginPrivateKey,
      keyId: process.env.APPLE_LOGIN_KEY_ID,
      teamId: process.env.APPLE_LOGIN_TEAM_ID,
      clientId: process.env.APPLE_LOGIN_CLIENT_ID ?? "de.aiity.maps.web",
      redirectUri: process.env.APPLE_LOGIN_REDIRECT_URI
        ?? "https://maps.aiity.de/maps/api/auth/apple/callback",
    })
  : undefined;

const app = await createApp({
  dbPath: process.env.DB_PATH ?? "data/maps.db",
  packsDir: process.env.PACKS_DIR ?? "../packs",
  geocoderUrls: (process.env.GEOCODER_URLS ?? process.env.GEOCODER_URL ?? "https://photon.komoot.io")
    .split(",").map((s) => s.trim()).filter(Boolean),
  jwtSecret,
  prefix: process.env.API_PREFIX ?? "/maps/api",
  packsPublicBase: process.env.PACKS_PUBLIC_BASE ?? "/maps/packs",
  secureCookies: process.env.INSECURE_COOKIES !== "1",
  appleAudiences: (process.env.APPLE_AUDIENCES ?? "de.aiity.maps,de.aiity.maps.web").split(",").filter(Boolean),
  googleAudiences: (process.env.GOOGLE_AUDIENCES ?? "").split(",").filter(Boolean),
  devCors: process.env.DEV_CORS === "1",
  poiDbPath: process.env.POI_DB_PATH ?? "/data/pois.db",
  valhallaUrls: (process.env.VALHALLA_URLS ?? process.env.VALHALLA_URL ?? "https://valhalla1.openstreetmap.de")
    .split(",").map((s) => s.trim()).filter(Boolean),
  appleMaps,
  appleWebOAuth,
});

const port = Number(process.env.PORT ?? 3103);
await app.listen({ port, host: "0.0.0.0" });
console.log(`maps-api listening on :${port}`);
