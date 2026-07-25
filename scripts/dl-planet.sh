#!/bin/bash
# Parallel chunked download: the origin throttles ~3 MB/s PER CONNECTION,
# so 8 concurrent ranged GETs give ~8x. Each chunk is its own file, which
# makes the whole thing resumable — a rerun only refetches missing/short parts.
#
# v2: the finalization used to be
#   [ "$sz" = "$TOTAL" ] && rm -rf "$DIR" && echo "PLANET DOWNLOAD COMPLETE"
# which on a size mismatch printed NOTHING, left a truncated archive at $OUT,
# and exited 0 — indistinguishable from success. Now it fails loudly.
# Also bumps curl's retries: part 124 lost an HTTP/2 stream (curl 92) and
# exhausted 5 attempts, which cost a full rerun.
set -u
URL=https://build.protomaps.com/20260725.pmtiles
OUT=/volume1/docker/maps/planet-z15.pmtiles
DIR=/volume1/docker/maps/planet-parts
TOTAL=137012000190
CHUNK=$((1024*1024*1024))          # 1 GiB per part
N=$(( (TOTAL + CHUNK - 1) / CHUNK ))

fetch() {
  i=$1
  start=$(( i * CHUNK ))
  end=$(( start + CHUNK - 1 ))
  [ $end -ge $TOTAL ] && end=$(( TOTAL - 1 ))
  want=$(( end - start + 1 ))
  f="$DIR/part.$(printf %04d $i)"
  have=$( [ -f "$f" ] && stat -c %s "$f" || echo 0 )
  [ "$have" = "$want" ] && return 0          # already complete
  # --http1.1 avoids the HTTP/2 stream resets seen on long chunk transfers.
  curl -sS --http1.1 --retry 10 --retry-delay 3 --retry-all-errors \
       -r ${start}-${end} -o "$f" "$URL"
}
export -f fetch; export URL DIR CHUNK TOTAL

seq 0 $((N-1)) | xargs -P 8 -I{} bash -c 'fetch {}'

# Verify every part before assembling — a short part would corrupt the archive.
bad=0
for i in $(seq 0 $((N-1))); do
  start=$(( i * CHUNK )); end=$(( start + CHUNK - 1 ))
  [ $end -ge $TOTAL ] && end=$(( TOTAL - 1 ))
  want=$(( end - start + 1 ))
  f="$DIR/part.$(printf %04d $i)"
  have=$( [ -f "$f" ] && stat -c %s "$f" || echo 0 )
  [ "$have" = "$want" ] || { echo "SHORT part $i: $have/$want"; bad=1; }
done
[ $bad = 1 ] && { echo "INCOMPLETE — rerun to resume"; exit 1; }

# Zero-padded names, so the glob sorts numerically — order is the one thing a
# byte-count check can never catch.
cat "$DIR"/part.* > "$OUT"
sz=$(stat -c %s "$OUT")
echo "assembled: $sz bytes (expected $TOTAL)"
if [ "$sz" != "$TOTAL" ]; then
  echo "FAIL: assembled size mismatch (diff $((sz - TOTAL))) — parts kept for retry"
  exit 1
fi
rm -rf "$DIR"
echo "PLANET DOWNLOAD COMPLETE"
