import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '../lib/utils'
import { projectActiveMapToScreen } from '../maps/rendererController'

type Props = {
  /** -1…1 lane offset → bank / slide */
  lateral?: number
  speedMps?: number
  /** Running — wheels spin, engine shake */
  active?: boolean
  /** Map position — car is anchored to this lon/lat on screen. */
  lon?: number
  lat?: number
  heading?: number
  className?: string
}

/**
 * Three.js sports car overlaid on the map. Anchored to lon/lat via
 * projectActiveMapToScreen so it sits on the road (not a fixed HUD corner).
 */
export function RaceCar3D({
  lateral = 0,
  speedMps = 0,
  active = false,
  lon,
  lat,
  heading = 0,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{
    setInput: (lateral: number, speedMps: number, active: boolean, heading: number) => void
    setScreen: (x: number | null, y: number | null) => void
    dispose: () => void
  } | null>(null)

  // Mount Three.js once
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40)
    // Rear / slightly elevated — reads as first-person hood + car body
    camera.position.set(0, 1.15, 4.2)
    camera.lookAt(0, 0.45, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)
    Object.assign(renderer.domElement.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
    })

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.35)
    key.position.set(3, 6, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x88bbff, 0.55)
    rim.position.set(-4, 2, -2)
    scene.add(rim)
    const fill = new THREE.DirectionalLight(0xffccaa, 0.35)
    fill.position.set(0, 1, 5)
    scene.add(fill)

    // Ground shadow catcher (transparent)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    scene.add(ground)

    const car = buildSportsCar()
    // Pivot so we can bank/yaw without losing the rear-facing base orientation.
    const pivot = new THREE.Group()
    pivot.add(car.root)
    scene.add(pivot)
    const baseYaw = Math.PI // rear of car faces the camera

    let lateralIn = 0
    let speedIn = 0
    let activeIn = false
    let wheelSpin = 0
    let bankZ = 0
    let yawY = 0
    let pitchX = 0
    let posX = 0
    let raf = 0
    let disposed = false

    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const tick = () => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      const steer = THREE.MathUtils.clamp(lateralIn, -1, 1)
      const speed = THREE.MathUtils.clamp(speedIn / 30, 0, 1)

      // Bank + yaw into turns; slight nose pitch with speed
      bankZ = THREE.MathUtils.lerp(bankZ, -steer * 0.22, 0.12)
      yawY = THREE.MathUtils.lerp(yawY, -steer * 0.1, 0.1)
      pitchX = THREE.MathUtils.lerp(pitchX, -speed * 0.05, 0.08)
      posX = THREE.MathUtils.lerp(posX, steer * 0.35, 0.12)
      pivot.rotation.z = bankZ
      pivot.rotation.y = baseYaw + yawY
      pivot.rotation.x = pitchX
      pivot.position.x = posX
      pivot.position.y = activeIn ? Math.sin(performance.now() * 0.04) * 0.012 * (0.4 + speed) : 0

      // Wheel spin + steer front wheels (indices 0/1 = front after build)
      const spinSpeed = activeIn ? 0.25 + speed * 0.85 : 0
      wheelSpin += spinSpeed
      for (const w of car.wheels) {
        w.tire.rotation.x = -wheelSpin
      }
      const frontSteer = steer * 0.5
      car.wheels[0].hub.rotation.y = frontSteer
      car.wheels[1].hub.rotation.y = frontSteer

      // Brake lights brighter when not accelerating hard
      const brake = activeIn && speed < 0.12 ? 1.2 : 0.4
      car.brakeMat.emissiveIntensity = brake

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    let screenX: number | null = null
    let screenY: number | null = null

    apiRef.current = {
      setInput: (lat, spd, act, head) => {
        lateralIn = lat
        speedIn = spd
        activeIn = act
        // Subtle model yaw from map heading change is handled via bank/steer only
        void head
      },
      setScreen: (x, y) => {
        screenX = x
        screenY = y
        if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
          host.classList.add('maps-fp-car--anchored')
          host.style.left = `${x}px`
          host.style.top = `${y}px`
          host.style.bottom = 'auto'
          host.style.marginLeft = '0'
          // Anchor near rear axle so chase-cam look-ahead keeps the car lower-center.
          host.style.transform = 'translate(-50%, -42%)'
        } else {
          host.classList.remove('maps-fp-car--anchored')
          host.style.left = '50%'
          host.style.top = 'auto'
          host.style.bottom = 'max(4.5rem, calc(var(--race-hud-h, 120px) - 0.5rem))'
          host.style.marginLeft = '-min(210px, 46vw)'
          host.style.transform = 'none'
        }
      },
      dispose: () => {
        disposed = true
        cancelAnimationFrame(raf)
        ro.disconnect()
        disposeObject(pivot)
        ground.geometry.dispose()
        ;(ground.material as THREE.Material).dispose()
        renderer.dispose()
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
      },
    }
    void screenX
    void screenY

    return () => {
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [])

  // Push live inputs without remounting the scene
  useEffect(() => {
    apiRef.current?.setInput(lateral, speedMps, active, heading)
  }, [lateral, speedMps, active, heading])

  // Anchor to map coordinates every animation frame while posed
  useEffect(() => {
    if (lon == null || lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      apiRef.current?.setScreen(null, null)
      return
    }
    let raf = 0
    const loop = () => {
      const p = projectActiveMapToScreen(lon, lat)
      apiRef.current?.setScreen(p?.x ?? null, p?.y ?? null)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [lon, lat])

  return (
    <div
      ref={hostRef}
      className={cn('maps-fp-car maps-fp-car--three', className)}
      aria-hidden
    />
  )
}

// ---------------------------------------------------------------------------
// Procedural sports-car mesh (no external GLB — always available offline)
// ---------------------------------------------------------------------------

type WheelPart = { hub: THREE.Group; tire: THREE.Mesh }
type CarBuild = {
  root: THREE.Group
  wheels: WheelPart[]
  brakeMat: THREE.MeshStandardMaterial
}

function buildSportsCar(): CarBuild {
  const root = new THREE.Group()
  root.position.y = 0.32

  const bodyBlue = new THREE.MeshStandardMaterial({
    color: 0x0b5fff,
    metalness: 0.65,
    roughness: 0.28,
  })
  const bodyDark = new THREE.MeshStandardMaterial({
    color: 0x062a7a,
    metalness: 0.7,
    roughness: 0.35,
  })
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xa8d4ff,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.55,
    thickness: 0.4,
    transparent: true,
    opacity: 0.85,
  })
  const black = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.4,
    roughness: 0.55,
  })
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    metalness: 0.95,
    roughness: 0.15,
  })
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x220000,
    emissive: 0xff2244,
    emissiveIntensity: 0.4,
    metalness: 0.3,
    roughness: 0.4,
  })
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff2cc,
    emissive: 0xffe08a,
    emissiveIntensity: 0.8,
    metalness: 0.2,
    roughness: 0.3,
  })

  // Main hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 3.6), bodyBlue)
  hull.position.y = 0.22
  hull.castShadow = true
  root.add(hull)

  // Sculpted nose (tapered)
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.28, 0.9), bodyBlue)
  nose.position.set(0, 0.18, 1.95)
  nose.castShadow = true
  root.add(nose)

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.45, 1.4), bodyDark)
  cabin.position.set(0, 0.55, -0.1)
  cabin.castShadow = true
  root.add(cabin)

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.38, 0.08), glass)
  windshield.position.set(0, 0.62, 0.55)
  windshield.rotation.x = -0.45
  root.add(windshield)

  // Rear glass
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 0.06), glass)
  rearGlass.position.set(0, 0.62, -0.75)
  rearGlass.rotation.x = 0.35
  root.add(rearGlass)

  // Side windows
  for (const x of [-0.68, 0.68]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 1.0), glass)
    side.position.set(x, 0.58, -0.05)
    root.add(side)
  }

  // Spoiler
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.35), black)
  wing.position.set(0, 0.72, -1.55)
  wing.castShadow = true
  root.add(wing)
  const wingPosts = [
    [-0.45, -1.45],
    [0.45, -1.45],
  ] as const
  for (const [x, z] of wingPosts) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), black)
    post.position.set(x, 0.58, z)
    root.add(post)
  }

  // Diffuser / rear bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.35), bodyDark)
  bumper.position.set(0, 0.12, -1.85)
  root.add(bumper)

  // Tail lights
  for (const x of [-0.5, 0.5]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.06), brakeMat)
    light.position.set(x, 0.28, -1.98)
    root.add(light)
  }

  // Headlights
  for (const x of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), lightMat)
    hl.position.set(x, 0.28, 2.35)
    root.add(hl)
  }

  // Exhaust tips
  for (const x of [-0.25, 0.25]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 12), chrome)
    tip.rotation.x = Math.PI / 2
    tip.position.set(x, 0.1, -2.05)
    root.add(tip)
  }

  // Wheels: FL, FR, RL, RR
  const wheels: WheelPart[] = []
  const wheelPositions: [number, number, number][] = [
    [-0.78, 0.0, 1.15],
    [0.78, 0.0, 1.15],
    [-0.78, 0.0, -1.2],
    [0.78, 0.0, -1.2],
  ]
  for (const [x, y, z] of wheelPositions) {
    const hub = new THREE.Group()
    hub.position.set(x, y, z)

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24),
      black,
    )
    tire.rotation.z = Math.PI / 2
    tire.castShadow = true
    hub.add(tire)

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16),
      chrome,
    )
    rim.rotation.z = Math.PI / 2
    hub.add(rim)

    root.add(hub)
    wheels.push({ hub, tire })
  }

  // Wheels sit on ground; pivot applies base yaw (rear toward camera).
  root.position.y = 0.34

  return { root, wheels, brakeMat }
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    }
  })
}
