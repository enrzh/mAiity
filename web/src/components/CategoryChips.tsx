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
    const center = getCenter()
    if (center) void app.showCategory(cat, center)
  }

  return (
    <div
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
        WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
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
              'h-8 shrink-0 rounded-full border px-3 text-[12px] font-medium shadow-none',
              !active && 'border-border/50 bg-background hover:bg-accent',
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
