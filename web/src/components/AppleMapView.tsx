import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import {
  raceCameraAt,
  RACE_ALTITUDE_M, RACE_ALTITUDE_READY_M, RACE_LOOKAHEAD_M, RACE_LOOKAHEAD_READY_M, RACE_PITCH,
} from '../lib/drivingCamera'
import { getDrivingLive } from '../lib/drivingLive'
import { appleOverlayClass, resolveAppleColorScheme, resolveAppleMapType } from '../maps/appleAppearance'
import { registerMapRenderer } from '../maps/rendererController'
import { readViewport, writeViewport } from '../maps/viewportStorage'
import type { Place } from '../state'
import { useApp } from '../state'
import { cn } from '../lib/utils'

const INITIAL_REGION = { lat: 51.16, lon: 10.45, latDelta: 8, lonDelta: 11 }

/**
 * MapKit JS MarkerAnnotation is unsafe in this app: addAnnotation queues work
 * until tiles finish, and if the map is torn down (React StrictMode remount,
 * provider switch, failure fallback) MapKit throws uncaught:
 *   - Cannot read properties of null (reading 'isRooted')
 *   - Cannot read properties of null (reading 'supportsLabelRegions')
 *
 * We intentionally never call addAnnotation. Camera + polyline only.
 * Pins live in the rail UI (PlaceCard / PoiResults / SavedPanel).
 */

/** Module-level MapKit init — Apple documents a single init() per page. */
let mapkitBootstrapped = false
let mapkitAuthToken = ''
let mapkitErrorSinkInstalled = false

function installMapkitErrorSink() {
  if (mapkitErrorSinkInstalled || typeof window === 'undefined') return
  mapkitErrorSinkInstalled = true
  const isMapkitNoise = (msg: string, file?: string) => {
    const m = msg || ''
    const f = file || ''
    if (!/mapkit/i.test(f) && !/mapkit/i.test(m) && !/apple-mapkit/i.test(f)) return false
    return /isRooted|supportsLabelRegions|labelsCanBeShown|_addAnnotation|_shouldAnnotation/i.test(m)
  }
  window.addEventListener('error', (event) => {
    const msg = String(event.message || event.error || '')
    const file = String(event.filename || '')
    if (isMapkitNoise(msg, file)) {
      event.preventDefault()
      event.stopImmediatePropagation?.()
    }
  }, true)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const msg = String(reason?.message || reason || '')
    const stack = String(reason?.stack || '')
    if (isMapkitNoise(msg + stack, stack)) {
      event.preventDefault()
    }
  })
}

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

function mapIsLive(map: any, host: HTMLElement | null | undefined): boolean {
  if (!map || !host || !host.isConnected) return false
  if (host.offsetWidth < 2 || host.offsetHeight < 2) return false
  return true
}

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
  // Delay destroy one frame so MapKit can drop pending tile callbacks
  // without racing React unmount.
  const victim = map
  requestAnimationFrame(() => {
    try { victim.destroy() } catch { /* half-init */ }
  })
}

