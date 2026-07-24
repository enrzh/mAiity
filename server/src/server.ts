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
}

export async function createApp(opts: AppOpts): Promise<FastifyInstance & { db: Database }> {
  const prefix = opts.prefix ?? "/maps/api";
  const app = Fastify({ logger: false, trustProxy: true });
  const db = createDb(opts.dbPath);
  const signer = makeAccessSigner(opts.jwtSecret);

  await app.register(cookie);
  await app.register(cors, {
    // Production is same-origin only; localhost origins are dev-opt-in.
    origin: opts.devCors
      ? [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, "https://privatenas.nl"]
      : ["https://privatenas.nl"],
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
      registerGeocodeRoutes(scope, db, opts.geocoderUrls);
      registerRouteRoutes(scope, db, opts.valhallaUrls ?? ["https://valhalla1.openstreetmap.de"]);
    },
    { prefix }
  );

  const withDb = app as FastifyInstance & { db: Database };
  withDb.db = db;
  return withDb;
}
