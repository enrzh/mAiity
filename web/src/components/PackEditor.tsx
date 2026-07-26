import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '../lib/api'
import { type TKey } from '../lib/i18n'
import { useT } from '../lib/useT'
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

const SLOT_LABELS: Record<keyof Slots, TKey> = {
  wasser: 'slot-water',
  land: 'slot-land',
  gruen: 'slot-green',
  strassen: 'slot-roads',
  gebaeude: 'slot-buildings',
  schrift: 'slot-labels',
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
      // Land tone, NOT water — background shows through whenever a tile
      // hasn't finished painting yet (streaming in new tiles, a pan gap),
      // so a water-colored backdrop made every loading gap look flooded.
      case 'background': layer.paint['background-color'] = s.land; break
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
      case 'buildings-3d':
        // Keep the height ramp, recoloured: taller reads lighter.
        layer.paint['fill-extrusion-color'] = [
          'interpolate', ['linear'],
          ['case', ['has', 'height'], ['get', 'height'], 8],
          0, s.gebaeude, 60, shade(s.gebaeude, 0.25),
        ]
        delete layer.paint['fill-extrusion-pattern']
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
  const t = useT()
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
      if (!res.ok) throw new Error(`template ${res.status}`)
      const base = await res.json()
      if (!Array.isArray((base as { layers?: unknown })?.layers)) throw new Error('template invalid')
      const styled = applySlots(base, slots)
      await app.installPack({ name: name.trim(), styleJson: JSON.stringify(styled) })
      toast.success(t('pack-created'))
      onOpenChange(false)
      setName('')
      setSlots(DEFAULTS)
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'unknown'
      toast.error(code === 'pack_limit_reached' ? t('err-pack-limit') : t('pack-create-failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('pack-editor-title')}</DialogTitle>
          <DialogDescription>
            {t('pack-editor-subtitle')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editor-name">{t('name')}</Label>
            <Input id="editor-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t('pack-editor-name-placeholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(SLOT_LABELS) as Array<keyof Slots>).map((k) => (
              <label key={k} className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3 py-2">
                <input
                  type="color"
                  value={slots[k]}
                  onChange={set(k)}
                  className="size-8 shrink-0 cursor-pointer appearance-none rounded-lg border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/10"
                  aria-label={t(SLOT_LABELS[k])}
                />
                <span className="text-sm font-medium">{t(SLOT_LABELS[k])}</span>
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
            {busy ? '…' : t('pack-create-activate')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
