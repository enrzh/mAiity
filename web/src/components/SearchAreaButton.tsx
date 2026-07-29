import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { liveMap } from './MapView'
import { activeMapViewport } from '../maps/rendererController'
import { useT } from '../lib/useT'
import { useApp } from '../state'
import type { NearbyCategory } from '../lib/api'

/// "Search this area" — appears once the user pans away from the results
/// they're looking at, exactly like Maps. Redoing the query uses the visible
/// viewport rather than a radius around a stale point.
export function SearchAreaButton() {
  const app = useApp()
  const t = useT()
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    const m = liveMap.current
    if (!m || !app.activeCategory) { setMoved(false); return }
    const onMove = (e: { originalEvent?: unknown }) => { if (e.originalEvent) setMoved(true) }
    m.on('moveend', onMove)
    return () => { m.off('moveend', onMove) }
  }, [app.activeCategory])

  // A fresh category search resets the prompt.
  useEffect(() => { setMoved(false) }, [app.pois])

  if (!app.activeCategory || !moved) return null

  return (
    <div // Centred on the VISIBLE map, not the window: the rail (and, when
    // collapsed, the floating search overlay) covers the left edge, so a
    // window-centred pill slides under it below ~1050px.
    className="pointer-events-none absolute left-[calc(50%+var(--left-chrome,0px)/2)] top-4 z-20 -translate-x-1/2">
      <Button
        className="pointer-events-auto gap-2 rounded-full px-4 shadow-lg"
        onClick={() => {
          const m = liveMap.current
          const viewport = activeMapViewport()
          if (!viewport) return
          setMoved(false)
          void app.showCategory(app.activeCategory as NearbyCategory,
            viewport.center,
            m ? {
              west: m.getBounds().getWest(),
              south: m.getBounds().getSouth(),
              east: m.getBounds().getEast(),
              north: m.getBounds().getNorth(),
            } : {
              west: viewport.center.lon - viewport.longitudeDelta / 2,
              south: viewport.center.lat - viewport.latitudeDelta / 2,
              east: viewport.center.lon + viewport.longitudeDelta / 2,
              north: viewport.center.lat + viewport.latitudeDelta / 2,
            })
        }}
      >
        <RotateCw className="size-4" /> {t('search-this-area')}
      </Button>
    </div>
  )
}
