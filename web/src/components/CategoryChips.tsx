import {
  Banknote, BedDouble, Coffee, Fuel, Pill, ShoppingCart, SquareParking, Utensils, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NEARBY_CATEGORIES, type NearbyCategory } from '../lib/api'
import { useT } from '../lib/useT'
import { useApp } from '../state'
import type { Map as MLMap } from 'maplibre-gl'

/// Real icons, not emoji — emoji render differently per platform and read
/// as filler. One icon per category id.
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

/// "In der Nähe" browsing — one tap shows a category around the map center.
export function CategoryChips({ getCenter }: { getCenter: () => { lat: number; lon: number } | null }) {
  const app = useApp()
  const t = useT()
  if (app.route) return null

  const pick = (cat: NearbyCategory) => {
    if (app.activeCategory === cat) { app.clearPois(); return }
    const center = getCenter()
    if (center) void app.showCategory(cat, center)
  }

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)' }}
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
              'h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium shadow-sm',
              // Solid: chips sit on the solid rail/sheet (and read fine as
              // solid pills in the collapsed overlay too) — no blur here.
              !active && 'border-border/60 bg-background hover:bg-accent',
            )}
            onClick={() => pick(c.id)}
          >
            <Icon className="size-3.5" />
            {t(c.labelKey)}
            {active && <X className="size-3 opacity-70" />}
          </Button>
        )
      })}
    </div>
  )
}

/** Helper for App: read the live map center through the DOM-mounted map. */
export function centerOf(map: MLMap | null): { lat: number; lon: number } | null {
  if (!map) return null
  const c = map.getCenter()
  return { lat: c.lat, lon: c.lng }
}
