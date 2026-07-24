#!/usr/bin/env bash
#
# Phase 0 · Stage A — cut a regional PMTiles so you self-host YOUR base map.
#
# Requires the pmtiles CLI:
#   brew install protomaps/tap/pmtiles
#   # or: go install github.com/protomaps/go-pmtiles@latest
#
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source data/bbox.env

# Source archive. The demo bucket is keyless + always up; for fresh data use a
# dated daily build instead: https://build.protomaps.com/<YYYYMMDD>.pmtiles
SRC="${SRC:-https://demo-bucket.protomaps.com/v4.pmtiles}"
OUT="web/public/region.pmtiles"

echo "Extracting bbox=$BBOX"
echo "  from $SRC"
echo "  ->   $OUT"
pmtiles extract "$SRC" "$OUT" --bbox="$BBOX"

echo
echo "Done. To serve YOUR tiles instead of the demo bucket, point the source"
echo "url in style/style.json at:  pmtiles://http://localhost:5173/region.pmtiles"
echo "(or your VPS/R2 URL once deployed — see infra/nginx-pmtiles.conf)."
