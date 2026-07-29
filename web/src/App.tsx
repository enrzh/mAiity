import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Box, Car, ChevronLeft, ChevronRight, Crosshair, Minus, Plus, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { readSidebarCollapsed, writeSidebarCollapsed } from '@/lib/sidebarState'
import { AppProvider, useApp } from './state'
import { MapView, locateUser, railInset, set3D, zoomBy } from './components/MapView'
import { CategoryChips } from './components/CategoryChips'
import { activeMapViewport } from './maps/rendererController'
import { ChromeBar } from './components/ChromeBar'
import { SearchOverlay } from './components/SearchOverlay'
import { PlaceCard } from './components/PlaceCard'
import { PoiResults } from './components/PoiResults'
import { SearchAreaButton } from './components/SearchAreaButton'
import { RoutePanel } from './components/RoutePanel'
import { NavigationPanel } from './components/NavigationPanel'
import { SavedPanel } from './components/SavedPanel'
import { PackSwitcher } from './components/PackSwitcher'
import { DrivingModePanel } from './components/DrivingModePanel'
import { TrackCard } from './components/TrackCard'
const RaceCar3D = lazy(() =>
  import('./components/RaceCar3D').then((m) => ({ default: m.RaceCar3D })),
)
import { MapStatus } from './components/MapStatus'
import { AuthModal } from './components/AuthModal'
import { isPortraitViewport, setDrivingLandscape } from './lib/drivingOrientation'

type Panel = 'none' | 'saved' | 'packs'

/**
 * Liquid-glass iOS Maps shell.
 * Chrome: [Saved] [Me] ····· [Search]
 * Search expands to full-screen overlay; pick → shrink sheet + place/route track.
 */

type Detent = 'peek' | 'half' | 'full'
const DETENTS: Detent[] = ['peek', 'half', 'full']
function detentPx(d: Detent): number {
  // Peek: chrome bar only — map stays the hero.
  return d === 'peek' ? 88 : Math.round(window.innerHeight * (d === 'half' ? 0.4 : 0.88))
}

