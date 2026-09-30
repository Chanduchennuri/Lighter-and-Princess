import { useEffect, useRef } from "react"
import type { PointerEvent } from "react"

import {
  Home,
  ListTodo,
  CalendarDays,
  Images,
  Settings,
  AudioWaveform,
  User,
} from "lucide-react"

type Page =
  | "today"
  | "tasks"
  | "calendar"
  | "gallery"
  | "settings"

interface SystemNavigationProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

// Each page has its own glow colour. The sliding pill changes
// its glow to match the page you land on.
const navigation = [
  { id: "today" as const, icon: Home, label: "Today", accent: "#fbbf24" },
  { id: "tasks" as const, icon: ListTodo, label: "Tasks", accent: "#a78bfa" },
  { id: "calendar" as const, icon: CalendarDays, label: "Calendar", accent: "#38bdf8" },
  { id: "gallery" as const, icon: Images, label: "Gallery", accent: "#f472b6" },
  { id: "settings" as const, icon: Settings, label: "Settings", accent: "#34d399" },
]

// ======================================================
// PHYSICS
// ======================================================

const STEP = 1 / 240 // fixed timestep: identical feel at 60 / 120 / 144 Hz

const PILL_OMEGA = 20
const PILL_ZETA = 0.58 // < 1: the pill overshoots a little and settles
const TILT_OMEGA = 16
const TILT_ZETA = 0.6
const LIFT_OMEGA = 18
const LIFT_ZETA = 0.7
const POP_OMEGA = 16
const POP_ZETA = 0.38 // bouncy icon squish-and-pop on click
const SPOT_OMEGA = 14

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

/**
 * Damped harmonic oscillator:  x'' = -w^2 (x - target) - 2 z w x'
 * Semi-implicit Euler, stable at a fixed dt.
 */
class Spring {
  x: number
  v = 0
  target: number

  constructor(x: number) {
    this.x = x
    this.target = x
  }

  step(omega: number, zeta: number, dt: number) {
    const a =
      -omega * omega * (this.x - this.target) - 2 * zeta * omega * this.v
    this.v += a * dt
    this.x += this.v * dt
  }

  rest(ex: number, ev: number) {
    return Math.abs(this.x - this.target) < ex && Math.abs(this.v) < ev
  }

  snap() {
    this.x = this.target
    this.v = 0
  }
}

interface ButtonPhysics {
  rx: Spring // tilt around X (deg)
  ry: Spring // tilt around Y (deg)
  lift: Spring // hover lift toward the viewer
  pop: Spring // icon scale, kicked on click
}

interface Physics {
  pillX: Spring
  buttons: ButtonPhysics[]
  spot: { x: number; y: number; tx: number; ty: number; a: Spring }
  reduce: boolean
}

// ======================================================
// COMPONENT
// ======================================================

