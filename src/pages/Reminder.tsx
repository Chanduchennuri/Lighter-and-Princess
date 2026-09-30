import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, PointerEvent } from "react"

import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi"

import { Check, Clock3, Pause, TimerReset, X } from "lucide-react"

import "./Reminder.css"

import type { Task, TaskPriority } from "../lib/types"
import { getAnimationById } from "../lib/animationLibrary"

// ======================================================
// TYPES
// ======================================================

interface BackendTask {
  id: string
  title: string
  description: string | null
  due_date: string
  due_time: string
  priority: string
  repeat: string
  sound_enabled: boolean
  animation_id: string
  completed: boolean
  created_at: string
  updated_at: string
}

interface ScreenBounds {
  left: number
  top: number
  width: number
  height: number
}

interface Vec2 {
  x: number
  y: number
}

// ======================================================
// CONSTANTS
// ======================================================

const ANIMAL_SIZE = 200
const EDGE_MARGIN = 40

const PANEL_WIDTH = 320
const PANEL_HEIGHT = 235

// Fixed physics timestep (240 Hz). Physics stays identical
// on 60 / 120 / 144 Hz monitors and never explodes on lag.
const STEP = 1 / 240

// --- Entrance: a spring drives progress 0 -> 1 along a Bezier arc.
// omega = speed (rad/s)   zeta = damping (<1 = slight overshoot)
const ENTRANCE_DELAY = 0.15
const ENTRANCE_OMEGA = 4.6
const ENTRANCE_ZETA = 0.68
const ARC_BOW = 0.32 // how much the flight path curves (0 = straight line)

// --- Secondary springs (follow-through / juice)
const TILT_OMEGA = 11
const TILT_ZETA = 0.5
const POP_OMEGA = 10
const POP_ZETA = 0.42
const HOVER_OMEGA = 16
const HOVER_ZETA = 0.7

const PANEL_CLOSE_MS = 170

// ======================================================
// BACKEND TASK -> FRONTEND TASK
// ======================================================

function mapTask(raw: BackendTask): Task {
  const priority: TaskPriority =
    raw.priority === "high" ? "high" : raw.priority === "medium" ? "medium" : "low"

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    dueAt: raw.due_time,
    priority,
    animationId: raw.animation_id,
    status: raw.completed ? "completed" : "pending",
    repeat: raw.repeat,
  }
}

// ======================================================
// MATH + PHYSICS
// ======================================================

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * Damped harmonic oscillator:
 *
 *      x'' = -w^2 (x - target) - 2 z w x'
 *
 * Integrated with semi-implicit Euler (stable at fixed dt).
 * zeta < 1  -> underdamped (overshoot + settle, feels alive)
 * zeta = 1  -> critically damped (fastest, no overshoot)
 */
class Spring {
  x: number
  v = 0

  constructor(x: number) {
    this.x = x
  }

  step(target: number, omega: number, zeta: number, dt: number) {
    const a = -omega * omega * (this.x - target) - 2 * zeta * omega * this.v
    this.v += a * dt
    this.x += this.v * dt
  }
}

/** Quadratic Bezier. Works for t > 1 too, so spring overshoot continues along the path. */
function bezier(s: Vec2, c: Vec2, e: Vec2, t: number): Vec2 {
  const u = 1 - t
  return {
    x: u * u * s.x + 2 * u * t * c.x + t * t * e.x,
    y: u * u * s.y + 2 * u * t * c.y + t * t * e.y,
  }
}

interface Motion {
  start: Vec2
  control: Vec2
  target: Vec2
  pos: Vec2
  prev: Vec2
  vel: Vec2 // smoothed velocity, px / s
  progress: Spring
  tilt: Spring
  pop: Spring
  hover: Spring
  delay: number
  acc: number
  last: number
  idle: number // 0..1 blend into idle float
  settled: boolean
  reduce: boolean
}

function createMotion(start: Vec2, target: Vec2, reduce: boolean): Motion {
  const dx = target.x - start.x
  const dy = target.y - start.y
  const len = Math.hypot(dx, dy) || 1

  // Perpendicular to the travel direction -> arc bows outward.
  const control: Vec2 = {
    x: (start.x + target.x) / 2 + (-dy / len) * len * ARC_BOW,
    y: (start.y + target.y) / 2 + (dx / len) * len * ARC_BOW,
  }

  const progress = new Spring(reduce ? 1 : 0)
  const pop = new Spring(reduce ? 1 : 0.35)

  return {
    start,
    control,
    target,
    pos: { ...start },
    prev: { ...start },
    vel: { x: 0, y: 0 },
    progress,
    tilt: new Spring(0),
    pop,
    hover: new Spring(1),
    delay: reduce ? 0 : ENTRANCE_DELAY,
    acc: 0,
    last: performance.now(),
    idle: 0,
    settled: false,
    reduce,
  }
}

