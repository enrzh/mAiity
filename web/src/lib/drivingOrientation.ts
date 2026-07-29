/**
 * Prefer landscape while the driving game is active.
 * - Mobile browsers: Screen Orientation API (often needs fullscreen / user gesture).
 * - Fallback: CSS class + rotate prompt when the device stays in portrait.
 */

const CLASS = 'maps-driving-landscape'

export function setDrivingLandscape(active: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (active) {
    root.classList.add(CLASS)
    void lockLandscape()
  } else {
    root.classList.remove(CLASS)
    void unlockOrientation()
  }
}

async function lockLandscape(): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>
    }
    if (typeof o?.lock === 'function') {
      await o.lock('landscape')
    }
  } catch {
    // Not allowed (desktop, iOS Safari without fullscreen, permission) — CSS prompt handles UX.
  }
}

async function unlockOrientation(): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientation & { unlock?: () => void }
    o?.unlock?.()
  } catch {
    /* ignore */
  }
}

/** True when the viewport is portrait (user should rotate for driving). */
export function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(orientation: portrait)').matches
}
