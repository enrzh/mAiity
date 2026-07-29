import { Component, lazy, Suspense, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
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

/** Apple Maps is the default renderer; custom packs continue to use MapLibre.
 *  Each engine is code-split so Apple-first loads skip the MapLibre bundle. */
export function MapView({
  onAppleFailed,
}: {
  onAppleFailed?: () => void
} = {}) {
  const app = useApp()
  const [appleFailed, setAppleFailed] = useState(false)
  const [mapEpoch, setMapEpoch] = useState(0)

  const handleAppleFailure = useCallback(() => {
    setAppleFailed(true)
    onAppleFailed?.()
    // Persist fallback so a reload doesn't immediately re-enter a broken
    // MapKit session (token / origin / layout glitches).
    try {
      const prefs = readMapPreferences()
      if (prefs.provider === 'apple') {
        writeMapPreferences({ ...prefs, provider: 'custom' })
        app.setMapProvider('custom')
      }
    } catch {
      app.setMapProvider('custom')
    }
  }, [onAppleFailed, app])

  const handleRendererCrash = useCallback(() => {
    // Prefer custom packs after any hard renderer crash.
    setAppleFailed(true)
    onAppleFailed?.()
    try {
      const prefs = readMapPreferences()
      writeMapPreferences({ ...prefs, provider: 'custom' })
    } catch { /* best effort */ }
    app.setMapProvider('custom')
    setMapEpoch((n) => n + 1)
  }, [onAppleFailed, app])

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
