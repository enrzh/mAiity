import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Box, Car, Check, ChevronLeft, ChevronRight, Crosshair, Globe, LogOut, Minus, Palette, Plus, Star, User, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { readSidebarCollapsed, writeSidebarCollapsed } from '@/lib/sidebarState'
import { AppProvider, useApp } from './state'
import { MapView, locateUser, railInset, set3D, zoomBy } from './components/MapView'
import { CategoryChips } from './components/CategoryChips'
import { activeMapViewport } from './maps/rendererController'
import { SearchBar } from './components/SearchBar'
import { PlaceCard } from './components/PlaceCard'
import { PoiResults } from './components/PoiResults'
import { SearchAreaButton } from './components/SearchAreaButton'
import { RoutePanel } from './components/RoutePanel'
import { NavigationPanel } from './components/NavigationPanel'
import { SavedPanel } from './components/SavedPanel'
import { PackSwitcher } from './components/PackSwitcher'
import { DrivingModePanel } from './components/DrivingModePanel'
const RaceCar3D = lazy(() =>
  import('./components/RaceCar3D').then((m) => ({ default: m.RaceCar3D })),
)
import { MapStatus } from './components/MapStatus'
import { AuthModal } from './components/AuthModal'

type Panel = 'none' | 'saved' | 'packs'

/// Layout: a Google-Maps-style left rail that owns search and all contextual
/// content, with the map as the hero to its right.
///
/// Surface tokens: the rail/sheet are SOLID panels (bg-background, border,
/// shadow-xl) — blur is reserved for chrome that truly floats over the map
/// (MapControls, the collapsed search overlay, the search-area pill), where
/// it earns its cost. Shadow scale: floating=shadow-lg, panels=shadow-xl.

/// Mobile bottom-sheet detents. peek shows search+chips, half/full open the
/// contextual content. Heights resolved lazily (vh depends on the viewport).
type Detent = 'peek' | 'half' | 'full'
const DETENTS: Detent[] = ['peek', 'half', 'full']
function detentPx(d: Detent): number {
  // Peek: search + chips only — keep short so the map stays the hero.
  return d === 'peek' ? 118 : Math.round(window.innerHeight * (d === 'half' ? 0.42 : 0.85))
}

