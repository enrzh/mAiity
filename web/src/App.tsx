import { useEffect, useState } from 'react'
import { Box, Crosshair, LogOut, Palette, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { AppProvider, useApp } from './state'
import { MapView, liveMap, set3D } from './components/MapView'
import { CategoryChips, centerOf } from './components/CategoryChips'
import { SearchBar } from './components/SearchBar'
import { PlaceCard } from './components/PlaceCard'
import { RoutePanel } from './components/RoutePanel'
import { SavedPanel } from './components/SavedPanel'
import { PackSwitcher } from './components/PackSwitcher'
import { AuthModal } from './components/AuthModal'

type Panel = 'none' | 'saved' | 'packs'

/// Layout: a Google-Maps-style left rail that owns search and all contextual
/// content, with the map as the hero to its right. Surfaces use a single
/// material (blurred, hairline-bordered, generously padded) rather than a
/// scatter of floating cards.

function MapControls() {
  const app = useApp()
  const btn =
    'size-11 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/60 shadow-lg hover:bg-background'
  return (
    <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2.5 md:right-6">
      <Button
        variant={app.is3D ? 'default' : 'ghost'}
        className={cn(btn, app.is3D && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        onClick={() => { app.toggle3D(); set3D(!app.is3D) }}
        aria-label="3D-Ansicht" aria-pressed={app.is3D} title="3D-Ansicht"
      >
        <Box className="size-5" />
      </Button>
      <Button
        variant="ghost"
        className={btn}
        onClick={() => {
          navigator.geolocation?.getCurrentPosition((p) =>
            liveMap.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15, duration: 900 }))
        }}
        aria-label="Mein Standort" title="Mein Standort"
      >
        <Crosshair className="size-5" />
      </Button>
    </div>
  )
}

function Shell() {
  const app = useApp()
  const [panel, setPanel] = useState<Panel>('none')
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? 'none' : p))

  // A place or route takes over the rail; side panels step aside.
  useEffect(() => { if (app.selected || app.route) setPanel('none') }, [app.selected, app.route])

  return (
    <div className="relative flex h-full overflow-hidden bg-muted/30">
      {/* ---- Rail ------------------------------------------------------ */}
      <aside
        className="absolute inset-x-0 bottom-0 z-30 flex max-h-[58%] flex-col gap-3 rounded-t-3xl border-t border-border/60 bg-background/85 p-3 shadow-2xl backdrop-blur-2xl md:static md:inset-auto md:h-full md:max-h-none md:w-[392px] md:shrink-0 md:gap-4 md:rounded-none md:border-r md:border-t-0 md:p-4 md:shadow-xl"
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><SearchBar /></div>
          <Button
            variant="ghost" size="icon"
            className={cn('size-10 shrink-0 rounded-xl', panel === 'packs' && 'bg-accent text-accent-foreground')}
            onClick={() => toggle('packs')}
            aria-label="Karten-Stil" aria-pressed={panel === 'packs'} title="Karten-Stil"
          >
            <Palette className="size-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn('size-10 shrink-0 rounded-xl', panel === 'saved' && 'bg-accent text-accent-foreground')}
            onClick={() => toggle('saved')}
            aria-label="Gespeicherte Orte" aria-pressed={panel === 'saved'} title="Gespeicherte Orte"
          >
            <Star className="size-5" />
          </Button>
          {app.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="size-10 shrink-0 rounded-xl font-semibold" aria-label={`Konto: ${app.user.email ?? ''}`}>
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
              variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl"
              onClick={() => app.setAuthOpen(true)} aria-label="Anmelden" title="Anmelden"
            >
              <User className="size-5" />
            </Button>
          )}
        </div>

        <CategoryChips getCenter={() => centerOf(liveMap.current)} />

        {/* Contextual content — one thing at a time, like Maps. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {app.route ? <RoutePanel />
            : app.selected ? <PlaceCard />
            : panel === 'saved' ? <SavedPanel onClose={() => setPanel('none')} />
            : panel === 'packs' ? <PackSwitcher onClose={() => setPanel('none')} />
            : <EmptyRail />}
        </div>
      </aside>

      {/* ---- Map ------------------------------------------------------- */}
      <main className="relative min-w-0 flex-1">
        <MapView />
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
