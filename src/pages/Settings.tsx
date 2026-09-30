import {
  Bell,
  ExternalLink,
  Monitor,
  Moon,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  UserRound,
  Volume2,
} from "lucide-react"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useSettings } from "../lib/appState"

import type { AppTheme } from "../lib/types"

/* ============================================================
   L&P SETTINGS CONSTANTS
   ============================================================ */

const DEVELOPER_LINKEDIN_URL =
  "https://www.linkedin.com/in/chandrasekhar-chennuri-austin/"

const RECOMMENDED_SETTINGS = {
  notifications: true,
  sound: true,
  animationEnabled: true,
  launchAtStartup: false,
  theme: "system" as AppTheme,
}

/* ============================================================
   PHYSICS
   ------------------------------------------------------------
   useSpring integrates a damped harmonic oscillator

       x'' = -k (x - target) - c x'

   (semi-implicit Euler, 4 sub-steps per frame).
   Damping ratio ζ = c / (2√k): ζ < 1 overshoots, ζ ≈ 1 is
   critically damped, ζ > 1 creeps.

   Tip: if you use this in more than one file, move it to
   lib/useSpring.ts and import it.
   ============================================================ */

function useSpring(target: number, k = 180, c = 20) {
  const state = useRef({ x: target, v: 0, t: target })
  const raf = useRef<number | null>(null)
  const [, force] = useState(0)

  const run = useCallback(() => {
    if (raf.current !== null) return
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      const s = state.current
      const sub = 4
      const h = dt / sub

      for (let i = 0; i < sub; i++) {
        const a = -k * (s.x - s.t) - c * s.v
        s.v += a * h
        s.x += s.v * h
      }

      const atRest =
        Math.abs(s.v) < 0.002 && Math.abs(s.x - s.t) < 0.002

      if (atRest) {
        s.x = s.t
        s.v = 0
        raf.current = null
        force((n) => n + 1)
        return
      }

      force((n) => n + 1)
      raf.current = requestAnimationFrame(step)
    }

    raf.current = requestAnimationFrame(step)
  }, [k, c])

  useEffect(() => {
    state.current.t = target
    run()
  }, [target, run])

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    },
    [],
  )

  return { x: state.current.x, v: state.current.v }
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

/* ============================================================
   SETTINGS
   ============================================================ */

