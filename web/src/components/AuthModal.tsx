import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '../lib/api'
import { type TKey } from '../lib/i18n'
import { useT } from '../lib/useT'
import { useApp } from '../state'

const ERROR_KEY: Record<string, TKey> = {
  invalid_email: 'err-invalid-email',
  password_too_short: 'err-password-too-short',
  email_taken: 'err-email-taken',
  invalid_credentials: 'err-invalid-credentials',
  too_many_requests: 'err-too-many-requests',
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
  const t = useT()
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
      setError(t(ERROR_KEY[code] ?? 'err-unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-[380px]">
      <DialogHeader>
        <DialogTitle>{mode === 'login' ? t('sign-in') : t('create-account')}</DialogTitle>
        <DialogDescription>
          {t('auth-subtitle')}
        </DialogDescription>
      </DialogHeader>
      <Tabs value={mode} onValueChange={(v) => { setMode(v as 'login' | 'register'); setError('') }}>
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">{t('sign-in')}</TabsTrigger>
          <TabsTrigger value="register" className="flex-1">{t('register')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="auth-email">{t('email')}</Label>
          <Input
            id="auth-email" type="email" value={email} required
            autoComplete="email" autoFocus
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-password">{t('password')}</Label>
          <Input
            id="auth-password" type="password" value={password} required minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? '…' : mode === 'login' ? t('sign-in') : t('create-account')}
        </Button>
        {mode === 'register' && (
          <p className="text-center text-xs text-muted-foreground">
            {t('auth-more-options')}
          </p>
        )}
      </form>
    </DialogContent>
  )
}
