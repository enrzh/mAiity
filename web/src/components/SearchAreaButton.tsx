import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activeMapViewport, subscribeActiveMapMoveEnd } from '../maps/rendererController'
import { useT } from '../lib/useT'
import { useApp } from '../state'
import type { NearbyCategory } from '../lib/api'

/// "Search this area" — appears once the user pans away from the results
/// they're looking at, exactly like Maps. Works for Apple + custom via the
/// active renderer controller (not MapLibre-only liveMap).
export function SearchAreaButton() {
  const app = useApp()
  const t = useT()
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    if (!app.activeCategory) { setMoved(false); return }
    return subscribeActiveMapMoveEnd(() => setMoved(true))
  }, [app.activeCategory, app.mapProvider])

  // A fresh category search resets the prompt.
  useEffect(() => { setMoved(false) }, [app.pois])

  if (!app.activeCategory || !moved) return null

  return (
    // Top-centre of the visible map (accounts for left rail chrome).
    // Never sit near the bottom — that zone is owned by sheet / race HUD.
    <div className="pointer-events-none absolute left-[calc(50%+var(--left-chrome,0px)/2)] top-3 z-20 -translate-x-1/2 md:top-4">
      <Button
        size="sm"
        className="pointer-events-auto h-9 gap-1.5 rounded-full px-3.5 text-[13px] shadow-lg"
        onClick={() => {
          const viewport = activeMapViewport()
          if (!viewport) return
          setMoved(false)
          void app.showCategory(app.activeCategory as NearbyCategory,
            viewport.center,
            {
              west: viewport.center.lon - viewport.longitudeDelta / 2,
              south: viewport.center.lat - viewport.latitudeDelta / 2,
              east: viewport.center.lon + viewport.longitudeDelta / 2,
              north: viewport.center.lat + viewport.latitudeDelta / 2,
            })
        }}
      >
        <RotateCw className="size-3.5" /> {t('search-this-area')}
      </Button>
    </div>
  )
}
