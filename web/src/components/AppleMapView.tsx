import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { bearingAtProgress, pointAtProgress } from '../lib/driving'
import { carPositionAt, offsetAlongBearing, RACE_PITCH } from '../lib/drivingCamera'
import { appleOverlayClass, resolveAppleColorScheme, resolveAppleMapType } from '../maps/appleAppearance'
import { registerMapRenderer } from '../maps/rendererController'
import { readViewport, writeViewport } from '../maps/viewportStorage'
import type { Place } from '../state'
import { useApp } from '../state'
import { cn } from '../lib/utils'

const INITIAL_REGION = { lat: 51.16, lon: 10.45, latDelta: 8, lonDelta: 11 }

/** Module-level MapKit init — Apple documents a single init() per page. */
let mapkitBootstrapped = false
let mapkitAuthToken = ''

function ensureMapkitInit(mk: any, language: string, token: string) {
  mapkitAuthToken = token
  if (mapkitBootstrapped) return
  mk.init({
    language,
    authorizationCallback: (done: (t: string) => void) => {
      done(mapkitAuthToken)
    },
  })
  mapkitBootstrapped = true
}

function regionForPlace(mk: any, place: Place) {
  // Clamp spans — MapKit can hard-crash the page on NaN/insane spans from
  // geocode extents (observed as a blank #root after picking a search result).
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
  try {
    if (place.extent && place.extent.length >= 4) {
      const [west, north, east, south] = place.extent
      if ([west, north, east, south, place.lat, place.lon].every(Number.isFinite)) {
        const latDelta = clamp(Math.abs(north - south) * 1.25, 0.002, 12)
        const lonDelta = clamp(Math.abs(east - west) * 1.25, 0.002, 12)
        const centerLat = clamp((north + south) / 2, -85, 85)
        const centerLon = clamp((west + east) / 2, -180, 180)
        return new mk.CoordinateRegion(
          new mk.Coordinate(centerLat, centerLon),
          new mk.CoordinateSpan(latDelta, lonDelta),
        )
      }
    }
  } catch { /* fall through to point region */ }
  const lat = Number.isFinite(place.lat) ? place.lat : 51.16
  const lon = Number.isFinite(place.lon) ? place.lon : 10.45
  return new mk.CoordinateRegion(
    new mk.Coordinate(lat, lon),
    new mk.CoordinateSpan(0.035, 0.035),
  )
}

function fitPlaces(map: any, mk: any, places: Place[]) {
  if (places.length === 0) return
  if (places.length === 1) {
    try {
      map.setRegionAnimated(regionForPlace(mk, places[0]), true)
    } catch {
      const p = places[0]
      if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
        map.setCenterAnimated?.(new mk.Coordinate(p.lat, p.lon), true)
      }
    }
    return
  }
  let north = -90, south = 90, east = -180, west = 180
  let any = false
  for (const place of places) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue
    any = true
    north = Math.max(north, place.lat)
    south = Math.min(south, place.lat)
    east = Math.max(east, place.lon)
    west = Math.min(west, place.lon)
  }
  if (!any) return
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
  try {
    map.setRegionAnimated(new mk.CoordinateRegion(
      new mk.Coordinate(clamp((north + south) / 2, -85, 85), clamp((east + west) / 2, -180, 180)),
      new mk.CoordinateSpan(
        clamp(Math.max(0.015, (north - south) * 1.35), 0.015, 40),
        clamp(Math.max(0.015, (east - west) * 1.35), 0.015, 40),
      ),
    ), true)
  } catch (e) {
    console.error('[mapkit] fitPlaces failed', e)
  }
}

function addSelectionListener(annotation: any, select: () => void) {
  annotation.addEventListener?.('select', select)
}

/** True only while the MapKit map is still mounted and sizeable. */
function mapIsLive(map: any, host: HTMLElement | null | undefined): boolean {
  if (!map || !host || !host.isConnected) return false
  if (host.offsetWidth < 2 || host.offsetHeight < 2) return false
  return true
}

