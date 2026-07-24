import type { FastifyInstance } from "fastify";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface PackInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  styleUrl: string;
  preview?: unknown;
}

/** Scan the packs directory (each subdir = one pack with pack.json + style.json). */
export function listPacks(packsDir: string, publicBase: string): PackInfo[] {
  if (!existsSync(packsDir)) return [];
  const out: PackInfo[] = [];
  for (const entry of readdirSync(packsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packsDir, entry.name, "pack.json");
    const stylePath = join(packsDir, entry.name, "style.json");
    if (!existsSync(manifestPath) || !existsSync(stylePath)) continue;
    try {
      const m = JSON.parse(readFileSync(manifestPath, "utf8"));
      out.push({
        id: m.id ?? entry.name,
        name: m.name ?? entry.name,
        version: m.version ?? "0.0.0",
        author: m.author ?? "",
        description: m.description ?? "",
        preview: m.preview,
        styleUrl: `${publicBase}/${entry.name}/style.json`,
      });
    } catch {
      // Broken manifest — skip the pack rather than break the list.
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function registerPackRoutes(app: FastifyInstance, packsDir: string, publicBase: string) {
  app.get("/packs", async () => ({ packs: listPacks(packsDir, publicBase) }));
}