export function Settings() {
  const {
    settings,
    settingsLoading,
    settingsError,
    updateSetting,
    setTheme,
  } = useSettings()

  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resetInProgress, setResetInProgress] = useState(false)

  // Increments after every successful save; the gear reacts to it.
  const [pulse, setPulse] = useState(0)

  /* ---------- UPDATE HELPER ---------- */

  async function handleToggle(
    key:
      | "notifications"
      | "sound"
      | "animationEnabled"
      | "launchAtStartup",
  ) {
    if (savingKey) return

    try {
      setSavingKey(key)
      await updateSetting(key, !settings[key])
      setPulse((p) => p + 1)
    } catch (error) {
      console.error(`[Settings] Failed to update ${key}:`, error)
    } finally {
      setSavingKey(null)
    }
  }

  /* ---------- RESET PREFERENCES ---------- */

  async function handleResetPreferences() {
    if (savingKey || resetInProgress) return

    try {
      setResetInProgress(true)
      setSavingKey("reset")

      await updateSetting("notifications", RECOMMENDED_SETTINGS.notifications)
      await updateSetting("sound", RECOMMENDED_SETTINGS.sound)
      await updateSetting(
        "animationEnabled",
        RECOMMENDED_SETTINGS.animationEnabled,
      )
      await updateSetting("launchAtStartup", RECOMMENDED_SETTINGS.launchAtStartup)
      await setTheme(RECOMMENDED_SETTINGS.theme)
      setPulse((p) => p + 3)
    } catch (error) {
      console.error("[Settings] Failed to reset preferences:", error)
    } finally {
      setSavingKey(null)
      setResetInProgress(false)
    }
  }

  /* ---------- THEME ---------- */

  async function handleTheme(theme: AppTheme) {
    if (savingKey || settings.theme === theme) return

    try {
      setSavingKey("theme")
      await setTheme(theme)
      setPulse((p) => p + 1)
    } catch (error) {
      console.error("[Settings] Failed to update theme:", error)
    } finally {
      setSavingKey(null)
    }
  }

  /* ---------- STATUS ---------- */

  const statusText = useMemo(() => {
    if (settingsLoading) return "Loading"
    if (settingsError) return "Sync error"
    if (savingKey) return "Saving"
    return "Synced"
  }, [settingsLoading, settingsError, savingKey])

  // How many of the three reminder features are effectively on (drives the ring)
  const activeCount = [
    settings.notifications,
    settings.sound && settings.notifications,
    settings.animationEnabled,
  ].filter(Boolean).length

  /* ---------- RENDER ---------- */

  return (
    <div className="px-5 py-6 md:px-8 md:py-8">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-settings] * { animation-duration: 1ms !important; transition-duration: 1ms !important; }
        }
      `}</style>

      <div data-settings className="max-w-3xl">
        {/* ==================== HEADER ==================== */}

        <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white px-6 py-7 md:px-8">
          <DotField />

          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <Flywheel pulse={pulse} />

              <div>
                <h1 className="font-serif text-[44px] font-semibold italic leading-none tracking-[-0.035em] text-black md:text-[54px]">
                  Settings
                </h1>
                <p className="mt-2.5 max-w-xs text-[14px] leading-6 text-neutral-500">
                  Choose how your reminders behave.
                </p>
              </div>
            </div>

            <StatusPill status={statusText} />
          </div>
        </header>

        {/* ==================== SECTIONS ==================== */}

        <div className="mt-4 space-y-4">
          <SettingsSection
            icon={<Bell size={18} strokeWidth={1.8} />}
            title="Notifications"
            description="Control when L&P can notify you."
          >
            <SettingRow
              title="Enable reminders"
              description="Allow scheduled tasks to trigger reminders."
            >
              <Toggle
                label="Enable reminders"
                checked={settings.notifications}
                disabled={savingKey === "notifications"}
                onChange={() => void handleToggle("notifications")}
              />
            </SettingRow>

            <SettingRow
              title="Notification sound"
              description={
                settings.notifications
                  ? "Play a sound when a reminder is triggered."
                  : "Turn on reminders to use sound."
              }
            >
              <Toggle
                label="Notification sound"
                checked={settings.sound}
                disabled={!settings.notifications || savingKey === "sound"}
                onChange={() => void handleToggle("sound")}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            icon={<Monitor size={18} strokeWidth={1.8} />}
            title="Appearance"
            description="Customize how the app looks and moves."
          >
            <SettingRow
              title="Theme"
              description="Choose how L&P should appear."
            >
              <ThemeSwitch
                value={settings.theme}
                disabled={savingKey === "theme"}
                onChange={(t) => void handleTheme(t)}
              />
            </SettingRow>

            <SettingRow
              title="Animated reminders"
              description="Show animated characters when a reminder triggers."
            >
              <Toggle
                label="Animated reminders"
                checked={settings.animationEnabled}
                disabled={savingKey === "animationEnabled"}
                onChange={() => void handleToggle("animationEnabled")}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            icon={<Sparkles size={18} strokeWidth={1.8} />}
            title="Application"
            description="Control how L&P behaves on your system."
          >
            <SettingRow
              title="Launch at startup"
              description="Start L&P automatically when you sign in."
            >
              <Toggle
                label="Launch at startup"
                checked={settings.launchAtStartup}
                disabled={savingKey === "launchAtStartup"}
                onChange={() => void handleToggle("launchAtStartup")}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            icon={<Shield size={18} strokeWidth={1.8} />}
            title="System"
            description="Application information and local storage."
          >
            <SettingRow
              title="Local database"
              description="Your tasks and preferences are stored locally."
            >
              <Badge>Local</Badge>
            </SettingRow>

           

            <SettingRow
              title="Reminder scheduler"
              description="The Rust scheduler continuously checks for due tasks."
            >
              <Badge live>Active</Badge>
            </SettingRow>
          </SettingsSection>
        </div>

        {/* ==================== WORKSPACE SUMMARY ==================== */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex items-center gap-5">
              <ProgressRing value={activeCount} max={3} />

              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-black">
                  {activeCount === 3
                    ? "Everything is ready."
                    : `${activeCount} of 3 reminder features on.`}
                </h2>
                <p className="mt-1 max-w-md text-[13px] leading-6 text-neutral-500">
                  Your reminder controls are stored locally and synchronized
                  with the L&P backend.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleResetPreferences()}
              disabled={Boolean(savingKey) || settingsLoading}
              className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-[13px] font-semibold text-black transition hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black"
            >
              <RotateCcw
                size={15}
                strokeWidth={1.9}
                className={`transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:-rotate-[120deg] ${
                  resetInProgress
                    ? "animate-[spin_0.9s_linear_infinite_reverse]"
                    : ""
                }`}
              />
              {resetInProgress ? "Resetting…" : "Reset preferences"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-px border-t border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label="Reminders"
              on={settings.notifications}
              value={settings.notifications ? "Enabled" : "Off"}
            />
            <SummaryTile
              label="Sound"
              on={settings.sound && settings.notifications}
              value={
                settings.sound && settings.notifications ? "Enabled" : "Off"
              }
            />
            <SummaryTile
              label="Animations"
              on={settings.animationEnabled}
              value={settings.animationEnabled ? "Enabled" : "Off"}
            />
            <SummaryTile
              label="Theme"
              on
              value={
                settings.theme.charAt(0).toUpperCase() +
                settings.theme.slice(1)
              }
            />
          </div>
        </section>

        {/* ==================== REMINDER ENGINE ==================== */}

        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-black">
              <Volume2 size={18} strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[16px] font-semibold tracking-[-0.01em] text-black">
                  Reminder engine
                </p>
                <Badge live>Connected</Badge>
              </div>

              <p className="mt-1 text-[13px] leading-6 text-neutral-500">
                Reminder scheduling is handled locally and are continuously updated.
              </p>
            </div>
          </div>
        </section>

        {/* ==================== DEVELOPER ==================== */}

        <footer className="mt-8 border-t border-neutral-200 pb-2 pt-5">
          <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="text-[12px] font-medium text-neutral-500">
                Developed by
              </p>
              <p className="mt-0.5 font-serif text-[22px] font-semibold italic tracking-[-0.02em] text-black">
                L&P
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.location.assign(DEVELOPER_LINKEDIN_URL)}
              aria-label="Open L&P developer LinkedIn profile"
              className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-[13px] font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.97]"
            >
              <UserRound size={16} strokeWidth={1.8} />
              Developer profile
              <ExternalLink
                size={14}
                strokeWidth={1.7}
                className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] text-neutral-400 sm:text-left">
            You can find the {" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
              DEVELOPER_LINKEDIN_URL
            </code>{" "}
            here.
          </p>
        </footer>
      </div>
    </div>
  )
}

/* ============================================================
   FLYWHEEL: the one showpiece
   ------------------------------------------------------------
   A gear with real rotational inertia.
     • Drag it: angular velocity ω is measured from the change of
       atan2(y − cy, x − cx) between pointer events.
     • Let go: it coasts with viscous + dry friction
           ω' = −μ·ω − sign(ω)·f      →  ω(t) = ω₀·e^(−μt)
     • Every saved setting gives it a small kick.
   Angle is written straight to the DOM, so no React re-renders.
   ============================================================ */

const GEAR_TEETH = 12

function gearPath() {
  const rIn = 36
  const rOut = 45
  const pts: string[] = []

  for (let i = 0; i < GEAR_TEETH; i++) {
    const base = (i * 2 * Math.PI) / GEAR_TEETH
    const spec: [number, number][] = [
      [base - 0.22, rIn],
      [base - 0.12, rOut],
      [base + 0.12, rOut],
      [base + 0.22, rIn],
    ]
    spec.forEach(([a, r]) => {
      pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`)
    })
  }

  return `M${pts.join("L")}Z`
}

