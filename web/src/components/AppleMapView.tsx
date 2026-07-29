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

function regionForPlace(mk: any, place: Place) {
  if (place.extent) {
    const [west, north, east, south] = place.extent
    return new mk.CoordinateRegion(
      new mk.Coordinate((north + south) / 2, (west + east) / 2),
      new mk.CoordinateSpan(
        Math.max(0.002, Math.abs(north - south) * 1.25),
        Math.max(0.002, Math.abs(east - west) * 1.25),
      ),
    )
  }
  return new mk.CoordinateRegion(
    new mk.Coordinate(place.lat, place.lon),
    new mk.CoordinateSpan(0.035, 0.035),
  )
}

function fitPlaces(map: any, mk: any, places: Place[]) {
  if (places.length === 0) return
  if (places.length === 1) {
    map.setRegionAnimated(regionForPlace(mk, places[0]), true)
    return
  }
  let north = -90, south = 90, east = -180, west = 180
  for (const place of places) {
    north = Math.max(north, place.lat)
    south = Math.min(south, place.lat)
    east = Math.max(east, place.lon)
    west = Math.min(west, place.lon)
  }
  map.setRegionAnimated(new mk.CoordinateRegion(
    new mk.Coordinate((north + south) / 2, (east + west) / 2),
    new mk.CoordinateSpan(
      Math.max(0.015, (north - south) * 1.35),
      Math.max(0.015, (east - west) * 1.35),
    ),
  ), true)
}

function addSelectionListener(annotation: any, select: () => void) {
  annotation.addEventListener?.('select', select)
}

