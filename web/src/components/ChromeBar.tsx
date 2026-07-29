import { Check, Globe, LogOut, Palette, Search, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChromeRow } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { useApp } from '../state'

const LANGS: Array<[string, string]> = [
  ['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'],
]

type Panel = 'none' | 'saved' | 'packs'

type Props = {
  panel: Panel
  onSaved: () => void
  onPacks?: () => void
  onSearch: () => void
  className?: string
  floating?: boolean
}

/** Compact chrome: Saved · Me ····· Search — unified Surface + Button only. */
export function ChromeBar({ panel, onSaved, onPacks, onSearch, className, floating }: Props) {
  const app = useApp()
  const t = useT()

  return (
    <ChromeRow className={cn(floating && 'shadow-md', className)} aria-label={t('explore-map')}>
      <Button
        type="button"
        variant={panel === 'saved' ? 'default' : 'ghost'}
        size="sm"
        className="gap-1.5 font-medium"
        onClick={onSaved}
        aria-pressed={panel === 'saved'}
      >
        <Star className={cn('size-3.5', panel === 'saved' && 'fill-current')} />
        <span className="max-w-[5rem] truncate">{t('chrome-saved')}</span>
      </Button>

      {app.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 font-medium"
              aria-label={`${t('chrome-me')}: ${app.user.email ?? ''}`}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {(app.user.email ?? '?')[0].toUpperCase()}
              </span>
              <span className="max-w-[4rem] truncate">{t('chrome-me')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 rounded-2xl border-border/50 bg-popover/95 backdrop-blur-xl">
            <DropdownMenuLabel className="truncate font-medium">
              {app.user.displayName ?? app.user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onPacks && (
              <DropdownMenuItem onClick={onPacks}>
                <Palette className="size-4" /> {t('map-style')}
              </DropdownMenuItem>
            )}
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
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 font-medium" aria-label={t('chrome-me')}>
              <User className="size-3.5" />
              <span>{t('chrome-me')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 rounded-2xl border-border/50 bg-popover/95 backdrop-blur-xl">
            <DropdownMenuItem onClick={() => app.setAuthOpen(true)}>
              <User className="size-4" /> {t('sign-in')}
            </DropdownMenuItem>
            {onPacks && (
              <DropdownMenuItem onClick={onPacks}>
                <Palette className="size-4" /> {t('map-style')}
              </DropdownMenuItem>
            )}
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

      <div className="min-w-1 flex-1" aria-hidden />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        onClick={onSearch}
        aria-label={t('search')}
        title={t('search')}
      >
        <Search className="size-4" />
      </Button>
    </ChromeRow>
  )
}
