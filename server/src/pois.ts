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
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  cuisine?: string | null;
  wheelchair?: string | null;
}

export interface PoiResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  /** Detail fields — present once the DB carries them. */
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null;
  cuisine?: string | null;
  wheelchair?: string | null;
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

/** Detail columns that only exist after the enriched extract. */
const DETAIL_COLUMNS = ["phone", "website", "opening_hours", "cuisine", "wheelchair"] as const;

export class PoiIndex {
  private db: Database | null = null;
  /** Columns actually present — the DB may predate the detail fields. */
  private columns: string[] = [];

  constructor(path: string) {
    if (!existsSync(path)) return;
    try {
      this.db = new Database(path, { readonly: true });
      this.columns = (this.db.query("PRAGMA table_info(pois)").all() as Array<{ name: string }>)
        .map((c) => c.name);
      if (!this.columns.includes("name")) this.db = null;
    } catch {
      this.db = null;
    }
  }

  get available(): boolean {
    return this.db !== null;
  }

  /** True once the enriched extract (phone/hours/…) has landed. */
  get hasDetails(): boolean {
    return this.columns.includes("opening_hours");
  }

  /** SELECT list limited to columns this DB actually has. */
  private get selectList(): string {
    const base = ["name", "cat", "kind", "brand", "street", "postcode", "city", "lat", "lon"];
    const extra = DETAIL_COLUMNS.filter((c) => this.columns.includes(c));
    return [...base, ...extra].join(", ");
  }

  private toResult(r: PoiRow): PoiResult {
    return {
      name: r.brand && !r.name.includes(r.brand) ? `${r.name} (${r.brand})` : r.name,
      label: label(r),
      lat: r.lat,
      lon: r.lon,
      kind: r.kind ?? r.cat,
      street: r.street ?? null,
      postcode: r.postcode ?? null,
      city: r.city ?? null,
      phone: r.phone ?? null,
      website: r.website ?? null,
      openingHours: r.opening_hours ?? null,
      cuisine: r.cuisine ?? null,
      wheelchair: r.wheelchair ?? null,
    };
  }

  /** Nearest POIs of a category, sorted by true distance. */
  nearby(cat: string, lat: number, lon: number, limit = 20): PoiResult[] {
    if (!this.db) return [];
    for (const radius of [1_500, 5_000, 20_000, 60_000]) {
      const { dLat, dLon } = degBox(lat, radius);
      const rows = this.db
        .query(
          `SELECT ${this.selectList} FROM pois
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
        .map(({ r }) => this.toResult(r));
    }
    return [];
  }

  /** Name/brand search near a point — finds "REWE", "Netto", "Späti". */
  search(q: string, lat: number, lon: number, limit = 8): PoiResult[] {
    if (!this.db) return [];
    const { dLat, dLon } = degBox(lat, 40_000);
    const rows = this.db
      .query(
        `SELECT ${this.selectList} FROM pois
         WHERE (name LIKE ?1 OR brand LIKE ?1)
           AND lat BETWEEN ?2 AND ?3 AND lon BETWEEN ?4 AND ?5
         LIMIT 400`,
      )
      .all(`%${q}%`, lat - dLat, lat + dLat, lon - dLon, lon + dLon) as PoiRow[];
    return rows
      .map((r) => ({
        r,
        rank: r.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1,
        d: (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2,
      }))
      .sort((a, b) => a.rank - b.rank || a.d - b.d)
      .slice(0, limit)
      .map(({ r }) => this.toResult(r));
  }

  /// Details for the POI at (or nearest to) a coordinate — powers the place
  /// panel after a search hit or a map tap. Name is used as a tie-breaker,
  /// never as a hard filter, so a tap slightly off the pin still resolves.
  detailsAt(lat: number, lon: number, name?: string, radiusM = 120): PoiResult | null {
    if (!this.db) return null;
    const { dLat, dLon } = degBox(lat, radiusM);
    const rows = this.db
      .query(
        `SELECT ${this.selectList} FROM pois
         WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 200`,
      )
      .all(lat - dLat, lat + dLat, lon - dLon, lon + dLon) as PoiRow[];
    if (rows.length === 0) return null;
    const wanted = name?.toLowerCase().trim();
    const scored = rows.map((r) => ({
      r,
      nameMatch: wanted && r.name.toLowerCase().includes(wanted.split(" (")[0]) ? 0 : 1,
      d: (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2,
    }));
    scored.sort((a, b) => a.nameMatch - b.nameMatch || a.d - b.d);
    return this.toResult(scored[0].r);
  }
}
