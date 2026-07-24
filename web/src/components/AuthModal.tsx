import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '../lib/api'
import { useApp } from '../state'

const ERROR_TEXT: Record<string, string> = {
  invalid_email: 'Bitte eine gültige E-Mail-Adresse eingeben.',
  password_too_short: 'Passwort muss mindestens 8 Zeichen haben.',
  email_taken: 'Diese E-Mail ist bereits registriert.',
  invalid_credentials: 'E-Mail oder Passwort ist falsch.',
  too_many_requests: 'Zu viele Versuche — bitte kurz warten.',
}

/// Radix Dialog: focus trap, Escape and unmount-on-close come for free.
export function AuthModal() {
  const app = useApp()
  return (
    <Dialog open={app.authOpen} onOpenChange={app.setAuthOpen}>
      {app.authOpen && <AuthDialogContent />}
    </Dialog>
  )
}

function AuthDialogContent() {
  const app = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await app.login(email, password)
      else await app.register(email, password)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'unknown'
      setError(ERROR_TEXT[code] ?? 'Etwas ist schiefgelaufen — bitte erneut versuchen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-[380px]">
      <DialogHeader>
        <DialogTitle>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</DialogTitle>
        <DialogDescription>
          Orte speichern und auf allen Geräten synchronisieren.
        </DialogDescription>
      </DialogHeader>
      <Tabs value={mode} onValueChange={(v) => { setMode(v as 'login' | 'register'); setError('') }}>
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">Anmelden</TabsTrigger>
          <TabsTrigger value="register" className="flex-1">Registrieren</TabsTrigger>
        </TabsList>
      </Tabs>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="auth-email">E-Mail</Label>
          <Input
            id="auth-email" type="email" value={email} required
            autoComplete="email" autoFocus
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-password">Passwort</Label>
          <Input
            id="auth-password" type="password" value={password} required minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </Button>
        {mode === 'register' && (
          <p className="text-center text-xs text-muted-foreground">
            Weitere Anmelde-Optionen (Apple, Google) folgen in der App.
          </p>
        )}
      </form>
    </DialogContent>
  )
}
