import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '../lib/api'
import { useApp } from '../state'

/// Create a texture pack with color pickers — no JSON knowledge needed.
/// Takes the Light pack as the template, recolors its semantic slots, and
/// installs the result as a personal pack (same pipeline as URL/JSON install).

interface Slots {
  wasser: string
  land: string
  gruen: string
  strassen: string
  gebaeude: string
  schrift: string
}

const DEFAULTS: Slots = {
  wasser: '#a5cae8',
  land: '#eae7df',
  gruen: '#d6e6c3',
  strassen: '#ffffff',
  gebaeude: '#e4dfd4',
  schrift: '#3d3d3d',
}

const SLOT_LABELS: Record<keyof Slots, string> = {
  wasser: 'Wasser',
  land: 'Land',
  gruen: 'Grünflächen',
  strassen: 'Straßen',
  gebaeude: 'Gebäude',
  schrift: 'Beschriftung',
}

/** Lighten (f>0) or darken (f<0) a #rrggbb color. */
function shade(hex: string, f: number): string {
  const v = parseInt(hex.slice(1), 16)
  const ch = (x: number) => {
    const n = f < 0 ? x * (1 + f) : x + (255 - x) * f
    return Math.round(Math.min(255, Math.max(0, n)))
  }
  const r = ch((v >> 16) & 255), g = ch((v >> 8) & 255), b = ch(v & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16)
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255
}

/** Recolor the template style's known layers from the slot colors. */
function applySlots(base: unknown, s: Slots): unknown {
  const style = JSON.parse(JSON.stringify(base)) as {
    name?: string
    metadata?: Record<string, unknown>
    layers: Array<{ id: string; type: string; paint?: Record<string, unknown> }>
  }
  const halo = luminance(s.land) > 0.5 ? '#ffffff' : shade(s.land, -0.6)
  for (const layer of style.layers) {
    layer.paint = layer.paint ?? {}
    switch (layer.id) {
      case 'background': layer.paint['background-color'] = s.wasser; break
      case 'water': layer.paint['fill-color'] = s.wasser; break
      case 'earth': layer.paint['fill-color'] = s.land; delete layer.paint['fill-pattern']; break
      case 'landcover':
      case 'landuse': layer.paint['fill-color'] = s.gruen; break
      case 'roads': layer.paint['line-color'] = s.strassen; break
      case 'roads-casing': layer.paint['line-color'] = shade(s.strassen, -0.25); break
      case 'buildings':
        layer.paint['fill-color'] = s.gebaeude
        layer.paint['fill-outline-color'] = shade(s.gebaeude, -0.2)
        delete layer.paint['fill-pattern']
        break
      case 'places-labels':
        layer.paint['text-color'] = s.schrift
        layer.paint['text-halo-color'] = halo
        break
    }
  }
  style.metadata = { ...(style.metadata ?? {}), 'maps:pack': 'custom-editor' }
  return style
}

export function PackEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useApp()
  const [name, setName] = useState('')
  const [slots, setSlots] = useState<Slots>(DEFAULTS)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof Slots) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSlots((cur) => ({ ...cur, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    try {
      // Template: the Light pack (known layer structure).
      const res = await fetch('/maps/packs/light/style.json')
      const base = await res.json()
      const styled = applySlots(base, slots)
      await app.installPack({ name: name.trim(), styleJson: JSON.stringify(styled) })
      toast.success('Pack erstellt und aktiviert.')
      onOpenChange(false)
      setName('')
      setSlots(DEFAULTS)
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'unknown'
      toast.error(code === 'pack_limit_reached' ? 'Maximal 20 eigene Packs.' : 'Erstellen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Eigenes Pack erstellen</DialogTitle>
          <DialogDescription>
            Farben wählen — fertig ist dein Texture-Pack. Es wird mit deinem Konto synchronisiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editor-name">Name</Label>
            <Input id="editor-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mitternacht" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(SLOT_LABELS) as Array<keyof Slots>).map((k) => (
              <label key={k} className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3 py-2">
                <input
                  type="color"
                  value={slots[k]}
                  onChange={set(k)}
                  className="size-8 shrink-0 cursor-pointer appearance-none rounded-lg border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/10"
                  aria-label={SLOT_LABELS[k]}
                />
                <span className="text-sm font-medium">{SLOT_LABELS[k]}</span>
              </label>
            ))}
          </div>
          {/* Mini preview strip */}
          <div className="overflow-hidden rounded-xl border" aria-hidden="true">
            <div className="flex h-12">
              <div className="flex-1" style={{ background: slots.wasser }} />
              <div className="flex-[2] relative" style={{ background: slots.land }}>
                <div className="absolute inset-y-0 left-1/4 w-1.5 rotate-12" style={{ background: slots.strassen }} />
                <div className="absolute bottom-1 right-2 size-5 rounded-sm" style={{ background: slots.gebaeude }} />
                <div className="absolute left-2 top-1 h-4 w-6 rounded-full" style={{ background: slots.gruen }} />
                <span className="absolute bottom-0.5 left-2 text-[9px] font-bold" style={{ color: slots.schrift }}>Berlin</span>
              </div>
            </div>
          </div>
          <Button className="w-full" disabled={busy || !name.trim()} onClick={submit}>
            {busy ? '…' : 'Erstellen und aktivieren'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
