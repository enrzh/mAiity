import { useEffect, useState } from 'react'
import { Box, LogOut, Palette, Star, User } from 'lucide-react'
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

const roundBtn = 'size-11 rounded-full bg-background/95 shadow-md backdrop-blur hover:bg-background supports-[backdrop-filter]:bg-background/85'

function Shell() {
  const app = useApp()
  const [panel, setPanel] = useState<Panel>('none')
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? 'none' : p))

  // A selected place takes the stage — close side panels so the card is clear.
  useEffect(() => { if (app.selected) setPanel('none') }, [app.selected])

  return (
    <div className="relative h-full overflow-hidden">
      <MapView />

      <div
        className="pointer-events-none absolute z-20 flex items-start gap-2.5"
        style={{
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'max(12px, env(safe-area-inset-left))',
          right: 'max(12px, env(safe-area-inset-right))',
        }}
      >
        <div className="pointer-events-auto min-w-0 flex-1"><SearchBar /></div>
        <div className="pointer-events-auto ml-auto flex shrink-0 gap-2">
          <Button
            variant="ghost" size="icon"
            className={cn(roundBtn, app.is3D && 'ring-2 ring-primary')}
            onClick={() => { app.toggle3D(); set3D(!app.is3D) }}
            aria-label="3D-Ansicht" aria-pressed={app.is3D} title="3D-Ansicht"
          >
            <Box className="size-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn(roundBtn, panel === 'packs' && 'ring-2 ring-primary')}
            onClick={() => toggle('packs')}
            aria-label="Karten-Stil" aria-pressed={panel === 'packs'} title="Karten-Stil"
          >
            <Palette className="size-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={cn(roundBtn, panel === 'saved' && 'ring-2 ring-primary')}
            onClick={() => toggle('saved')}
            aria-label="Gespeicherte Orte" aria-pressed={panel === 'saved'} title="Gespeicherte Orte"
          >
            <Star className="size-5" />
          </Button>
          {app.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="size-11 rounded-full font-bold shadow-md"
                  aria-label={`Konto: ${app.user.email ?? 'Konto'}`}
                >
                  {(app.user.email ?? '?')[0].toUpperCase()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {app.user.displayName ?? app.user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => app.logout()}>
                  <LogOut className="size-4" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost" size="icon"
              className={roundBtn}
              onClick={() => app.setAuthOpen(true)}
              aria-label="Anmelden" title="Anmelden"
            >
              <User className="size-5" />
            </Button>
          )}
        </div>
      </div>

      <CategoryChips getCenter={() => centerOf(liveMap.current)} />

      {app.packsError && app.packs.length === 0 && (
        <div
          className="absolute left-1/2 top-[68px] z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg backdrop-blur"
          role="alert"
        >
          Karte konnte nicht geladen werden.
          <Button size="sm" variant="destructive" onClick={() => app.loadPacks()}>
            Erneut versuchen
          </Button>
        </div>
      )}

      {panel === 'saved' && <SavedPanel onClose={() => setPanel('none')} />}
      {panel === 'packs' && <PackSwitcher onClose={() => setPanel('none')} />}
      {app.route ? <RoutePanel /> : <PlaceCard />}
      <AuthModal />
      <Toaster position="bottom-center" />
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
