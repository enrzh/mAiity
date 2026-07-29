import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const PREFS_KEY = 'maps.preferences.v1'

function forceCustomMapsAndReload() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    const prefs = raw ? JSON.parse(raw) : {}
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      version: 1,
      provider: 'custom',
      customPackId: typeof prefs.customPackId === 'string' && prefs.customPackId ? prefs.customPackId : 'dark',
      appleMapType: prefs.appleMapType ?? 'standard',
      appleColorScheme: prefs.appleColorScheme ?? 'adaptive',
      appleOverlayTone: prefs.appleOverlayTone ?? 'none',
    }))
  } catch {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        version: 1,
        provider: 'custom',
        customPackId: 'dark',
        appleMapType: 'standard',
        appleColorScheme: 'adaptive',
        appleOverlayTone: 'none',
      }))
    } catch { /* ignore */ }
  }
  location.reload()
}

/** Keep a blank page from swallowing the whole shell after a map/provider crash. */
class RootErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[app] render crash', err, info.componentStack)
  }
  render() {
    if (this.state.err) {
      const detail = this.state.err.message ? String(this.state.err.message).slice(0, 160) : ''
      return (
        <div style={{
          display: 'grid', placeItems: 'center', height: '100%', padding: 24,
          fontFamily: 'system-ui, sans-serif', textAlign: 'center', gap: 12,
        }}>
          <strong>Something went wrong</strong>
          <p style={{ maxWidth: 360, color: '#666', fontSize: 14 }}>
            The map UI crashed. Reload to continue, or switch to custom map styles.
          </p>
          {detail && (
            <p style={{ maxWidth: 420, color: '#999', fontSize: 12, wordBreak: 'break-word' }}>
              {detail}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => location.reload()}
              style={{
                padding: '10px 16px', borderRadius: 10, border: '1px solid #ccc',
                background: '#fff', color: '#111', cursor: 'pointer',
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={forceCustomMapsAndReload}
              style={{
                padding: '10px 16px', borderRadius: 10, border: '1px solid #111',
                background: '#111', color: '#fff', cursor: 'pointer',
              }}
            >
              Use custom maps
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