/** Strip annotations/overlays before destroy so MapKit can't flush dead nodes. */
function purgeMapkitInstance(map: any) {
  if (!map) return
  try {
    const anns = map.annotations
    if (anns?.length) map.removeAnnotations([...anns])
  } catch { /* ignore */ }
  try {
    const ovs = map.overlays
    if (ovs?.length) map.removeOverlays([...ovs])
  } catch { /* ignore */ }
  try {
    map.showsUserLocation = false
  } catch { /* ignore */ }
  try {
    map.destroy()
  } catch { /* MapKit destroy can throw if half-init */ }
}

function safeAddAnnotation(map: any, host: HTMLElement | null | undefined, annotation: any): boolean {
  if (!mapIsLive(map, host) || !annotation) return false
  try {
    map.addAnnotation(annotation)
    return true
  } catch (e) {
    console.error('[mapkit] addAnnotation failed', e)
    return false
  }
}

function safeRemoveAnnotation(map: any, annotation: any) {
  if (!map || !annotation) return
  try { map.removeAnnotation(annotation) } catch { /* already gone */ }
}

function safeRemoveAnnotations(map: any, annotations: any[]) {
  if (!map || !annotations.length) return
  try { map.removeAnnotations(annotations) } catch {
    for (const a of annotations) safeRemoveAnnotation(map, a)
  }
}

