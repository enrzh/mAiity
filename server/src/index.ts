import { createApp } from "./server";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error("JWT_SECRET (>=32 chars) is required");
  process.exit(1);
}

const app = await createApp({
  dbPath: process.env.DB_PATH ?? "data/maps.db",
  packsDir: process.env.PACKS_DIR ?? "../packs",
  geocoderUrls: (process.env.GEOCODER_URLS ?? process.env.GEOCODER_URL ?? "https://photon.komoot.io")
    .split(",").map((s) => s.trim()).filter(Boolean),
  jwtSecret,
  prefix: process.env.API_PREFIX ?? "/maps/api",
  packsPublicBase: process.env.PACKS_PUBLIC_BASE ?? "/maps/packs",
  secureCookies: process.env.INSECURE_COOKIES !== "1",
  appleAudiences: (process.env.APPLE_AUDIENCES ?? "com.aiity.maps").split(",").filter(Boolean),
  googleAudiences: (process.env.GOOGLE_AUDIENCES ?? "").split(",").filter(Boolean),
  devCors: process.env.DEV_CORS === "1",
  poiDbPath: process.env.POI_DB_PATH ?? "/data/pois.db",
  valhallaUrls: (process.env.VALHALLA_URLS ?? process.env.VALHALLA_URL ?? "https://valhalla1.openstreetmap.de")
    .split(",").map((s) => s.trim()).filter(Boolean),
});

const port = Number(process.env.PORT ?? 3103);
await app.listen({ port, host: "0.0.0.0" });
console.log(`maps-api listening on :${port}`);