/// One control stack, bottom-right. Sits above the mobile sheet and above the
/// race HUD via CSS vars so nothing stacks on top of each other.
function MapControls({ racing }: { racing: boolean }) {
  const app = useApp()
  const t = useT()
  // During race on phone the touch pads own the bottom — hide the stack.
  if (racing) {
    return (
      <div className="absolute bottom-[calc(var(--race-hud-h,12rem)+0.75rem)] right-3 z-30 hidden flex-col items-end gap-2 md:flex">
        <Button
          variant="ghost"
          className="size-10 rounded-xl border border-border/60 bg-background/90 shadow-md backdrop-blur-xl"
          onClick={locateUser}
          aria-label={t('my-location')}
          title={t('my-location')}
        >
          <Crosshair className="size-4" />
        </Button>
        <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-md backdrop-blur-xl">
          <Button variant="ghost" className="size-10 rounded-none" onClick={() => zoomBy(1)} aria-label={t('zoom-in')}>
            <Plus className="size-4" />
          </Button>
          <Separator />
          <Button variant="ghost" className="size-10 rounded-none" onClick={() => zoomBy(-1)} aria-label={t('zoom-out')}>
            <Minus className="size-4" />
          </Button>
        </div>
      </div>
    )
  }
  const btn =
    'size-11 rounded-2xl bg-background/90 backdrop-blur-xl border border-border/60 shadow-lg hover:bg-background'
  return (
    <div className="absolute bottom-[calc(var(--sheet-h,0px)+1rem)] right-3 z-20 flex flex-col items-end gap-2 transition-[bottom] duration-200 md:bottom-5 md:right-4">
      {/* 3D tilt — custom MapLibre + Apple MapKit Camera pitch. */}
      <Button
        variant={app.is3D ? 'default' : 'ghost'}
        className={cn(btn, app.is3D && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        onClick={() => {
          const next = !app.is3D
          app.setIs3D(next)
          set3D(next)
        }}
        aria-label={t('view-3d')}
        aria-pressed={app.is3D}
        title={t('view-3d')}
      >
        <Box className="size-5" />
      </Button>
      {/* Free drive — raise the world without a route. */}
      {app.driving.status === 'idle' && (
        <Button
          variant="ghost"
          className={btn}
          onClick={() => {
            app.armFreeDrivingMode()
            set3D(true)
          }}
          aria-label={t('free-drive')}
          title={t('free-drive')}
        >
          <Car className="size-5" />
        </Button>
      )}
      <Button variant="ghost" className={btn} onClick={locateUser} aria-label={t('my-location')} title={t('my-location')}>
        <Crosshair className="size-5" />
      </Button>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl">
        <Button variant="ghost" className="size-11 rounded-none hover:bg-accent" onClick={() => zoomBy(1)} aria-label={t('zoom-in')} title={t('zoom-in')}>
          <Plus className="size-5" />
        </Button>
        <Separator />
        <Button variant="ghost" className="size-11 rounded-none hover:bg-accent" onClick={() => zoomBy(-1)} aria-label={t('zoom-out')} title={t('zoom-out')}>
          <Minus className="size-5" />
        </Button>
      </div>
    </div>
  )
}

const LANGS: Array<[string, string]> = [
  ['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'],
]

function LanguageMenu({ size }: { size: string }) {
  const app = useApp()
  const t = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn(size, 'shrink-0 rounded-xl')}
          aria-label={t('language')} title={t('language')}>
          <Globe className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGS.map(([code, label]) => (
          <DropdownMenuItem key={code} onClick={() => app.setLang(code)}>
            <span className="flex-1">{label}</span>
            {app.lang === code && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/// Compact rail actions — only packs + account (language lives under account).
/// Keeps the search field wide; four icons next to search was crushing UX.
function RailControls({
  panel, toggle, compact = false,
}: { panel: Panel; toggle: (p: Panel) => void; compact?: boolean }) {
  const app = useApp()
  const t = useT()
  const size = compact ? 'size-9' : 'size-10'
  return (
    <>
      <Button
        variant="ghost" size="icon"
        className={cn(size, 'shrink-0 rounded-xl', panel === 'packs' && 'bg-accent text-accent-foreground')}
        onClick={() => toggle('packs')}
        aria-label={t('map-style')} aria-pressed={panel === 'packs'} title={t('map-style')}
      >
        <Palette className="size-5" />
      </Button>
      <Button
        variant="ghost" size="icon"
        className={cn(size, 'shrink-0 rounded-xl', panel === 'saved' && 'bg-accent text-accent-foreground')}
        onClick={() => toggle('saved')}
        aria-label={t('saved-places')} aria-pressed={panel === 'saved'} title={t('saved-places')}
      >
        <Star className="size-5" />
      </Button>
      {app.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={cn(size, 'shrink-0 rounded-xl font-semibold')} aria-label={`${t('account')}: ${app.user.email ?? ''}`}>
              {(app.user.email ?? '?')[0].toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{app.user.displayName ?? app.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('language')}</DropdownMenuLabel>
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
        <>
          <LanguageMenu size={size} />
          <Button
            variant="ghost" size="icon" className={cn(size, 'shrink-0 rounded-xl')}
            onClick={() => app.setAuthOpen(true)} aria-label={t('sign-in')} title={t('sign-in')}
          >
            <User className="size-5" />
          </Button>
        </>
      )}
    </>
  )
}

function Shell() {
  const app = useApp()
  const t = useT()
  const [panel, setPanel] = useState<Panel>('none')
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed())
  const [appleFailed, setAppleFailed] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const railRef = useRef<HTMLElement>(null)
  const raceHudRef = useRef<HTMLDivElement>(null)
  const [sheetH, setSheetH] = useState(0)
  const [raceHudH, setRaceHudH] = useState(0)
  // Mobile sheet detent + live height while the grabber is being dragged.
  const [detent, setDetent] = useState<Detent>('peek')
  const [dragH, setDragH] = useState<number | null>(null)
  const dragFrom = useRef<{ y: number; h: number } | null>(null)
  // Immersive = actively racing. "Ready" keeps the rail/sheet so the route
  // stays visible alongside the Start race HUD (less jarring).
  const racing = app.driving.status === 'running'
    || app.driving.status === 'paused'
    || app.driving.status === 'finished'
  useEffect(() => writeSidebarCollapsed(collapsed), [collapsed])
  useEffect(() => {
    if (app.mapProvider !== 'apple') setAppleFailed(false)
  }, [app.mapProvider])

  // Global shortcuts when not typing in an input: / search, +/- zoom, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('input[type="search"], input[name="q"], header input, .search-bar input, [data-search-input]')
        if (input) {
          input.focus()
          input.select()
        } else {
          // Fall back: first text input in the rail
          document.querySelector<HTMLInputElement>('aside input')?.focus()
        }
        if (collapsed) setCollapsed(false)
        return
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); return }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-1); return }
      if (e.key === 'Escape') {
        // Priority: cancel pick-start → close side panel → dismiss race HUD.
        if (app.pickingStart) {
          app.cancelPickStart()
          return
        }
        if (panel !== 'none') {
          setPanel('none')
          return
        }
        if (app.driving.status === 'ready' || app.driving.status === 'finished') {
          app.exitDrivingMode()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, panel, app.driving.status, app.exitDrivingMode, app.pickingStart, app.cancelPickStart])

  const toggle = (p: Panel) => {
    // Acting on a rail function while collapsed reopens the rail to show it.
    if (collapsed) setCollapsed(false)
    // On mobile, the peek sheet has no room for panel content — lift it.
    setDetent((d) => (d === 'peek' ? 'half' : d))
    setPanel((cur) => (cur === p ? 'none' : p))
  }

  // Drag on the handle, snap to the nearest detent on release. Plain pointer
  // events (with capture) — no library needed for three snap points.
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragFrom.current = { y: e.clientY, h: railRef.current?.offsetHeight ?? detentPx(detent) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current
    if (!from) return
    const h = from.h + (from.y - e.clientY)
    setDragH(Math.min(detentPx('full'), Math.max(detentPx('peek'), h)))
  }
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current
    if (!from) return
    dragFrom.current = null
    const h = from.h + (from.y - e.clientY)
    let best: Detent = 'peek'
    for (const d of DETENTS) if (Math.abs(detentPx(d) - h) < Math.abs(detentPx(best) - h)) best = d
    setDetent(best)
    setDragH(null) // hand height control back to the detent (animated)
  }

  // Opening a place/route should not leave a stale packs/saved highlight — but
  // once a route is already open the user must still be able to open packs
  // (provider/style). That is handled by content precedence below, not by
  // forcing panel off on every route identity change.
  useEffect(() => {
    // Clear side panels when place/route content takes the rail.
    // User can re-open packs/saved afterward; those still outrank route in render.
    if (app.selected || app.route) setPanel('none')
  }, [app.selected, app.route])
  // Selecting something while collapsed should reveal it, like Maps does.
  // Exception: race mode is immersive — keep the rail collapsed.
  useEffect(() => {
    if (racing) return
    if (app.selected || app.route) setCollapsed(false)
  }, [app.selected, app.route, racing])
  // Category results must take over the rail: with the packs/saved panel
  // open they loaded into a slot BELOW it in the precedence chain, so the
  // chips looked broken. One thing at a time, like Maps.
  useEffect(() => { if (app.pois.length > 0) { setPanel('none'); setCollapsed(false) } }, [app.pois])
  // Active race: free the map (hide mobile sheet, collapse desktop rail).
  useEffect(() => {
    if (app.driving.status === 'running' || app.driving.status === 'paused' || app.driving.status === 'finished') {
      setPanel('none')
      setCollapsed(true)
      setDetent('peek')
    }
  }, [app.driving.status])
  // New contextual content while the mobile sheet is at peek would be
  // invisible — lift to half so a tap on the map/chips visibly answers.
  // Keep 'full' if the user already expanded; never leave content at peek.
  useEffect(() => {
    if (racing) return
    if (app.selected || app.route || app.pois.length > 0) {
      setDetent((d) => (d === 'full' ? d : 'half'))
    }
  }, [app.selected, app.route, app.pois, racing])
  // Tell the map how much of its left edge the rail covers, so framing a place
  // or route puts it in the VISIBLE half rather than behind the panel. Only on
  // desktop — on mobile the rail is a bottom sheet, not a left panel.
  // How much chrome covers the map's LEFT edge: the rail when open, the
  // floating search overlay when collapsed. Top-centred chrome (the
  // "search this area" button, the pack-error banner) must centre on the
  // VISIBLE map, not the window, or it slides under that chrome on narrow
  // desktops. railInset additionally offsets camera framing.
  const [leftChrome, setLeftChrome] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => {
      const w = !mq.matches ? 0 : collapsed ? 0 : 360
      setLeftChrome(w)
      railInset.current = collapsed || !mq.matches || racing ? 0 : 360
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [collapsed, racing])

  // Measure the mobile sheet so the map controls can sit above it.
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const mq = window.matchMedia('(min-width: 768px)')
    const measure = () => {
      // Race mode owns the bottom of the screen — treat sheet as gone.
      if (racing && !mq.matches) { setSheetH(0); return }
      setSheetH(mq.matches ? 0 : el.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    mq.addEventListener('change', measure)
    return () => { ro.disconnect(); mq.removeEventListener('change', measure) }
  }, [racing])

  // Measure race HUD height so map controls clear it on desktop.
  useEffect(() => {
    const el = raceHudRef.current
    if (!el || app.driving.status === 'idle') { setRaceHudH(0); return }
    const measure = () => setRaceHudH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [app.driving.status, app.driving.progress])

  return (
    <div
      className={cn('relative flex h-full min-h-0 overflow-hidden bg-muted/30', racing && 'maps-shell--racing')}
      style={{
        '--sheet-h': `${racing ? 0 : sheetH}px`,
        '--left-chrome': `${leftChrome}px`,
        '--race-hud-h': `${raceHudH}px`,
      } as React.CSSProperties}
    >
      {/* ---- Rail / mobile sheet ---------------------------------------- */}
      <aside
        ref={railRef}
        style={{ '--detent-h': `${dragH ?? detentPx(detent)}px` } as React.CSSProperties}
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 flex h-[var(--detent-h)] flex-col gap-2.5 rounded-t-3xl border-t border-border/60 bg-background p-3 shadow-xl',
          dragH === null && 'transition-[height,transform,opacity] duration-300 ease-out',
          'md:absolute md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-[360px] md:gap-3 md:rounded-none md:border-r md:border-t-0 md:p-4',
          'md:transition-transform md:duration-300 md:ease-out md:will-change-transform',
          collapsed ? 'md:-translate-x-full' : 'md:translate-x-0',
          // Race: hide the mobile sheet completely so the map + HUD are clean.
          racing && 'max-md:pointer-events-none max-md:translate-y-full max-md:opacity-0',
        )}
        aria-hidden={racing ? true : undefined}
      >
        {/* Grabber — the visible drag affordance for the mobile detents. */}
        <div
          className="-mb-2 -mt-1.5 flex shrink-0 cursor-grab touch-none justify-center py-1 active:cursor-grabbing md:hidden"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-hidden
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><SearchBar /></div>
          <RailControls panel={panel} toggle={toggle} />
        </div>

        <CategoryChips getCenter={() => activeMapViewport()?.center ?? null} />

        {/* Contextual content — one thing at a time, like Maps. At peek the
            sheet is search+chips only, so its clipped remainder must not
            become a scroll trap; it scrolls in half/full (and on desktop). */}
        <div
          className={cn(
            'min-h-0 flex-1 overscroll-contain',
            detent === 'peek' ? 'overflow-y-hidden md:overflow-y-auto' : 'overflow-y-auto',
          )}
        >
          {/* Side panels (packs/saved) outrank route/place so the rail content
              always matches the highlighted control. Previously packs stayed
              "pressed" while RoutePanel kept winning the slot — UI mismatch. */}
          {panel === 'packs' ? <PackSwitcher onClose={() => setPanel('none')} />
            : panel === 'saved' ? <SavedPanel onClose={() => setPanel('none')} />
            : app.navigating ? <NavigationPanel />
            : app.route ? <RoutePanel />
            : app.selected ? <PlaceCard />
            : app.pois.length > 0 ? <PoiResults />
            : <EmptyRail />}
        </div>
      </aside>

      {/* ---- Map ------------------------------------------------------- */}
      {/* min-h-0 + h-full: flex child must form a real containing block so
          absolute/100% map engines get non-zero height (blank map bug). */}
      <main className="relative min-h-0 min-w-0 h-full flex-1">
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

        {/* First-person Three.js car — WebGL mesh in the lower frame. */}
        {app.driving.status !== 'idle' && app.driving.status !== 'finished' && (
          <Suspense fallback={null}>
            <RaceCar3D
              lateral={app.driving.lateral ?? 0}
              speedMps={app.driving.speedMps ?? 0}
              active={app.driving.status === 'running'}
              lon={app.driving.lon}
              lat={app.driving.lat}
              heading={app.driving.heading}
            />
          </Suspense>
        )}

        {/* Race HUD — exclusive bottom strip; map controls clear it via --race-hud-h. */}
        {app.driving.status !== 'idle' && (
          <div
            ref={raceHudRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:justify-start md:p-4 md:pl-4 md:pr-24"
          >
            <div className="pointer-events-auto w-full max-w-md md:max-w-sm">
              <DrivingModePanel />
            </div>
          </div>
        )}

        {/* Collapsed desktop toolbar — hidden during race (map is immersive). */}
        {collapsed && !racing && (
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 hidden flex-col gap-2 md:flex">
            <div className="pointer-events-auto relative z-20 flex items-center gap-1 rounded-2xl border border-border/50 bg-background/95 p-1.5 shadow-lg backdrop-blur-md">
              <div className="min-w-0 flex-1"><SearchBar /></div>
              <RailControls panel={panel} toggle={toggle} compact />
            </div>
            <div className="pointer-events-auto relative z-10 w-fit max-w-full">
              <CategoryChips getCenter={() => activeMapViewport()?.center ?? null} />
            </div>
          </div>
        )}

        {/* Collapse handle — hide during race so it doesn't float mid-map. */}
        {!racing && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('sidebar-show') : t('sidebar-hide')}
            title={collapsed ? t('sidebar-show') : t('sidebar-hide')}
            className={cn(
              'absolute top-1/2 z-40 hidden h-12 w-5 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border/50 bg-background/95 text-muted-foreground shadow-md transition-[left,background-color,color] duration-300 ease-out hover:bg-accent hover:text-foreground md:flex',
              collapsed ? 'md:left-0' : 'md:left-[360px]',
            )}
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
        )}

        {/* Pick-start mode: clear top banner so users know to search or tap. */}
        {app.pickingStart && !racing && (
          <div
            className="pointer-events-none absolute left-[calc(50%+var(--left-chrome,0px)/2)] top-3 z-[36] flex -translate-x-1/2 px-3 md:top-4"
            role="status"
          >
            <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-primary/30 bg-background/95 px-3 py-2 text-[13px] font-medium shadow-lg backdrop-blur-md">
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">{t('route-pick-start')}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0"
                onClick={app.cancelPickStart}
                aria-label={t('close')}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {!racing && !app.pickingStart && <SearchAreaButton />}
        <MapControls racing={racing} />
      </main>

      <AuthModal />
      {/* Offset toasts below top chrome (search-area / status banners). */}
      <Toaster position="top-center" offset={64} gap={8} />
    </div>
  )
}

/** Quiet default state — hints without shouting. */
function EmptyRail() {
  const app = useApp()
  const t = useT()
  return (
    <div className="hidden h-full flex-col justify-end gap-2 px-1 pb-2 md:flex">
      <div className="rounded-xl bg-muted/40 px-3 py-3">
        <p className="text-sm font-medium tracking-tight text-foreground/90">
          {app.user ? t('welcome-back') : t('explore-map')}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {t('empty-hint')}
        </p>
      </div>
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
