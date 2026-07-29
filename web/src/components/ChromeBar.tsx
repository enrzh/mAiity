import { Check, Globe, LogOut, Palette, Search, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  /** Compact floating bar (desktop collapsed / map overlay). */
  floating?: boolean
}

/**
 * iOS Maps-style chrome: [Saved] [Me] ········· [Search]
 * Liquid glass capsule — only shadcn Button + DropdownMenu.
 */
export function ChromeBar({ panel, onSaved, onPacks, onSearch, className, floating }: Props) {
  const app = useApp()
  const t = useT()

  return (
    <div
      className={cn(
        'maps-chrome-bar maps-glass-pill',
        floating && 'shadow-lg',
        className,
      )}
      role="toolbar"
      aria-label={t('explore-map')}
    >
      <Button
        type="button"
        variant={panel === 'saved' ? 'default' : 'ghost'}
        size="sm"
        className={cn(
          'h-10 gap-1.5 rounded-full px-3.5 font-semibold',
          panel === 'saved' && 'shadow-sm',
        )}
        onClick={onSaved}
        aria-pressed={panel === 'saved'}
      >
        <Star className={cn('size-4', panel === 'saved' && 'fill-current')} />
        <span className="max-w-[5.5rem] truncate">{t('chrome-saved')}</span>
      </Button>

      {/* Me — account / sign-in + language */}
      {app.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5 rounded-full px-3.5 font-semibold"
              aria-label={`${t('chrome-me')}: ${app.user.email ?? ''}`}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {(app.user.email ?? '?')[0].toUpperCase()}
              </span>
              <span className="max-w-[4.5rem] truncate">{t('chrome-me')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="maps-glass-strong w-56 rounded-2xl">
            <DropdownMenuLabel className="truncate">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5 rounded-full px-3.5 font-semibold"
              aria-label={t('chrome-me')}
            >
              <User className="size-4" />
              <span>{t('chrome-me')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="maps-glass-strong w-52 rounded-2xl">
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
                <Globe className="size-4 opacity-50" />
                <span className="flex-1">{label}</span>
                {app.lang === code && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="min-w-2 flex-1" aria-hidden />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-full"
        onClick={onSearch}
        aria-label={t('search')}
        title={t('search')}
      >
        <Search className="size-5" />
      </Button>
    </div>
  )
}
