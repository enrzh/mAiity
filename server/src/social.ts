import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "bun:sqlite";
import { createRemoteJWKSet, jwtVerify } from "jose";

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

  // Link to an existing e-mail/password account only on a verified address.
  if (id.email && id.emailVerified) {
    const byEmail = db.query(`SELECT id FROM users WHERE email = ?`).get(id.email.toLowerCase()) as
      | { id: string }
      | null;
    if (byEmail) {
      db.query(`UPDATE users SET ${col} = ? WHERE id = ?`).run(id.sub, byEmail.id);
      return byEmail.id;
    }
  }

  const userId = crypto.randomUUID();
  db.query(
    `INSERT INTO users (id, email, ${col}, display_name, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(
    userId,
    id.email && id.emailVerified ? id.email.toLowerCase() : null,
    id.sub,
    displayName ?? id.name,
    now(),
  );
  return userId;
}

export type SessionIssuer = (
  reply: FastifyReply,
  req: FastifyRequest,
  userId: string,
) => Promise<unknown>;

export function registerSocialRoutes(
  app: FastifyInstance,
  db: Database,
  verifier: SocialVerifier,
  issueSession: SessionIssuer,
) {
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
