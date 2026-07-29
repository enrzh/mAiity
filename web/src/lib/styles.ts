/**
 * Unified style primitives for mAiity maps.
 * Prefer these over ad-hoc glass / radius classes so the UI stays minimal and coherent.
 */
import { cn } from './utils'

/** Shared motion — iOS-like ease, short durations. */
export const motion = {
  fast: 'duration-150 ease-out',
  med: 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
} as const

/** Radius scale (maps to CSS --radius). */
export const radius = {
  control: 'rounded-full',
  card: 'rounded-2xl',
  sheet: 'rounded-[1.25rem]',
  panel: 'rounded-3xl',
} as const

/**
 * Surface recipes — frosted glass, soft fill, or solid card.
 * All use semantic tokens only (no raw hex in components).
 */
export const surface = {
  glass: cn(
    'border border-border/40 bg-background/70 shadow-sm',
    'backdrop-blur-2xl backdrop-saturate-150',
    'supports-backdrop-filter:bg-background/55',
  ),
  soft: cn(
    'border border-border/30 bg-muted/50',
    'supports-backdrop-filter:bg-muted/40 supports-backdrop-filter:backdrop-blur-md',
  ),
  solid: 'border border-border/50 bg-card text-card-foreground shadow-sm',
  float: cn(
    'border border-border/40 bg-background/75 shadow-md',
    'backdrop-blur-2xl backdrop-saturate-150',
    'supports-backdrop-filter:bg-background/60',
  ),
} as const

/** Control heights — 44pt touch targets for primary chrome. */
export const control = {
  h: 'h-10',
  hLg: 'h-11',
  icon: 'size-10',
  iconSm: 'size-9',
  padX: 'px-3.5',
} as const

/** Type scale used in panels. */
export const type = {
  title: 'text-[17px] font-semibold tracking-tight leading-snug',
  subtitle: 'text-[13px] text-muted-foreground leading-snug',
  label: 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground',
  stat: 'text-lg font-semibold tabular-nums tracking-tight',
  body: 'text-sm leading-relaxed',
} as const

/** Map FAB stack buttons. */
export function mapFabClass(active?: boolean) {
  return cn(
    surface.float,
    radius.control,
    control.icon,
    'shrink-0 shadow-md transition-colors',
    motion.fast,
    active
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'hover:bg-background/90',
  )
}

/** Primary / secondary actions in sheets. */
export function actionClass(kind: 'primary' | 'secondary' = 'primary') {
  return cn(
    radius.control,
    control.hLg,
    'flex-1 gap-1.5 font-medium',
    kind === 'primary' ? '' : '',
  )
}
