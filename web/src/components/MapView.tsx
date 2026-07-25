import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MLMap, Marker, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { api } from '../lib/api'
import { useApp } from '../state'

maplibregl.addProtocol('pmtiles', new Protocol().tile)

/** Germany overview when the URL carries no #camera hash. */
const DEFAULT_CENTER: [number, number] = [10.45, 51.16]
const DEFAULT_ZOOM = 5.5

/** Live map handle for siblings that need camera reads (e.g. POI center). */
export const liveMap: { current: MLMap | null } = { current: null }

/// Free (keyless) global elevation tiles — Terrarium-encoded DEM. Gives the
/// map REAL relief instead of a flat plane; the single biggest 3D win.
/// Served through OUR api: the upstream Terrarium tiles carry no CORS
/// headers, so the browser cannot use them as WebGL textures directly.
const DEM_SOURCE = 'terrain-dem'
const DEM_TILES = '/maps/api/dem/{z}/{x}/{y}.png'

/// TERRAIN IS OFF pending a fix. The DEM proxy serves 200s and the tiles are
/// byte-identical to upstream, but `isSourceLoaded('terrain-dem')` never goes
/// true, and while terrain waits on its source MapLibre renders NOTHING
/// (queryRenderedFeatures() === 0 → a blank sky-coloured screen). Shipping
/// that would be worse than no terrain. 3D therefore = pitch + sky + extruded
/// buildings, which all work. Re-enable once the DEM decode is understood.
const TERRAIN_ENABLED = false

/** Add the DEM source + sky once per style (re-run after every style.load). */
export function ensure3DScenery(m: MLMap) {
  if (TERRAIN_ENABLED && !m.getSource(DEM_SOURCE)) {
    m.addSource(DEM_SOURCE, {
      type: 'raster-dem',
      tiles: [DEM_TILES],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 13,
      attribution: 'Elevation: Terrain Tiles (AWS Open Data)',
    })
  }
  // Atmosphere at the horizon — without it a pitched map looks cropped.
  // NOTE: in MapLibre v5 `sky` is a ROOT style property (setSky), NOT a
  // layer type — addLayer({type:'sky'}) throws and aborts 3D setup.
  try {
    m.setSky({
      'sky-color': '#8cb8e8',
      'sky-horizon-blend': 0.5,
      'horizon-color': '#f0e6d8',
      'horizon-fog-blend': 0.6,
      'fog-color': '#dfe7f0',
      'fog-ground-blend': 0.1,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 10, 0.6, 14, 0.2],
    })
  } catch { /* older renderer without sky support — terrain still works */ }
}

/** Tilt into 3D with real terrain relief (or back to flat). */
export function set3D(on: boolean) {
  const m = liveMap.current
  if (!m) return
  try {
    ensure3DScenery(m)
    if (TERRAIN_ENABLED) {
      m.setTerrain(on ? { source: DEM_SOURCE, exaggeration: 1.2 } : null)
    }
  } catch (e) {
    console.error('[3d] scenery unavailable', e) // never block the tilt
  }
  // Do NOT force a high zoom: with terrain enabled, zooming in over
  // mountains drops the camera below the elevated surface and the view
  // becomes pure sky. Only lift very far-out views, and keep the pitch
  // moderate so the horizon stays in frame.
  // Lift to z16 so extruded buildings (minzoom 14) are actually in view.
  m.easeTo({
    pitch: on ? 62 : 0,
    bearing: on ? -18 : 0,
    zoom: on ? Math.max(m.getZoom(), 16) : m.getZoom(),
    duration: 1000,
  })
}

/** Whether 3D is currently engaged (terrain set). */
export function is3DActive(): boolean {
  return !!liveMap.current?.getTerrain()
}

