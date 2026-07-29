import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/** Keep a blank page from swallowing the whole shell after a map/provider crash. */
class RootErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[app] render crash', err, info.componentStack)
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          display: 'grid', placeItems: 'center', height: '100%', padding: 24,
          fontFamily: 'system-ui, sans-serif', textAlign: 'center', gap: 12,
        }}>
          <strong>Something went wrong</strong>
          <p style={{ maxWidth: 360, color: '#666', fontSize: 14 }}>
            The map UI crashed. Reload to continue.
          </p>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              padding: '10px 16px', borderRadius: 10, border: '1px solid #ccc',
              background: '#111', color: '#fff', cursor: 'pointer',
            }}
          >
            Reload
          </button>
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
