import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MLMap, Marker, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { api } from '../lib/api'
import { makeT } from '../lib/i18n'
import {
  locateActiveMap,
  registerMapRenderer,
  setActiveMap3D,
  zoomActiveMap,
} from '../maps/rendererController'
import {
  type MapViewport,
} from '../maps/types'
import { readViewport, writeViewport } from '../maps/viewportStorage'
import { railInset } from '../maps/railInset'
import { MARKER_COLORS, MARKER_SCALES, MARKER_STROKES, ROUTE_STYLE } from '../lib/markerTokens'
import {
  raceCameraAt,
  RACE_LOOKAHEAD_M, RACE_LOOKAHEAD_READY_M,
} from '../lib/drivingCamera'
import { getDrivingLive, subscribeDrivingLive } from '../lib/drivingLive'
import { useApp } from '../state'
import { cn } from '../lib/utils'

// Bind protocol instance so MapLibre's free-function call keeps `this`.
const pmtilesProtocol = new Protocol()
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile.bind(pmtilesProtocol))

/**
 * The bundled PMTiles archive is regional. Starting at a Germany-wide camera
 * renders only the style background until geolocation or search moves into
 * the archive. Open on the archive's home region so the first frame is useful.
 */
const DEFAULT_CENTER: [number, number] = [6.71375, 51.19297]
const DEFAULT_ZOOM = 13

/** Live map handle for siblings that need camera reads (e.g. POI center). */
export const liveMap: { current: MLMap | null } = { current: null }

/// Free (keyless) global elevation tiles — Terrarium-encoded DEM. Gives the
/// map REAL relief instead of a flat plane; the single biggest 3D win.
/// Served through OUR api: the upstream Terrarium tiles carry no CORS
/// headers, so the browser cannot use them as WebGL textures directly.
const DEM_SOURCE = 'terrain-dem'
const DEM_TILES = '/maps/api/dem/{z}/{x}/{y}.png'

/// DEM is attached only AFTER the source is loaded. Calling `setTerrain`
/// before that can leave MapLibre on a blank sky (isSourceLoaded stuck false
/// on some paths). If DEM never loads within the timeout, 3D still works via
/// pitch + sky + extruded buildings.
const TERRAIN_ENABLED = true
const TERRAIN_ATTACH_MS = 4_000

/** Add the DEM source + sky once per style (re-run after every style.load). */
export function ensure3DScenery(m: MLMap) {
  if (TERRAIN_ENABLED && !m.getSource(DEM_SOURCE)) {
    try {
      m.addSource(DEM_SOURCE, {
        type: 'raster-dem',
        tiles: [DEM_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 13,
        attribution: 'Elevation: Terrain Tiles (AWS Open Data)',
      })
    } catch { /* style mid-swap */ }
  }
  // Atmosphere at the horizon — without it a pitched map looks cropped.
  // NOTE: in MapLibre v5 `sky` is a ROOT style property (setSky), NOT a
  // layer type — addLayer({type:'sky'}) throws and aborts 3D setup.
  try {
    // Soft atmosphere — high blend at low zoom washed the world into milk.
    m.setSky({
      'sky-color': '#8cb8e8',
      'sky-horizon-blend': 0.35,
      'horizon-color': '#e8eef5',
      'horizon-fog-blend': 0.25,
      'fog-color': '#e8eef5',
      'fog-ground-blend': 0.05,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.18, 4, 0.28, 8, 0.4, 14, 0.15],
    })
  } catch { /* older renderer without sky support */ }
}

/** Only enable terrain once DEM tiles are actually ready — never blanks the map. */
function attachTerrainWhenReady(m: MLMap) {
  if (!TERRAIN_ENABLED) return
  const apply = () => {
    try {
      if (m.getSource(DEM_SOURCE) && m.isSourceLoaded(DEM_SOURCE)) {
        m.setTerrain({ source: DEM_SOURCE, exaggeration: 1.15 })
        return true
      }
    } catch { /* ignore */ }
    return false
  }
  if (apply()) return
  const onData = (e: { sourceId?: string }) => {
    if (e.sourceId === DEM_SOURCE && apply()) m.off('sourcedata', onData)
  }
  m.on('sourcedata', onData)
  window.setTimeout(() => {
    m.off('sourcedata', onData)
    // Timed out: leave pitch/sky 3D without DEM (map stays visible).
  }, TERRAIN_ATTACH_MS)
}

