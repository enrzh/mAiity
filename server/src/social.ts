import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "bun:sqlite";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

/// Social sign-in: the CLIENT does the OAuth dance (native ASAuthorization /
/// GoogleSignIn / web flow) and posts the resulting identity token here. We
/// verify it against the provider's JWKS and mint our own session.
///
/// Account key is the provider's `sub` (Apple's is team-scoped: same user =>
/// same sub across this team's apps and web). Auto-link to an existing e-mail
/// account only when the provider asserts the address is verified.

export interface SocialIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface SocialVerifier {
  /** Throws on invalid token. */
  verifyApple(identityToken: string): Promise<SocialIdentity>;
  verifyGoogle(idToken: string): Promise<SocialIdentity>;
}

export interface AppleWebOAuth {
  clientId: string;
  redirectUri: string;
  exchangeCode(code: string): Promise<{ identityToken: string }>;
}

export async function makeAppleWebOAuth(opts: {
  clientId: string;
  redirectUri: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}): Promise<AppleWebOAuth> {
  const key = await importPKCS8(opts.privateKey, "ES256");
  return {
    clientId: opts.clientId,
    redirectUri: opts.redirectUri,
    async exchangeCode(code) {
      const clientSecret = await new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: opts.keyId })
        .setIssuer(opts.teamId)
        .setSubject(opts.clientId)
        .setAudience("https://appleid.apple.com")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(key);
      const response = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: opts.clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: opts.redirectUri,
        }),
      });
      const body = await response.json() as { id_token?: string };
      if (!response.ok || !body.id_token) throw new Error("apple_code_exchange_failed");
      return { identityToken: body.id_token };
    },
  };
}

const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function makeSocialVerifier(opts: {
  appleAudiences: string[];
  googleAudiences: string[];
}): SocialVerifier {
  return {
    async verifyApple(identityToken) {
      if (opts.appleAudiences.length === 0) throw new Error("apple_not_configured");
      const { payload } = await jwtVerify(identityToken, appleJWKS, {
        issuer: "https://appleid.apple.com",
        audience: opts.appleAudiences, // bundle id (native) and/or Services ID (web)
      });
      return {
        sub: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : null,
        // Apple sends email_verified as bool or the string "true".
        emailVerified: payload.email_verified === true || payload.email_verified === "true",
        name: null, // Apple delivers the name only via the client, first auth only
      };
    },
    async verifyGoogle(idToken) {
      if (opts.googleAudiences.length === 0) throw new Error("google_not_configured");
      const { payload } = await jwtVerify(idToken, googleJWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: opts.googleAudiences, // iOS client id + web client id
      });
      return {
        sub: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : null,
        emailVerified: payload.email_verified === true,
        name: typeof payload.name === "string" ? payload.name : null,
      };
    },
  };
}

const now = () => Math.floor(Date.now() / 1000);