// Apple owns the MapKit renderer and map data. Application state owns
// selection, routes and bookmarks so provider switching preserves context.
export function AppleMapView({ onFailure }: { onFailure?: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const app = useApp()
  const appRef = useRef(app)
  const onFailureRef = useRef(onFailure)
  const [map, setMap] = useState<any>(null)
  const genRef = useRef(0)
  const aliveRef = useRef(false)
  const routeOverlay = useRef<any>(null)
  appRef.current = app
  onFailureRef.current = onFailure

  // Mount once. Stable callbacks only (via refs).
  useEffect(() => {
    installMapkitErrorSink()
    let cancelled = false
    let instance: any
    let unregister = () => {}
    const gen = ++genRef.current
    aliveRef.current = true

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
      } catch { /* region restore is best-effort */ }

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
            const heading =
              typeof instance.camera?.heading === 'number'
                ? instance.camera.heading
                : (typeof instance.rotation === 'number' ? instance.rotation : 0)
            return {
              center: { lat: region.center.latitude, lon: region.center.longitude },
              latitudeDelta: region.span.latitudeDelta,
              longitudeDelta: region.span.longitudeDelta,
              bearing: heading,
            }
          } catch {
            return null
          }
        },
        projectToScreen: (lon, lat) => {
          try {
            if (!mapIsLive(instance, el.current) || !el.current) return null
            const mk = (window as any).mapkit
            const coord = new mk.Coordinate(lat, lon)
            // MapKit JS: convertCoordinateToPointOnMapView if available
            const pt = instance.convertCoordinateToPointOnMapView?.(coord)
              ?? instance.convertCoordinateToPoint?.(coord)
            if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null
            return { x: pt.x, y: pt.y }
          } catch { return null }
        },
        set3D: (on: boolean) => {
          if (!stillHere() || !mapIsLive(instance, el.current)) return
          try {
            const mk = (window as any).mapkit
            const center = instance.center ?? instance.region?.center
            if (!center || !mk.Camera) return
            const cam = new mk.Camera(center, {
              pitch: on ? 58 : 0,
              altitude: on ? 650 : 2500,
              heading: instance.camera?.heading ?? 0,
            })
            if (typeof instance.setCameraAnimated === 'function') instance.setCameraAnimated(cam, true)
            else instance.camera = cam
            if (typeof instance.showsBuildings !== 'undefined') instance.showsBuildings = on
          } catch (e) {
            console.error('[mapkit] set3D failed', e)
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
      routeOverlay.current = null
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

  // Selected place → camera only (no MarkerAnnotation).
  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    if (!app.selected) return
    if (!Number.isFinite(app.selected.lat) || !Number.isFinite(app.selected.lon)) return
    const mk = (window as any).mapkit
    try {
      map.setRegionAnimated(regionForPlace(mk, app.selected), true)
    } catch {
      try {
        map.setCenterAnimated?.(new mk.Coordinate(app.selected.lat, app.selected.lon), true)
      } catch { /* ignore */ }
    }
  }, [map, app.selected])

  // POI category → fit bounds only (markers are in the rail list).
  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    if (app.pois.length === 0) return
    const mk = (window as any).mapkit
    try { fitPlaces(map, mk, app.pois) } catch (e) {
      console.error('[mapkit] poi fit failed', e)
    }
  }, [map, app.pois])

  // Route polyline (overlay, not annotation — safer path).
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
      const overlay = new mk.PolylineOverlay(coordinates, {
        style: new mk.Style({ lineWidth: 6, strokeColor: '#1677ff', lineJoin: 'round', lineCap: 'round' }),
      })
      try {
        map.addOverlay(overlay)
        routeOverlay.current = overlay
      } catch (e) {
        console.error('[mapkit] addOverlay failed', e)
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

  // Chase camera from high-frequency drivingLive — never animate while running.
  useEffect(() => {
    if (!map || !aliveRef.current || !mapIsLive(map, el.current)) return
    const mk = (window as any).mapkit
    let raf = 0
    let wasRacing = false

    const apply = (animated: boolean) => {
      if (!aliveRef.current || !mapIsLive(map, el.current)) return
      const live = getDrivingLive()
      const racing = live.status !== 'idle'
      try {
        if (typeof map.showsBuildings !== 'undefined') map.showsBuildings = racing
        if (typeof map.showsCompass !== 'undefined' && mk.FeatureVisibility) {
          map.showsCompass = racing ? mk.FeatureVisibility.Hidden : mk.FeatureVisibility.Adaptive
        }
      } catch { /* older MapKit */ }

      if (!racing) {
        if (wasRacing) {
          try {
            const center = map.center
            if (mk.Camera && center) {
              const cam = new mk.Camera(center, { pitch: 0, altitude: 2500, heading: 0 })
              if (typeof map.setCameraAnimated === 'function') map.setCameraAnimated(cam, false)
              else if ('camera' in map) map.camera = cam
            }
          } catch { /* ok */ }
        }
        wasRacing = false
        return
      }
      wasRacing = true
      if (!(live.status === 'running' || live.status === 'paused' || live.status === 'ready')) return
      if (!Number.isFinite(live.lon) || !Number.isFinite(live.lat)) return

      const ready = live.status === 'ready'
      const cam = raceCameraAt([live.lon, live.lat], live.heading, {
        lookAheadM: ready ? RACE_LOOKAHEAD_READY_M : RACE_LOOKAHEAD_M,
        altitudeM: ready ? RACE_ALTITUDE_READY_M : RACE_ALTITUDE_M,
        pitch: Math.min(RACE_PITCH, 85),
      })
      const coord = new mk.Coordinate(cam.center[1], cam.center[0])
      try {
        if (mk.Camera) {
          const camera = new mk.Camera(coord, {
            heading: cam.bearing,
            pitch: cam.pitch,
            altitude: cam.altitudeM,
          })
          // Never animate while running — queued animations = lag.
          if (typeof map.setCameraAnimated === 'function') {
            map.setCameraAnimated(camera, animated && ready)
          } else if ('camera' in map) {
            map.camera = camera
          }
        }
      } catch { /* camera API quirks */ }
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      apply(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [map])

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
