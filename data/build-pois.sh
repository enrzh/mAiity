#!/usr/bin/env bash
#
# Phase 0 · Stage B — build YOUR OWN POI overlay (the "richer than raw OSM"
# differentiator) from Overture Places + Foursquare Open Places. Fully legal,
# permissively licensed, no Google.
#
# Requires:
#   pip install overturemaps          # Overture CLI
#   brew install duckdb tippecanoe    # query + vector-tile builder
#
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source data/bbox.env
IFS=',' read -r W S E N <<< "$BBOX"

echo "1/3  Overture Places  ->  data/overture.geojsonseq"
overturemaps download --bbox="$BBOX" -f geojsonseq --type=place -o data/overture.geojsonseq

echo "2/3  Foursquare Open Places (Apache-2.0)  ->  data/fsq.geojsonseq"
# NOTE: confirm the current FSQ release S3 path + column names against
# https://docs.foursquare.com/data-products/docs/places-os  — layout changes per release.
duckdb -c "
  INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;
  SET s3_region='us-east-1';
  COPY (
    SELECT name,
           ST_Point(longitude, latitude) AS geometry
    FROM read_parquet('s3://fsq-os-places-us-east-1/release/dt=*/places/parquet/*.parquet', hive_partitioning=1)
    WHERE longitude BETWEEN $W AND $E AND latitude BETWEEN $S AND $N
      AND name IS NOT NULL
  ) TO 'data/fsq.geojsonseq' WITH (FORMAT gdal, DRIVER 'GeoJSONSeq');
" || echo "  (skipped/needs path fix — see the NOTE above)"

echo "3/3  Merge  ->  tippecanoe  ->  web/public/pois.pmtiles"
cat data/overture.geojsonseq data/fsq.geojsonseq > data/pois.geojsonseq 2>/dev/null || cp data/overture.geojsonseq data/pois.geojsonseq
tippecanoe -o web/public/pois.pmtiles -l pois -zg \
  --drop-densest-as-needed --extend-zooms-if-still-dropping --force \
  data/pois.geojsonseq

echo
echo "Done. Add a POI source + symbol layer to style/style.json, e.g.:"
echo '  sources.pois = { "type":"vector", "url":"pmtiles://http://localhost:5173/pois.pmtiles" }'
echo '  then a symbol layer with "source":"pois","source-layer":"pois".'
