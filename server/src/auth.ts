import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "bun:sqlite";
import { SignJWT, jwtVerify } from "jose";

const ACCESS_TTL_S = 15 * 60; // 15 min
const REFRESH_TTL_S = 30 * 24 * 3600; // 30 days

export interface AuthOpts {
  db: Database;
  jwtSecret: string;
  cookiePath: string; // e.g. /maps/api/auth
  secureCookies: boolean;
}

const sha256 = (s: string) =>
  new Bun.CryptoHasher("sha256").update(s).digest("hex");

const now = () => Math.floor(Date.now() / 1000);

function newRefreshToken(db: Database, userId: string): string {
  const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64url");
  db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), userId, sha256(raw), now() + REFRESH_TTL_S, now());
  return raw;
}

export function makeAccessSigner(jwtSecret: string) {
  const key = new TextEncoder().encode(jwtSecret);
  return {
    async sign(userId: string): Promise<string> {
      return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TTL_S}s`)
        .sign(key);
    },
    async verify(token: string): Promise<string | null> {
      try {
        const { payload } = await jwtVerify(token, key);
        return payload.sub ?? null;
      } catch {
        return null;
      }
    },
  };
}

export type AccessSigner = ReturnType<typeof makeAccessSigner>;

/** preHandler that requires a valid Bearer access token; sets req.userId. */
export function makeAuthGuard(signer: AccessSigner) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    const userId = token ? await signer.verify(token) : null;
    if (!userId) {
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    (req as FastifyRequest & { userId: string }).userId = userId;
  };
}

/** Shared session issuance — used by email auth and the social endpoints. */
export function makeSessionIssuer(opts: AuthOpts, signer: AccessSigner) {
  const isWeb = (req: FastifyRequest) => req.headers["x-client-platform"] === "web";
  const cookieOpts = {
    path: opts.cookiePath,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: opts.secureCookies,
    maxAge: REFRESH_TTL_S,
  };
  /// `viaCookie: true` forces httpOnly-cookie delivery regardless of the
  /// client-controlled platform header — a token presented via cookie must
  /// never be downgradable to a JS-readable body token.
  return async function issueSession(
    reply: FastifyReply,
    req: FastifyRequest,
    userId: string,
    viaCookie = false,
  ) {
    const accessToken = await signer.sign(userId);
    const refreshToken = newRefreshToken(opts.db, userId);
    const user = opts.db
      .query(`SELECT id, email, display_name AS displayName FROM users WHERE id = ?`)
      .get(userId) as { id: string; email: string | null; displayName: string | null };
    if (viaCookie || isWeb(req)) {
      reply.setCookie("maps_rt", refreshToken, cookieOpts);
      return { accessToken, expiresIn: ACCESS_TTL_S, user };
    }
    return { accessToken, expiresIn: ACCESS_TTL_S, refreshToken, user };
  };
}

export function registerAuthRoutes(app: FastifyInstance, opts: AuthOpts, signer: AccessSigner) {
  const { db } = opts;

  // Tiny in-memory limiter for the auth endpoints (per IP, sliding minute).
  // Scoped to this app instance so separate instances don't share state.
  const attempts = new Map<string, number[]>();
  const tooManyAttempts = (ip: string): boolean => {
    const cutoff = Date.now() - 60_000;
    const list = (attempts.get(ip) ?? []).filter((t) => t > cutoff);
    list.push(Date.now());
    attempts.set(ip, list);
    return list.length > 10;
  };

  const issueSession = makeSessionIssuer(opts, signer);

  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

  app.post("/auth/register", async (req, reply) => {
    if (tooManyAttempts(req.ip)) return reply.code(429).send({ error: "too_many_requests" });
    const { email, password, displayName } = (req.body ?? {}) as {
      email?: string; password?: string; displayName?: string;
    };
    if (!email || !emailOk(email)) return reply.code(400).send({ error: "invalid_email" });
    if (!password || password.length < 8) return reply.code(400).send({ error: "password_too_short" });

    const existing = db.query(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (existing) return reply.code(409).send({ error: "email_taken" });

    const id = crypto.randomUUID();
    // Bun.password defaults to argon2id.
    const hash = await Bun.password.hash(password);
    db.query(
      `INSERT INTO users (id, email, pw_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, email.toLowerCase(), hash, displayName ?? null, now());
    reply.code(201);
    return issueSession(reply, req, id);
  });

  app.post("/auth/login", async (req, reply) => {
    if (tooManyAttempts(req.ip)) return reply.code(429).send({ error: "too_many_requests" });
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) return reply.code(400).send({ error: "missing_credentials" });
    const user = db
      .query(`SELECT id, pw_hash FROM users WHERE email = ?`)
      .get(email.toLowerCase()) as { id: string; pw_hash: string | null } | null;
    // Constant-shape response for bad email vs bad password.
    if (!user?.pw_hash || !(await Bun.password.verify(password, user.pw_hash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    return issueSession(reply, req, user.id);
  });

  app.post("/auth/refresh", async (req, reply) => {
    const bodyToken = ((req.body ?? {}) as { refreshToken?: string }).refreshToken;
    const cookieToken = req.cookies?.maps_rt;
    const raw = bodyToken ?? cookieToken;
    const fromCookie = !bodyToken && !!cookieToken;
    if (!raw) return reply.code(401).send({ error: "missing_refresh_token" });

    const row = db
      .query(
        `SELECT id, user_id AS userId, expires_at AS expiresAt, revoked_at AS revokedAt
         FROM refresh_tokens WHERE token_hash = ?`
      )
      .get(sha256(raw)) as
      | { id: string; userId: string; expiresAt: number; revokedAt: number | null }
      | null;

    if (!row || row.expiresAt < now()) return reply.code(401).send({ error: "invalid_refresh_token" });
    if (row.revokedAt) {
      // Reuse of a rotated token = theft signal, kill every session of the
      // user. Both shipped clients single-flight their refreshes (web:
      // navigator.locks across tabs; iOS: actor), so a benign same-cookie
      // race cannot reach this branch — a grace window would only shelter
      // an actual attacker replaying a stolen token.
      db.query(`UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .run(now(), row.userId);
      return reply.code(401).send({ error: "refresh_token_reused" });
    }
    const replacement = crypto.randomUUID();
    db.query(`UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ?`)
      .run(now(), replacement, row.id);
    return issueSession(reply, req, row.userId, fromCookie);
  });

  app.post("/auth/logout", async (req, reply) => {
    const bodyToken = ((req.body ?? {}) as { refreshToken?: string }).refreshToken;
    const raw = bodyToken ?? req.cookies?.maps_rt;
    if (raw) {
      db.query(`UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
        .run(now(), sha256(raw));
    }
    reply.clearCookie("maps_rt", { path: opts.cookiePath });
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: makeAuthGuard(signer) }, async (req) => {
    const userId = (req as FastifyRequest & { userId: string }).userId;
    return db
      .query(`SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?`)
      .get(userId);
  });
}
