import {
  Banknote, BedDouble, Coffee, Fuel, Pill, ShoppingCart, SquareParking, Utensils, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NEARBY_CATEGORIES, type NearbyCategory } from '../lib/api'
import { useT } from '../lib/useT'
import { useApp } from '../state'

const ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  cafe: Coffee,
  supermarket: ShoppingCart,
  fuel: Fuel,
  pharmacy: Pill,
  hotel: BedDouble,
  parking: SquareParking,
  atm: Banknote,
}

/// Nearby category pills — hidden during route/nav/race so they don't fight
/// the route panel or race HUD for space.
export function CategoryChips({ getCenter }: { getCenter: () => { lat: number; lon: number } | null }) {
  const app = useApp()
  const t = useT()
  if (app.route || app.navigating) return null
  if (app.driving.status === 'running' || app.driving.status === 'paused') return null

  const pick = (cat: NearbyCategory) => {
    if (app.activeCategory === cat) { app.clearPois(); return }
    // Fall back to a Germany-wide center if the map hasn't reported a viewport yet
    // (e.g. before the first region-change / geolocation).
    const center = getCenter() ?? { lat: 51.16, lon: 10.45 }
    void app.showCategory(cat, center)
  }

  return (
    <div
      className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        maskImage: 'linear-gradient(to right, #000 calc(100% - 20px), transparent)',
        WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 20px), transparent)',
      }}
    >
      {NEARBY_CATEGORIES.map((c) => {
        const Icon = ICONS[c.id] ?? Utensils
        const active = app.activeCategory === c.id
        return (
          <Button
            key={c.id}
            size="sm"
            variant={active ? 'default' : 'secondary'}
            className={cn(
              'h-8 shrink-0 gap-1.5 px-3 text-[12px] font-medium shadow-none',
              !active && 'border border-border/40 bg-background/70 backdrop-blur-md',
            )}
            onClick={() => pick(c.id)}
          >
            <Icon className="size-3.5 opacity-80" />
            {t(c.labelKey)}
            {active && <X className="size-3 opacity-70" />}
          </Button>
        )
      })}
    </div>
  )
}
