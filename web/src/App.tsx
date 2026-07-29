import { useEffect, useState } from 'react'
import { Box, Check, Crosshair, Globe, LogOut, Minus, Palette, Plus, Star, User, X, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { AppProvider, useApp } from './state'
import { MapView, locateUser, railInset, set3D, zoomBy } from './components/MapView'
import { CategoryChips } from './components/CategoryChips'
import { activeMapViewport } from './maps/rendererController'
import { SearchOverlay } from './components/SearchOverlay'
import { PlaceCard } from './components/PlaceCard'
import { PoiResults } from './components/PoiResults'
import { SearchAreaButton } from './components/SearchAreaButton'
import { RoutePanel } from './components/RoutePanel'
import { NavigationPanel } from './components/NavigationPanel'
import { SavedPanel } from './components/SavedPanel'
import { PackSwitcher } from './components/PackSwitcher'
import { TrackCard } from './components/TrackCard'
import { MapStatus } from './components/MapStatus'
import { AuthModal } from './components/AuthModal'
import { Surface } from './components/ui/surface'

type Panel = 'none' | 'saved' | 'packs'

const LANGS: Array<[string, string]> = [
  ['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'],
]

/**
 * Map-first shell: top chrome only, full-bleed map, contextual bottom card.
 * shadcn + clean/minimal — no sidebar, no game mode.
 */

function TopBar({
  panel, onSaved, onPacks, onSearch,
}: {
  panel: Panel
  onSaved: () => void
  onPacks: () => void
  onSearch: () => void
}) {
  const app = useApp()
  const t = useT()

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-1.5 rounded-2xl border border-border bg-background p-1.5 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          className="h-10 min-w-0 flex-1 justify-start gap-2 rounded-xl px-3 font-normal text-muted-foreground hover:text-foreground"
          onClick={onSearch}
        >
          <span className="truncate text-left text-sm">{t('search-placeholder')}</span>
        </Button>

        <Button
          type="button"
          variant={panel === 'saved' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-10 shrink-0 gap-1.5 rounded-xl px-3"
          onClick={onSaved}
          aria-pressed={panel === 'saved'}
        >
          <Star className={cn('size-3.5', panel === 'saved' && 'fill-current')} />
          <span className="hidden sm:inline">{t('chrome-saved')}</span>
        </Button>

        {app.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-10 shrink-0 gap-1.5 rounded-xl px-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {(app.user.email ?? '?')[0].toUpperCase()}
                </span>
                <span className="hidden sm:inline">{t('chrome-me')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuLabel className="truncate font-medium">
                {app.user.displayName ?? app.user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onPacks}>
                <Palette className="size-4" /> {t('map-style')}
              </DropdownMenuItem>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t('language')}
              </DropdownMenuLabel>
              {LANGS.map(([code, label]) => (
                <DropdownMenuItem key={code} onClick={() => app.setLang(code)}>
                  <span className="flex-1">{label}</span>
                  {app.lang === code && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => app.logout()}>
                <LogOut className="size-4" /> {t('sign-out')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-10 shrink-0 gap-1.5 rounded-xl px-3">
                <User className="size-3.5" />
                <span className="hidden sm:inline">{t('chrome-me')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem onClick={() => app.setAuthOpen(true)}>
                <User className="size-4" /> {t('sign-in')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPacks}>
                <Palette className="size-4" /> {t('map-style')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t('language')}
              </DropdownMenuLabel>
              {LANGS.map(([code, label]) => (
                <DropdownMenuItem key={code} onClick={() => app.setLang(code)}>
                  <Globe className="size-4 opacity-40" />
                  <span className="flex-1">{label}</span>
                  {app.lang === code && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}

function MapFabs() {
  const app = useApp()
  const t = useT()
  const fab =
    'size-10 rounded-full border border-border bg-background shadow-sm hover:bg-muted'

  return (
    <div className="absolute bottom-[calc(var(--detail-h,0px)+1rem)] right-3 z-20 flex flex-col items-end gap-2 transition-[bottom] duration-200 md:bottom-5 md:right-4">
      <Button
        variant={app.is3D ? 'default' : 'ghost'}
        className={cn(fab, app.is3D && 'bg-primary text-primary-foreground')}
        onClick={() => {
          const next = !app.is3D
          app.setIs3D(next)
          set3D(next)
        }}
        aria-label={t('view-3d')}
        aria-pressed={app.is3D}
        title={t('view-3d')}
      >
        <Box className="size-4" />
      </Button>
      <Button variant="ghost" className={fab} onClick={locateUser} aria-label={t('my-location')} title={t('my-location')}>
        <Crosshair className="size-4" />
      </Button>
      <div className="flex flex-col overflow-hidden rounded-full border border-border/60 bg-background/95 shadow-md backdrop-blur-md">
        <Button variant="ghost" className="size-10 rounded-none" onClick={() => zoomBy(1)} aria-label={t('zoom-in')} title={t('zoom-in')}>
          <Plus className="size-4" />
        </Button>
        <Separator />
        <Button variant="ghost" className="size-10 rounded-none" onClick={() => zoomBy(-1)} aria-label={t('zoom-out')} title={t('zoom-out')}>
          <Minus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function Shell() {
  const app = useApp()
  const t = useT()
  const [panel, setPanel] = useState<Panel>('none')
  const [searchOpen, setSearchOpen] = useState(false)
  const [appleFailed, setAppleFailed] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const [detailExpanded, setDetailExpanded] = useState(false)

  // No left rail — map framing uses full width.
  useEffect(() => {
    railInset.current = 0
  }, [])

  useEffect(() => {
    if (app.mapProvider !== 'apple') setAppleFailed(false)
  }, [app.mapProvider])

  useEffect(() => {
    if (app.selected || app.route) setPanel('none')
  }, [app.selected, app.route])

  useEffect(() => {
    if (app.pois.length > 0) setPanel('none')
  }, [app.pois])

  // / opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); return }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-1); return }
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return }
        if (app.pickingStart) { app.cancelPickStart(); return }
        if (panel !== 'none') { setPanel('none'); return }
        if (app.navigating) { app.stopNavigation(); return }
        if (app.route) { app.clearRoute(); return }
        if (app.selected) { app.select(null); return }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, panel, app])

  const hasDetail = !!(
    panel !== 'none'
    || app.navigating
    || app.route
    || app.selected
    || app.pois.length > 0
  )

  // Expand detail when content appears
  useEffect(() => {
    if (hasDetail) setDetailExpanded(true)
  }, [hasDetail, app.selected, app.route, app.navigating, panel, app.pois.length])

  const detailH = !hasDetail ? 0 : detailExpanded ? Math.min(420, Math.round(window.innerHeight * 0.48)) : 120

  const body =
    panel === 'packs' ? <PackSwitcher onClose={() => setPanel('none')} />
    : panel === 'saved' ? <SavedPanel onClose={() => setPanel('none')} />
    : app.navigating ? <NavigationPanel />
    : app.route ? (
      <div className="space-y-3">
        <TrackCard />
        <RoutePanel />
      </div>
    )
    : app.selected ? <PlaceCard />
    : app.pois.length > 0 ? <PoiResults />
    : null

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-muted/20"
      style={{ '--detail-h': `${detailH}px` } as React.CSSProperties}
    >
      <main className="absolute inset-0">
        <MapView
          key={mapKey}
          onAppleFailed={() => setAppleFailed(true)}
        />
        <MapStatus
          appleFailed={appleFailed}
          onRetryApple={() => {
            setAppleFailed(false)
            setMapKey((k) => k + 1)
          }}
        />
        <MapFabs />
        {!app.pickingStart && <SearchAreaButton />}

        {app.pickingStart && (
          <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-[36] flex -translate-x-1/2 px-3" role="status">
            <Surface variant="float" radius="pill" padding="sm" className="pointer-events-auto flex max-w-md items-center gap-2 text-[13px] font-medium">
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">{t('route-pick-start')}</span>
              <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={app.cancelPickStart} aria-label={t('close')}>
                <X className="size-3.5" />
              </Button>
            </Surface>
          </div>
        )}
      </main>

      <TopBar
        panel={panel}
        onSaved={() => setPanel((p) => (p === 'saved' ? 'none' : 'saved'))}
        onPacks={() => setPanel((p) => (p === 'packs' ? 'none' : 'packs'))}
        onSearch={() => setSearchOpen(true)}
      />

      {/* Category chips float under top bar when idle */}
      {!hasDetail && !app.pickingStart && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] z-20 flex justify-center px-3 md:top-[4.5rem]">
          <div className="pointer-events-auto max-w-xl overflow-x-auto">
            <CategoryChips getCenter={() => activeMapViewport()?.center ?? null} />
          </div>
        </div>
      )}

      {/* Contextual detail card — bottom only */}
      {hasDetail && body && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div
            className="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg transition-[height] duration-200 ease-out"
            style={{ height: detailH }}
          >
            <button
              type="button"
              className="flex shrink-0 justify-center py-2"
              onClick={() => setDetailExpanded((e) => !e)}
              aria-label={detailExpanded ? t('close') : t('search')}
            >
              <span className="h-1 w-9 rounded-full bg-muted-foreground/30" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
              {body}
            </div>
          </div>
        </div>
      )}

      <SearchOverlay
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPicked={() => {
          setSearchOpen(false)
          setPanel('none')
          setDetailExpanded(true)
        }}
      />
      <AuthModal />
      <Toaster position="top-center" offset={72} gap={8} />
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
