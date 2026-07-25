import { useEffect, useState } from 'react'
import { Box, ChevronLeft, ChevronRight, Crosshair, LogOut, Minus, Palette, Plus, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { AppProvider, useApp } from './state'
import { MapView, liveMap, locateUser, set3D, zoomBy } from './components/MapView'
import { CategoryChips, centerOf } from './components/CategoryChips'
import { SearchBar } from './components/SearchBar'
import { PlaceCard } from './components/PlaceCard'
import { PoiResults } from './components/PoiResults'
import { SearchAreaButton } from './components/SearchAreaButton'
import { RoutePanel } from './components/RoutePanel'
import { NavigationPanel } from './components/NavigationPanel'
import { SavedPanel } from './components/SavedPanel'
import { PackSwitcher } from './components/PackSwitcher'
import { AuthModal } from './components/AuthModal'

type Panel = 'none' | 'saved' | 'packs'

/// Layout: a Google-Maps-style left rail that owns search and all contextual
/// content, with the map as the hero to its right. Surfaces use a single
/// material (blurred, hairline-bordered, generously padded) rather than a
/// scatter of floating cards.

/// One control stack, bottom-right. The MapLibre built-ins are disabled so
/// nothing stacks on top of these (they shared the same corner).
function MapControls() {
  const app = useApp()
  const btn =
    'size-11 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/60 shadow-lg hover:bg-background'
  return (
    <div className="absolute bottom-6 right-4 z-20 flex flex-col items-end gap-2.5">
      <Button
        variant={app.is3D ? 'default' : 'ghost'}
        className={cn(btn, app.is3D && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        onClick={() => { app.toggle3D(); set3D(!app.is3D) }}
        aria-label="3D-Ansicht" aria-pressed={app.is3D} title="3D-Ansicht"
      >
        <Box className="size-5" />
      </Button>
      <Button variant="ghost" className={btn} onClick={locateUser}
        aria-label="Mein Standort" title="Mein Standort">
        <Crosshair className="size-5" />
      </Button>
      {/* Zoom pair, joined like a segmented control. */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur-xl">
        <Button variant="ghost" className="size-11 rounded-none hover:bg-accent"
          onClick={() => zoomBy(1)} aria-label="Vergrößern" title="Vergrößern">
          <Plus className="size-5" />
        </Button>
        <Separator />
        <Button variant="ghost" className="size-11 rounded-none hover:bg-accent"
          onClick={() => zoomBy(-1)} aria-label="Verkleinern" title="Verkleinern">
          <Minus className="size-5" />
        </Button>
      </div>
    </div>
  )
}

/// The rail's controls, reused verbatim in the collapsed floating overlay so
/// hiding the rail never removes a capability.
function RailControls({
  panel, toggle, compact = false,
}: { panel: Panel; toggle: (p: Panel) => void; compact?: boolean }) {
  const app = useApp()
  const size = compact ? 'size-9' : 'size-10'
  return (
    <>
      <Button
        variant="ghost" size="icon"
        className={cn(size, 'shrink-0 rounded-xl', panel === 'packs' && 'bg-accent text-accent-foreground')}
        onClick={() => toggle('packs')}
        aria-label="Karten-Stil" aria-pressed={panel === 'packs'} title="Karten-Stil"
      >
        <Palette className="size-5" />
      </Button>
      <Button
        variant="ghost" size="icon"
        className={cn(size, 'shrink-0 rounded-xl', panel === 'saved' && 'bg-accent text-accent-foreground')}
        onClick={() => toggle('saved')}
        aria-label="Gespeicherte Orte" aria-pressed={panel === 'saved'} title="Gespeicherte Orte"
      >
        <Star className="size-5" />
      </Button>
      {app.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={cn(size, 'shrink-0 rounded-xl font-semibold')} aria-label={`Konto: ${app.user.email ?? ''}`}>
              {(app.user.email ?? '?')[0].toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{app.user.displayName ?? app.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => app.logout()}>
              <LogOut className="size-4" /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost" size="icon" className={cn(size, 'shrink-0 rounded-xl')}
          onClick={() => app.setAuthOpen(true)} aria-label="Anmelden" title="Anmelden"
        >
          <User className="size-5" />
        </Button>
      )}
    </>
  )
}

function Shell() {
  const app = useApp()
  const [panel, setPanel] = useState<Panel>('none')
  const [collapsed, setCollapsed] = useState(false)
  const toggle = (p: Panel) => {
    // Acting on a rail function while collapsed reopens the rail to show it.
    if (collapsed) setCollapsed(false)
    setPanel((cur) => (cur === p ? 'none' : p))
  }

  // A place or route takes over the rail; side panels step aside.
  useEffect(() => { if (app.selected || app.route) setPanel('none') }, [app.selected, app.route])
  // Selecting something while collapsed should reveal it, like Maps does.
  useEffect(() => { if (app.selected || app.route) setCollapsed(false) }, [app.selected, app.route])

  return (
    <div className="relative flex h-full overflow-hidden bg-muted/30">
      {/* ---- Rail ------------------------------------------------------ */}
      <aside
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 flex max-h-[58%] flex-col gap-3 rounded-t-3xl border-t border-border/60 bg-background/85 p-3 shadow-2xl backdrop-blur-2xl',
          // md:min-w-0 is load-bearing: a flex item defaults to min-width:auto,
          // which resolves to its MIN-CONTENT width, so md:w-0 could not shrink
          // the rail below the search bar. It stayed 392px wide while "collapsed"
          // and the floating overlay rendered on top of it — two search bars.
          'md:static md:inset-auto md:h-full md:max-h-none md:min-w-0 md:shrink-0 md:gap-4 md:rounded-none md:border-r md:border-t-0 md:shadow-xl',
          'md:transition-[width,padding] md:duration-300 md:ease-out',
          collapsed
            ? 'md:w-0 md:overflow-hidden md:border-r-0 md:p-0 md:opacity-0'
            : 'md:w-[392px] md:p-4',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><SearchBar /></div>
          <RailControls panel={panel} toggle={toggle} />
        </div>

        <CategoryChips getCenter={() => centerOf(liveMap.current)} />

        {/* Contextual content — one thing at a time, like Maps. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {app.navigating ? <NavigationPanel />
            : app.route ? <RoutePanel />
            : app.selected ? <PlaceCard />
            : panel === 'saved' ? <SavedPanel onClose={() => setPanel('none')} />
            : panel === 'packs' ? <PackSwitcher onClose={() => setPanel('none')} />
            : app.pois.length > 0 ? <PoiResults />
            : <EmptyRail />}
        </div>
      </aside>

      {/* ---- Map ------------------------------------------------------- */}
      <main className="relative min-w-0 flex-1">
        <MapView />

        {/* Collapsing hides the rail, never its functions: search, chips and
            the rail controls float over the map instead. */}
        {collapsed && (
          <div className="pointer-events-none absolute left-8 top-4 z-20 hidden w-[380px] max-w-[calc(100%-6rem)] flex-col gap-2 md:flex">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background/85 p-1.5 shadow-lg backdrop-blur-xl">
              <div className="min-w-0 flex-1"><SearchBar /></div>
              <RailControls panel={panel} toggle={toggle} compact />
            </div>
            <div className="pointer-events-auto">
              <CategoryChips getCenter={() => centerOf(liveMap.current)} />
            </div>
          </div>
        )}

        {/* Google-style collapse handle riding the rail's edge (desktop). */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Seitenleiste einblenden' : 'Seitenleiste ausblenden'}
          title={collapsed ? 'Seitenleiste einblenden' : 'Seitenleiste ausblenden'}
          className="absolute left-0 top-1/2 z-20 hidden h-14 w-[22px] -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-border/60 bg-background/90 text-muted-foreground shadow-md backdrop-blur transition-colors hover:bg-accent hover:text-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>

        <SearchAreaButton />
        <MapControls />
        {app.packsError && app.packs.length === 0 && (
          <div
            className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg backdrop-blur"
            role="alert"
          >
            Karte konnte nicht geladen werden.
            <Button size="sm" variant="destructive" onClick={() => app.loadPacks()}>Erneut versuchen</Button>
          </div>
        )}
      </main>

      <AuthModal />
      <Toaster position="top-center" />
    </div>
  )
}

/** Quiet default state — hints without shouting. */
function EmptyRail() {
  const app = useApp()
  return (
    <div className="hidden h-full flex-col justify-end gap-1 px-1 pb-1 md:flex">
      <p className="text-sm font-medium text-foreground/80">
        {app.user ? `Willkommen zurück` : 'Karte erkunden'}
      </p>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Suche einen Ort, tippe auf die Karte für Details, oder wähle eine Kategorie.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
