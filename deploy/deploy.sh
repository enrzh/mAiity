#!/usr/bin/env bash
#
# Deploy maps to the NAS. Usage:
#   ./deploy/deploy.sh [web] [api] [packs]
# No args = deploy everything.
#
set -euo pipefail
cd "$(dirname "$0")/.."
NAS=enrico@100.93.237.25
SCP="scp -O -o StrictHostKeyChecking=no"
SSH="ssh -o StrictHostKeyChecking=no"

WANT="${*:-web api packs}"

if [[ "$WANT" == *web* ]]; then
  echo "── web: build + upload"
  (cd web && npm run build >/dev/null)
  tar czf /tmp/maps-dist.tgz -C web/dist .
  $SCP /tmp/maps-dist.tgz "$NAS:/tmp/"
  # Preserve EVERY tile archive (they are 7-128 GB and versioned, e.g.
  # region-z14.pmtiles) — a bare `! -name region.pmtiles` silently deletes
  # the versioned ones and the map 404s.
  $SSH "$NAS" 'set -e
    cd /volume1/docker/maps
    # Recover the stable archive before replacing web assets. Deploying UI
    # must never silently disable every custom map style.
    if ! find dist -maxdepth 1 -name "*.pmtiles" -print -quit | grep -q .; then
      archive="$(find dist.old . -maxdepth 2 -name "region.pmtiles" -print -quit 2>/dev/null || true)"
      if [ -n "$archive" ]; then ln "$archive" dist/region.pmtiles 2>/dev/null || cp --reflink=auto "$archive" dist/region.pmtiles; fi
    fi
    find dist -mindepth 1 -maxdepth 1 ! -name "*.pmtiles" -exec rm -rf {} +
    tar xzf /tmp/maps-dist.tgz -C dist 2>/dev/null
    test -s dist/region.pmtiles
    ls dist | head'
fi

if [[ "$WANT" == *packs* ]]; then
  echo "── packs: upload"
  tar czf /tmp/maps-packs.tgz -C packs .
  $SCP /tmp/maps-packs.tgz "$NAS:/tmp/"
  $SSH "$NAS" 'cd /volume1/docker/maps && rm -rf packs/* && tar xzf /tmp/maps-packs.tgz -C packs 2>/dev/null; ls packs'
fi

if [[ "$WANT" == *api* ]]; then
  echo "── api: upload + rebuild container"
  tar czf /tmp/maps-api.tgz -C server package.json Dockerfile src
  $SCP /tmp/maps-api.tgz deploy/nas/docker-compose.yaml deploy/nas/nginx.conf "$NAS:/tmp/"
  $SSH "$NAS" 'set -e; cd /volume1/docker/maps
    rm -rf api/src && tar xzf /tmp/maps-api.tgz -C api 2>/dev/null
    cp /tmp/docker-compose.yaml docker-compose.yaml && cp /tmp/nginx.conf nginx.conf
    docker compose up -d --build 2>&1 | tail -2
    sleep 2; docker ps --filter name=apps-nas-maps --format "{{.Names}} {{.Status}}"'
fi

echo "── verify"
curl -s https://maps.aiity.de/maps/api/healthz && echo
curl -s -o /dev/null -w "web: %{http_code}\n" https://maps.aiity.de/maps/
curl -s -o /dev/null -w "tiles range: %{http_code}\n" -H 'Range: bytes=0-0' https://maps.aiity.de/maps/region-z15.pmtiles
echo "done."