const GEAR_D = gearPath()

function Flywheel({ pulse }: { pulse: number }) {
  const group = useRef<SVGGElement>(null)
  const root = useRef<HTMLButtonElement>(null)
  const raf = useRef<number | null>(null)

  const s = useRef({
    angle: 0,
    omega: 0, // degrees per second
    dragging: false,
    lastPointer: 0,
    lastMove: 0,
  })

  const draw = () => {
    group.current?.setAttribute("transform", `rotate(${s.current.angle} 50 50)`)
  }

  const loop = useCallback(() => {
    if (raf.current !== null) return
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const st = s.current

      if (!st.dragging) {
        st.angle += st.omega * dt

        // viscous drag (exponential) + a little dry friction so it stops crisply
        st.omega *= Math.exp(-1.5 * dt)
        const dry = 28 * dt
        st.omega =
          Math.abs(st.omega) <= dry ? 0 : st.omega - Math.sign(st.omega) * dry
      }

      draw()

      if (!st.dragging && st.omega === 0) {
        raf.current = null
        return
      }
      raf.current = requestAnimationFrame(step)
    }

    raf.current = requestAnimationFrame(step)
  }, [])

  const kick = useCallback(
    (dOmega: number) => {
      s.current.omega += dOmega
      loop()
    },
    [loop],
  )

  // Spin-up when the page opens
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduce) kick(560)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }, [kick])

  // Tick on each successful save
  const firstPulse = useRef(true)
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false
      return
    }
    kick(300)
  }, [pulse, kick])

  const pointerAngle = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect()
    return (
      (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) *
        180) /
      Math.PI
    )
  }

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    root.current?.setPointerCapture(e.pointerId)
    const st = s.current
    st.dragging = true
    st.omega = 0
    st.lastPointer = pointerAngle(e)
    st.lastMove = performance.now()
    loop()
  }

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const st = s.current
    if (!st.dragging) return

    const a = pointerAngle(e)
    let d = a - st.lastPointer
    // shortest signed angle in (−180, 180]
    d = ((((d + 180) % 360) + 360) % 360) - 180

    const now = performance.now()
    const dt = Math.max((now - st.lastMove) / 1000, 0.001)

    st.angle += d
    // exponentially smoothed velocity estimate
    st.omega = 0.6 * st.omega + 0.4 * (d / dt)
    st.lastPointer = a
    st.lastMove = now
  }

  function onUp() {
    const st = s.current
    if (!st.dragging) return
    st.dragging = false
    // If the pointer rested before release, don't throw the gear
    if (performance.now() - st.lastMove > 90) st.omega = 0
    st.omega = clamp(st.omega, -2400, 2400)
    loop()
  }

  return (
    <button
      ref={root}
      type="button"
      aria-label="Spin the gear"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          kick(500)
        }
      }}
      className="h-[84px] w-[84px] shrink-0 cursor-grab touch-none select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:cursor-grabbing"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <g ref={group}>
          <path d={GEAR_D} fill="black" />
          <circle cx="50" cy="50" r="17" fill="white" />
          {[0, 90, 180, 270].map((deg) => {
            const r = (deg * Math.PI) / 180
            return (
              <circle
                key={deg}
                cx={50 + 27 * Math.cos(r)}
                cy={50 + 27 * Math.sin(r)}
                r="2.6"
                fill="white"
              />
            )
          })}
          <circle cx="50" cy="50" r="5" fill="black" />
          {/* a single mark on the hub so rotation is easy to read */}
          <rect x="49" y="35" width="2" height="9" rx="1" fill="black" />
        </g>
      </svg>
    </button>
  )
}

