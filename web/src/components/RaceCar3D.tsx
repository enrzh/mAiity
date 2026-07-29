import { cn } from '../lib/utils'

/**
 * First-person 3D car: fixed in the viewport like a cockpit/hood view.
 * Map camera is driver-eye; this mesh sits in the lower frame so the car
 * reads as a real vehicle, not a top-down pin.
 */
export function RaceCar3D({
  bearing = 0,
  lateral = 0,
  speedMps = 0,
  active = false,
  className,
}: {
  /** Degrees — used for subtle roll with steering. */
  bearing?: number
  /** -1…1 lane offset → bank the body. */
  lateral?: number
  speedMps?: number
  /** Running / paused — stronger motion. */
  active?: boolean
  className?: string
}) {
  const steer = Math.max(-1, Math.min(1, lateral))
  const bank = steer * -12
  const speed = Math.min(1, Math.max(0, speedMps / 28))
  const bounce = active ? 0.6 + speed * 1.4 : 0

  return (
    <div
      className={cn('maps-fp-car', active && 'maps-fp-car--active', className)}
      aria-hidden
      style={{
        // Subtle lateral slide with steering
        transform: `translateX(${steer * 18}px)`,
      }}
    >
      <div
        className="maps-fp-car__scene"
        style={{
          // Perspective stage; body banks into turns
          ['--fp-bank' as string]: `${bank}deg`,
          ['--fp-bounce' as string]: `${bounce}px`,
        }}
      >
        {/* Road reflection strip under the car */}
        <div className="maps-fp-car__shadow" />

        <div className="maps-fp-car__body">
          {/* Rear wing */}
          <div className="maps-fp-car__wing" />
          {/* Cabin / glass */}
          <div className="maps-fp-car__cabin">
            <div className="maps-fp-car__glass maps-fp-car__glass--rear" />
            <div className="maps-fp-car__glass maps-fp-car__glass--side maps-fp-car__glass--left" />
            <div className="maps-fp-car__glass maps-fp-car__glass--side maps-fp-car__glass--right" />
          </div>
          {/* Main body panels */}
          <div className="maps-fp-car__hull">
            <div className="maps-fp-car__deck" />
            <div className="maps-fp-car__side maps-fp-car__side--left" />
            <div className="maps-fp-car__side maps-fp-car__side--right" />
            <div className="maps-fp-car__tail" />
          </div>
          {/* Wheels */}
          <div className={cn('maps-fp-car__wheel maps-fp-car__wheel--rl', active && 'maps-fp-car__wheel--spin')} />
          <div className={cn('maps-fp-car__wheel maps-fp-car__wheel--rr', active && 'maps-fp-car__wheel--spin')} />
          <div className={cn('maps-fp-car__wheel maps-fp-car__wheel--fl', active && 'maps-fp-car__wheel--spin')} />
          <div className={cn('maps-fp-car__wheel maps-fp-car__wheel--fr', active && 'maps-fp-car__wheel--spin')} />
          {/* Brake / tail lights */}
          <div className="maps-fp-car__light maps-fp-car__light--l" />
          <div className="maps-fp-car__light maps-fp-car__light--r" />
          {/* Exhaust glow when moving */}
          <div className={cn('maps-fp-car__exhaust', speed > 0.15 && 'maps-fp-car__exhaust--on')} />
        </div>
      </div>
    </div>
  )
}
