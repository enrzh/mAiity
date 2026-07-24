import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "bun:sqlite";
import { makeAuthGuard, type AccessSigner } from "./auth";

const now = () => Math.floor(Date.now() / 1000);

const validCoord = (lat: unknown, lon: unknown) =>
  typeof lat === "number" && typeof lon === "number" &&
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

export function registerUserDataRoutes(app: FastifyInstance, db: Database, signer: AccessSigner) {
  const guard = makeAuthGuard(signer);
  const uid = (req: FastifyRequest) => (req as FastifyRequest & { userId: string }).userId;

  // ---- Bookmarks -----------------------------------------------------------
  app.get("/bookmarks", { preHandler: guard }, async (req) => {
    return db
      .query(
        `SELECT id, name, lat, lon, icon, note, created_at AS createdAt, updated_at AS updatedAt
         FROM bookmarks WHERE user_id = ? ORDER BY updated_at DESC`
      )
      .all(uid(req));
  });

  app.post("/bookmarks", { preHandler: guard }, async (req, reply) => {
    const b = (req.body ?? {}) as {
      name?: string; lat?: number; lon?: number; icon?: string; note?: string;
    };
    if (!b.name || b.name.length > 200) return reply.code(400).send({ error: "invalid_name" });
    if (!validCoord(b.lat, b.lon)) return reply.code(400).send({ error: "invalid_coordinates" });
    const id = crypto.randomUUID();
    db.query(
      `INSERT INTO bookmarks (id, user_id, name, lat, lon, icon, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, uid(req), b.name, b.lat!, b.lon!, b.icon ?? "star", b.note ?? "", now(), now());
    reply.code(201);
    return db
      .query(`SELECT id, name, lat, lon, icon, note, created_at AS createdAt, updated_at AS updatedAt
              FROM bookmarks WHERE id = ?`)
      .get(id);
  });

  app.patch("/bookmarks/:id", { preHandler: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = db
      .query(`SELECT id FROM bookmarks WHERE id = ? AND user_id = ?`)
      .get(id, uid(req));
    if (!existing) return reply.code(404).send({ error: "not_found" });

    const b = (req.body ?? {}) as {
      name?: string; lat?: number; lon?: number; icon?: string; note?: string;
    };
    if (b.name !== undefined && (!b.name || b.name.length > 200))
      return reply.code(400).send({ error: "invalid_name" });
    if ((b.lat !== undefined || b.lon !== undefined) && !validCoord(b.lat, b.lon))
      return reply.code(400).send({ error: "invalid_coordinates" });

    // Build the update from whitelisted fields only.
    const sets: string[] = [];
    const vals: (string | number)[] = [];
    for (const key of ["name", "icon", "note"] as const) {
      if (b[key] !== undefined) { sets.push(`${key} = ?`); vals.push(b[key]!); }
    }
    if (b.lat !== undefined) { sets.push(`lat = ?`); vals.push(b.lat); }
    if (b.lon !== undefined) { sets.push(`lon = ?`); vals.push(b.lon); }
    if (sets.length === 0) return reply.code(400).send({ error: "empty_update" });
    sets.push(`updated_at = ?`); vals.push(now());
    vals.push(id);
    db.query(`UPDATE bookmarks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    return db
      .query(`SELECT id, name, lat, lon, icon, note, created_at AS createdAt, updated_at AS updatedAt
              FROM bookmarks WHERE id = ?`)
      .get(id);
  });

  app.delete("/bookmarks/:id", { preHandler: guard }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = db.query(`DELETE FROM bookmarks WHERE id = ? AND user_id = ?`).run(id, uid(req));
    if (res.changes === 0) return reply.code(404).send({ error: "not_found" });
    reply.code(204);
  });

  // ---- Settings sync (active pack + last camera) ---------------------------
  app.get("/user/settings", { preHandler: guard }, async (req) => {
    const row = db
      .query(`SELECT active_pack AS activePack, camera, updated_at AS updatedAt
              FROM settings WHERE user_id = ?`)
      .get(uid(req)) as { activePack: string | null; camera: string | null; updatedAt: number } | null;
    return {
      activePack: row?.activePack ?? null,
      camera: row?.camera ? JSON.parse(row.camera) : null,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  app.put("/user/settings", { preHandler: guard }, async (req, reply) => {
    const b = (req.body ?? {}) as { activePack?: string | null; camera?: unknown };
    if (b.activePack !== undefined && b.activePack !== null && typeof b.activePack !== "string")
      return reply.code(400).send({ error: "invalid_active_pack" });
    const cameraJson = b.camera === undefined ? null : JSON.stringify(b.camera);
    db.query(
      `INSERT INTO settings (user_id, active_pack, camera, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         active_pack = COALESCE(excluded.active_pack, settings.active_pack),
         camera      = COALESCE(excluded.camera, settings.camera),
         updated_at  = excluded.updated_at`
    ).run(uid(req), b.activePack ?? null, cameraJson, now());
    return { ok: true };
  });
}
