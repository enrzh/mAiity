import { AlertTriangle, Map as MapIcon, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '../lib/useT'
import { useApp } from '../state'

/** Recovery surface when a map provider fails to load (never leave a blank map). */
export function MapStatus({
  appleFailed,
  onRetryApple,
}: {
  appleFailed: boolean
  onRetryApple: () => void
}) {
  const app = useApp()
  const t = useT()
  if (!appleFailed && !app.packsError) return null

  if (appleFailed && app.mapProvider === 'apple') {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-3"
        style={{ paddingLeft: 'var(--left-chrome, 0px)' }}
        role="alert"
      >
        <div className="pointer-events-auto flex max-w-md flex-col gap-2 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            <span>{t('map-apple-failed')}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetryApple}>
              <RefreshCw className="size-3.5" /> {t('retry')}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => app.setMapProvider('custom')}
            >
              <MapIcon className="size-3.5" /> {t('map-switch-custom')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (app.packsError && app.mapProvider === 'custom' && app.packs.length === 0) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-3"
        style={{ paddingLeft: 'var(--left-chrome, 0px)' }}
        role="alert"
      >
        <div className="pointer-events-auto flex max-w-md flex-col gap-2 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            <span>{t('map-load-failed')}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void app.loadPacks()}>
              <RefreshCw className="size-3.5" /> {t('retry')}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => app.setMapProvider('apple')}
            >
              <MapIcon className="size-3.5" /> {t('map-switch-apple')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