export function SystemNavigation({
  activePage,
  onNavigate,
}: SystemNavigationProps) {
  const activeIndex = Math.max(
    0,
    navigation.findIndex((item) => item.id === activePage),
  )
  const accent = navigation[activeIndex].accent

  const gridRef = useRef<HTMLDivElement | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)
  const spotRef = useRef<HTMLDivElement | null>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const innerRefs = useRef<(HTMLSpanElement | null)[]>([])
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([])

  const physicsRef = useRef<Physics | null>(null)
  const wakeRef = useRef<() => void>(() => {})
  const measureRef = useRef<(snap: boolean) => void>(() => {})
  const activeIndexRef = useRef(activeIndex)
  const firstRunRef = useRef(true)

  // ====================================================
  // PHYSICS LOOP
  //
  // Runs only while something is moving. When every spring
  // is at rest the loop stops, so an idle nav costs nothing.
  // ====================================================

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const p: Physics = {
      pillX: new Spring(0),
      buttons: navigation.map(() => ({
        rx: new Spring(0),
        ry: new Spring(0),
        lift: new Spring(0),
        pop: new Spring(1),
      })),
      spot: { x: 0, y: 0, tx: 0, ty: 0, a: new Spring(0) },
      reduce,
    }
    physicsRef.current = p

    let raf = 0
    let last = 0
    let acc = 0

    const render = () => {
      // Pill: slides on the spring, stretches with speed (squash & stretch).
      const pill = pillRef.current
      if (pill) {
        const s = p.reduce ? 0 : clamp(Math.abs(p.pillX.v) / 3000, 0, 0.28)
        pill.style.transform =
          `translate3d(${p.pillX.x.toFixed(2)}px, 0, 0) ` +
          `scale(${(1 + s).toFixed(3)}, ${(1 - s * 0.3).toFixed(3)})`
      }

      // Buttons: 3D tilt toward the cursor + icon pop.
      for (let i = 0; i < navigation.length; i++) {
        const b = p.buttons[i]

        const inner = innerRefs.current[i]
        if (inner) {
          inner.style.transform =
            `perspective(260px) ` +
            `translate3d(0, ${(-b.lift.x * 2).toFixed(2)}px, ${(b.lift.x * 10).toFixed(2)}px) ` +
            `rotateX(${b.rx.x.toFixed(2)}deg) rotateY(${b.ry.x.toFixed(2)}deg)`
        }

        const icon = iconRefs.current[i]
        if (icon) {
          icon.style.transform =
            `scale(${b.pop.x.toFixed(3)}) rotate(${((1 - b.pop.x) * 40).toFixed(2)}deg)`
        }
      }

      // Spotlight that trails the cursor.
      const grid = gridRef.current
      const spot = spotRef.current
      if (grid) {
        grid.style.setProperty("--mx", `${p.spot.x.toFixed(1)}px`)
        grid.style.setProperty("--my", `${p.spot.y.toFixed(1)}px`)
      }
      if (spot) spot.style.opacity = clamp(p.spot.a.x, 0, 1).toFixed(3)
    }

    const resting = () =>
      p.pillX.rest(0.05, 2) &&
      p.spot.a.rest(0.002, 0.02) &&
      Math.hypot(p.spot.tx - p.spot.x, p.spot.ty - p.spot.y) < 0.5 &&
      p.buttons.every(
        (b) =>
          b.rx.rest(0.02, 0.3) &&
          b.ry.rest(0.02, 0.3) &&
          b.lift.rest(0.002, 0.02) &&
          b.pop.rest(0.002, 0.02),
      )

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      acc += dt

      while (acc >= STEP) {
        acc -= STEP
        p.pillX.step(PILL_OMEGA, PILL_ZETA, STEP)
        p.spot.a.step(SPOT_OMEGA, 1, STEP)
        for (const b of p.buttons) {
          b.rx.step(TILT_OMEGA, TILT_ZETA, STEP)
          b.ry.step(TILT_OMEGA, TILT_ZETA, STEP)
          b.lift.step(LIFT_OMEGA, LIFT_ZETA, STEP)
          b.pop.step(POP_OMEGA, POP_ZETA, STEP)
        }
      }

      // Exponential smoothing for the spotlight position.
      const k = 1 - Math.exp(-dt * 14)
      p.spot.x += (p.spot.tx - p.spot.x) * k
      p.spot.y += (p.spot.ty - p.spot.y) * k

      if (resting()) {
        p.pillX.snap()
        p.spot.a.snap()
        for (const b of p.buttons) {
          b.rx.snap()
          b.ry.snap()
          b.lift.snap()
          b.pop.snap()
        }
        p.spot.x = p.spot.tx
        p.spot.y = p.spot.ty
        render()
        raf = 0
        return
      }

      render()
      raf = requestAnimationFrame(tick)
    }

    const wake = () => {
      if (raf) return
      last = performance.now()
      acc = 0
      raf = requestAnimationFrame(tick)
    }
    wakeRef.current = wake

    // Point the pill at the active button (re-measured on resize).
    const measure = (snap: boolean) => {
      const btn = buttonRefs.current[activeIndexRef.current]
      const pill = pillRef.current
      if (!btn || !pill) return

      pill.style.width = `${btn.offsetWidth}px`
      p.pillX.target = btn.offsetLeft

      if (snap || p.reduce) {
        p.pillX.x = btn.offsetLeft
        p.pillX.v = 0
      }

      render()
      wake()
    }
    measureRef.current = measure

    measure(true)

    const observer = new ResizeObserver(() => measure(true))
    if (gridRef.current) observer.observe(gridRef.current)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  // Page changed: slide the pill there and pop the new icon.
  useEffect(() => {
    activeIndexRef.current = activeIndex

    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }

    measureRef.current(false)

    const p = physicsRef.current
    if (p && !p.reduce) {
      p.buttons[activeIndex].pop.x = 0.55
      wakeRef.current()
    }
  }, [activeIndex])

  // ====================================================
  // POINTER HANDLERS
  // ====================================================

  const handleButtonMove =
    (i: number) => (event: PointerEvent<HTMLButtonElement>) => {
      const p = physicsRef.current
      if (!p || p.reduce) return

      const rect = event.currentTarget.getBoundingClientRect()
      const nx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
      const ny = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)

      const b = p.buttons[i]
      b.ry.target = nx * 16
      b.rx.target = -ny * 14
      b.lift.target = 1
      wakeRef.current()
    }

  const handleButtonLeave = (i: number) => () => {
    const p = physicsRef.current
    if (!p) return

    const b = p.buttons[i]
    b.ry.target = 0
    b.rx.target = 0
    b.lift.target = 0
    wakeRef.current()
  }

  const handleGridEnter = (event: PointerEvent<HTMLDivElement>) => {
    const p = physicsRef.current
    if (!p || p.reduce) return

    const rect = event.currentTarget.getBoundingClientRect()
    p.spot.tx = p.spot.x = event.clientX - rect.left
    p.spot.ty = p.spot.y = event.clientY - rect.top
    p.spot.a.target = 1
    wakeRef.current()
  }

  const handleGridMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = physicsRef.current
    if (!p || p.reduce) return

    const rect = event.currentTarget.getBoundingClientRect()
    p.spot.tx = event.clientX - rect.left
    p.spot.ty = event.clientY - rect.top
    wakeRef.current()
  }

  const handleGridLeave = () => {
    const p = physicsRef.current
    if (!p) return

    p.spot.a.target = 0
    wakeRef.current()
  }

  const handleClick = (i: number, id: Page) => () => {
    const p = physicsRef.current
    if (p && !p.reduce) {
      p.buttons[i].pop.x = 0.55 // squash, then spring back with overshoot
      wakeRef.current()
    }
    onNavigate(id)
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <section
      className="
        relative
        shrink-0
        overflow-hidden
        rounded-[22px]
        border
        border-slate-200/80
        bg-white/90
        p-4
        shadow-[0_12px_35px_rgba(30,45,65,0.07)]
        backdrop-blur-xl
      "
    >
      <style>{`
        @keyframes nav-spin { to { transform: rotate(360deg); } }
        @keyframes nav-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes nav-wave {
          0%, 100% { transform: scaleY(0.72); }
          50%      { transform: scaleY(1.18); }
        }
        .nav-spin    { animation: nav-spin 7s linear infinite; }
        .nav-shimmer {
          background: linear-gradient(100deg, #94a3b8 30%, #172033 50%, #94a3b8 70%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: nav-shimmer 5s linear infinite;
        }
        .nav-wave    { animation: nav-wave 1.6s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) {
          .nav-spin, .nav-shimmer, .nav-wave { animation: none; }
        }
      `}</style>

      {/* Top accent: takes the colour of the current page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-6 right-6 top-0 h-px opacity-80"
        style={{
          background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
        }}
      />

      {/* Header (fixed height so the card never changes size) */}
      <div className="mb-3 flex h-[52px] items-center justify-between px-1">
        <div className="flex items-center gap-3">
          {/* Avatar with a slowly rotating colour ring */}
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span
              aria-hidden="true"
              className="nav-spin absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, #fbbf24, #a78bfa, #38bdf8, #f472b6, #34d399, #fbbf24)",
              }}
            />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#172033]">
              <User size={16} strokeWidth={2} />
            </span>
          </span>

          <p className="nav-shimmer text-[14px] font-semibold italic tracking-tight">
            workspace
          </p>
        </div>

        <span
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-xl
            bg-slate-100
            text-[#172033]/70
            ring-1
            ring-inset
            ring-slate-200/70
          "
        >
          <AudioWaveform size={18} className="nav-wave" />
        </span>
      </div>

      {/* Navigation */}
      <div
        ref={gridRef}
        onPointerEnter={handleGridEnter}
        onPointerMove={handleGridMove}
        onPointerLeave={handleGridLeave}
        className="
          relative
          grid
          shrink-0
          grid-cols-5
          gap-1.5
          rounded-[16px]
          border
          border-slate-200/70
          bg-slate-100/80
          p-1.5
        "
      >
        {/* Cursor spotlight */}
        <div
          ref={spotRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 rounded-[15px] opacity-0"
          style={{
            background:
              "radial-gradient(84px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.95), rgba(255,255,255,0) 70%)",
          }}
        />

        {/* Sliding active pill (spring driven) */}
        <div
          ref={pillRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 left-0 top-1.5 z-[1] rounded-[12px]"
          style={{
            width: 0,
            willChange: "transform",
            background:
              "linear-gradient(160deg, #1f2e4a 0%, #152033 55%, #0f1828 100%)",
            boxShadow: `0 10px 22px -6px ${accent}99, 0 8px 18px rgba(21,32,51,0.22), inset 0 1px 0 rgba(255,255,255,0.16)`,
            transition: "box-shadow 420ms ease-out",
          }}
        >
          <span
            className="absolute left-1/2 top-1.5 h-0.5 w-4 -translate-x-1/2 rounded-full"
            style={{
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
              transition: "background 420ms ease-out, box-shadow 420ms ease-out",
            }}
          />
        </div>

        {navigation.map((item, i) => {
          const Icon = item.icon
          const active = activePage === item.id

          return (
            <button
              key={item.id}
              ref={(el) => {
                buttonRefs.current[i] = el
              }}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={handleClick(i, item.id)}
              onPointerMove={handleButtonMove(i)}
              onPointerLeave={handleButtonLeave(i)}
              className={`
                relative
                z-[2]
                flex
                h-[54px]
                min-w-0
                shrink-0
                items-center
                justify-center
                rounded-[12px]
                transition-colors
                duration-300
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-slate-400/60
                ${
                  active
                    ? "text-white delay-75"
                    : "text-slate-400 hover:text-[#172033]"
                }
              `}
            >
              <span
                ref={(el) => {
                  innerRefs.current[i] = el
                }}
                className="flex flex-col items-center justify-center gap-1 will-change-transform"
              >
                <span
                  ref={(el) => {
                    iconRefs.current[i] = el
                  }}
                  className="flex"
                  style={{
                    filter: active
                      ? `drop-shadow(0 0 6px ${item.accent}aa)`
                      : "none",
                    transition: "filter 400ms ease-out",
                  }}
                >
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                </span>

                <span
                  className={`
                    hidden
                    whitespace-nowrap
                    text-[10px]
                    font-semibold
                    tracking-wide
                    sm:block
                    ${active ? "text-white/90" : "text-slate-400"}
                  `}
                >
                  {item.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}