/// The one imperative component: owns the MapLibre map, keeps it in sync with
/// app state (active pack style, selected place, bookmark markers).
export function MapView() {
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
    const m = new maplibregl.Map({
      container: el.current,
      style: appRef.current.activeStyleUrl!,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      hash: true,
      attributionControl: { compact: true },
      maxPitch: 85, // near-horizon 3D views
    })
    styleRef.current = appRef.current.activeStyleUrl
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    m.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'bottom-right')

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
          : { name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, label: 'Unbekannter Ort', lat, lon: lng },
      )
    })

    m.on('error', (ev) => console.error('[maplibre]', ev?.error ?? ev))

    // Route layers are user layers on TOP of pack styles — re-added after
    // every setStyle (pack switch) from the current routeRef.
    m.on('style.load', () => {
      styleReadyRef.current = true
      syncRouteLayers(m)
      // A style swap drops sources/terrain — restore the 3D scenery if it
      // was engaged, so pack switching doesn't silently flatten the map.
      if (wants3DRef.current) {
        ensure3DScenery(m)
        if (TERRAIN_ENABLED) m.setTerrain({ source: DEM_SOURCE, exaggeration: 1.2 })
      }
    })

    // Startup location: open the map where the user IS, unless the URL
    // already pins a view (#camera hash) or a shared place (?p=).
    const pinned = window.location.hash.length > 1 || new URLSearchParams(window.location.search).has('p')
    if (!pinned && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Only if the user hasn't already moved the map themselves.
          if (m.getZoom() === DEFAULT_ZOOM) {
            m.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 })
          }
        },
        () => { /* denied/unavailable — keep the country overview */ },
        { timeout: 8000, maximumAge: 300_000 },
      )
    }

    // Keep the GL canvas matched to the container (init can happen pre-layout).
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(el.current)

    setMap(m)
    liveMap.current = m
    // Debug handle (harmless, and invaluable for diagnosing render issues).
    ;(window as unknown as { __map?: MLMap }).__map = m
    return () => {
      ro.disconnect()
      selMarker.current?.remove(); selMarker.current = null
      for (const [, mk] of bmMarkers.current) mk.remove()
      bmMarkers.current.clear()
      m.remove()
      liveMap.current = null
      setMap(null)
    }
  }, [ready])

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
    selMarker.current?.remove()
    selMarker.current = null
    if (!app.selected) return
    selMarker.current = new Marker({ color: '#e74c3c' })
      .setLngLat([app.selected.lon, app.selected.lat])
      .addTo(map)
    map.flyTo({
      center: [app.selected.lon, app.selected.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 900,
    })
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
      paint: { 'line-color': '#1d4ed8', 'line-width': 9, 'line-opacity': 0.35 },
    })
    m.addLayer({
      id: 'route-line', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#3b82f6', 'line-width': 5 },
    })
  }
  const routeGeometry = app.route?.status === 'ready' ? app.route.result?.geometry ?? null : null
  useEffect(() => {
    if (!map) return
    routeGeoRef.current = routeGeometry
    // If the style isn't ready, the persistent style.load handler syncs later.
    if (styleReadyRef.current) syncRouteLayers(map)
    if (routeGeometry && routeGeometry.length > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [x, y] of routeGeometry) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 900 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routeGeometry])

  // POI category markers (teal), replaced wholesale per category.
  const poiMarkers = useRef<Marker[]>([])
  useEffect(() => {
    if (!map) return
    for (const mk of poiMarkers.current) mk.remove()
    poiMarkers.current = []
    if (app.pois.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of app.pois) {
      const mk = new Marker({ color: '#0d9488', scale: 0.75 })
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
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 90, duration: 700, maxZoom: 15 })
    }
  }, [map, app.pois])

  // Bookmark markers (gold), diffed by id.
  useEffect(() => {
    if (!map) return
    const seen = new Set<string>()
    for (const b of app.bookmarks) {
      seen.add(b.id)
      if (bmMarkers.current.has(b.id)) continue
      const mk = new Marker({ color: '#f1c40f', scale: 0.85 })
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

  return <div ref={el} className="map" />
}
