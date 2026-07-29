import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { registerMapController } from '../lib/mapController'
import { useApp } from '../state'

// MapKit JS is intentionally loaded at runtime; Apple owns the renderer and
// keeps its map data out of our bundle.
export function AppleMapView({ onFailure }: { onFailure?: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const app = useApp()
  const appRef = useRef(app)
  const [map, setMap] = useState<any>(null)
  appRef.current = app

  useEffect(() => {
    let cancelled = false
    let map: any
    let unregisterController = () => {}
    let userAnnotation: any
    const load = async () => {
      if (!el.current) return
      if (!(window as any).mapkit) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.apple-mapkit.com/mk/6.x.x/mapkit.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('MapKit JS failed to load'))
          document.head.appendChild(script)
        })
      }
      if (cancelled) return
      const mk = (window as any).mapkit
        mk.init({
          language: appRef.current.lang,
          authorizationCallback: async (done: (token: string) => void) => {
          try {
            const result = await api.mapkitToken()
            // Do not initialize MapKit with a known fallback/invalid token.
            // MapKit still creates a canvas in that state, but renders only a
            // blank surface and never emits a useful failure to the component.
            if (result.fallback) { onFailure?.(); return }
            done(result.token)
          } catch { onFailure?.() }
        },
      })
      if (cancelled || !el.current) return
      map = new mk.Map(el.current)
      setMap(map)
      map.region = new mk.CoordinateRegion(
        new mk.Coordinate(51.16, 10.45),
        new mk.CoordinateSpan(8, 11),
      )
      map.showsCompass = true
      map.showsScale = true
      map.showsMapTypeControl = true
      unregisterController = registerMapController({
        zoomBy: (delta) => {
          const region = map.region
          if (!region) return
          const factor = delta > 0 ? 0.55 : 1.8
          map.setRegionAnimated(new mk.CoordinateRegion(
            region.center,
            new mk.CoordinateSpan(
              Math.max(0.0008, Math.min(160, region.span.latitudeDelta * factor)),
              Math.max(0.0008, Math.min(320, region.span.longitudeDelta * factor)),
            ),
          ), true)
        },
        set3D: (on) => {
          map.cameraPitch = on ? 55 : 0
          if (on) map.cameraHeading = -18
        },
        locate: () => {
          if (!navigator.geolocation) return
          navigator.geolocation.getCurrentPosition((position) => {
            const coordinate = new mk.Coordinate(
              position.coords.latitude,
              position.coords.longitude,
            )
            if (userAnnotation) map.removeAnnotation(userAnnotation)
            userAnnotation = new mk.MarkerAnnotation(coordinate, {
              title: appRef.current.lang === 'de' ? 'Mein Standort' : 'My location',
              color: '#1677ff',
            })
            map.addAnnotation(userAnnotation)
            map.setRegionAnimated(new mk.CoordinateRegion(
              coordinate,
              new mk.CoordinateSpan(0.025, 0.025),
            ), true)
          }, () => {}, { enableHighAccuracy: true, timeout: 8000 })
        },
      })
      map.addEventListener('region-change-end', () => {
        const c = map.center
        // MapKit owns the camera; searches continue to use the selected place
        // or the browser's location bias from the existing app state.
      })
      // MapKit JS reports invalid authorization asynchronously and otherwise
      // leaves an empty map element. Do not strand users on a white canvas.
      window.setTimeout(() => {
        if (!cancelled && el.current && !el.current.querySelector('canvas, iframe, img')) onFailure?.()
      }, 5000)
    }
    load().catch((error) => { console.error('[mapkit]', error); onFailure?.() })
    return () => {
      cancelled = true
      unregisterController()
      map?.destroy()
      setMap(null)
    }
  }, [onFailure])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    const annotations = app.pois.map((p) => new mk.MarkerAnnotation(new mk.Coordinate(p.lat, p.lon), { title: p.name, subtitle: p.label }))
    map.removeAnnotations(map.annotations)
    map.addAnnotations(annotations)
  }, [map, app.pois])

  return <div ref={el} className="map apple-map" aria-label="Apple Maps" />
}
