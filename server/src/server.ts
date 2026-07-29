import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import type { Database } from "bun:sqlite";
import { createDb } from "./db";
import { makeAccessSigner, makeSessionIssuer, registerAuthRoutes } from "./auth";
import { registerUserDataRoutes } from "./bookmarks";
import { registerPackRoutes } from "./packs";
import { registerGeocodeRoutes } from "./geocode";
import { makeSocialVerifier, registerSocialRoutes, type SocialVerifier } from "./social";
import { registerRouteRoutes } from "./route";
import { registerUserPackRoutes } from "./userpacks";
import { PoiIndex } from "./pois";
import { registerDemRoutes } from "./dem";
import type { AppleMapsClient } from "./applemaps";

export interface AppOpts {
  dbPath: string;
  packsDir: string;
  /** Photon-compatible upstreams (/api?q=, /reverse?lat=&lon=), tried in
   *  order — e.g. self-hosted instance first, public fallback second. */
  geocoderUrls: string[];
  jwtSecret: string;
  prefix?: string;       // public path prefix, default /maps/api
  packsPublicBase?: string; // default /maps/packs (served statically by nginx)
  secureCookies?: boolean;
  /** Sign in with Apple audiences (bundle id / Services ID). Empty = 501. */
  appleAudiences?: string[];
  /** Google OAuth client ids (iOS + web). Empty = 501. */
  googleAudiences?: string[];
  /** Test seam — replaces the JWKS-backed verifier. */
  socialVerifier?: SocialVerifier;
  /** Allow localhost CORS origins (dev only). */
  devCors?: boolean;
  /** Valhalla-compatible routing engines, tried in order (self-host → public). */
  valhallaUrls?: string[];
  /** SQLite POI index from data/build-poi-db.sh (optional). */
  poiDbPath?: string;
  /** Disk cache for proxied elevation tiles (3D terrain). */
  demCacheDir?: string;
  appleMaps?: AppleMapsClient;
}

export async function createApp(opts: AppOpts): Promise<FastifyInstance & { db: Database }> {
  const prefix = opts.prefix ?? "/maps/api";
  // trustProxy: 1 — exactly one trusted hop (the Caddy edge). `true` would
  // let clients spoof req.ip via X-Forwarded-For and bypass rate limits.
  const app = Fastify({ logger: false, trustProxy: 1 });
  const db = createDb(opts.dbPath);
  const pois = opts.poiDbPath ? new PoiIndex(opts.poiDbPath) : undefined;

  // Evict expired cache rows (24h is the longest TTL any reader applies).
  const prune = db.query(`DELETE FROM geocode_cache WHERE created_at < ?`);
  prune.run(Math.floor(Date.now() / 1000) - 24 * 3600);
  const pruneTimer = setInterval(
    () => prune.run(Math.floor(Date.now() / 1000) - 24 * 3600),
    3600_000,
  );
  (pruneTimer as unknown as { unref?: () => void }).unref?.();
  const signer = makeAccessSigner(opts.jwtSecret);

  await app.register(cookie);
  await app.register(cors, {
    // Production is same-origin only; localhost origins are dev-opt-in.
    // maps.aiity.de is the sole canonical domain — privatenas.nl/maps now
    // redirects at the Caddy edge rather than being proxied, so a request
    // never actually arrives here with that Origin.
    origin: opts.devCors
      ? [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, "https://maps.aiity.de"]
      : ["https://maps.aiity.de"],
    credentials: true,
  });

  await app.register(
    async (scope) => {
      scope.get("/healthz", async () => ({ ok: true }));
      const authOpts = {
        db,
        jwtSecret: opts.jwtSecret,
        cookiePath: `${prefix}/auth`,
        secureCookies: opts.secureCookies ?? true,
      };
      registerAuthRoutes(scope, authOpts, signer);
      const verifier = opts.socialVerifier ?? makeSocialVerifier({
        appleAudiences: opts.appleAudiences ?? [],
        googleAudiences: opts.googleAudiences ?? [],
      });
      registerSocialRoutes(scope, db, verifier, makeSessionIssuer(authOpts, signer));
      registerUserDataRoutes(scope, db, signer);
      registerPackRoutes(scope, opts.packsDir, opts.packsPublicBase ?? "/maps/packs");
      registerUserPackRoutes(scope, db, signer, prefix);
      registerGeocodeRoutes(scope, db, opts.geocoderUrls, pois, opts.appleMaps);
      registerRouteRoutes(scope, db, opts.valhallaUrls ?? ["https://valhalla1.openstreetmap.de"]);
      registerDemRoutes(scope, opts.demCacheDir ?? "/data/dem");
    },
    { prefix }
  );

  const withDb = app as FastifyInstance & { db: Database };
  withDb.db = db;
  return withDb;
}