/** Find-or-create the user for a verified social identity. */
function upsertSocialUser(
  db: Database,
  provider: "apple" | "google",
  id: SocialIdentity,
  displayName: string | null,
): string {
  const col = provider === "apple" ? "apple_sub" : "google_sub";
  const existing = db.query(`SELECT id FROM users WHERE ${col} = ?`).get(id.sub) as { id: string } | null;
  if (existing) return existing.id;

  // Auto-link by e-mail ONLY when the existing account is itself a federated
  // identity (no password). A password account's address was never verified
  // here, so linking to it would enable account pre-hijacking: an attacker
  // pre-registers the victim's e-mail with a password, waits for the victim's
  // first social sign-in, and keeps password access to the merged account.
  let email: string | null = id.email && id.emailVerified ? id.email.toLowerCase() : null;
  if (email) {
    const byEmail = db.query(`SELECT id, pw_hash AS pwHash FROM users WHERE email = ?`).get(email) as
      | { id: string; pwHash: string | null }
      | null;
    if (byEmail) {
      if (byEmail.pwHash === null) {
        db.query(`UPDATE users SET ${col} = ? WHERE id = ?`).run(id.sub, byEmail.id);
        return byEmail.id;
      }
      // Occupied by a password account — create a distinct user. The e-mail
      // column is UNIQUE, so the new account stores no address.
      email = null;
    }
  }

  const userId = crypto.randomUUID();
  db.query(
    `INSERT INTO users (id, email, ${col}, display_name, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, email, id.sub, displayName ?? id.name, now());
  return userId;
}

export type SessionIssuer = (
  reply: FastifyReply,
  req: FastifyRequest,
  userId: string,
  viaCookie?: boolean,
) => Promise<unknown>;

export function registerSocialRoutes(
  app: FastifyInstance,
  db: Database,
  verifier: SocialVerifier,
  issueSession: SessionIssuer,
  webOAuth?: AppleWebOAuth,
  secureCookies = true,
) {
  const stateCookie = {
    path: "/maps/api/auth/apple",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies,
    maxAge: 10 * 60,
  };

  app.get("/auth/apple/start", async (_req, reply) => {
    if (!webOAuth) return reply.code(501).send({ error: "apple_not_configured" });
    const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    reply.setCookie("maps_apple_state", state, stateCookie);
    const authorization = new URL("https://appleid.apple.com/auth/authorize");
    authorization.search = new URLSearchParams({
      client_id: webOAuth.clientId,
      redirect_uri: webOAuth.redirectUri,
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state,
    }).toString();
    return reply.redirect(authorization.toString());
  });

  app.post("/auth/apple/callback", async (req, reply) => {
    const body = (req.body ?? {}) as {
      code?: string;
      state?: string;
      user?: string;
      error?: string;
    };
    const expectedState = req.cookies?.maps_apple_state;
    reply.clearCookie("maps_apple_state", { path: stateCookie.path });
    if (!webOAuth) return reply.redirect("/maps/?apple_login=apple_not_configured");
    if (!expectedState || !body.state || expectedState !== body.state) {
      return reply.redirect("/maps/?apple_login=invalid_oauth_state");
    }
    if (body.error || !body.code) {
      return reply.redirect(`/maps/?apple_login=${body.error === "user_cancelled_authorize" ? "cancelled" : "failed"}`);
    }
    try {
      const { identityToken } = await webOAuth.exchangeCode(body.code);
      const identity = await verifier.verifyApple(identityToken);
      let fullName: string | null = null;
      if (body.user) {
        try {
          const user = JSON.parse(body.user) as { name?: { firstName?: string; lastName?: string } };
          fullName = [user.name?.firstName, user.name?.lastName].filter(Boolean).join(" ") || null;
        } catch { /* Apple sends user only once; malformed optional data is ignored. */ }
      }
      const userId = upsertSocialUser(db, "apple", identity, fullName);
      await issueSession(reply, req, userId, true);
      return reply.redirect("/maps/?apple_login=success");
    } catch {
      return reply.redirect("/maps/?apple_login=failed");
    }
  });

  app.post("/auth/apple", async (req, reply) => {
    const { identityToken, fullName } = (req.body ?? {}) as {
      identityToken?: string;
      fullName?: string;
    };
    if (!identityToken) return reply.code(400).send({ error: "missing_identity_token" });
    let identity: SocialIdentity;
    try {
      identity = await verifier.verifyApple(identityToken);
    } catch (e) {
      if ((e as Error).message === "apple_not_configured")
        return reply.code(501).send({ error: "apple_not_configured" });
      return reply.code(401).send({ error: "invalid_identity_token" });
    }
    // Name arrives only on the FIRST authorization — persist it right away.
    const userId = upsertSocialUser(db, "apple", identity, fullName?.trim() || null);
    return issueSession(reply, req, userId);
  });

  app.post("/auth/google", async (req, reply) => {
    const { idToken } = (req.body ?? {}) as { idToken?: string };
    if (!idToken) return reply.code(400).send({ error: "missing_id_token" });
    let identity: SocialIdentity;
    try {
      identity = await verifier.verifyGoogle(idToken);
    } catch (e) {
      if ((e as Error).message === "google_not_configured")
        return reply.code(501).send({ error: "google_not_configured" });
      return reply.code(401).send({ error: "invalid_id_token" });
    }
    const userId = upsertSocialUser(db, "google", identity, null);
    return issueSession(reply, req, userId);
  });
}
