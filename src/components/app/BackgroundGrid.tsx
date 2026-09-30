import { useEffect, useRef } from "react"

// ======================================================
// CONSTANTS
// ======================================================

const SPACING = 28 // distance between dots (px)

const CURSOR_RADIUS = 180 // reach of the cursor "lens"
const CURSOR_PUSH = 16 // how far dots are shoved away (px)

const RIPPLE_LIFE = 2.4 // seconds
const RIPPLE_SPEED = 440 // px / s
const RIPPLE_WIDTH = 40 // thickness of the ring (px)
const MAX_RIPPLES = 4

const STEP = 1 / 240 // fixed physics timestep

// Soft colour clouds that drift on slow Lissajous paths.
// c = rgb, a = opacity, b* = centre (fraction of the area),
// a* = travel distance, f* = speed (Hz), p = phase.
const BLOBS = [
  { c: "251,191,36", a: 0.34, bx: 0.12, by: 0.1, ax: 0.14, ay: 0.18, fx: 0.05, fy: 0.037, p: 0.0 },
  { c: "167,139,250", a: 0.36, bx: 0.88, by: 0.18, ax: 0.12, ay: 0.2, fx: 0.041, fy: 0.058, p: 1.7 },
  { c: "56,189,248", a: 0.3, bx: 0.8, by: 0.88, ax: 0.16, ay: 0.12, fx: 0.046, fy: 0.033, p: 3.1 },
  { c: "244,114,182", a: 0.28, bx: 0.18, by: 0.86, ax: 0.14, ay: 0.14, fx: 0.036, fy: 0.052, p: 4.4 },
  { c: "52,211,153", a: 0.24, bx: 0.5, by: 0.5, ax: 0.22, ay: 0.22, fx: 0.029, fy: 0.044, p: 5.6 },
]

// ======================================================
// MATH
// ======================================================

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

/** Damped harmonic oscillator: x'' = -w^2 (x - target) - 2 z w x' */
class Spring {
  x: number
  v = 0
  target: number

  constructor(x: number) {
    this.x = x
    this.target = x
  }

  step(omega: number, zeta: number, dt: number) {
    const a = -omega * omega * (this.x - this.target) - 2 * zeta * omega * this.v
    this.v += a * dt
    this.x += this.v * dt
  }
}

interface Ripple {
  x: number
  y: number
  t0: number
}

interface ActiveRipple {
  x: number
  y: number
  r: number // current ring radius
  k: number // strength, fades with age
}

// ======================================================
// COMPONENT
// ======================================================

/**
 * A living dot field.
 *
 *  - Every dot swells and fades with a flowing wave
 *    (three interfering sine waves, so it never visibly loops).
 *  - Your cursor acts as a lens: nearby dots swell, get pushed
 *    outward and pick up colour. The lens follows the cursor on a
 *    spring, so it glides and overshoots a little.
 *  - Clicking sends a ring ripple across the field.
 *  - Soft colour clouds drift underneath.
 */
