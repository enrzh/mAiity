import type { FastifyInstance } from "fastify";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/// Elevation (DEM) tile proxy for 3D terrain.
///
/// The public Terrarium tiles (AWS Open Data) serve NO CORS headers, so a
/// browser cannot upload them as WebGL textures — terrain silently stays
/// flat. We proxy them under our own origin (same-origin = no CORS problem)
/// and cache each tile on disk so the upstream is hit once per tile ever.
const UPSTREAM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const MAX_Z = 13;

export function registerDemRoutes(app: FastifyInstance, cacheDir: string) {
  try { mkdirSync(cacheDir, { recursive: true }) } catch { /* best effort */ }

  app.get("/dem/:z/:x/:y", async (req, reply) => {
    const { z, x, y } = req.params as { z: string; x: string; y: string };
    const zi = Number(z), xi = Number(x), yi = Number(y.replace(/\.png$/, ""));
    const max = 2 ** zi;
    if (!Number.isInteger(zi) || zi < 0 || zi > MAX_Z ||
        !Number.isInteger(xi) || xi < 0 || xi >= max ||
        !Number.isInteger(yi) || yi < 0 || yi >= max) {
      return reply.code(400).send({ error: "bad_tile" });
    }

    reply.header("Cache-Control", "public, max-age=2592000, immutable");
    reply.header("Access-Control-Allow-Origin", "*");
    reply.type("image/png");

    const file = join(cacheDir, `${zi}_${xi}_${yi}.png`);
    if (existsSync(file)) return reply.send(readFileSync(file));

    try {
      const res = await fetch(`${UPSTREAM}/${zi}/${xi}/${yi}.png`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return reply.code(res.status === 404 ? 404 : 502).send();
      const buf = Buffer.from(await res.arrayBuffer());
      try { writeFileSync(file, buf) } catch { /* cache is optional */ }
      return reply.send(buf);
    } catch {
      return reply.code(502).send();
    }
  });
}
