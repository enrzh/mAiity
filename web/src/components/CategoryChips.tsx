import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NEARBY_CATEGORIES, type NearbyCategory } from '../lib/api'
import { useApp } from '../state'
import type { Map as MLMap } from 'maplibre-gl'

/// "In der Nähe" browsing — one tap shows a category around the map center.
export function CategoryChips({ getCenter }: { getCenter: () => { lat: number; lon: number } | null }) {
  const app = useApp()
  if (app.route) return null

  const pick = (cat: NearbyCategory) => {
    if (app.activeCategory === cat) { app.clearPois(); return }
    const center = getCenter()
    if (center) void app.showCategory(cat, center)
  }

  return (
    <div
      className="pointer-events-auto absolute left-0 right-0 z-10 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]"
      style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 52px)' }}
    >
      {NEARBY_CATEGORIES.map((c) => (
        <Button
          key={c.id}
          size="sm"
          variant="ghost"
          className={cn(
            'h-8 shrink-0 rounded-full bg-background/95 px-3 text-xs font-medium shadow-sm backdrop-blur',
            app.activeCategory === c.id && 'ring-2 ring-primary',
          )}
          onClick={() => pick(c.id)}
        >
          <span aria-hidden="true">{c.emoji}</span> {c.label}
          {app.activeCategory === c.id && <X className="size-3" />}
        </Button>
      ))}
    </div>
  )
}

/** Helper for App: read the live map center through the DOM-mounted map. */
export function centerOf(map: MLMap | null): { lat: number; lon: number } | null {
  if (!map) return null
  const c = map.getCenter()
  return { lat: c.lat, lon: c.lng }
}
