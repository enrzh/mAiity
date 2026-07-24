import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "bun:sqlite";
import { makeAuthGuard, type AccessSigner } from "./auth";

/// The install-your-own-texture-pack feature. A custom pack is either a URL
/// to a hosted style.json, or a pasted/uploaded style stored server-side and
/// served publicly under an unguessable UUID path. Synced via the account.
const MAX_STYLE_BYTES = 512 * 1024;

const now = () => Math.floor(Date.now() / 1000);

export function ensureUserPacksTable(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_packs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      style_url   TEXT,
      style_json  TEXT,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_up_user ON user_packs(user_id);
  `);
}

/** Light structural validation — advisory, the renderer is the real judge. */
function validateStyle(style: unknown): string | null {
  if (typeof style !== "object" || style === null || Array.isArray(style)) return "style_not_object";
  const s = style as { version?: unknown; layers?: unknown; sources?: unknown };
  if (s.version !== 8) return "style_version_must_be_8";
  if (!Array.isArray(s.layers) ||
      s.layers.some((l) => typeof l !== "object" || l === null || Array.isArray(l)))
    return "style_layers_missing";
  if (typeof s.sources !== "object" || s.sources === null || Array.isArray(s.sources))
    return "style_sources_missing";
  return null;
}

export function registerUserPackRoutes(
  app: FastifyInstance,
  db: Database,
  signer: AccessSigner,
  publicApiBase: string, // e.g. /maps/api
) {
  ensureUserPacksTable(db);
  const guard = makeAuthGuard(signer);
  const uid = (req: FastifyRequest) => (req as FastifyRequest & { userId: string }).userId;

  const toClient = (r: { id: string; name: string; styleUrl: string | null }) => ({
    id: `u-${r.id}`,
    name: r.name,
    version: "custom",
    author: "",
    description: "Eigenes Pack",
    custom: true,
    styleUrl: r.styleUrl ?? `${publicApiBase}/packs/u/${r.id}/style.json`,
  });

  app.get("/user/packs", { preHandler: guard }, async (req) => {
    const rows = db
      .query(`SELECT id, name, style_url AS styleUrl FROM user_packs WHERE user_id = ? ORDER BY created_at DESC`)
      .all(uid(req)) as Array<{ id: string; name: string; styleUrl: string | null }>;
    return { packs: rows.map(toClient) };
  });

  app.post("/user/packs", { preHandler: guard }, async (req, reply) => {
    const b = (req.body ?? {}) as { name?: string; styleUrl?: string; styleJson?: unknown };
    const name = (b.name ?? "").trim();
    if (!name || name.length > 60) return reply.code(400).send({ error: "invalid_name" });

    let styleUrl: string | null = null;
    let styleJson: string | null = null;

    if (b.styleUrl) {
      let u: URL;
      try { u = new URL(b.styleUrl) } catch { return reply.code(400).send({ error: "invalid_url" }) }
      if (u.protocol !== "https:") return reply.code(400).send({ error: "url_must_be_https" });
      styleUrl = u.toString();
    } else if (b.styleJson !== undefined) {
      const raw = typeof b.styleJson === "string" ? b.styleJson : JSON.stringify(b.styleJson);
      // Bytes, not UTF-16 code units — multi-byte styles must not slip the cap.
      if (Buffer.byteLength(raw, "utf8") > MAX_STYLE_BYTES)
        return reply.code(413).send({ error: "style_too_large" });
      let parsed: unknown;
      try { parsed = typeof b.styleJson === "string" ? JSON.parse(b.styleJson) : b.styleJson }
      catch { return reply.code(400).send({ error: "style_not_json" }) }
      const err = validateStyle(parsed);
      if (err) return reply.code(400).send({ error: err });
      styleJson = JSON.stringify(parsed);
      if (Buffer.byteLength(styleJson, "utf8") > MAX_STYLE_BYTES)
        return reply.code(413).send({ error: "style_too_large" });
    } else {
      return reply.code(400).send({ error: "style_url_or_json_required" });
    }

    const count = db.query(`SELECT COUNT(*) AS n FROM user_packs WHERE user_id = ?`).get(uid(req)) as { n: number };
    if (count.n >= 20) return reply.code(409).send({ error: "pack_limit_reached" });
    // Global backstop: per-user caps don't bound total storage under open
    // registration (20 packs × 512 KB × unlimited users).
    const total = db.query(`SELECT COUNT(*) AS n FROM user_packs`).get() as { n: number };
    if (total.n >= 2000) return reply.code(507).send({ error: "global_pack_limit" });

    const id = crypto.randomUUID();
    db.query(
      `INSERT INTO user_packs (id, user_id, name, style_url, style_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, uid(req), name, styleUrl, styleJson, now());
    reply.code(201);
    return toClient({ id, name, styleUrl });
  });

  app.delete("/user/packs/:id", { preHandler: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const bare = id.startsWith("u-") ? id.slice(2) : id;
    const res = db.query(`DELETE FROM user_packs WHERE id = ? AND user_id = ?`).run(bare, uid(req));
    if (res.changes === 0) return reply.code(404).send({ error: "not_found" });
    reply.code(204);
  });

  // Public style serving for STORED packs only (unguessable UUID; styles are
  // not secrets — the renderer must fetch them without auth headers).
  // URL-packs are never served here: clients get their external styleUrl
  // directly, and redirecting from a trusted origin to an arbitrary
  // user-supplied URL would be an open redirect.
  app.get("/packs/u/:id/style.json", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = db
      .query(`SELECT style_json AS styleJson, style_url AS styleUrl FROM user_packs WHERE id = ?`)
      .get(id) as { styleJson: string | null; styleUrl: string | null } | null;
    if (!row || row.styleUrl) return reply.code(404).send({ error: "not_found" });
    reply.header("Cache-Control", "public, max-age=60");
    reply.type("application/json");
    return row.styleJson;
  });
}