export function BackgroundGrid() {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const blobRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    if (!box || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let w = 0
    let h = 0
    let raf = 0
    let acc = 0
    let last = performance.now()
    const t0 = last

    // Cursor lens state (springs = follow-through)
    const cx = new Spring(0)
    const cy = new Spring(0)
    const presence = new Spring(0)
    let seen = false

    const ripples: Ripple[] = []

    // ----------------------------------------------------
    // Drifting colour clouds
    // ----------------------------------------------------

    const placeBlobs = (t: number) => {
      const size = Math.max(w, h) * 0.62

      BLOBS.forEach((b, i) => {
        const el = blobRefs.current[i]
        if (!el) return

        const x = (b.bx + b.ax * Math.sin(Math.PI * 2 * b.fx * t + b.p)) * w
        const y = (b.by + b.ay * Math.sin(Math.PI * 2 * b.fy * t + b.p * 1.3)) * h

        el.style.width = `${size}px`
        el.style.height = `${size}px`
        el.style.transform = `translate3d(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px, 0)`
      })
    }

    // ----------------------------------------------------
    // Dot field
    // ----------------------------------------------------

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)

      const lx = cx.x
      const ly = cy.x
      const lens = clamp(presence.x, 0, 1)
      const R = CURSOR_RADIUS

      // Ripples currently alive, turned into ring radius + strength.
      const live: ActiveRipple[] = []
      for (const rp of ripples) {
        const age = t - rp.t0
        if (age < 0 || age > RIPPLE_LIFE) continue
        const life = 1 - age / RIPPLE_LIFE
        live.push({ x: rp.x, y: rp.y, r: age * RIPPLE_SPEED, k: life * life })
      }

      const cols = Math.ceil(w / SPACING) + 1
      const rows = Math.ceil(h / SPACING) + 1
      const ox = (w % SPACING) / 2
      const oy = (h % SPACING) / 2

      const base = "rgb(30, 41, 59)"
      ctx.fillStyle = base
      let tinted = false

      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const x = ox + i * SPACING
          const y = oy + j * SPACING

          // Flowing wave: three sines -> 0..1
          const wv =
            0.5 +
            0.5 *
              (0.5 * Math.sin(x * 0.0105 + t * 0.55) +
                0.3 * Math.sin(y * 0.0125 - t * 0.42) +
                0.2 * Math.sin((x + y) * 0.0068 + t * 0.28))

          let px = x
          let py = y
          let r = 0.8 + 1.5 * wv * wv
          let alpha = 0.22 + 0.36 * wv
          let tint = 0

          // Cursor lens
          if (lens > 0.01) {
            const dx = x - lx
            const dy = y - ly
            const d2 = dx * dx + dy * dy

            if (d2 < R * R) {
              const d = Math.sqrt(d2) || 1
              const f = 1 - d / R
              const f2 = f * f * lens

              px += (dx / d) * f2 * CURSOR_PUSH
              py += (dy / d) * f2 * CURSOR_PUSH
              r += f2 * 3.2
              alpha += f2 * 0.45
              if (f2 > tint) tint = f2
            }
          }

          // Click ripples
          for (let n = 0; n < live.length; n++) {
            const rp = live[n]
            const dx = x - rp.x
            const dy = y - rp.y
            const d = Math.sqrt(dx * dx + dy * dy) || 1
            const q = (d - rp.r) / RIPPLE_WIDTH
            const g = Math.exp(-q * q) * rp.k

            if (g > 0.01) {
              px += (dx / d) * g * 12
              py += (dy / d) * g * 12
              r += g * 2.4
              alpha += g * 0.4
              if (g > tint) tint = g
            }
          }

          if (tint > 0.04) {
            const hue = (t * 20 + x * 0.12 + y * 0.05) % 360
            ctx.fillStyle = `hsl(${hue.toFixed(0)}, 78%, 52%)`
            tinted = true
          } else if (tinted) {
            ctx.fillStyle = base
            tinted = false
          }

          ctx.globalAlpha = Math.min(alpha, 0.95)
          ctx.beginPath()
          ctx.arc(px, py, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
    }

    // ----------------------------------------------------
    // Sizing
    // ----------------------------------------------------

    const resize = () => {
      w = box.clientWidth
      h = box.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      placeBlobs((performance.now() - t0) / 1000)
      if (reduce) draw(0)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(box)
    resize()

    if (reduce) {
      // Static frame only: no loop, no pointer effects.
      placeBlobs(0)
      draw(0)
      return () => observer.disconnect()
    }

    // ----------------------------------------------------
    // Pointer (listened on window, since this layer ignores the mouse)
    // ----------------------------------------------------

    const localPoint = (event: PointerEvent) => {
      const rect = box.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const onMove = (event: PointerEvent) => {
      const p = localPoint(event)

      if (!seen) {
        // First move: start the lens at the cursor instead of flying in.
        cx.x = p.x
        cy.x = p.y
        seen = true
      }

      cx.target = p.x
      cy.target = p.y
      presence.target = 1
    }

    const onLeave = () => {
      presence.target = 0
    }

    const onDown = (event: PointerEvent) => {
      const p = localPoint(event)
      ripples.push({ x: p.x, y: p.y, t0: (performance.now() - t0) / 1000 })
      if (ripples.length > MAX_RIPPLES) ripples.shift()
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("blur", onLeave)
    document.documentElement.addEventListener("pointerleave", onLeave)

    // ----------------------------------------------------
    // Loop
    // ----------------------------------------------------

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)

      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      acc += dt

      while (acc >= STEP) {
        acc -= STEP
        cx.step(9, 0.72, STEP)
        cy.step(9, 0.72, STEP)
        presence.step(10, 1, STEP)
      }

      const t = (now - t0) / 1000
      draw(t)
      placeBlobs(t)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("blur", onLeave)
      document.documentElement.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #f3f5fa 0%, #e9edf5 55%, #e3e8f1 100%)",
      }}
    >
      {/* Drifting colour clouds */}
      {BLOBS.map((b, i) => (
        <div
          key={i}
          ref={(el) => {
            blobRefs.current[i] = el
          }}
          className="absolute left-0 top-0 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(${b.c}, ${b.a}) 0%, rgba(${b.c}, 0) 65%)`,
            willChange: "transform",
          }}
        />
      ))}

      {/* Dot field */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Soft light from the top-left */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.7), transparent 55%)",
        }}
      />

      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 50%, rgba(15,23,42,0.07) 100%)",
        }}
      />
    </div>
  )
}