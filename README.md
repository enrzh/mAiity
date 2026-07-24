# maps — web + native map with swappable texture packs

Phase 0 goal: **one `style.json` renders identically on web and iOS**, from tiles
you control, with no third-party API key. Everything runs on the open
**MapLibre + OpenStreetMap/Protomaps** stack — no Google Maps (see notes below).

```
        ┌─ base geometry (roads, water, buildings, land) ─┐
OSM ────┤   → Protomaps v4 vector schema (PMTiles)         │→ style.json → web + iOS
        └──────────────────────────────────────────────────┘
        ┌─ POI density (your differentiator) ─────────────┐
Overture ┐                                                 │
 + FSQ   ┴→ tippecanoe → pois.pmtiles (overlay layer) ─────┘
```

## Layout

| Path | What |
|---|---|
| `style/style.json` | **The shared artifact.** Web imports it; iOS bundles it. Edit once, both change. |
| `web/` | Vite + MapLibre GL JS v5 + pmtiles. |
| `ios/` | SwiftUI app via `maplibre/swiftui-dsl` (XcodeGen). |
| `data/` | `build-tiles.sh` (base) + `build-pois.sh` (Overture + Foursquare overlay). |
| `infra/` | nginx config for self-hosting `.pmtiles` (byte-range + CORS). |

## Run the web client

```bash
cd web
npm install
npm run dev     # http://localhost:5173
```

Out of the box it renders the **Protomaps keyless demo tiles** — proof that the
renderer + style work with zero setup. Nothing to build first.

## Make it *your* map (self-hosted tiles)

```bash
# 1. cut a small region from Protomaps' hosted planet build
brew install protomaps/tap/pmtiles
./data/build-tiles.sh              # -> web/public/region.pmtiles  (edit data/bbox.env)

# 2. point the style at your file: in style/style.json change
#    sources.protomaps.url  ->  "pmtiles://http://localhost:5173/region.pmtiles"
```

## Add rich POIs (Overture + Foursquare)

```bash
pip install overturemaps && brew install duckdb tippecanoe
./data/build-pois.sh               # -> web/public/pois.pmtiles
# then add a pois source + symbol layer to style/style.json
```

## iOS

```bash
brew install xcodegen
cd ios && xcodegen generate && open MapsApp.xcodeproj
```

The app bundles `style/style.json` and renders it with MapLibre Native — same map
as the web. (Uses the `pmtiles://` scheme, supported by MapLibre Native iOS.)

## Notes / gotchas

- **No Google Maps.** Its cloud styling can't load custom sprites/fonts/texture
  packs, and its ToS forbids scraping its data to build your own map. Richer POI
  data comes from **Overture + Foursquare Open Places** — legal, free, owned.
- **PMTiles hosting** must return HTTP **byte-range** + CORS `Range` or MapLibre
  shows a blank map with no error. See `infra/nginx-pmtiles.conf`; Cloudflare R2
  does both natively.
- **Attribution** (`© OpenStreetMap`, Protomaps) is baked into the style and must
  stay visible — it's an ODbL requirement, in every tier.
- `swiftui-dsl` is pre-1.0: pin the version; drop to raw `MLNMapView` for
  anything it hasn't wrapped.

## Roadmap

- **Phase 0 (here):** one style, both clients, your tiles + POIs.
- **Phase 1:** the `.mappack` texture-pack format + packager CLI + manager UI.
- **Phase 2:** offline downloads + Android + StoreKit (`hasPro` gate, €1/mo · €10/yr).
- **Phase 3:** pack marketplace (registry on NAS, signed packs).
