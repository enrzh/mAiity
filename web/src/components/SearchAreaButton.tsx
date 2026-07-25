import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { liveMap } from './MapView'
import { useApp } from '../state'
import type { NearbyCategory } from '../lib/api'

/// "Search this area" — appears once the user pans away from the results
/// they're looking at, exactly like Maps. Redoing the query uses the visible
/// viewport rather than a radius around a stale point.
export function SearchAreaButton() {
  const app = useApp()
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
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
      <Button
        className="pointer-events-auto gap-2 rounded-full px-4 shadow-lg"
        onClick={() => {
          const m = liveMap.current
          if (!m) return
          const b = m.getBounds(), c = m.getCenter()
          setMoved(false)
          void app.showCategory(app.activeCategory as NearbyCategory,
            { lat: c.lat, lon: c.lng },
            { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() })
        }}
      >
        <RotateCw className="size-4" /> Diesen Bereich durchsuchen
      </Button>
    </div>
  )
}
