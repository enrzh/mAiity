#!/usr/bin/env bash
#
# Build a COMPLETE local POI database from the Germany OSM extract that
# Valhalla already downloaded. Photon's text index only matches category
# WORDS, so branded places ("REWE", "McDonald's") were invisible — this gives
# every named POI with its category, brand and address.
#
# Runs ON THE NAS (the .pbf is there; the Mac uplink is slow).
# Output: /volume1/docker/maps/data-api/pois.db  (SQLite, read by the API)
#
set -euo pipefail
BASE=/volume1/docker/maps
PBF="$BASE/valhalla-data/germany-latest.osm.pbf"
OUT="$BASE/data-api/pois.db"
DUCK="$BASE/duckdb"

[ -f "$PBF" ] || { echo "missing $PBF"; exit 1; }

if [ ! -x "$DUCK" ]; then
  echo "[1/3] installing duckdb"
  curl -sL https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip -o /tmp/duck.zip
  unzip -o /tmp/duck.zip duckdb -d "$BASE" >/dev/null
  chmod +x "$DUCK"
fi
"$DUCK" --version

echo "[2/3] extracting POIs from $(du -h "$PBF" | cut -f1) pbf (this takes a while)"
rm -f "$OUT"
"$DUCK" <<SQL
INSTALL spatial; LOAD spatial;
INSTALL sqlite;  LOAD sqlite;
ATTACH '$OUT' AS out (TYPE SQLITE);

CREATE TEMP TABLE raw AS
SELECT
  map_extract(tags, 'name')[1]          AS name,
  map_extract(tags, 'amenity')[1]       AS amenity,
  map_extract(tags, 'shop')[1]          AS shop,
  map_extract(tags, 'tourism')[1]       AS tourism,
  map_extract(tags, 'leisure')[1]       AS leisure,
  map_extract(tags, 'brand')[1]         AS brand,
  map_extract(tags, 'addr:street')[1]   AS street,
  map_extract(tags, 'addr:housenumber')[1] AS housenumber,
  map_extract(tags, 'addr:postcode')[1] AS postcode,
  map_extract(tags, 'addr:city')[1]     AS city,
  lat, lon
FROM ST_ReadOSM('$PBF')
WHERE kind = 'node' AND lat IS NOT NULL
  AND map_extract(tags, 'name')[1] IS NOT NULL
  AND (map_extract(tags, 'amenity')[1] IS NOT NULL
    OR map_extract(tags, 'shop')[1]    IS NOT NULL
    OR map_extract(tags, 'tourism')[1] IS NOT NULL
    OR map_extract(tags, 'leisure')[1] IS NOT NULL);

CREATE TABLE out.pois AS
SELECT
  name,
  -- App categories (the chips). 'other' stays searchable by name/brand.
  CASE
    WHEN amenity IN ('restaurant','fast_food','biergarten','food_court') THEN 'restaurant'
    WHEN amenity IN ('cafe','ice_cream','bar','pub')                     THEN 'cafe'
    WHEN shop IN ('supermarket','convenience','greengrocer','butcher','bakery','deli') THEN 'supermarket'
    WHEN amenity = 'fuel'                                                THEN 'fuel'
    WHEN amenity IN ('pharmacy','doctors','hospital','clinic')            THEN 'pharmacy'
    WHEN tourism IN ('hotel','hostel','guest_house','motel','apartment') THEN 'hotel'
    WHEN amenity IN ('parking','parking_space','bicycle_parking')         THEN 'parking'
    WHEN amenity IN ('atm','bank','bureau_de_change')                     THEN 'atm'
    ELSE 'other'
  END AS cat,
  COALESCE(amenity, shop, tourism, leisure) AS kind,
  brand,
  trim(coalesce(street,'') || ' ' || coalesce(housenumber,'')) AS street,
  postcode,
  city,
  lat, lon
FROM raw;

SELECT cat, count(*) AS n FROM out.pois GROUP BY cat ORDER BY n DESC;
SELECT count(*) AS total FROM out.pois;
SQL

echo "[3/3] indexing"
# bun:sqlite reads this; a compound bbox index keeps /nearby fast.
"$BASE/duckdb" -c "ATTACH '$OUT' AS o (TYPE SQLITE); " >/dev/null 2>&1 || true
python3 - "$OUT" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute("CREATE INDEX IF NOT EXISTS idx_pois_bbox ON pois(lat, lon)")
db.execute("CREATE INDEX IF NOT EXISTS idx_pois_cat  ON pois(cat, lat, lon)")
db.execute("CREATE INDEX IF NOT EXISTS idx_pois_name ON pois(name)")
db.commit()
print("rows:", db.execute("select count(*) from pois").fetchone()[0])
db.close()
PY
ls -lh "$OUT"
echo "DONE"
