import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useApp } from '../state'
import {
  locateActiveMap,
  setActiveMap3D,
  zoomActiveMap,
} from '../maps/rendererController'

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

/** Apple Maps is the default renderer; custom packs continue to use MapLibre.
 *  Each engine is code-split so Apple-first loads skip the MapLibre bundle. */
export function MapView({
  onAppleFailed,
}: {
  onAppleFailed?: () => void
} = {}) {
  const app = useApp()
  const [appleFailed, setAppleFailed] = useState(false)
  const handleAppleFailure = useCallback(() => {
    setAppleFailed(true)
    onAppleFailed?.()
  }, [onAppleFailed])
  useEffect(() => {
    if (app.mapProvider !== 'apple') setAppleFailed(false)
  }, [app.mapProvider])

  if (app.mapProvider === 'apple' && !appleFailed) {
    return (
      <Suspense fallback={<MapFallback />}>
        <AppleMapView onFailure={handleAppleFailure} />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<MapFallback />}>
      <MapLibreMapView />
    </Suspense>
  )
}
