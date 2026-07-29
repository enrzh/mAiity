import { Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '../lib/useT'
import { useApp } from '../state'

/// Saved places list — flat (no nested card) so the rail stays one surface.
export function SavedPanel({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const t = useT()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t('saved-places')}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')}>
          <X className="size-4" />
        </Button>
      </div>

      {!app.user ? (
        <div className="space-y-3 rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
          <p>{t('saved-signin-hint')}</p>
          <Button onClick={() => { onClose(); app.setAuthOpen(true) }}>{t('sign-in')}</Button>
        </div>
      ) : app.bookmarksStatus === 'loading' ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : app.bookmarksStatus === 'error' ? (
        <div className="space-y-3 rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
          <p>{t('saved-load-failed')}</p>
          <Button onClick={() => app.loadBookmarks()}>{t('retry')}</Button>
        </div>
      ) : app.bookmarks.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
          {t('saved-empty')}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {app.bookmarks.map((b) => (
            <li key={b.id} className="flex items-center gap-1">
              <button
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent"
                onClick={() => {
                  app.select({ name: b.name, label: b.note || b.name, lat: b.lat, lon: b.lon })
                  onClose()
                }}
              >
                <Star className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground/60 hover:text-destructive"
                disabled={app.pendingDeletes.has(b.id)}
                onClick={() => { void app.removeBookmark(b.id) }}
                aria-label={`${b.name} ${t('delete')}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