function MapControls({ racing }: { racing: boolean }) {
  const app = useApp()
  const t = useT()
  if (racing) {
    return (
      <div className="absolute bottom-[calc(var(--race-hud-h,12rem)+0.75rem)] right-3 z-30 hidden flex-col items-end gap-2 md:flex">
        <Button
          variant="secondary"
          className="maps-glass-pill size-10 rounded-full shadow-md"
          onClick={locateUser}
          aria-label={t('my-location')}
          title={t('my-location')}
        >
          <Crosshair className="size-4" />
        </Button>
        <div className="maps-glass-pill flex flex-col overflow-hidden rounded-2xl">
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
  const btn = 'maps-glass-pill size-11 rounded-full shadow-lg hover:bg-background/80'
  return (
    <div className="absolute bottom-[calc(var(--sheet-h,0px)+1rem)] right-3 z-20 flex flex-col items-end gap-2 transition-[bottom] duration-200 md:bottom-5 md:right-4">
      <Button
        variant={app.is3D ? 'default' : 'secondary'}
        className={cn(btn, app.is3D && 'bg-primary text-primary-foreground shadow-md')}
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
      {app.driving.status === 'idle' && (
        <Button
          variant="secondary"
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
      <Button variant="secondary" className={btn} onClick={locateUser} aria-label={t('my-location')} title={t('my-location')}>
        <Crosshair className="size-5" />
      </Button>
      <div className="maps-glass-pill flex flex-col overflow-hidden rounded-2xl shadow-lg">
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

function Shell() {
  const app = useApp()
  const t = useT()
  const [panel, setPanel] = useState<Panel>('none')
  const [searchOpen, setSearchOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed())
  const [appleFailed, setAppleFailed] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const railRef = useRef<HTMLElement>(null)
  const raceHudRef = useRef<HTMLDivElement>(null)
  const [sheetH, setSheetH] = useState(0)
  const [raceHudH, setRaceHudH] = useState(0)
  const [detent, setDetent] = useState<Detent>('peek')
  const [dragH, setDragH] = useState<number | null>(null)
  const dragFrom = useRef<{ y: number; h: number } | null>(null)

  const racing = app.driving.status === 'running'
    || app.driving.status === 'paused'
    || app.driving.status === 'finished'
  /** Full driving game session (incl. ready / countdown) — always landscape. */
  const drivingGame = app.driving.status !== 'idle'
  const [portraitWhileDriving, setPortraitWhileDriving] = useState(false)

  const hasDetail = !!(app.selected || app.route || app.navigating || app.pois.length > 0 || panel !== 'none')

  useEffect(() => writeSidebarCollapsed(collapsed), [collapsed])
  useEffect(() => {
    if (app.mapProvider !== 'apple') setAppleFailed(false)
  }, [app.mapProvider])

  // Driving game always prefers landscape (native + mobile web).
  useEffect(() => {
    setDrivingLandscape(drivingGame)
    if (!drivingGame) {
      setPortraitWhileDriving(false)
      return
    }
    const sync = () => setPortraitWhileDriving(isPortraitViewport())
    sync()
    const mq = window.matchMedia('(orientation: portrait)')
    const onChange = () => sync()
    mq.addEventListener('change', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('orientationchange', onChange)
      setDrivingLandscape(false)
    }
  }, [drivingGame])

  // / opens full-screen search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setSearchOpen(true)
        if (collapsed) setCollapsed(false)
        return
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); return }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-1); return }
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return }
        if (app.pickingStart) { app.cancelPickStart(); return }
        if (panel !== 'none') { setPanel('none'); return }
        if (app.driving.status === 'ready' || app.driving.status === 'finished') {
          app.exitDrivingMode()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, panel, searchOpen, app.driving.status, app.exitDrivingMode, app.pickingStart, app.cancelPickStart])

  const toggle = (p: Panel) => {
    if (collapsed) setCollapsed(false)
    setDetent((d) => (d === 'peek' ? 'half' : d))
    setPanel((cur) => (cur === p ? 'none' : p))
  }

  const openSearch = () => {
    setSearchOpen(true)
    setPanel('none')
  }

  /** After picking a search result — leave list mode, show map + detail sheet. */
  const onSearchPicked = () => {
    setSearchOpen(false)
    setPanel('none')
    setCollapsed(false)
    setDetent('half')
  }

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
    setDragH(null)
  }

  useEffect(() => {
    if (app.selected || app.route) setPanel('none')
  }, [app.selected, app.route])

  useEffect(() => {
    if (racing) return
    if (app.selected || app.route) setCollapsed(false)
  }, [app.selected, app.route, racing])

  useEffect(() => {
    if (app.pois.length > 0) { setPanel('none'); setCollapsed(false) }
  }, [app.pois])

  useEffect(() => {
    if (app.driving.status === 'running' || app.driving.status === 'paused' || app.driving.status === 'finished') {
      setPanel('none')
      setCollapsed(true)
      setDetent('peek')
      setSearchOpen(false)
    }
  }, [app.driving.status])

  // Place / route → shrink sheet to half (map visible above)
  useEffect(() => {
    if (racing || searchOpen) return
    if (app.selected || app.route || app.pois.length > 0) {
      setDetent((d) => (d === 'full' ? 'half' : d === 'peek' ? 'half' : d))
    }
  }, [app.selected, app.route, app.pois, racing, searchOpen])

  const [leftChrome, setLeftChrome] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => {
      const w = !mq.matches ? 0 : collapsed ? 0 : 380
      setLeftChrome(w)
      railInset.current = collapsed || !mq.matches || racing ? 0 : 380
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [collapsed, racing])

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const mq = window.matchMedia('(min-width: 768px)')
    const measure = () => {
      if (racing && !mq.matches) { setSheetH(0); return }
      setSheetH(mq.matches ? 0 : el.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    mq.addEventListener('change', measure)
    return () => { ro.disconnect(); mq.removeEventListener('change', measure) }
  }, [racing, detent, hasDetail])

  useEffect(() => {
    const el = raceHudRef.current
    if (!el || app.driving.status === 'idle') { setRaceHudH(0); return }
    const measure = () => setRaceHudH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [app.driving.status, app.driving.progress])

  const bodyContent = panel === 'packs' ? <PackSwitcher onClose={() => setPanel('none')} />
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
    : <EmptyRail />

  return (
    <div
      className={cn('relative flex h-full min-h-0 overflow-hidden bg-muted/20', racing && 'maps-shell--racing')}
      style={{
        '--sheet-h': `${racing ? 0 : sheetH}px`,
        '--left-chrome': `${leftChrome}px`,
        '--race-hud-h': `${raceHudH}px`,
      } as React.CSSProperties}
    >
      {/* ---- Liquid glass sheet ---------------------------------------- */}
      <aside
        ref={railRef}
        style={{ '--detent-h': `${dragH ?? detentPx(detent)}px` } as React.CSSProperties}
        className={cn(
          'maps-sheet maps-glass absolute inset-x-0 bottom-0 z-30 flex h-[var(--detent-h)] flex-col gap-2.5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl',
          dragH === null && 'transition-[height,transform,opacity] duration-300 ease-[var(--ease-ios)]',
          'md:absolute md:inset-y-3 md:left-3 md:right-auto md:h-auto md:max-h-[calc(100%-1.5rem)] md:w-[380px] md:gap-3 md:rounded-[1.75rem] md:border md:p-4',
          'md:transition-transform md:duration-300 md:ease-[var(--ease-ios)] md:will-change-transform',
          collapsed ? 'md:-translate-x-[120%]' : 'md:translate-x-0',
          racing && 'max-md:pointer-events-none max-md:translate-y-full max-md:opacity-0',
        )}
        aria-hidden={racing ? true : undefined}
      >
        <div
          className="-mb-1 -mt-1 flex shrink-0 cursor-grab touch-none justify-center py-1.5 active:cursor-grabbing md:hidden"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-hidden
        >
          <div className="maps-sheet__grabber" />
        </div>

        {/* Compact chrome: Saved · Me · Search */}
        <ChromeBar
          panel={panel}
          onSaved={() => toggle('saved')}
          onPacks={() => toggle('packs')}
          onSearch={openSearch}
        />

        {/* Categories only when not in dense detail mode */}
        {!app.route && !app.navigating && panel === 'none' && (
          <div className={cn(detent === 'peek' && 'max-md:hidden')}>
            <CategoryChips getCenter={() => activeMapViewport()?.center ?? null} />
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 overscroll-contain',
            detent === 'peek' && !hasDetail
              ? 'overflow-y-hidden max-md:hidden md:overflow-y-auto'
              : 'overflow-y-auto',
          )}
        >
          {bodyContent}
        </div>
      </aside>

      {/* ---- Map ------------------------------------------------------- */}
      <main className="relative min-h-0 h-full min-w-0 flex-1">
        <MapView key={mapKey} onAppleFailed={() => setAppleFailed(true)} />
        <MapStatus
          appleFailed={appleFailed}
          onRetryApple={() => {
            setAppleFailed(false)
            setMapKey((k) => k + 1)
          }}
        />

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

        {/* Desktop collapsed: floating glass chrome */}
        {collapsed && !racing && (
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 hidden flex-col gap-2 md:flex">
            <div className="pointer-events-auto w-full max-w-md">
              <ChromeBar
                floating
                panel={panel}
                onSaved={() => { setCollapsed(false); toggle('saved') }}
                onPacks={() => { setCollapsed(false); toggle('packs') }}
                onSearch={() => { setCollapsed(false); openSearch() }}
              />
            </div>
          </div>
        )}

        {!racing && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('sidebar-show') : t('sidebar-hide')}
            title={collapsed ? t('sidebar-show') : t('sidebar-hide')}
            className={cn(
              'maps-glass-pill absolute top-1/2 z-40 hidden h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r-2xl text-muted-foreground transition-[left] duration-300 ease-[var(--ease-ios)] hover:text-foreground md:flex',
              collapsed ? 'md:left-0' : 'md:left-[calc(0.75rem+380px)]',
            )}
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
        )}

        {app.pickingStart && !racing && (
          <div
            className="pointer-events-none absolute left-[calc(50%+var(--left-chrome,0px)/2)] top-3 z-[36] flex -translate-x-1/2 px-3 md:top-4"
            role="status"
          >
            <div className="maps-glass-pill pointer-events-auto flex max-w-md items-center gap-2 px-3 py-2 text-[13px] font-medium">
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">{t('route-pick-start')}</span>
              <Button type="button" variant="ghost" size="icon-sm" className="size-7 shrink-0 rounded-full" onClick={app.cancelPickStart} aria-label={t('close')}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {!racing && !app.pickingStart && <SearchAreaButton />}
        <MapControls racing={racing} />
      </main>

      {/* Rotate to landscape when the browser cannot force orientation. */}
      {drivingGame && portraitWhileDriving && (
        <div
          className="maps-rotate-prompt"
          role="status"
          aria-live="polite"
        >
          <div className="maps-rotate-prompt__card maps-glass-strong">
            <Car className="size-8 text-primary" aria-hidden />
            <p className="maps-rotate-prompt__title">{t('drive-rotate-title')}</p>
            <p className="maps-rotate-prompt__body">{t('drive-rotate-hint')}</p>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} onPicked={onSearchPicked} />
      <AuthModal />
      <Toaster position="top-center" offset={64} gap={8} />
    </div>
  )
}

function EmptyRail() {
  const app = useApp()
  const t = useT()
  return (
    <div className="hidden h-full flex-col justify-end gap-2 px-1 pb-2 md:flex">
      <div className="maps-glass-pill rounded-2xl px-3.5 py-3.5">
        <p className="text-sm font-semibold tracking-tight text-foreground/90">
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
