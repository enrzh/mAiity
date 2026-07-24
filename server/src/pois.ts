import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

/// Local POI index built from the Germany OSM extract (data/build-poi-db.sh).
/// Photon's text index only matched category WORDS, so branded places
/// ("REWE", "McDonald's") were invisible — this returns everything.

export interface PoiRow {
  name: string;
  cat: string;
  kind: string | null;
  brand: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  lat: number;
  lon: number;
}

export interface PoiResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
  kind: string;
}

/** Nice German label: "REWE, Hauptstraße 3, 10115, Berlin". */
function label(r: PoiRow): string {
  return [r.name, r.street, r.postcode, r.city].filter((s) => s && String(s).trim()).join(", ");
}

/** Rough metres-per-degree at the given latitude (equirectangular). */
function degBox(lat: number, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { dLat, dLon };
}

export class PoiIndex {
  private db: Database | null = null;

  constructor(path: string) {
    if (!existsSync(path)) return;
    try {
      this.db = new Database(path, { readonly: true });
      // Fail fast if the table is missing/corrupt rather than at query time.
      this.db.query("SELECT 1 FROM pois LIMIT 1").get();
    } catch {
      this.db = null;
    }
  }

  get available(): boolean {
    return this.db !== null;
  }

  /** Nearest POIs of a category, sorted by true distance. */
  nearby(cat: string, lat: number, lon: number, limit = 20): PoiResult[] {
    if (!this.db) return [];
    // Widen the search box until we have enough hits (dense city → 1 pass).
    for (const radius of [1_500, 5_000, 20_000, 60_000]) {
      const { dLat, dLon } = degBox(lat, radius);
      const rows = this.db
        .query(
          `SELECT name, cat, kind, brand, street, postcode, city, lat, lon
           FROM pois
           WHERE cat = ? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
           LIMIT 600`,
        )
        .all(cat, lat - dLat, lat + dLat, lon - dLon, lon + dLon) as PoiRow[];
      if (rows.length === 0 && radius !== 60_000) continue;
      return rows
        .map((r) => ({
          r,
          d: (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2,
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, limit)
        .map(({ r }) => ({
          name: r.brand && !r.name.includes(r.brand) ? `${r.name} (${r.brand})` : r.name,
          label: label(r),
          lat: r.lat,
          lon: r.lon,
          kind: r.kind ?? r.cat,
        }));
    }
    return [];
  }

  /** Name/brand search near a point — finds "REWE", "Netto", "Späti". */
  search(q: string, lat: number, lon: number, limit = 8): PoiResult[] {
    if (!this.db) return [];
    const { dLat, dLon } = degBox(lat, 40_000);
    const rows = this.db
      .query(
        `SELECT name, cat, kind, brand, street, postcode, city, lat, lon
         FROM pois
         WHERE (name LIKE ?1 OR brand LIKE ?1)
           AND lat BETWEEN ?2 AND ?3 AND lon BETWEEN ?4 AND ?5
         LIMIT 400`,
      )
      .all(`%${q}%`, lat - dLat, lat + dLat, lon - dLon, lon + dLon) as PoiRow[];
    return rows
      .map((r) => ({
        r,
        // Prefer prefix matches, then proximity.
        rank: (r.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1),
        d: (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2,
      }))
      .sort((a, b) => a.rank - b.rank || a.d - b.d)
      .slice(0, limit)
      .map(({ r }) => ({
        name: r.name,
        label: label(r),
        lat: r.lat,
        lon: r.lon,
        kind: r.kind ?? r.cat,
      }));
  }
}