/** Tilt into 3D with real terrain relief (or back to flat). */
export function set3D(on: boolean) {
  setActiveMap3D(on)
}

function setMapLibre3D(m: MLMap, on: boolean) {
  try {
    ensure3DScenery(m)
    if (on) attachTerrainWhenReady(m)
    else {
      try { m.setTerrain(null) } catch { /* ok */ }
    }
  } catch (e) {
    console.error('[3d] scenery unavailable', e) // never block the tilt
  }
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Don't force zoom-in on toggle — keep the user's scale (mobile felt "broken"
  // when 3D yanked the camera to z16).
  m.easeTo({
    pitch: on ? 58 : 0,
    bearing: on ? m.getBearing() : 0,
    duration: reduced ? 0 : 700,
  })
}

/** Globe at continental zoom; mercator for street/city. Softens flat-world fade. */
function syncProjectionForZoom(m: MLMap) {
  try {
    const z = m.getZoom()
    const wantGlobe = z < 5.5
    const proj = m.getProjection?.() as { type?: string } | undefined
    const cur = proj?.type ?? 'mercator'
    if (wantGlobe && cur !== 'globe') m.setProjection({ type: 'globe' })
    else if (!wantGlobe && cur === 'globe') m.setProjection({ type: 'mercator' })
  } catch { /* projection API unavailable */ }
}

/** Padding for framing calls, keeping content clear of the rail. */
function framePad(base: number) {
  return { top: base, bottom: base, right: base, left: base + railInset.current }
}

/** Whether 3D is currently engaged. Pitch — NOT getTerrain(), which is always
 *  null while TERRAIN_ENABLED is false and would report 3D as permanently off. */
export function is3DActive(): boolean {
  return (liveMap.current?.getPitch() ?? 0) > 5
}

/// Rewrite label layers to the chosen language. The tiles carry
/// name:<lang> for 40+ languages on places — without this, city names
/// render in each country's LOCAL language (Warszawa, København) and the
/// map reads inconsistently. Street names stay local on purpose: that is
/// what the signs on the ground say.
export function applyMapLanguage(m: MLMap, lang: string) {
  const localized = ["coalesce", ["get", `name:${lang}`], ["get", "name"]]
  try {
    if (m.getLayer('places-labels')) m.setLayoutProperty('places-labels', 'text-field', localized)
    if (m.getLayer('landmarks-labels'))
      m.setLayoutProperty('landmarks-labels', 'text-field', ["concat", "✦ ", localized])
  } catch { /* style mid-swap — the style.load hook re-applies */ }
}

/**
 * MapLibre pauses tile managers while a source is reloaded (e.g. after
 * setLayoutProperty on a protomaps layer). If resume runs before the manager
 * has a transform, tiles never cover the viewport — permanent blank basemap
 * (background only). Force every manager awake with the live transform.
 */
function kickTiles(m: MLMap) {
  try {
    const tm = (m as unknown as { style?: { tileManagers?: Map<string, any> | Record<string, any> } }).style?.tileManagers
    if (!tm) return
    const managers = typeof (tm as Map<string, any>).values === 'function'
      ? [...(tm as Map<string, any>).values()]
      : Object.values(tm as Record<string, any>)
    const terrain = (m as unknown as { terrain?: unknown }).terrain ?? null
    for (const manager of managers) {
      if (!manager) continue
      try {
        // Style recalc normally sets `used` each frame. If that loop stalls
        // (seen with deferred style.load mutations), managers stay with
        // used=undefined and never request tiles — blank basemap.
        manager.used = true
        if (manager._paused && typeof manager.resume === 'function') manager.resume()
        if (typeof manager.update === 'function' && m.transform) {
          manager.update(m.transform, terrain)
        }
      } catch { /* manager mid-dispose */ }
    }
    try { m.resize() } catch { /* ok */ }
    m.triggerRepaint()
  } catch { /* style not ready */ }
}

/// Persistent "you are here" dot — the built-in GeolocateControl only shows
/// one after an explicit click, and it collides with our control stack.
let userDot: Marker | null = null
export function showUserDot(m: MLMap, at: [number, number]) {
  if (!userDot) {
    const el = document.createElement('div')
    el.className = 'maps-user-dot'
    el.style.background = MARKER_COLORS.user // token, not CSS — one source of truth
    userDot = new Marker({ element: el })
  }
  userDot.setLngLat(at).addTo(m)
}

/// A fixed ~900ms for every camera jump, regardless of size, meant tiles for
/// a 10-zoom-level jump had exactly as long to load as a 2-level one. When
/// they didn't make it in time, MapLibre filled the gap with whatever coarser
/// zoom was already cached — and this archive's low-zoom water is generalized
/// aggressively enough that the gap-filler could look like a flood. Scaling
/// duration with the actual jump size gives real jumps (world view -> street
/// level) enough time for intermediate zooms to load along the way, so the
/// final frame is far more likely to already have the correct tile.
function flyDuration(m: MLMap, toZoom: number, base = 700): number {
  const delta = Math.abs(toZoom - m.getZoom())
  return Math.round(base + delta * 90)
}

/** Centre on the user, showing the dot. */
export function locateUser() {
  locateActiveMap()
}

function locateMapLibre(m: MLMap) {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const here: [number, number] = [p.coords.longitude, p.coords.latitude]
      showUserDot(m, here)
      m.flyTo({ center: here, zoom: 15, duration: flyDuration(m, 15) })
    },
    () => { /* permission denied — nothing to centre on */ },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

export function zoomBy(delta: number) {
  zoomActiveMap(delta)
}

/// The one imperative component: owns the MapLibre map, keeps it in sync with
/// app state (active pack style, selected place, bookmark markers).
export function MapLibreMapView() {
  const el = useRef<HTMLDivElement>(null)
  // Map readiness is STATE (not just a ref) so dependent effects re-run once
  // the map exists — a ref write alone would leave them dead forever.
  const [map, setMap] = useState<MLMap | null>(null)
  const styleRef = useRef<string | null>(null)
  // Own readiness flag: map.isStyleLoaded() is a transient tiles+sprite check
  // that reads false during tile loads — trusting it can silently drop the
  // route layer forever.
  const styleReadyRef = useRef(false)
  const wants3DRef = useRef(false)
  const selMarker = useRef<Marker | null>(null)
  const bmMarkers = useRef<globalThis.Map<string, Marker>>(new globalThis.Map())
  const drivingMarker = useRef<Marker | null>(null)
  const app = useApp()
  // Keep latest handlers reachable from map listeners without re-binding.
  const appRef = useRef(app)
  appRef.current = app
  wants3DRef.current = app.is3D

  // Init once, as soon as the first style URL is known. Keyed on a boolean so
  // later pack changes do NOT re-run this effect (its cleanup destroys the map).
  const ready = !!app.activeStyleUrl
  useEffect(() => {
    if (!el.current || !ready) return
    const host = el.current
    // If flex layout hasn't resolved yet, wait one frame so MapLibre doesn't
    // bake a 0-height canvas (looks like a permanently blank map).
    const boot = () => {
    const m = new maplibregl.Map({
      container: host,
      style: appRef.current.activeStyleUrl!,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      // Hash can re-open a previous world-scale zoom that leaves regional
      // packs looking empty — still enabled, but clamped on restore below.
      hash: true,
      minZoom: 3,
      maxZoom: 19,
      attributionControl: { compact: true },
      maxPitch: 85, // near-horizon 3D views
      // Low-zoom water polygons in this archive are heavily generalized (a
      // lake/river system can simplify to a shape covering an entire tile).
      // MapLibre briefly renders a cached tile from a DIFFERENT zoom as a
      // placeholder while the ideal one loads — normally unnoticeable, but
      // with data this coarse that placeholder looks like a flood. Keeping
      // more zoom levels' worth of tiles resident means a "zoom out then
      // back in" is more likely to find something close to the real zoom
      // already cached, instead of falling all the way back to z5-ish data.
      maxTileCacheZoomLevels: 8,
      maxTileCacheSize: 300,
    })
    styleRef.current = appRef.current.activeStyleUrl
    // NOTE: no built-in NavigationControl/GeolocateControl — they render in
    // the same bottom-right corner as our own stack and overlap it. Zoom and
    // locate live in MapControls instead.

    // Last click wins; a dead network falls back to the coordinate card.
    let clickSeq = 0
    m.on('click', async (e) => {
      const mySeq = ++clickSeq
      const { lat, lng } = e.lngLat
      const r = await api.reverse(lat, lng) // never throws (returns null)
      if (mySeq !== clickSeq) return
      appRef.current.select(
        r
          ? { name: r.name, label: r.label, lat: r.lat, lon: r.lon }
          : { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, label: makeT(appRef.current.lang)('unknown-place'), lat, lon: lng },
      )
    })

    m.on('error', (ev) => console.error('[maplibre]', ev?.error ?? ev))

    // Route layers are user layers on TOP of pack styles — re-added after
    // every setStyle (pack switch) from the current routeRef.
    //
    // CRITICAL: setLayoutProperty / addLayer pauses the basemap tile manager.
    // Doing that in style.load before the first cover of tiles is computed
    // leaves managers paused with no transform → permanent blank basemap
    // (dark/light background only, no roads). Let tiles spin up first.
    m.on('style.load', () => {
      styleReadyRef.current = true
      // Immediate kick so the basemap starts covering the viewport.
      requestAnimationFrame(() => {
        try { m.resize() } catch { /* ok */ }
        kickTiles(m)
      })

      let overlaysDone = false
      const applyOverlays = () => {
        if (overlaysDone) return
        overlaysDone = true
        try {
          // Language + optional route/3D only after basemap is alive.
          applyMapLanguage(m, appRef.current.lang)
          syncRouteLayers(m)
          if (wants3DRef.current) {
            ensure3DScenery(m)
            if (TERRAIN_ENABLED) m.setTerrain({ source: DEM_SOURCE, exaggeration: 1.2 })
          }
        } catch (e) {
          console.error('[maplibre] style overlays failed', e)
        } finally {
          kickTiles(m)
          requestAnimationFrame(() => kickTiles(m))
        }
      }

      // First idle = style + at least one render pass. Prefer that.
      m.once('idle', applyOverlays)
      // Fallback: don't block overlays forever if idle is flaky.
      window.setTimeout(applyOverlays, 1200)
    })

    // Startup location: open the map where the user IS.
    // The old check bailed whenever a #hash existed — but `hash: true` writes
    // one on every map move, so after the first visit it ALWAYS bailed and
    // never located. Instead: only a shared place (?p=) pins the view, and we
    // skip the fly if the user has already grabbed the map themselves.
    let userMoved = false
    const markMoved = (e: { originalEvent?: unknown }) => { if (e.originalEvent) userMoved = true }
    m.on('dragstart', markMoved)
    m.on('zoomstart', markMoved)

    const shared = new URLSearchParams(window.location.search).has('p')
    if (!shared && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here: [number, number] = [pos.coords.longitude, pos.coords.latitude]
          showUserDot(m, here)
          if (!userMoved) m.easeTo({ center: here, zoom: 15, duration: flyDuration(m, 15) })
        },
        () => { /* denied/unavailable — keep the current view */ },
        { timeout: 8000, maximumAge: 300_000 },
      )
    }

    // Keep the GL canvas matched to the container (init can happen pre-layout).
    // Coalesced to one resize per frame and skipped when the box did not
    // actually change: the sidebar's 300ms width transition fires this on every
    // frame, and a bare m.resize() per frame re-renders and re-requests tiles
    // for ~18 intermediate viewports — which looks like the map reloading.
    let raf = 0
    let lastW = 0
    let lastH = 0
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box && Math.round(box.width) === lastW && Math.round(box.height) === lastH) return
      if (box) { lastW = Math.round(box.width); lastH = Math.round(box.height) }
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; m.resize() })
    })
    ro.observe(host)

    setMap(m)
    liveMap.current = m
    const viewport = (): MapViewport => {
      const center = m.getCenter()
      const bounds = m.getBounds()
      return {
        center: { lat: center.lat, lon: center.lng },
        latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
        longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
        bearing: m.getBearing(),
      }
    }
    const moveListeners = new Set<() => void>()
    const onMoveEnd = () => {
      writeViewport('custom', viewport())
      for (const listener of moveListeners) listener()
    }
    m.on('moveend', onMoveEnd)
    m.on('zoomend', () => { try { syncProjectionForZoom(m) } catch { /* ok */ } })
    try { syncProjectionForZoom(m) } catch { /* ok */ }
    // Restore last custom viewport if we have one. Regional PMTiles look blank
    // at world-scale zooms, so clamp to a useful street/city range.
    const savedCustom = readViewport('custom')
    if (savedCustom) {
      try {
        const zFromDelta = Math.log2(360 / Math.max(0.01, savedCustom.longitudeDelta)) - 1
        const zoom = Math.max(10, Math.min(16, zFromDelta))
        m.jumpTo({
          center: [savedCustom.center.lon, savedCustom.center.lat],
          zoom,
        })
      } catch { /* ignore bad saved state */ }
    }
    // Layout can settle after first paint (flex + lazy engine). Force a resize
    // so we never stay stuck at 0×0 / stale canvas size — then kick tiles.
    requestAnimationFrame(() => {
      try { m.resize() } catch { /* disposed */ }
      kickTiles(m)
      requestAnimationFrame(() => {
        try { m.resize() } catch { /* disposed */ }
        kickTiles(m)
      })
    })
    // Periodic safety net for the first few seconds after boot (covers the
    // case where style.load overlays re-pause managers).
    const kickTimers = [300, 800, 1600].map((ms) =>
      window.setTimeout(() => { try { kickTiles(m) } catch { /* disposed */ } }, ms),
    )
    const unregisterController = registerMapRenderer({
      provider: 'custom',
      capabilities: {
        threeD: true,
        mapClick: true,
        routes: true,
        bookmarks: true,
        nativeControls: false,
      },
      locate: () => locateMapLibre(m),
      set3D: (on) => setMapLibre3D(m, on),
      zoomBy: (delta) => m.easeTo({ zoom: m.getZoom() + delta, duration: 220 }),
      focusPlace: (place) => m.flyTo({
        center: [place.lon, place.lat],
        zoom: Math.max(m.getZoom(), 14),
        duration: flyDuration(m, 14),
        padding: framePad(0),
      }),
      showPlaces: (places) => {
        if (!places.length) return
        const bounds = new maplibregl.LngLatBounds()
        for (const place of places) bounds.extend([place.lon, place.lat])
        m.fitBounds(bounds, { padding: framePad(80), duration: 700, maxZoom: 15 })
      },
      getViewport: viewport,
      projectToScreen: (lon, lat) => {
        try {
          const p = m.project([lon, lat])
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
          return { x: p.x, y: p.y }
        } catch { return null }
      },
      queryBuildingsNear: (lon, lat, radiusM = 60) => {
        try {
          // Prefer rendered building layers (style-visible), fall back to source tiles.
          const style = m.getStyle()
          const buildingLayerIds = (style?.layers ?? [])
            .filter((l) => {
              const srcLayer = (l as { 'source-layer'?: string })['source-layer']
              const id = l.id ?? ''
              return srcLayer === 'buildings' || /building/i.test(id)
            })
            .map((l) => l.id)

          type Feat = { geometry?: { type?: string; coordinates?: unknown } }
          let raw: Feat[] = []
          if (buildingLayerIds.length) {
            // Screen radius ≈ metres at this zoom (rough)
            const p = m.project([lon, lat])
            const pxR = Math.min(220, Math.max(48, radiusM * 2.2))
            raw = m.queryRenderedFeatures(
              [[p.x - pxR, p.y - pxR], [p.x + pxR, p.y + pxR]],
              { layers: buildingLayerIds },
            ) as Feat[]
          }
          if (!raw.length && m.getSource('protomaps')) {
            raw = m.querySourceFeatures('protomaps', { sourceLayer: 'buildings' }) as Feat[]
          }
          if (!raw.length) return []

          const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
          const r2 = radiusM * radiusM
          const out: { ring: [number, number][] }[] = []
          const seen = new Set<string>()

          const pushRing = (ring: number[][]) => {
            if (!ring || ring.length < 3) return
            // Centroid for distance cull
            let sx = 0, sy = 0
            for (const c of ring) { sx += c[0]; sy += c[1] }
            const n = ring.length
            const clat = sy / n, clon = sx / n
            const dx = (clon - lon) * 111_320 * cosLat
            const dy = (clat - lat) * 111_320
            if (dx * dx + dy * dy > r2 * 2.5) return
            const key = `${clon.toFixed(5)},${clat.toFixed(5)}`
            if (seen.has(key)) return
            seen.add(key)
            out.push({ ring: ring.map((c) => [c[0], c[1]] as [number, number]) })
          }

          for (const f of raw) {
            if (out.length >= 64) break
            const g = f.geometry
            if (!g?.coordinates) continue
            if (g.type === 'Polygon') pushRing((g.coordinates as number[][][])[0])
            else if (g.type === 'MultiPolygon') {
              for (const poly of g.coordinates as number[][][][]) {
                pushRing(poly[0])
                if (out.length >= 64) break
              }
            }
          }
          return out
        } catch {
          return []
        }
      },
      queryRoadsNear: (lon, lat, radiusM = 55) => {
        try {
          const style = m.getStyle()
          const roadLayerIds = (style?.layers ?? [])
            .filter((l) => {
              const srcLayer = (l as { 'source-layer'?: string })['source-layer']
              const id = l.id ?? ''
              return srcLayer === 'roads' || /^roads?-/i.test(id)
            })
            .map((l) => l.id)
            .slice(0, 12)

          type Feat = { geometry?: { type?: string; coordinates?: unknown } }
          let raw: Feat[] = []
          if (roadLayerIds.length) {
            const p = m.project([lon, lat])
            const pxR = Math.min(200, Math.max(40, radiusM * 2))
            raw = m.queryRenderedFeatures(
              [[p.x - pxR, p.y - pxR], [p.x + pxR, p.y + pxR]],
              { layers: roadLayerIds },
            ) as Feat[]
          }
          if (!raw.length && m.getSource('protomaps')) {
            raw = m.querySourceFeatures('protomaps', { sourceLayer: 'roads' }) as Feat[]
          }

          const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
          const r2 = radiusM * radiusM
          const segs: Array<{ a: [number, number]; b: [number, number] }> = []
          const pushLine = (coords: number[][]) => {
            for (let i = 1; i < coords.length && segs.length < 80; i++) {
              const a = coords[i - 1]
              const b = coords[i]
              if (!a || !b) continue
              const mx = (a[0] + b[0]) / 2
              const my = (a[1] + b[1]) / 2
              const dx = (mx - lon) * 111_320 * cosLat
              const dy = (my - lat) * 111_320
              if (dx * dx + dy * dy > r2) continue
              segs.push({ a: [a[0], a[1]], b: [b[0], b[1]] })
            }
          }
          for (const f of raw) {
            if (segs.length >= 80) break
            const g = f.geometry
            if (!g?.coordinates) continue
            if (g.type === 'LineString') pushLine(g.coordinates as number[][])
            else if (g.type === 'MultiLineString') {
              for (const line of g.coordinates as number[][][]) pushLine(line)
            }
          }
          return segs
        } catch {
          return []
        }
      },
      followNavigation: ({ lat, lon, heading }) => {
        showUserDot(m, [lon, lat])
        m.easeTo({ center: [lon, lat], zoom: 17, pitch: 60, bearing: heading, duration: 900 })
      },
      subscribeMoveEnd: (listener) => {
        moveListeners.add(listener)
        return () => { moveListeners.delete(listener) }
      },
    })
    // Debug handle (harmless, and invaluable for diagnosing render issues).
    ;(window as unknown as { __map?: MLMap }).__map = m
    return () => {
      for (const id of kickTimers) window.clearTimeout(id)
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      m.off('moveend', onMoveEnd)
      selMarker.current?.remove(); selMarker.current = null
      drivingMarker.current?.remove(); drivingMarker.current = null
      for (const [, mk] of bmMarkers.current) mk.remove()
      bmMarkers.current.clear()
      m.remove()
      liveMap.current = null
      unregisterController()
      setMap(null)
    }
    } // end boot()

    let cancelled = false
    let cleanup: (() => void) | undefined
    let tries = 0
    const start = () => {
      if (cancelled || !el.current) return
      const node = el.current
      // Force fill while waiting for flex/rail layout to settle.
      node.style.position = 'absolute'
      node.style.inset = '0'
      node.style.width = '100%'
      node.style.height = '100%'
      tries++
      if ((node.clientHeight < 2 || node.clientWidth < 2) && tries < 45) {
        requestAnimationFrame(start)
        return
      }
      cleanup = boot()
    }
    start()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [ready])

  // Language switch — relabel in place, no style reload needed.
  useEffect(() => {
    if (!map || !styleReadyRef.current) return
    applyMapLanguage(map, app.lang)
    // setLayoutProperty pauses the basemap source — wake tiles again.
    requestAnimationFrame(() => kickTiles(map))
  }, [map, app.lang])

  // Pack switching — camera survives setStyle; DOM markers survive too.
  // styleRef re-commits on successful load; ANY error during the load window
  // reverts it so re-selecting the pack retries (idempotent — an unrelated
  // map error just re-allows a retry that becomes a no-op-diff).
  useEffect(() => {
    if (!map || !app.activeStyleUrl || styleRef.current === app.activeStyleUrl) return
    const url = app.activeStyleUrl
    const prev = styleRef.current
    styleRef.current = url // optimistic, for the early-return guard
    styleReadyRef.current = false
    const onError = () => { styleRef.current = prev }
    const onLoad = () => {
      styleRef.current = url
      map.off('error', onError)
    }
    map.once('style.load', onLoad)
    map.on('error', onError)
    // diff:false — packs carry their OWN sprite atlas, and a diffed swap
    // leaves stale pattern/sprite references behind (GTA buildings on
    // Minecraft grass). A full rebuild is correct; the camera is outside the
    // style so the view is preserved either way.
    map.setStyle(url, { diff: false })
    return () => {
      map.off('style.load', onLoad)
      map.off('error', onError)
    }
  }, [map, app.activeStyleUrl])

  // Selected-place marker + flyTo.
  useEffect(() => {
    if (!map) return
    try {
      selMarker.current?.remove()
      selMarker.current = null
      if (!app.selected) return
      if (!Number.isFinite(app.selected.lat) || !Number.isFinite(app.selected.lon)) return
      selMarker.current = new Marker({ color: MARKER_COLORS.selected, scale: MARKER_SCALES.selected })
        .setLngLat([app.selected.lon, app.selected.lat])
        .addTo(map)
      selMarker.current.getElement().style.filter = MARKER_STROKES.selected
      // Places zoom to their real size: a country fills the viewport via its
      // bbox instead of dropping the camera onto one street at z14.
      if (app.selected.extent) {
        const [w, n, e, sth] = app.selected.extent
        if ([w, n, e, sth].every(Number.isFinite)) {
          map.fitBounds([[w, sth], [e, n]], { padding: framePad(60), duration: 900, maxZoom: 15 })
          return
        }
      }
      const kindZoom: Record<string, number> = {
        country: 5.5, state: 7, county: 9, city: 11, municipality: 11.5,
        town: 12.5, village: 13.5, suburb: 13.5,
      }
      const targetZoom = kindZoom[app.selected.kind ?? ''] ?? Math.max(map.getZoom(), 14)
      map.flyTo({
        center: [app.selected.lon, app.selected.lat],
        zoom: targetZoom,
        duration: flyDuration(map, targetZoom),
        padding: framePad(0),
      })
    } catch (e) {
      console.error('[maplibre] select place failed', e)
    }
  }, [map, app.selected])

  // Route line: keep a ref for style.load re-adds, sync on route changes.
  const routeGeoRef = useRef<[number, number][] | null>(null)
  const syncRouteLayers = (m: MLMap) => {
    const geo = routeGeoRef.current
    const data = {
      type: 'FeatureCollection',
      features: geo
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: geo }, properties: {} }]
        : [],
    } as GeoJSON.FeatureCollection
    const src = m.getSource('route') as GeoJSONSource | undefined
    if (src) { src.setData(data); return }
    m.addSource('route', { type: 'geojson', data })
    m.addLayer({
      id: 'route-casing', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': MARKER_COLORS.routeCasing,
        'line-width': ROUTE_STYLE.casingWidth,
        'line-opacity': ROUTE_STYLE.casingOpacity,
      },
    })
    m.addLayer({
      id: 'route-line', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': MARKER_COLORS.route, 'line-width': ROUTE_STYLE.lineWidth },
    })
  }
  const routeGeometry = app.route?.status === 'ready' ? app.route.result?.geometry ?? null : null
  useEffect(() => {
    if (!map) return
    // Drop non-finite coords so GeoJSON/fitBounds never poison the map.
    const clean = routeGeometry?.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) ?? null
    const geo = clean && clean.length >= 2 ? clean : null
    routeGeoRef.current = geo
    try {
      // If the style isn't ready, the persistent style.load handler syncs later.
      if (styleReadyRef.current) syncRouteLayers(map)
      if (geo) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const [x, y] of geo) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x)
          minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        }
        if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
          map.fitBounds([[minX, minY], [maxX, maxY]], { padding: framePad(80), duration: 900 })
        }
      }
    } catch (e) {
      console.error('[maplibre] route layers failed', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routeGeometry])

  // Race / free-drive camera — reads high-frequency drivingLive (NOT React state).
  // jumpTo every frame: easeTo stacking was the main lag source.
  const racePrevStatus = useRef(app.driving.status)
  useEffect(() => {
    if (!map) return
    drivingMarker.current?.remove(); drivingMarker.current = null

    let raf = 0
    let sceneryReady = false
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const live = getDrivingLive()
      if (live.status === 'idle') return
      if (!(live.status === 'running' || live.status === 'paused' || live.status === 'ready')) return
      if (!Number.isFinite(live.lon) || !Number.isFinite(live.lat)) return

      if (!sceneryReady) {
        sceneryReady = true
        try { ensure3DScenery(map) } catch { /* optional */ }
        try { attachTerrainWhenReady(map) } catch { /* optional */ }
      }

      try {
        const ready = live.status === 'ready'
        const cam = raceCameraAt([live.lon, live.lat], live.heading, {
          lookAheadM: ready ? RACE_LOOKAHEAD_READY_M : RACE_LOOKAHEAD_M,
        })
        // Instant camera follow while running — no animation queue lag.
        if (live.status === 'running' || reduced) {
          map.jumpTo({
            center: cam.center as [number, number],
            bearing: cam.bearing,
            pitch: cam.pitch,
            zoom: cam.zoom,
            padding: { top: 12, bottom: 140, left: 12, right: 56 },
          })
        } else {
          map.easeTo({
            center: cam.center as [number, number],
            bearing: cam.bearing,
            pitch: cam.pitch,
            zoom: cam.zoom,
            duration: ready ? 350 : 0,
            essential: true,
            padding: { top: 12, bottom: 140, left: 12, right: 56 },
          })
        }
      } catch { /* map disposed mid-frame */ }
    }

    const unsub = subscribeDrivingLive(() => {
      // Kick loop; continuous rAF keeps camera smooth while live updates.
    })
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      unsub()
      if (
        racePrevStatus.current === 'running'
        || racePrevStatus.current === 'paused'
        || racePrevStatus.current === 'finished'
        || racePrevStatus.current === 'ready'
      ) {
        try {
          map.easeTo({ pitch: 0, bearing: 0, duration: reduced ? 0 : 500, essential: true })
        } catch { /* ok */ }
      }
    }
  }, [map])

  useEffect(() => {
    racePrevStatus.current = app.driving.status
  }, [app.driving.status])

  // POI category markers (teal), replaced wholesale per category.
  const poiMarkers = useRef<Marker[]>([])
  useEffect(() => {
    if (!map) return
    for (const mk of poiMarkers.current) mk.remove()
    poiMarkers.current = []
    if (app.pois.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of app.pois) {
      const mk = new Marker({ color: MARKER_COLORS.poi, scale: MARKER_SCALES.poi })
        .setLngLat([p.lon, p.lat])
        .addTo(map)
      mk.getElement().style.cursor = 'pointer'
      mk.getElement().addEventListener('click', (ev) => {
        ev.stopPropagation()
        appRef.current.select({ name: p.name, label: p.label, lat: p.lat, lon: p.lon })
      })
      poiMarkers.current.push(mk)
      minX = Math.min(minX, p.lon); maxX = Math.max(maxX, p.lon)
      minY = Math.min(minY, p.lat); maxY = Math.max(maxY, p.lat)
    }
    if (app.pois.length > 1) {
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: framePad(90), duration: 700, maxZoom: 15 })
    }
  }, [map, app.pois])

  // Bookmark markers (gold), diffed by id.
  useEffect(() => {
    if (!map) return
    const seen = new Set<string>()
    for (const b of app.bookmarks) {
      seen.add(b.id)
      if (bmMarkers.current.has(b.id)) continue
      const mk = new Marker({ color: MARKER_COLORS.bookmark, scale: MARKER_SCALES.bookmark })
        .setLngLat([b.lon, b.lat])
        .addTo(map)
      mk.getElement().style.cursor = 'pointer'
      mk.getElement().addEventListener('click', (ev) => {
        ev.stopPropagation()
        appRef.current.select({ name: b.name, label: b.note || b.name, lat: b.lat, lon: b.lon })
      })
      bmMarkers.current.set(b.id, mk)
    }
    for (const [id, mk] of bmMarkers.current) {
      if (!seen.has(id)) { mk.remove(); bmMarkers.current.delete(id) }
    }
  }, [map, app.bookmarks])

  return (
    <div
      ref={el}
      className={cn('map', app.pickingStart && 'maps-pick-start')}
      style={app.pickingStart ? { cursor: 'crosshair' } : undefined}
    />
  )
}

export default MapLibreMapView
