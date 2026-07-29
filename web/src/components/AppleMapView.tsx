import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useApp } from '../state'

// MapKit JS is intentionally loaded at runtime; Apple owns the renderer and
// keeps its map data out of our bundle.
export function AppleMapView() {
  const el = useRef<HTMLDivElement>(null)
  const app = useApp()
  const appRef = useRef(app)
  const [map, setMap] = useState<any>(null)
  appRef.current = app

  useEffect(() => {
    let cancelled = false
    let map: any
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
      await new Promise<void>((resolve, reject) => {
        mk.init({
          language: appRef.current.lang,
          authorizationCallback: async (done: (token: string) => void) => {
            try { done((await api.mapkitToken()).token) } catch { reject(new Error('MapKit authorization failed')) }
          },
          callback: resolve,
        })
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
      map.addEventListener('region-change-end', () => {
        const c = map.center
        // MapKit owns the camera; searches continue to use the selected place
        // or the browser's location bias from the existing app state.
      })
    }
    load().catch((error) => console.error('[mapkit]', error))
    return () => { cancelled = true; map?.destroy(); setMap(null) }
  }, [])

  useEffect(() => {
    if (!map) return
    const mk = (window as any).mapkit
    const annotations = app.pois.map((p) => new mk.MarkerAnnotation(new mk.Coordinate(p.lat, p.lon), { title: p.name, subtitle: p.label }))
    map.removeAnnotations(map.annotations)
    map.addAnnotations(annotations)
  }, [map, app.pois])

  return <div ref={el} className="map apple-map" aria-label="Apple Maps" />
}
