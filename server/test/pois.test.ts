import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PoiIndex } from "../src/pois";

/// Same fixture rows through both search implementations: the FTS5 fast
/// path and the LIKE fallback (pre-FTS databases). Ranking and bbox
/// behaviour must match — only the junk mid-word-substring tier is
/// allowed to differ.

const ROWS = [
  // name, cat, kind, brand, city, lat, lon
  ["REWE", "supermarket", "supermarket", "REWE", "Köln", 50.95, 6.96],
  ["REWE City", "supermarket", "supermarket", "REWE", "Köln", 50.94, 6.95],
  ["Restaurant Rhein", "restaurant", "restaurant", null, "Köln", 50.93, 6.97],
  ["Bikerewerkstatt", "other", "bicycle_repair", null, "Köln", 50.951, 6.961],
  ["REWE", "supermarket", "supermarket", "REWE", "München", 48.14, 11.58], // outside bbox
] as const;

function makeDb(path: string, withFts: boolean) {
  const db = new Database(path);
  db.run(`CREATE TABLE pois (name TEXT, cat TEXT, kind TEXT, brand TEXT,
          street TEXT, postcode TEXT, city TEXT, lat REAL, lon REAL)`);
  const ins = db.query(
    `INSERT INTO pois (name, cat, kind, brand, street, postcode, city, lat, lon)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
  );
  for (const [name, cat, kind, brand, city, lat, lon] of ROWS) ins.run(name, cat, kind, brand, city, lat, lon);
  if (withFts) {
    db.run(`CREATE VIRTUAL TABLE pois_fts USING fts5(name, brand, poi_id UNINDEXED)`);
    db.run(`INSERT INTO pois_fts (name, brand, poi_id) SELECT name, coalesce(brand,''), rowid FROM pois`);
  }
  db.close();
}

const dir = mkdtempSync(join(tmpdir(), "pois-test-"));

for (const withFts of [true, false]) {
  const label = withFts ? "FTS5 path" : "LIKE fallback";
  describe(`PoiIndex ${label}`, () => {
    const path = join(dir, withFts ? "fts.db" : "plain.db");
    makeDb(path, withFts);
    const idx = new PoiIndex(path);

    test("is available", () => {
      expect(idx.available).toBe(true);
    });

    test("brand query ranks exact name over noise, bbox-limited", () => {
      const r = idx.search("REWE", 50.95, 6.96);
      expect(r.length).toBeGreaterThanOrEqual(2);
      // Exact-name tier first; the München REWE is outside the 40km box.
      expect(r[0].name).toContain("REWE");
      expect(r.every((x) => x.city !== "München")).toBe(true);
      // The mid-word substring hit is junk tier: never above real matches.
      const bikeIdx = r.findIndex((x) => x.name === "Bikerewerkstatt");
      if (bikeIdx !== -1) expect(bikeIdx).toBeGreaterThan(0);
      if (withFts) expect(bikeIdx).toBe(-1); // FTS drops mid-word matches entirely
    });

    test("multi-word prefix query matches", () => {
      const r = idx.search("Restaurant Rh", 50.95, 6.96);
      expect(r.some((x) => x.name === "Restaurant Rhein")).toBe(true);
    });

    test("garbage query returns empty, never throws", () => {
      expect(idx.search('"*^\'', 50.95, 6.96)).toEqual([]);
      expect(idx.search("zzzzunfindable", 50.95, 6.96)).toEqual([]);
    });
  });
}
