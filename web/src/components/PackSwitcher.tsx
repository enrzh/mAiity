import { useState } from 'react'
import { Check, Palette, Plus, Trash2, X } from 'lucide-react'
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
import { useApp } from '../state'
import { PackEditor } from './PackEditor'

/// The signature feature: swap the whole map look with one tap — and install
/// your own packs (URL to a style.json, or paste the style itself).
export function PackSwitcher({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const [installOpen, setInstallOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <>
      <Card className="gap-2 border-border/60 py-4 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <CardTitle className="text-base">Karten-Stil</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Schließen">
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="px-3">
          {app.packs.length === 0 ? (
            <div className="space-y-3 p-2 text-center text-sm text-muted-foreground">
              <p>{app.packsError ? 'Stile konnten nicht geladen werden.' : 'Lade Stile …'}</p>
              {app.packsError && <Button onClick={() => app.loadPacks()}>Erneut versuchen</Button>}
            </div>
          ) : (
            <ul className="space-y-2">
              {app.packs.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-3 rounded-xl border-2 bg-muted/40 px-3 py-2.5 text-left hover:bg-accent',
                      app.activePack === p.id ? 'border-primary bg-accent' : 'border-transparent',
                    )}
                    aria-pressed={app.activePack === p.id}
                    onClick={() => app.setActivePack(p.id)}
                  >
                    {p.preview?.colors?.length ? (
                      <span className="flex gap-1" aria-hidden="true">
                        {p.preview.colors.slice(0, 3).map((c) => (
                          <span key={c} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                        ))}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="px-1.5 text-[10px]">Eigenes</Badge>
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
                      aria-label={`${p.name} entfernen`}
                      onClick={() => app.removePack(p.id).catch(() => toast.error('Entfernen fehlgeschlagen.'))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline" className="flex-1"
              onClick={() => {
                if (!app.user) { onClose(); app.setAuthOpen(true); return }
                setEditorOpen(true)
              }}
            >
              <Palette className="size-4" /> Erstellen
            </Button>
            <Button
              variant="outline" className="flex-1"
              onClick={() => {
                if (!app.user) { onClose(); app.setAuthOpen(true); return }
                setInstallOpen(true)
              }}
            >
              <Plus className="size-4" /> Installieren
            </Button>
          </div>
        </CardContent>
      </Card>
      <InstallDialog open={installOpen} onOpenChange={setInstallOpen} />
      <PackEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </>
  )
}

function InstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useApp()
  const [tab, setTab] = useState<'url' | 'json'>('url')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [json, setJson] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ERROR_TEXT: Record<string, string> = {
    invalid_name: 'Bitte einen Namen (max. 60 Zeichen) angeben.',
    invalid_url: 'Die URL ist ungültig.',
    url_must_be_https: 'Nur https-URLs sind erlaubt.',
    style_not_json: 'Das ist kein gültiges JSON.',
    style_version_must_be_8: 'Der Style muss "version": 8 haben (MapLibre Style Spec).',
    style_layers_missing: 'Dem Style fehlt das "layers"-Array.',
    style_sources_missing: 'Dem Style fehlt das "sources"-Objekt.',
    style_too_large: 'Der Style ist zu groß (max. 512 KB).',
    pack_limit_reached: 'Maximal 20 eigene Packs.',
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
      toast.success('Pack installiert und aktiviert.')
      onOpenChange(false)
      setName(''); setUrl(''); setJson('')
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'unknown'
      setError(ERROR_TEXT[code] ?? 'Installation fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setBusy(false)
    }
  }

  const valid = name.trim().length > 0 && (tab === 'url' ? url.trim().startsWith('https://') : json.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Texture-Pack installieren</DialogTitle>
          <DialogDescription>
            Ein Pack ist ein MapLibre-Style (style.json) — per URL oder direkt eingefügt.
            Es wird mit deinem Konto synchronisiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pack-name">Name</Label>
            <Input id="pack-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="z. B. Neon Nights" />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'json')}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1">Von URL</TabsTrigger>
              <TabsTrigger value="json" className="flex-1">JSON einfügen</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'url' ? (
            <div className="space-y-2">
              <Label htmlFor="pack-url">Style-URL (https)</Label>
              <Input id="pack-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/style.json" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pack-json">style.json Inhalt</Label>
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
            Hinweis: Packs können externe Kacheln/Schriften laden. Installiere nur Styles aus Quellen, denen du vertraust.
          </p>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button className="w-full" disabled={busy || !valid} onClick={submit}>
            {busy ? '…' : 'Installieren'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
