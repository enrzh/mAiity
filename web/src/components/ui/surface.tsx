import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const surfaceVariants = cva(
  'text-foreground transition-colors duration-150',
  {
    variants: {
      variant: {
        glass:
          'border border-border/40 bg-background/70 shadow-sm backdrop-blur-2xl backdrop-saturate-150 supports-backdrop-filter:bg-background/55',
        soft:
          'border border-border/30 bg-muted/45 supports-backdrop-filter:bg-muted/35 supports-backdrop-filter:backdrop-blur-md',
        solid:
          'border border-border/50 bg-card text-card-foreground shadow-sm',
        float:
          'border border-border/40 bg-background/75 shadow-md backdrop-blur-2xl backdrop-saturate-150 supports-backdrop-filter:bg-background/60',
        bare: 'border-0 bg-transparent shadow-none',
      },
      radius: {
        none: 'rounded-none',
        md: 'rounded-xl',
        lg: 'rounded-2xl',
        xl: 'rounded-3xl',
        pill: 'rounded-full',
        sheet: 'rounded-t-[1.25rem] md:rounded-[1.25rem]',
      },
      padding: {
        none: 'p-0',
        sm: 'p-2.5',
        md: 'p-3.5',
        lg: 'p-4',
      },
    },
    defaultVariants: {
      variant: 'glass',
      radius: 'lg',
      padding: 'none',
    },
  },
)

export type SurfaceProps = React.ComponentProps<'div'> &
  VariantProps<typeof surfaceVariants>

/**
 * Unified frosted / soft surface. Use for chrome, sheets, cards, FABs wrappers.
 */
function Surface({
  className,
  variant,
  radius,
  padding,
  ...props
}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      className={cn(surfaceVariants({ variant, radius, padding, className }))}
      {...props}
    />
  )
}

/** Compact metric cell (ETA / distance / speed). */
function Stat({
  label,
  value,
  hint,
  className,
  emphasize,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
  emphasize?: boolean
}) {
  return (
    <div
      data-slot="stat"
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/40 px-2.5 py-2',
        className,
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'text-lg font-semibold tabular-nums tracking-tight leading-none',
          emphasize && 'text-primary',
        )}
      >
        {value}
        {hint != null && (
          <span className="ml-0.5 text-xs font-medium text-muted-foreground">{hint}</span>
        )}
      </span>
    </div>
  )
}

/** Horizontal chrome row: left actions + flex spacer + trailing. */
function ChromeRow({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="chrome-row"
      role="toolbar"
      className={cn(
        surfaceVariants({ variant: 'glass', radius: 'pill' }),
        'flex min-h-11 items-center gap-1 p-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Drag handle for bottom sheets. */
function SheetGrabber({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex shrink-0 justify-center py-1.5 md:hidden', className)}
      aria-hidden
    >
      <div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
    </div>
  )
}

export { Surface, Stat, ChromeRow, SheetGrabber, surfaceVariants }