// ======================================================
// COMPONENT
// ======================================================

export function Reminder() {
  const appWindow = useMemo(() => getCurrentWindow(), [])

  const [task, setTask] = useState<Task | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [closing, setClosing] = useState(false)
  const [extending, setExtending] = useState(false)
  const [settled, setSettled] = useState(false)

  // Physics state lives in a ref: no React re-render per frame.
  const motionRef = useRef<Motion | null>(null)
  const currentPositionRef = useRef<Vec2>({ x: 0, y: 0 })
  const lastSentRef = useRef<Vec2 | null>(null)
  const expandedRef = useRef(false)
  const hoverRef = useRef(false)
  const animalRef = useRef<HTMLSpanElement | null>(null)

  // Native window position queue: only the LATEST position matters,
  // stale frames are dropped instead of stacking up in the IPC channel.
  const pendingPositionRef = useRef<Vec2 | null>(null)
  const movingWindowRef = useRef(false)

  // ====================================================
  // TRANSPARENT PAGE + KEYFRAMES
  // ====================================================

  useEffect(() => {
    const style = document.createElement("style")
    style.id = "lighter-princess-reminder-transparent"

    style.textContent = `
      html, body, #root {
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: visible !important;
        background: transparent !important;
        background-color: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      body { color-scheme: light; }

      /* Attention ripple: expands and fades, staggered twin rings */
      @keyframes rm-ripple {
        0%   { transform: scale(0.85); opacity: 0; }
        18%  { opacity: 0.55; }
        100% { transform: scale(1.55); opacity: 0; }
      }

      .rm-ring {
        position: absolute;
        inset: 24px;
        border-radius: 9999px;
        border: 2px solid var(--rm-halo, rgba(244, 114, 182, 0.6));
        pointer-events: none;
        opacity: 0;
        animation: rm-ripple 2.8s cubic-bezier(0.16, 0.6, 0.3, 1) infinite;
      }
      .rm-ring--2 { animation-delay: 1.4s; }

      /* Panel grows out of the animal (origin = animal center)
         with a small spring-like overshoot. */
      @keyframes rm-panel-in {
        0%   { transform: scale(0.32); opacity: 0; border-radius: 9999px; }
        55%  { opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes rm-panel-out {
        0%   { transform: scale(1); opacity: 1; }
        100% { transform: scale(0.32); opacity: 0; }
      }

      .rm-panel {
        transform-origin: 60px 60px;
        animation: rm-panel-in 420ms cubic-bezier(0.34, 1.45, 0.5, 1) both;
      }
      .rm-panel--out {
        animation: rm-panel-out ${PANEL_CLOSE_MS}ms cubic-bezier(0.4, 0, 0.9, 0.4) both;
      }

      @media (prefers-reduced-motion: reduce) {
        .rm-ring { animation: none; }
        .rm-panel, .rm-panel--out { animation-duration: 1ms; }
      }
    `

    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  // ====================================================
  // SCREEN
  // ====================================================

  const getScreenBounds = (): ScreenBounds => {
    const screen = window.screen
    return {
      left: 0,
      top: 0,
      width: screen.availWidth,
      height: screen.availHeight,
    }
  }

  // ====================================================
  // NATIVE WINDOW MOVEMENT (latest-wins queue)
  // ====================================================

  const queueWindowPosition = (x: number, y: number) => {
    pendingPositionRef.current = { x, y }

    if (movingWindowRef.current) return
    movingWindowRef.current = true

    void (async () => {
      while (pendingPositionRef.current) {
        const next = pendingPositionRef.current
        pendingPositionRef.current = null

        try {
          await appWindow.setPosition(new LogicalPosition(next.x, next.y))
        } catch (error) {
          console.error("[Reminder] Failed to move window:", error)
          pendingPositionRef.current = null
          break
        }
      }

      movingWindowRef.current = false
    })()
  }

  /** Snap to the physical pixel grid so slow motion never jitters. */
  const snap = (v: number) => {
    const dpr = window.devicePixelRatio || 1
    return Math.round(v * dpr) / dpr
  }

  const sendPosition = (x: number, y: number) => {
    const sx = snap(x)
    const sy = snap(y)
    const last = lastSentRef.current

    if (last && last.x === sx && last.y === sy) return

    lastSentRef.current = { x: sx, y: sy }
    queueWindowPosition(sx, sy)
  }

  // ====================================================
  // RESET / START POSITION
  // ====================================================

  const resetAnimal = async () => {
    const screen = getScreenBounds()

    // Start bottom-right
    const start: Vec2 = {
      x: screen.left + screen.width - ANIMAL_SIZE - EDGE_MARGIN,
      y: screen.top + screen.height - ANIMAL_SIZE - EDGE_MARGIN,
    }

    // Target center
    const target: Vec2 = {
      x: screen.left + screen.width / 2 - ANIMAL_SIZE / 2,
      y: screen.top + screen.height / 2 - ANIMAL_SIZE / 2,
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    motionRef.current = createMotion(start, target, reduce)
    currentPositionRef.current = { ...start }
    lastSentRef.current = null
    expandedRef.current = false

    setSettled(false)
    setClosing(false)
    setExpanded(false)

    try {
      await appWindow.setSize(new LogicalSize(ANIMAL_SIZE, ANIMAL_SIZE))
      await appWindow.setPosition(new LogicalPosition(snap(start.x), snap(start.y)))

      // Don't count the time spent on IPC as animation time.
      if (motionRef.current) motionRef.current.last = performance.now()
    } catch (error) {
      console.error("[Reminder] Failed to reset:", error)
    }
  }

  // ====================================================
  // LOAD TASK FROM URL
  // ====================================================

  useEffect(() => {
    let mounted = true

    async function loadTask() {
      try {
        const id = decodeURIComponent(
          window.location.pathname.split("/").filter(Boolean).pop() ?? "",
        )

        if (!id) return

        const result = await invoke<BackendTask | null>("get_task", { id })

        if (mounted && result) {
          setTask(mapTask(result))
          await resetAnimal()
        }
      } catch (error) {
        console.error("[Reminder] Failed to load task:", error)
      }
    }

    void loadTask()

    return () => {
      mounted = false
    }
  }, [])

  // ====================================================
  // REMINDER EVENT
  // ====================================================

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setup = async () => {
      try {
        unlisten = await listen<BackendTask>("reminder-task", (event) => {
          setTask(mapTask(event.payload))
          void resetAnimal()
        })
      } catch (error) {
        console.error("[Reminder] Failed to listen:", error)
      }
    }

    void setup()

    return () => {
      unlisten?.()
    }
  }, [])

  // ====================================================
  // PHYSICS LOOP
  //
  //  1. progress spring (underdamped) -> t
  //  2. window = Bezier(start, control, target, t)
  //     t overshoots ~5% past 1, then settles: glide,
  //     tiny overshoot, ease back. No fixed duration.
  //  3. velocity of the flight (low-pass filtered) drives:
  //       - tilt spring     (leans into the motion, wobbles)
  //       - squash/stretch  (elongates along the velocity)
  //  4. once settled, the native window stops moving and a
  //     layered-sine idle float fades in (smoothstep blend).
  // ====================================================

  useEffect(() => {
    let frame = 0

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate)

      const m = motionRef.current
      if (!m) return

      const dt = Math.min((now - m.last) / 1000, 0.05)
      m.last = now

      if (expandedRef.current || dt <= 0) return

      // ------------------------------------------------
      // Fixed-step integration
      // ------------------------------------------------

      if (m.delay > 0) m.delay -= dt

      const tiltTarget = clamp(m.vel.x * 0.011, -18, 18)
      const hoverTarget = hoverRef.current ? 1.09 : 1

      m.acc += dt

      while (m.acc >= STEP) {
        m.acc -= STEP

        if (!m.settled && m.delay <= 0) {
          m.progress.step(1, ENTRANCE_OMEGA, ENTRANCE_ZETA, STEP)
        }

        m.tilt.step(tiltTarget, TILT_OMEGA, TILT_ZETA, STEP)
        m.pop.step(1, POP_OMEGA, POP_ZETA, STEP)
        m.hover.step(hoverTarget, HOVER_OMEGA, HOVER_ZETA, STEP)
      }

      // ------------------------------------------------
      // Entrance: move the native window
      // ------------------------------------------------

      if (!m.settled) {
        m.pos = bezier(m.start, m.control, m.target, m.progress.x)

        const rawVx = (m.pos.x - m.prev.x) / dt
        const rawVy = (m.pos.y - m.prev.y) / dt
        const k = 1 - Math.exp(-dt * 18)

        m.vel.x += (rawVx - m.vel.x) * k
        m.vel.y += (rawVy - m.vel.y) * k
        m.prev = { ...m.pos }

        currentPositionRef.current = { ...m.pos }
        sendPosition(m.pos.x, m.pos.y)

        const arrived =
          m.delay <= 0 &&
          Math.abs(m.progress.x - 1) < 0.0008 &&
          Math.abs(m.progress.v) < 0.004

        if (arrived) {
          m.settled = true
          m.pos = { ...m.target }
          m.vel = { x: 0, y: 0 }
          currentPositionRef.current = { ...m.target }
          sendPosition(m.target.x, m.target.y)
          setSettled(true)
        }
      } else {
        // Let leftover velocity decay smoothly instead of cutting to 0.
        const k = 1 - Math.exp(-dt * 10)
        m.vel.x += (0 - m.vel.x) * k
        m.vel.y += (0 - m.vel.y) * k
      }

      // ------------------------------------------------
      // Idle blend
      // ------------------------------------------------

      m.idle = m.settled ? Math.min(1, m.idle + dt / 0.9) : 0
      const idle = m.reduce ? 0 : smoothstep(m.idle)

      // ------------------------------------------------
      // Visual transform inside the window
      // ------------------------------------------------

      const el = animalRef.current
      if (!el) return

      const t = now * 0.001

      // Layered sines = organic, non-repeating-looking float.
      const floatY = idle * (2.6 * Math.sin(t * 1.35) + 0.7 * Math.sin(t * 2.7 + 1.1))
      const idleRot = idle * 1.4 * Math.sin(t * 0.95)
      const breath = 1 + idle * 0.014 * Math.sin(t * 1.35 - 0.6)

      // Squash & stretch along the direction of travel.
      const speed = Math.hypot(m.vel.x, m.vel.y)
      const stretch = m.reduce ? 0 : clamp((speed / 1200) * 0.12, 0, 0.14)
      const theta = Math.atan2(m.vel.y, m.vel.x)

      const scale = m.pop.x * m.hover.x * breath
      const rotation = m.tilt.x + idleRot

      el.style.transform =
        `translate3d(0, ${floatY.toFixed(2)}px, 0) ` +
        `rotate(${rotation.toFixed(2)}deg) ` +
        `rotate(${theta.toFixed(3)}rad) ` +
        `scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.75).toFixed(3)}) ` +
        `rotate(${(-theta).toFixed(3)}rad) ` +
        `scale(${scale.toFixed(3)})`
    }

    frame = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(frame)
  }, [])

  // ====================================================
  // CLOSE
  // ====================================================

  const closeReminder = async () => {
    try {
      await appWindow.close()
    } catch (error) {
      console.error("[Reminder] Close failed:", error)
    }
  }

  // ====================================================
  // OPEN PANEL
  //
  // Resize the native window FIRST, then reveal the panel,
  // so the grow animation is never clipped.
  // ====================================================

  const openPanel = async (event: PointerEvent) => {
    event.stopPropagation()

    if (expandedRef.current) return
    expandedRef.current = true

    const current = currentPositionRef.current

    try {
      await appWindow.setSize(new LogicalSize(PANEL_WIDTH, PANEL_HEIGHT))
      await appWindow.setPosition(new LogicalPosition(snap(current.x), snap(current.y)))

      setClosing(false)
      setExpanded(true)

      await appWindow.setFocus()
    } catch (error) {
      console.error("[Reminder] Panel open failed:", error)
    }
  }

  // ====================================================
  // COLLAPSE PANEL
  //
  // Play the exit animation, THEN shrink the native window.
  // ====================================================

  const collapsePanel = async (event?: PointerEvent) => {
    event?.stopPropagation()

    if (!expandedRef.current || closing) return

    setClosing(true)

    await new Promise((resolve) => setTimeout(resolve, PANEL_CLOSE_MS))

    const current = currentPositionRef.current

    try {
      await appWindow.setSize(new LogicalSize(ANIMAL_SIZE, ANIMAL_SIZE))
      await appWindow.setPosition(new LogicalPosition(snap(current.x), snap(current.y)))
    } catch (error) {
      console.error("[Reminder] Panel close failed:", error)
    }

    // Resume the physics loop where it left off (no jump).
    if (motionRef.current) motionRef.current.last = performance.now()

    expandedRef.current = false
    setExpanded(false)
    setClosing(false)
  }

  // ====================================================
  // FINISH
  // ====================================================

  const finishTask = async () => {
    if (!task) return

    try {
      await invoke("complete_task", { id: task.id, completed: true })
      await closeReminder()
    } catch (error) {
      console.error("[Reminder] Finish failed:", error)
    }
  }

  // ====================================================
  // EXTEND
  // ====================================================

  const extendTask = async (minutes: number) => {
    if (!task || extending) return

    try {
      setExtending(true)

      const updated = await invoke<BackendTask>("extend_task", {
        id: task.id,
        minutes,
      })

      setTask(mapTask(updated))
    } catch (error) {
      console.error("[Reminder] Extend failed:", error)
    } finally {
      setExtending(false)
    }
  }

  // ====================================================
  // SELECT ANIMATION
  // ====================================================

  const selectedAnimation = useMemo(() => {
    if (!task) return null
    return getAnimationById(task.animationId)
  }, [task])

  if (!task) return null

  if (!selectedAnimation) {
    console.error("[Reminder] Unknown animation ID:", task.animationId)
    return null
  }

  // Ripple color follows priority.
  const haloColor =
    task.priority === "high"
      ? "rgba(239, 68, 68, 0.65)"
      : task.priority === "medium"
        ? "rgba(245, 158, 11, 0.65)"
        : "rgba(244, 114, 182, 0.6)"

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main
      className="h-full w-full overflow-visible bg-transparent select-none"
      style={{ backgroundColor: "transparent" }}
    >
      {/* ANIMAL */}

      {!expanded && (
        <button
          type="button"
          aria-label="Open reminder"
          onPointerDown={openPanel}
          onPointerEnter={() => {
            hoverRef.current = true
          }}
          onPointerLeave={() => {
            hoverRef.current = false
          }}
          className="absolute left-0 top-0 m-0 flex h-[200px] w-[200px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none"
          style={{ "--rm-halo": haloColor } as CSSProperties}
        >
          {settled && (
            <>
              <span className="rm-ring" />
              <span className="rm-ring rm-ring--2" />
            </>
          )}

          <span
            ref={animalRef}
            className="flex h-full w-full select-none items-center justify-center bg-transparent text-[84px] leading-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.18)]"
            style={{
              transformOrigin: "center center",
              willChange: "transform",
            }}
          >
            {selectedAnimation.mediaSrc &&
            (selectedAnimation.mediaType === "image" ||
              selectedAnimation.mediaType === "gif") ? (
              <img
                src={selectedAnimation.mediaSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
            ) : (
              selectedAnimation.preview
            )}
          </span>
        </button>
      )}

      {/* TASK PANEL */}

      {expanded && (
        <section
          onPointerDown={(event) => event.stopPropagation()}
          className={`rm-panel ${closing ? "rm-panel--out" : ""} relative h-[235px] w-[320px] overflow-hidden rounded-2xl border border-black/10 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.20)]`}
        >
          {/* Header */}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Reminder
              </p>

              <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
                {task.title}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Collapse reminder"
              onPointerDown={collapsePanel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
            >
              <X size={13} />
            </button>
          </div>

          {/* Description */}

          {task.description && (
            <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">
              {task.description}
            </p>
          )}

          {/* Metadata */}

          <div className="mt-3 flex gap-2">
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] text-slate-500">
              <Clock3 size={9} />
              {task.dueAt}
            </span>

            <span
              className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${
                task.priority === "high"
                  ? "bg-red-50 text-red-500"
                  : task.priority === "medium"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {task.priority}
            </span>
          </div>

          {/* Extend */}

          <div className="mt-4">
            <p className="mb-1.5 text-[9px] font-medium text-slate-400">Extend</p>

            <div className="grid grid-cols-3 gap-1.5">
              {[5, 10, 30].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  disabled={extending}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    void extendTask(minutes)
                  }}
                  className="flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-[9px] font-semibold text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-95 disabled:opacity-40"
                >
                  <TimerReset size={10} />+{minutes}m
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation()
                void closeReminder()
              }}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[9px] font-semibold text-slate-500 transition-all duration-150 hover:bg-slate-50 active:scale-95"
            >
              <Pause size={10} />
              Stop
            </button>

            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation()
                void finishTask()
              }}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-[9px] font-semibold text-white transition-all duration-150 hover:bg-slate-800 active:scale-95"
            >
              <Check size={10} />
              Finish
            </button>
          </div>
        </section>
      )}
    </main>
  )
}