/* ============================================================
   DOT FIELD
   Ambient traveling wave sin(ωt + φ(x, y)) plus Gaussian
   repulsion exp(−r² / 2σ²) around the cursor.
   ============================================================ */

function DotField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    const ctx = canvas?.getContext("2d")
    if (!canvas || !parent || !ctx) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const gap = 16
    const sigma = 80
    let w = 0
    let h = 0

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const m = { tx: -999, ty: -999, x: -999, y: -999, on: 0, s: 0 }

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      m.tx = e.clientX - r.left
      m.ty = e.clientY - r.top
      if (m.on === 0) {
        m.x = m.tx
        m.y = m.ty
      }
      m.on = 1
    }
    const leave = () => (m.on = 0)

    parent.addEventListener("pointermove", move)
    parent.addEventListener("pointerleave", leave)
    window.addEventListener("resize", resize)

    let raf = 0
    const frame = (now: number) => {
      const t = now / 1000

      m.x += (m.tx - m.x) * 0.16
      m.y += (m.ty - m.y) * 0.16
      m.s += (m.on - m.s) * 0.08

      ctx.clearRect(0, 0, w, h)

      for (let gx = gap / 2; gx < w; gx += gap) {
        for (let gy = gap / 2; gy < h; gy += gap) {
          const dx = gx - m.x
          const dy = gy - m.y
          const r2 = dx * dx + dy * dy
          const r = Math.sqrt(r2) || 1

          const f = m.s * Math.exp(-r2 / (2 * sigma * sigma))
          const push = f * 22
          const wave = reduce ? 0 : Math.sin(t * 1.1 + (gx + gy) * 0.035)

          ctx.beginPath()
          ctx.arc(
            gx + (dx / r) * push,
            gy + (dy / r) * push,
            Math.max(1 + 0.45 * wave + f * 1.8, 0.4),
            0,
            Math.PI * 2,
          )
          ctx.fillStyle = `rgba(0,0,0,${clamp(0.12 + 0.09 * wave + f * 0.65, 0.03, 0.9)})`
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      parent.removeEventListener("pointermove", move)
      parent.removeEventListener("pointerleave", leave)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{
        WebkitMaskImage: "linear-gradient(to left, black 10%, transparent 75%)",
        maskImage: "linear-gradient(to left, black 10%, transparent 75%)",
      }}
    />
  )
}

/* ============================================================
   STATUS PILL (grayscale: filled = healthy, inverted = error)
   ============================================================ */