// Apple owns the MapKit renderer and map data. Application state owns
// selection, routes and bookmarks so provider switching preserves context.
export function AppleMapView({ onFailure }: { onFailure?: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const app = useApp()
  const appRef = useRef(app)
  const [map, setMap] = useState<any>(null)
  const selectedAnnotation = useRef<any>(null)
  const userAnnotation = useRef<any>(null)
  const poiAnnotations = useRef<any[]>([])
  const bookmarkAnnotations = useRef<any[]>([])
  const routeOverlay = useRef<any>(null)
  const drivingAnnotation = useRef<any>(null)
  appRef.current = app

  useEffect(() => {
    let cancelled = false
    let instance: any
    let unregister = () => {}

    const loadScript = async () => {
      if ((window as any).mapkit) return
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-mapkit-js]')
        if (existing) {
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
      await loadScript()
      if (cancelled || !el.current) return
      const mk = (window as any).mapkit
      mk.init({
        language: appRef.current.lang,
        authorizationCallback: async (done: (token: string) => void) => {
          try {
            const result = await api.mapkitToken()
            if (result.fallback) throw new Error('MapKit token unavailable')
            done(result.token)
          } catch {
            onFailure?.()
          }
        },
      })
      if (cancelled || !el.current) return

      instance = new mk.Map(el.current, {
        isScrollEnabled: true,
        isZoomEnabled: true,
        isRotationEnabled: true,
        showsCompass: mk.FeatureVisibility?.Adaptive ?? true,
        showsScale: mk.FeatureVisibility?.Adaptive ?? true,
        showsMapTypeControl: true,
        showsZoomControl: false,
        showsUserLocationControl: false,
      })
      ;(window as unknown as { __appleMap?: unknown }).__appleMap = instance
      const saved = readViewport('apple')
      instance.region = new mk.CoordinateRegion(
        new mk.Coordinate(saved?.center.lat ?? INITIAL_REGION.lat, saved?.center.lon ?? INITIAL_REGION.lon),
        new mk.CoordinateSpan(saved?.latitudeDelta ?? INITIAL_REGION.latDelta, saved?.longitudeDelta ?? INITIAL_REGION.lonDelta),
      )
      setMap(instance)

      const locate = () => {
        instance.showsUserLocation = true
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition((position) => {
          const coordinate = new mk.Coordinate(position.coords.latitude, position.coords.longitude)
          if (userAnnotation.current) instance.removeAnnotation(userAnnotation.current)
          userAnnotation.current = new mk.MarkerAnnotation(coordinate, {
            title: appRef.current.lang === 'de' ? 'Mein Standort' : 'My location',
            color: '#1677ff',
          })
          instance.addAnnotation(userAnnotation.current)
          instance.setRegionAnimated(new mk.CoordinateRegion(
            coordinate,
            new mk.CoordinateSpan(0.025, 0.025),
          ), true)
        }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 })
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
        },
        locate,
        set3D: () => {},
        focusPlace: (place) => instance.setRegionAnimated(regionForPlace(mk, place), true),
        showPlaces: (places) => fitPlaces(instance, mk, places),
        getViewport: () => {
          const region = instance.region
          if (!region) return null
          return {
            center: { lat: region.center.latitude, lon: region.center.longitude },
            latitudeDelta: region.span.latitudeDelta,
            longitudeDelta: region.span.longitudeDelta,
          }
        },
        followNavigation: ({ lat, lon, heading }) => {
          const coordinate = new mk.Coordinate(lat, lon)
          if (userAnnotation.current) instance.removeAnnotation(userAnnotation.current)
          userAnnotation.current = new mk.MarkerAnnotation(coordinate, {
            title: appRef.current.lang === 'de' ? 'Mein Standort' : 'My location',
            color: '#1677ff',
          })
          instance.addAnnotation(userAnnotation.current)
          instance.showsUserLocation = true
          try {
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
          } catch {
            instance.setCenterAnimated(coordinate, true)
          }
        },
        subscribeMoveEnd: (listener) => {
          moveListeners.add(listener)
          return () => { moveListeners.delete(listener) }
        },
      })

      instance.addEventListener?.('single-tap', (event: any) => {
        if (!event.coordinate) return
        const lat = event.coordinate.latitude
        const lon = event.coordinate.longitude
        void api.reverse(lat, lon).then((result) => {
          appRef.current.select(result
            ? { name: result.name, label: result.label, lat: result.lat, lon: result.lon }
            : { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, label: '', lat, lon })
        })
      })
      instance.addEventListener?.('region-change-end', () => {
        const region = instance.region
        if (!region) return
        writeViewport('apple', {
          center: { lat: region.center.latitude, lon: region.center.longitude },
          latitudeDelta: region.span.latitudeDelta,
          longitudeDelta: region.span.longitudeDelta,
        })
        for (const listener of moveListeners) listener()
      })

      if (!saved && !new URLSearchParams(window.location.search).has('p')) locate()

      window.setTimeout(() => {
        if (!cancelled && el.current && !el.current.querySelector('canvas, iframe, img')) onFailure?.()
      }, 6000)
    }

    void load().catch((error) => {
      console.error('[mapkit]', error)
      onFailure?.()
    })
    return () => {
      cancelled = true
      unregister()
      delete (window as unknown as { __appleMap?: unknown }).__appleMap
      instance?.destroy()
      setMap(null)
    }
  }, [onFailure])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    const mapType = resolveAppleMapType(mk, app.mapPreferences.appleMapType)
    const colorScheme = resolveAppleColorScheme(mk, app.mapPreferences.appleColorScheme)
    if (mapType != null) map.mapType = mapType
    if (colorScheme != null) map.colorScheme = colorScheme
  }, [map, app.mapPreferences.appleMapType, app.mapPreferences.appleColorScheme])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    if (selectedAnnotation.current) map.removeAnnotation(selectedAnnotation.current)
    selectedAnnotation.current = null
    if (!app.selected) return
    selectedAnnotation.current = new mk.MarkerAnnotation(
      new mk.Coordinate(app.selected.lat, app.selected.lon),
      { title: app.selected.name, subtitle: app.selected.label, color: '#111111' },
    )
    map.addAnnotation(selectedAnnotation.current)
    map.setRegionAnimated(regionForPlace(mk, app.selected), true)
  }, [map, app.selected])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    if (poiAnnotations.current.length) map.removeAnnotations(poiAnnotations.current)
    poiAnnotations.current = app.pois.map((place) => {
      const annotation = new mk.MarkerAnnotation(
        new mk.Coordinate(place.lat, place.lon),
        { title: place.name, subtitle: place.label, color: '#147d78' },
      )
      addSelectionListener(annotation, () => appRef.current.selectResult(place))
      return annotation
    })
    if (poiAnnotations.current.length) {
      map.addAnnotations(poiAnnotations.current)
      fitPlaces(map, mk, app.pois)
    }
  }, [map, app.pois])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    if (bookmarkAnnotations.current.length) map.removeAnnotations(bookmarkAnnotations.current)
    bookmarkAnnotations.current = app.bookmarks.map((bookmark) => {
      const annotation = new mk.MarkerAnnotation(
        new mk.Coordinate(bookmark.lat, bookmark.lon),
        { title: bookmark.name, subtitle: bookmark.note || bookmark.name, color: '#c28b00' },
      )
      addSelectionListener(annotation, () => appRef.current.select({
        name: bookmark.name,
        label: bookmark.note || bookmark.name,
        lat: bookmark.lat,
        lon: bookmark.lon,
      }))
      return annotation
    })
    if (bookmarkAnnotations.current.length) map.addAnnotations(bookmarkAnnotations.current)
  }, [map, app.bookmarks])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    if (routeOverlay.current) map.removeOverlay(routeOverlay.current)
    routeOverlay.current = null
    const geometry = app.route?.status === 'ready' ? app.route.result?.geometry : null
    if (!geometry || geometry.length < 2 || !mk.PolylineOverlay) return
    const coordinates = geometry.map(([lon, lat]) => new mk.Coordinate(lat, lon))
    routeOverlay.current = new mk.PolylineOverlay(coordinates, {
      style: new mk.Style({ lineWidth: 6, strokeColor: '#1677ff', lineJoin: 'round', lineCap: 'round' }),
    })
    map.addOverlay(routeOverlay.current)
    fitPlaces(map, mk, geometry.map(([lon, lat]) => ({ name: '', label: '', lat, lon })))
  }, [map, app.route])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    if (drivingAnnotation.current) map.removeAnnotation(drivingAnnotation.current)
    drivingAnnotation.current = null
    const geometry = app.route?.status === 'ready' ? app.route.result?.geometry : null
    if (!geometry || geometry.length < 2 || app.driving.status === 'idle') {
      // Flatten camera when leaving an active race.
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
    const point = pointAtProgress(geometry, app.driving.progress)
    const bearing = bearingAtProgress(geometry, app.driving.progress)
    const carPt = carPositionAt(point, bearing, app.driving.lateral ?? 0)
    const look = offsetAlongBearing(carPt, bearing, app.driving.status === 'ready' ? 16 : 36)
    drivingAnnotation.current = new mk.MarkerAnnotation(new mk.Coordinate(carPt[1], carPt[0]), {
      title: 'Driving position',
      color: '#0b5fff',
      glyphText: '🚗',
    })
    map.addAnnotation(drivingAnnotation.current)
    if (app.driving.status === 'running' || app.driving.status === 'paused' || app.driving.status === 'ready') {
      const coord = new mk.Coordinate(look[1], look[0])
      try {
        if (mk.Camera && typeof map.setCameraAnimated === 'function') {
          // Street-level chase cam (MapKit JS Camera API).
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
        map.setCenterAnimated(new mk.Coordinate(carPt[1], carPt[0]), false)
      }
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
