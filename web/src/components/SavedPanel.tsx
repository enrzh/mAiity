import { Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '../lib/useT'
import { useApp } from '../state'

/// Floating list of saved places. Click → jump; trash → optimistic delete.
export function SavedPanel({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const t = useT()

  return (
    <Card className="gap-2 border-border/60 py-4 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardTitle className="text-base">{t('saved-places')}</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')}>
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-3">
        {!app.user ? (
          <div className="space-y-3 p-2 text-center text-sm text-muted-foreground">
            <p>{t('saved-signin-hint')}</p>
            <Button onClick={() => { onClose(); app.setAuthOpen(true) }}>{t('sign-in')}</Button>
          </div>
        ) : app.bookmarksStatus === 'loading' ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : app.bookmarksStatus === 'error' ? (
          <div className="space-y-3 p-2 text-center text-sm text-muted-foreground">
            <p>{t('saved-load-failed')}</p>
            <Button onClick={() => app.loadBookmarks()}>{t('retry')}</Button>
          </div>
        ) : app.bookmarks.length === 0 ? (
          <p className="p-2 text-center text-sm text-muted-foreground">
            {t('saved-empty')}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {app.bookmarks.map((b) => (
              <li key={b.id} className="flex items-center gap-1">
                <button
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent"
                  onClick={() => { app.select({ name: b.name, label: b.note || b.name, lat: b.lat, lon: b.lon }); onClose() }}
                >
                  <Star className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {b.lat.toFixed(4)}, {b.lon.toFixed(4)}
                  </span>
                </button>
                <Button
                  variant="ghost" size="icon-sm"
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
      </CardContent>
    </Card>
  )
}