function StatusPill({ status }: { status: string }) {
  const error = status === "Sync error"
  const synced = status === "Synced"

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center gap-2.5 self-start rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors duration-300 sm:self-center ${
        error
          ? "border-black bg-black text-white"
          : "border-neutral-300 bg-white text-black"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {synced && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-40" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            error ? "bg-white" : "bg-black"
          } ${!synced && !error ? "animate-pulse" : ""}`}
        />
      </span>
      {status}
    </div>
  )
}

/* ============================================================
   PROGRESS RING
   Arc length = 2πr · fraction, driven by a spring so it
   overshoots a touch when a feature is switched.
   ============================================================ */

function ProgressRing({ value, max }: { value: number; max: number }) {
  const r = 30
  const C = 2 * Math.PI * r
  const { x } = useSpring(value / max, 120, 13)
  const frac = clamp(x, 0, 1.04)

  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#e5e5e5" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="black"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ opacity: frac < 0.01 ? 0 : 1 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-black">
        {value}/{max}
      </span>
    </div>
  )
}

/* ============================================================
   SUMMARY TILE
   ============================================================ */

function SummaryTile({
  label,
  value,
  on,
}: {
  label: string
  value: string
  on: boolean
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="flex items-center gap-2 text-[12px] font-medium text-neutral-500">
        <span
          className={`h-1.5 w-1.5 rounded-full border border-black transition-colors duration-300 ${
            on ? "bg-black" : "bg-transparent"
          }`}
        />
        {label}
      </p>
      <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.015em] text-black">
        {value}
      </p>
    </div>
  )
}

/* ============================================================
   SECTION + ROW
   ============================================================ */

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-start gap-3 border-b border-neutral-200 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-black">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </div>

      <div className="divide-y divide-neutral-200">{children}</div>
    </div>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-5 py-4 transition-colors duration-200 hover:bg-neutral-50">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.005em] text-black">
          {title}
        </p>
        <p className="mt-0.5 max-w-xl text-[13px] leading-5 text-neutral-500">
          {description}
        </p>
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  )
}

/* ============================================================
   BADGE
   ============================================================ */

function Badge({
  children,
  live = false,
  outline = false,
}: {
  children: ReactNode
  live?: boolean
  outline?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
        outline
          ? "border border-neutral-300 bg-white text-black"
          : "bg-neutral-100 text-black"
      }`}
    >
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-40" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
        </span>
      )}
      {children}
    </span>
  )
}

/* ============================================================
   TOGGLE: spring thumb, stretches with velocity
   ============================================================ */

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}) {
  const { x, v } = useSpring(checked ? 1 : 0, 340, 22)
  const grey = Math.round(229 - clamp(x, 0, 1) * (229 - 10))

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative block h-8 w-14 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
        disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"
      }`}
      style={{ background: `rgb(${grey},${grey},${grey})` }}
    >
      <span
        className="absolute top-1 h-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
        style={{
          left: 4 + x * 24,
          width: 24 + clamp(Math.abs(v) * 2, 0, 10),
        }}
      />
    </button>
  )
}

/* ============================================================
   THEME SWITCH
   Sliding pill position is a spring in index units; width
   stretches with |velocity| (squash & stretch).
   ============================================================ */

const THEME_OPTIONS: { value: AppTheme; label: string; icon: ReactNode }[] = [
  { value: "system", label: "System", icon: <Monitor size={15} strokeWidth={1.8} /> },
  { value: "light", label: "Light", icon: <Sun size={15} strokeWidth={1.8} /> },
  { value: "dark", label: "Dark", icon: <Moon size={15} strokeWidth={1.8} /> },
]

function ThemeSwitch({
  value,
  disabled,
  onChange,
}: {
  value: AppTheme
  disabled: boolean
  onChange: (t: AppTheme) => void
}) {
  const n = THEME_OPTIONS.length
  const index = Math.max(
    0,
    THEME_OPTIONS.findIndex((o) => o.value === value),
  )
  const { x, v } = useSpring(index, 280, 21)
  const stretch = 1 + clamp(Math.abs(v) * 0.03, 0, 0.22)

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`relative grid rounded-2xl bg-neutral-100 p-1 ${
        disabled ? "cursor-wait opacity-60" : ""
      }`}
      style={{ gridTemplateColumns: `repeat(${n}, 84px)` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-xl bg-black shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
        style={{
          width: `calc((100% - 8px) / ${n})`,
          transform: `translateX(${x * 100}%) scaleX(${stretch})`,
        }}
      />

      {THEME_OPTIONS.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
              active ? "text-white" : "text-neutral-500 hover:text-black"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}