// Apple owns the MapKit renderer and map data. Application state owns
// selection, routes and bookmarks so provider switching preserves context.
export function AppleMapView({ onFailure }: { onFailure?: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const app = useApp()
  const appRef = useRef(app)
  const onFailureRef = useRef(onFailure)
  const [map, setMap] = useState<any>(null)
  /** Generation token — async MapKit work from a destroyed mount must no-op. */
  const genRef = useRef(0)
  const aliveRef = useRef(false)
  const selectedAnnotation = useRef<any>(null)
  const userAnnotation = useRef<any>(null)
  const poiAnnotations = useRef<any[]>([])
  const bookmarkAnnotations = useRef<any[]>([])
  const routeOverlay = useRef<any>(null)
  const drivingAnnotation = useRef<any>(null)
  const failCount = useRef(0)
  appRef.current = app
  onFailureRef.current = onFailure

  const noteMapkitFault = (reason: string) => {
    failCount.current += 1
    console.error('[mapkit] fault', reason, failCount.current)
    // Only fall back after repeated hard failures — a single annotation glitch
    // must not destroy the map while tiles are still flushing (isRooted spam).
    if (failCount.current >= 3) onFailureRef.current?.()
  }

  // Mount once. Never re-run on onFailure identity changes (that was destroying
  // MapKit mid-tile-load and causing isRooted / supportsLabelRegions crashes).
  useEffect(() => {
    let cancelled = false
    let instance: any
    let unregister = () => {}
    const gen = ++genRef.current
    aliveRef.current = true
    failCount.current = 0

    const stillHere = () =>
      !cancelled && gen === genRef.current && aliveRef.current && !!el.current?.isConnected

    const loadScript = async () => {
      if ((window as any).mapkit) return
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-mapkit-js]')
        if (existing) {
          if ((window as any).mapkit) { resolve(); return }
          existing.addEventListener('load', () => resolve(), { once: true })
          existing.addEventListener('error', () => reject(new Error('MapKit JS failed to load')), { once: true })
          return
        }
        const script = document.createElement('script')
        script.dataset.mapkitJs = 'true'
        // Pin major line; 6.x is current MapKit JS. Avoid re-init churn across remounts.
        script.src = 'https://cdn.apple-mapkit.com/mk/6.x.x/mapkit.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('MapKit JS failed to load'))
        document.head.appendChild(script)
      })
    }

    const load = async () => {
      if (!el.current) return
      const tokenResult = await api.mapkitToken()
      if (!stillHere()) return
      if (tokenResult.fallback || !tokenResult.token) {
        onFailureRef.current?.()
        return
      }
      await loadScript()
      if (!stillHere()) return
      const mk = (window as any).mapkit
      try {
        ensureMapkitInit(mk, appRef.current.lang, tokenResult.token)
        mapkitAuthToken = tokenResult.token
      } catch (e) {
        console.error('[mapkit] init failed', e)
        onFailureRef.current?.()
        return
      }
      if (!stillHere()) return

      // Wait a frame so the host has layout — MapKit needs a rooted, sized node.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      if (!stillHere() || !el.current) return
      if (el.current.offsetWidth < 2 || el.current.offsetHeight < 2) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (!stillHere() || !el.current) return

      try {
        instance = new mk.Map(el.current, {
          isScrollEnabled: true,
          isZoomEnabled: true,
          isRotationEnabled: true,
          showsCompass: mk.FeatureVisibility?.Adaptive ?? true,
          showsScale: mk.FeatureVisibility?.Adaptive ?? true,
          showsMapTypeControl: true,
          showsZoomControl: false,
          // Built-in blue dot — avoid custom MarkerAnnotation for "me" (fewer
          // pending-annotation races with tile load).
          showsUserLocation: false,
          showsUserLocationControl: false,
        })
      } catch (e) {
        console.error('[mapkit] Map() failed', e)
        onFailureRef.current?.()
        return
      }
      if (!stillHere()) {
        purgeMapkitInstance(instance)
        instance = null
        return
      }
      ;(window as unknown as { __appleMap?: unknown }).__appleMap = instance
      const saved = readViewport('apple')
      try {
        instance.region = new mk.CoordinateRegion(
          new mk.Coordinate(saved?.center.lat ?? INITIAL_REGION.lat, saved?.center.lon ?? INITIAL_REGION.lon),
          new mk.CoordinateSpan(saved?.latitudeDelta ?? INITIAL_REGION.latDelta, saved?.longitudeDelta ?? INITIAL_REGION.lonDelta),
        )
      } catch {
        /* region restore is best-effort */
      }

      // Defer React setMap until MapKit has had a chance to root into the DOM.
      // Adding annotations in the same tick as Map() is a known source of
      // supportsLabelRegions / isRooted null crashes.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      if (!stillHere()) {
        purgeMapkitInstance(instance)
        instance = null
        return
      }
      setMap(instance)

      const locate = () => {
        if (!stillHere() || !mapIsLive(instance, el.current)) return
        try {
          instance.showsUserLocation = true
          if (!navigator.geolocation) return
          navigator.geolocation.getCurrentPosition((position) => {
            if (!stillHere() || !mapIsLive(instance, el.current)) return
            try {
              const coordinate = new mk.Coordinate(position.coords.latitude, position.coords.longitude)
              // Prefer built-in user location; only use a pin as a center target.
              instance.setRegionAnimated(new mk.CoordinateRegion(
                coordinate,
                new mk.CoordinateSpan(0.025, 0.025),
              ), true)
            } catch (e) {
              console.error('[mapkit] locate failed', e)
            }
          }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 })
        } catch (e) {
          console.error('[mapkit] locate failed', e)
        }
      }

      const moveListeners = new Set<() => void>()
      unregister = registerMapRenderer({
        provider: 'apple',
        capabilities: {
          threeD: false,
          mapClick: true,
          routes: true,
          bookmarks: true,
          nativeControls: false,
        },
        zoomBy: (delta) => {
          if (!stillHere() || !mapIsLive(instance, el.current)) return
          try {
            const region = instance.region
            if (!region) return
            const factor = delta > 0 ? 0.55 : 1.8
            instance.setRegionAnimated(new mk.CoordinateRegion(
              region.center,
              new mk.CoordinateSpan(
                Math.max(0.0008, Math.min(160, region.span.latitudeDelta * factor)),
                Math.max(0.0008, Math.min(320, region.span.longitudeDelta * factor)),
              ),
            ), true)
          } catch (e) {
            console.error('[mapkit] zoomBy failed', e)
          }
        },
        locate,
        set3D: () => {},
        focusPlace: (place) => {
          if (!stillHere() || !mapIsLive(instance, el.current)) return
          try { instance.setRegionAnimated(regionForPlace(mk, place), true) }
          catch (e) { console.error('[mapkit] focusPlace failed', e) }
        },
        showPlaces: (places) => {
          if (!stillHere() || !mapIsLive(instance, el.current)) return
          try { fitPlaces(instance, mk, places) }
          catch (e) { console.error('[mapkit] showPlaces failed', e) }
        },
        getViewport: () => {
          try {
            if (!mapIsLive(instance, el.current)) return null
            const region = instance.region
            if (!region) return null
            return {
              center: { lat: region.center.latitude, lon: region.center.longitude },
              latitudeDelta: region.span.latitudeDelta,
              longitudeDelta: region.span.longitudeDelta,
            }
          } catch {
            return null
          }
        },
        followNavigation: ({ lat, lon, heading }) => {
          if (!stillHere() || !mapIsLive(instance, el.current)) return
          try {
            const coordinate = new mk.Coordinate(lat, lon)
            instance.showsUserLocation = true
            if (mk.Camera && typeof instance.setCameraAnimated === 'function') {
              instance.setCameraAnimated(new mk.Camera(coordinate, {
                heading,
                pitch: 58,
                altitude: 450,
              }), true)
            } else {
              instance.setCenterAnimated(coordinate, true)
              if (typeof instance.setRotationAnimated === 'function') instance.setRotationAnimated(heading)
            }
          } catch (e) {
            console.error('[mapkit] followNavigation failed', e)
          }
        },
        subscribeMoveEnd: (listener) => {
          moveListeners.add(listener)
          return () => { moveListeners.delete(listener) }
        },
      })

      instance.addEventListener?.('single-tap', (event: any) => {
        if (!stillHere() || !event.coordinate) return
        const lat = event.coordinate.latitude
        const lon = event.coordinate.longitude
        void api.reverse(lat, lon).then((result) => {
          if (!stillHere()) return
          appRef.current.select(result
            ? { name: result.name, label: result.label, lat: result.lat, lon: result.lon }
            : { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, label: '', lat, lon })
        })
      })
      instance.addEventListener?.('region-change-end', () => {
        if (!stillHere()) return
        try {
          const region = instance.region
          if (!region) return
          writeViewport('apple', {
            center: { lat: region.center.latitude, lon: region.center.longitude },
            latitudeDelta: region.span.latitudeDelta,
            longitudeDelta: region.span.longitudeDelta,
          })
          for (const listener of moveListeners) listener()
        } catch { /* ignore */ }
      })

      if (!saved && !new URLSearchParams(window.location.search).has('p')) locate()

      window.setTimeout(() => {
        if (!stillHere()) return
        if (el.current && !el.current.querySelector('canvas, iframe, img, .mk-map-view')) {
          onFailureRef.current?.()
        }
      }, 8000)
    }

    void load().catch((error) => {
      console.error('[mapkit]', error)
      if (!cancelled && gen === genRef.current) onFailureRef.current?.()
    })

    return () => {
      cancelled = true
      aliveRef.current = false
      genRef.current += 1
      try { unregister() } catch { /* ignore */ }
      delete (window as unknown as { __appleMap?: unknown }).__appleMap
      // Clear React-held annotation refs so effects don't re-touch a dead map.
      selectedAnnotation.current = null
      userAnnotation.current = null
      poiAnnotations.current = []
      bookmarkAnnotations.current = []
      routeOverlay.current = null
      drivingAnnotation.current = null
      purgeMapkitInstance(instance)
      instance = null
      setMap(null)
    }
  }, [])

  useEffect(() => {
    if (!map || !mapIsLive(map, el.current)) return
    try {
      const mk = (window as any).mapkit
      const mapType = resolveAppleMapType(mk, app.mapPreferences.appleMapType)
      const colorScheme = resolveAppleColorScheme(mk, app.mapPreferences.appleColorScheme)
      if (mapType != null) map.mapType = mapType
      if (colorScheme != null) map.colorScheme = colorScheme
    } catch (e) {
      console.error('[mapkit] appearance failed', e)
    }
  }, [map, app.mapPreferences.appleMapType, app.mapPreferences.appleColorScheme])

  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    const mk = (window as any).mapkit
    const host = el.current
    safeRemoveAnnotation(map, selectedAnnotation.current)
    selectedAnnotation.current = null
    if (!app.selected) return
    if (!Number.isFinite(app.selected.lat) || !Number.isFinite(app.selected.lon)) return

    // Always pan first (safe). Annotation is best-effort and must never kill the map.
    try {
      map.setRegionAnimated(regionForPlace(mk, app.selected), true)
    } catch {
      try {
        map.setCenterAnimated?.(new mk.Coordinate(app.selected.lat, app.selected.lon), true)
      } catch { /* ignore */ }
    }

    try {
      const ann = new mk.MarkerAnnotation(
        new mk.Coordinate(app.selected.lat, app.selected.lon),
        { title: app.selected.name || ' ', subtitle: app.selected.label || '', color: '#111111' },
      )
      if (safeAddAnnotation(map, host, ann)) {
        selectedAnnotation.current = ann
        failCount.current = Math.max(0, failCount.current - 1)
      } else {
        noteMapkitFault('select-annotation')
      }
    } catch (e) {
      console.error('[mapkit] select place failed', e)
      noteMapkitFault('select-exception')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, app.selected])

  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    const mk = (window as any).mapkit
    const host = el.current
    safeRemoveAnnotations(map, poiAnnotations.current)
    poiAnnotations.current = []
    const places = app.pois.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon))
    if (places.length === 0) return
    try {
      const anns = places.map((place) => {
        const annotation = new mk.MarkerAnnotation(
          new mk.Coordinate(place.lat, place.lon),
          { title: place.name || ' ', subtitle: place.label || '', color: '#147d78' },
        )
        addSelectionListener(annotation, () => {
          if (aliveRef.current) appRef.current.selectResult(place)
        })
        return annotation
      })
      // Add one-by-one so a single failure doesn't leave half-pending queues.
      const added: any[] = []
      for (const ann of anns) {
        if (safeAddAnnotation(map, host, ann)) added.push(ann)
      }
      poiAnnotations.current = added
      if (added.length) fitPlaces(map, mk, places)
    } catch (e) {
      console.error('[mapkit] poi annotations failed', e)
    }
  }, [map, app.pois])

  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    const mk = (window as any).mapkit
    const host = el.current
    safeRemoveAnnotations(map, bookmarkAnnotations.current)
    bookmarkAnnotations.current = []
    try {
      const added: any[] = []
      for (const bookmark of app.bookmarks) {
        if (!Number.isFinite(bookmark.lat) || !Number.isFinite(bookmark.lon)) continue
        const annotation = new mk.MarkerAnnotation(
          new mk.Coordinate(bookmark.lat, bookmark.lon),
          { title: bookmark.name || ' ', subtitle: bookmark.note || bookmark.name || '', color: '#c28b00' },
        )
        addSelectionListener(annotation, () => {
          if (!aliveRef.current) return
          appRef.current.select({
            name: bookmark.name,
            label: bookmark.note || bookmark.name,
            lat: bookmark.lat,
            lon: bookmark.lon,
          })
        })
        if (safeAddAnnotation(map, host, annotation)) added.push(annotation)
      }
      bookmarkAnnotations.current = added
    } catch (e) {
      console.error('[mapkit] bookmark annotations failed', e)
    }
  }, [map, app.bookmarks])

  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    const mk = (window as any).mapkit
    try {
      if (routeOverlay.current) {
        try { map.removeOverlay(routeOverlay.current) } catch { /* ignore */ }
        routeOverlay.current = null
      }
      const geometry = app.route?.status === 'ready' ? app.route.result?.geometry : null
      if (!geometry || geometry.length < 2 || !mk.PolylineOverlay) return
      const pts = geometry.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      if (pts.length < 2) return
      const coordinates = pts.map(([lon, lat]) => new mk.Coordinate(lat, lon))
      routeOverlay.current = new mk.PolylineOverlay(coordinates, {
        style: new mk.Style({ lineWidth: 6, strokeColor: '#1677ff', lineJoin: 'round', lineCap: 'round' }),
      })
      try {
        map.addOverlay(routeOverlay.current)
      } catch (e) {
        console.error('[mapkit] addOverlay failed', e)
        routeOverlay.current = null
        return
      }
      const a = pts[0]
      const b = pts[pts.length - 1]
      fitPlaces(map, mk, [
        { name: '', label: '', lat: a[1], lon: a[0] },
        { name: '', label: '', lat: b[1], lon: b[0] },
      ])
    } catch (e) {
      console.error('[mapkit] route overlay failed', e)
    }
  }, [map, app.route])

  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    const mk = (window as any).mapkit
    const host = el.current
    safeRemoveAnnotation(map, drivingAnnotation.current)
    drivingAnnotation.current = null
    try {
      const geometry = app.route?.status === 'ready' ? app.route.result?.geometry : null
      const pts = geometry?.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) ?? null
      if (!pts || pts.length < 2 || app.driving.status === 'idle') {
        if (app.driving.status === 'idle' && typeof map.setCameraAnimated === 'function') {
          try {
            const center = map.center
            if (mk.Camera && center) {
              map.setCameraAnimated(new mk.Camera(center, { pitch: 0, altitude: 2500 }), false)
            }
          } catch { /* MapKit version without Camera */ }
        }
        return
      }
      const point = pointAtProgress(pts, app.driving.progress)
      const bearing = bearingAtProgress(pts, app.driving.progress)
      const carPt = carPositionAt(point, bearing, app.driving.lateral ?? 0)
      if (!Number.isFinite(carPt[0]) || !Number.isFinite(carPt[1])) return
      const look = offsetAlongBearing(carPt, bearing, app.driving.status === 'ready' ? 16 : 36)
      // Prefer camera follow over glyph annotation — fewer MapKit annotation races.
      if (app.driving.status === 'running' || app.driving.status === 'paused' || app.driving.status === 'ready') {
        const coord = new mk.Coordinate(look[1], look[0])
        try {
          if (mk.Camera && typeof map.setCameraAnimated === 'function') {
            map.setCameraAnimated(new mk.Camera(coord, {
              heading: bearing,
              pitch: RACE_PITCH,
              altitude: 220,
            }), app.driving.status === 'running')
          } else {
            map.setCenterAnimated(new mk.Coordinate(carPt[1], carPt[0]), false)
            if (typeof map.setRotationAnimated === 'function') map.setRotationAnimated(bearing)
          }
        } catch {
          try { map.setCenterAnimated(new mk.Coordinate(carPt[1], carPt[0]), false) } catch { /* ignore */ }
        }
      }
      // Lightweight pin only when ready (start line); skip during running ticks.
      if (app.driving.status === 'ready' || app.driving.status === 'paused' || app.driving.status === 'finished') {
        const ann = new mk.MarkerAnnotation(new mk.Coordinate(carPt[1], carPt[0]), {
          title: ' ',
          color: '#0b5fff',
        })
        if (safeAddAnnotation(map, host, ann)) drivingAnnotation.current = ann
      }
    } catch (e) {
      console.error('[mapkit] driving annotation failed', e)
    }
  }, [map, app.route, app.driving])

  const tone = appleOverlayClass(app.mapPreferences.appleOverlayTone)
  return (
    <div className={cn('apple-map-shell', app.pickingStart && 'maps-pick-start')}>
      <div
        ref={el}
        className="map apple-map"
        aria-label="Apple Maps"
        style={app.pickingStart ? { cursor: 'crosshair' } : undefined}
      />
      {tone && <div className={tone} aria-hidden="true" />}
    </div>
  )
}
