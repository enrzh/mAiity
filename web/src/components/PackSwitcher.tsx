import { useState } from 'react'
import { Check, Layers3, Map, Palette, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ApiError } from '../lib/api'
import { type TKey } from '../lib/i18n'
import { useT } from '../lib/useT'
import { useApp } from '../state'
import { PackEditor } from './PackEditor'

/// The signature feature: swap the whole map look with one tap — and install
/// your own packs (URL to a style.json, or paste the style itself).
export function PackSwitcher({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const t = useT()
  const [installOpen, setInstallOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <>
      <Card className="gap-2 border-border/60 py-4 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <CardTitle className="text-base">{t('map-style')}</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('close')}>
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 px-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={app.mapProvider === 'apple' ? 'default' : 'outline'}
              onClick={() => {
                app.setMapProvider('apple')
                // Apple appearance options stay open for type/tone; only pack
                // picks auto-close (see texture buttons below).
              }}
            >
              <Map className="size-4" /> Apple Maps
            </Button>
            <Button
              variant={app.mapProvider === 'custom' ? 'default' : 'outline'}
              onClick={() => app.setMapProvider('custom')}
            >
              <Layers3 className="size-4" /> {app.lang === 'de' ? 'Eigene Stile' : 'Custom styles'}
            </Button>
          </div>

          {app.mapProvider === 'apple' ? (
            <div className="space-y-4">
              <OptionGroup
                label={app.lang === 'de' ? 'Kartentyp' : 'Map type'}
                value={app.mapPreferences.appleMapType}
                options={[
                  ['standard', app.lang === 'de' ? 'Standard' : 'Standard'],
                  ['muted', app.lang === 'de' ? 'Dezent' : 'Muted'],
                  ['satellite', app.lang === 'de' ? 'Satellit' : 'Satellite'],
                  ['hybrid', 'Hybrid'],
                ]}
                onChange={(appleMapType) => app.setAppleAppearance({ appleMapType: appleMapType as typeof app.mapPreferences.appleMapType })}
              />
              <OptionGroup
                label={app.lang === 'de' ? 'Darstellung' : 'Appearance'}
                value={app.mapPreferences.appleColorScheme}
                options={[
                  ['adaptive', app.lang === 'de' ? 'Automatisch' : 'Automatic'],
                  ['light', app.lang === 'de' ? 'Hell' : 'Light'],
                  ['dark', app.lang === 'de' ? 'Dunkel' : 'Dark'],
                ]}
                onChange={(appleColorScheme) => app.setAppleAppearance({ appleColorScheme: appleColorScheme as typeof app.mapPreferences.appleColorScheme })}
              />
              <OptionGroup
                label={app.lang === 'de' ? 'Farbton' : 'Tone'}
                value={app.mapPreferences.appleOverlayTone}
                options={[
                  ['none', app.lang === 'de' ? 'Original' : 'Original'],
                  ['cool', app.lang === 'de' ? 'Kühl' : 'Cool'],
                  ['warm', app.lang === 'de' ? 'Warm' : 'Warm'],
                  ['reduced-color', app.lang === 'de' ? 'Reduziert' : 'Reduced'],
                ]}
                onChange={(appleOverlayTone) => app.setAppleAppearance({ appleOverlayTone: appleOverlayTone as typeof app.mapPreferences.appleOverlayTone })}
              />
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                {app.lang === 'de'
                  ? 'Apple-Kartendaten bleiben interaktiv. Eigene Vollstile sind technisch nur im eigenen Kartenmodus möglich.'
                  : 'Apple map data stays interactive. Full custom styling is available only with the custom renderer.'}
              </p>
            </div>
          ) : app.packs.filter((pack) => pack.id !== 'light').length === 0 ? (
            <div className="space-y-3 p-2 text-center text-sm text-muted-foreground">
              <p>{app.packsError ? t('styles-load-failed') : t('styles-loading')}</p>
              {app.packsError && <Button onClick={() => app.loadPacks()}>{t('retry')}</Button>}
            </div>
          ) : (
            <ul className="space-y-2">
              {app.packs.filter((pack) => pack.id !== 'light').map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-3 rounded-xl border-2 bg-muted/40 px-3 py-2.5 text-left hover:bg-accent',
                      app.activePack === p.id ? 'border-primary bg-accent' : 'border-transparent',
                    )}
                    aria-pressed={app.activePack === p.id}
                    onClick={() => {
                      app.setActivePack(p.id)
                      // Choosing a texture pack is a complete action — return to
                      // the route/place rail so packs and driving don't stack.
                      onClose()
                    }}
                  >
                    {p.preview?.colors?.length ? (
                      <span className="flex gap-1" aria-hidden="true">
                        {p.preview.colors.slice(0, 3).map((c) => (
                          <span key={c} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                        ))}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="px-1.5 text-[10px]">{t('badge-custom')}</Badge>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{p.description}</span>
                    </span>
                    {app.activePack === p.id && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                  {p.custom && (
                    <Button
                      variant="ghost" size="icon-sm"
                      className="text-muted-foreground/60 hover:text-destructive"
                      aria-label={`${p.name} ${t('remove')}`}
                      onClick={() => app.removePack(p.id).catch(() => toast.error(t('pack-remove-failed')))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {app.mapProvider === 'custom' && <div className="flex gap-2">
            <Button
              variant="outline" className="flex-1"
              onClick={() => {
                if (!app.user) { onClose(); app.setAuthOpen(true); return }
                setEditorOpen(true)
              }}
            >
              <Palette className="size-4" /> {t('create')}
            </Button>
            <Button
              variant="outline" className="flex-1"
              onClick={() => {
                if (!app.user) { onClose(); app.setAuthOpen(true); return }
                setInstallOpen(true)
              }}
            >
              <Plus className="size-4" /> {t('install')}
            </Button>
          </div>}
        </CardContent>
      </Card>
      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} />
      <PackEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </>
  )
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map(([id, text]) => (
          <Button
            key={id}
            type="button"
            variant={value === id ? 'default' : 'outline'}
            className="min-w-0 justify-center"
            onClick={() => onChange(id)}
          >
            <span className="truncate">{text}</span>
          </Button>
        ))}
      </div>
    </fieldset>
  )
}

function InstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useApp()
  const t = useT()
  const [tab, setTab] = useState<'url' | 'json'>('url')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [json, setJson] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ERROR_KEY: Record<string, TKey> = {
    invalid_name: 'err-invalid-name',
    invalid_url: 'err-invalid-url',
    url_must_be_https: 'err-url-https',
    style_not_json: 'err-style-not-json',
    style_version_must_be_8: 'err-style-version',
    style_layers_missing: 'err-style-layers',
    style_sources_missing: 'err-style-sources',
    style_too_large: 'err-style-too-large',
    pack_limit_reached: 'err-pack-limit',
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await app.installPack(
        tab === 'url'
          ? { name: name.trim(), styleUrl: url.trim() }
          : { name: name.trim(), styleJson: json },
      )
      toast.success(t('pack-installed'))
      onOpenChange(false)
      setName(''); setUrl(''); setJson('')
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'unknown'
      setError(t(ERROR_KEY[code] ?? 'pack-install-failed'))
    } finally {
      setBusy(false)
    }
  }

  const valid = name.trim().length > 0 && (tab === 'url' ? url.trim().startsWith('https://') : json.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('pack-install-title')}</DialogTitle>
          <DialogDescription>
            {t('pack-install-subtitle')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pack-name">{t('name')}</Label>
            <Input id="pack-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t('pack-install-name-placeholder')} />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'json')}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1">{t('tab-from-url')}</TabsTrigger>
              <TabsTrigger value="json" className="flex-1">{t('tab-paste-json')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'url' ? (
            <div className="space-y-2">
              <Label htmlFor="pack-url">{t('style-url-label')}</Label>
              <Input id="pack-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/style.json" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pack-json">{t('style-json-label')}</Label>
              <textarea
                id="pack-json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder='{"version": 8, "sources": { … }, "layers": [ … ]}'
                className="h-36 w-full resize-none rounded-md border bg-transparent p-2.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t('pack-install-hint')}
          </p>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button className="w-full" disabled={busy || !valid} onClick={submit}>
            {busy ? '…' : t('install')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
