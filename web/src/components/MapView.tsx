import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { useApp } from '../state'
import {
  locateActiveMap,
  setActiveMap3D,
  zoomActiveMap,
} from '../maps/rendererController'
import { readMapPreferences, writeMapPreferences } from '../maps/providerPreferences'

export { railInset } from '../maps/railInset'

/** Tilt into 3D via the active renderer controller (Apple or MapLibre). */
export function set3D(on: boolean) {
  setActiveMap3D(on)
}

/** Centre on the user via the active renderer. */
export function locateUser() {
  locateActiveMap()
}

export function zoomBy(delta: number) {
  zoomActiveMap(delta)
}

const AppleMapView = lazy(() =>
  import('./AppleMapView').then((m) => ({ default: m.AppleMapView })),
)
const MapLibreMapView = lazy(() =>
  import('./MapLibreMapView').then((m) => ({ default: m.MapLibreMapView })),
)

function MapFallback() {
  return (
    <div className="map maps-map-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="maps-map-loading__inner">
        <span className="maps-map-loading__pulse" aria-hidden />
        <span className="maps-map-loading__label">Map</span>
      </div>
    </div>
  )
}

/**
 * Isolate renderer crashes so the rail/search shell stays usable.
 * A MapKit or MapLibre throw must never blank the entire #root.
 */
class MapErrorBoundary extends Component<
  { children: ReactNode; onCrash: () => void },
  { crashed: boolean }
> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[map] renderer crash', err, info.componentStack)
    this.props.onCrash()
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="map maps-map-loading" role="alert">
          <div className="maps-map-loading__inner">
            <span className="maps-map-loading__label">Map recovery…</span>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/** Custom MapLibre packs are the default renderer; Apple MapKit is opt-in.
 *  Each engine is code-split so MapLibre-first loads skip the MapKit bundle. */
export function MapView({
  onAppleFailed,
}: {
  onAppleFailed?: () => void
} = {}) {
  const app = useApp()
  const [appleFailed, setAppleFailed] = useState(false)
  const [mapEpoch, setMapEpoch] = useState(0)

  // Keep latest app/onAppleFailed without changing callback identity — otherwise
  // AppleMapView's mount effect re-runs every render, destroy()s MapKit while
  // annotations are still pending, and MapKit throws isRooted / supportsLabelRegions.
  const appRef = useRef(app)
  appRef.current = app
  const onAppleFailedRef = useRef(onAppleFailed)
  onAppleFailedRef.current = onAppleFailed

  const fallBackToCustom = useCallback(() => {
    setAppleFailed(true)
    onAppleFailedRef.current?.()
    try {
      const prefs = readMapPreferences()
      writeMapPreferences({ ...prefs, provider: 'custom' })
    } catch { /* best effort */ }
    try {
      appRef.current.setMapProvider('custom')
    } catch { /* ignore */ }
  }, [])

  const handleAppleFailure = useCallback(() => {
    fallBackToCustom()
  }, [fallBackToCustom])

  const handleRendererCrash = useCallback(() => {
    fallBackToCustom()
    setMapEpoch((n) => n + 1)
  }, [fallBackToCustom])

  useEffect(() => {
    if (app.mapProvider !== 'apple') setAppleFailed(false)
  }, [app.mapProvider])

  const useApple = app.mapProvider === 'apple' && !appleFailed

  return (
    <MapErrorBoundary key={`${useApple ? 'apple' : 'custom'}-${mapEpoch}`} onCrash={handleRendererCrash}>
      <Suspense fallback={<MapFallback />}>
        {useApple
          ? <AppleMapView onFailure={handleAppleFailure} />
          : <MapLibreMapView />}
      </Suspense>
    </MapErrorBoundary>
  )
}
