import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Bell,
  Check,
  Repeat2,
  Volume2,
  VolumeX,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"

import { invoke } from "@tauri-apps/api/core"

import { useAnimationSelection } from "../../lib/appState"

import {
  animationLibrary,
  getAnimationById,
  type AnimationItem,
} from "../../lib/animationLibrary"

type Priority = "low" | "medium" | "high"

type RepeatOption = "none" | "daily" | "weekdays" | "weekly"

export interface Task {
  id: string
  title: string
  description: string | null
  due_date: string
  due_time: string
  priority: Priority
  repeat: string
  sound_enabled: boolean
  animation_id: string
  completed: boolean
  created_at: string
  updated_at: string
}

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void | Promise<void>
  task?: Task | null
}

/* ================================================================== */
/*  PHYSICS                                                           */
/* ------------------------------------------------------------------ */
/*  useSpring integrates a damped harmonic oscillator                 */
/*                                                                    */
/*      x'' = -k (x - target) - c x'                                  */
/*                                                                    */
/*  with semi-implicit Euler and 4 sub-steps per frame for stability. */
/*  Damping ratio ζ = c / (2√k):  ζ < 1 overshoots and wobbles,       */
/*  ζ ≈ 1 settles fastest, ζ > 1 creeps.                              */
/* ================================================================== */

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

  // Give the spring an instant push (adds velocity)
  const kick = useCallback(
    (dv: number) => {
      state.current.v += dv
      run()
    },
    [run],
  )

  return { x: state.current.x, v: state.current.v, kick }
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

/* ================================================================== */
/*  COMPONENT                                                         */
/* ================================================================== */

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
  task = null,
}: CreateTaskDialogProps) {
  const isEditing = Boolean(task)

  const { selectedAnimationId, setSelectedAnimationId } =
    useAnimationSelection()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(today())
  const [time, setTime] = useState("14:30")
  const [priority, setPriority] = useState<Priority>("medium")
  const [repeat, setRepeat] = useState<RepeatOption>("none")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [animationId, setAnimationId] = useState(selectedAnimationId)

  // Latest default animation, readable inside effects without re-triggering them
  const defaultAnimationRef = useRef(selectedAnimationId)
  defaultAnimationRef.current = selectedAnimationId

  function resetForm() {
    setTitle("")
    setDescription("")
    setDate(today())
    setTime("14:30")
    setPriority("medium")
    setRepeat("none")
    setSoundEnabled(true)
    setAnimationId(defaultAnimationRef.current)
  }

  function loadTask(t: Task) {
    setTitle(t.title)
    setDescription(t.description ?? "")
    setDate(t.due_date)
    setTime(t.due_time)
    setPriority(t.priority)
    setRepeat(t.repeat as RepeatOption)
    setSoundEnabled(t.sound_enabled)
    setAnimationId(t.animation_id)
  }

  // Only re-run when the dialog opens or the task changes.
  // (Previously it also depended on selectedAnimationId, which wiped the
  //  whole form whenever you picked an animation in create mode.)
  useEffect(() => {
    if (!open) return
    if (task) loadTask(task)
    else resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task])

  function handleClose() {
    resetForm()
    onOpenChange(false)
  }

  function handleAnimationSelect(id: string) {
    if (!getAnimationById(id)) return
    setAnimationId(id)
    if (!isEditing) setSelectedAnimationId(id)
  }

  const selectedAnimation = getAnimationById(animationId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || saving) return

    const taskData = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: date,
      due_time: time,
      priority,
      repeat,
      sound_enabled: soundEnabled,
      animation_id: animationId,
    }

    try {
      setSaving(true)

      if (isEditing && task) {
        const updatedTask = await invoke("update_task", {
          task: { id: task.id, ...taskData },
        })
        console.log("TASK UPDATED:", updatedTask)
      } else {
        const createdTask = await invoke("create_task", {
          task: taskData,
        })
        console.log("TASK CREATED:", createdTask)
      }

      await onCreated?.()
      handleClose()
    } catch (error) {
      console.error(
        isEditing ? "FAILED TO UPDATE TASK:" : "FAILED TO CREATE TASK:",
        error,
      )
    } finally {
      setSaving(false)
    }
  }

  const when = describeWhen(date, time)

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm()
        onOpenChange(value)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-neutral-200 bg-white p-0 sm:max-w-[640px]">
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            [data-ct] * { animation-duration: 1ms !important; transition-duration: 1ms !important; }
          }
          @keyframes ct-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
        `}</style>

        <div data-ct>
          {/* ---------- Header: dot field + swinging bell ---------- */}
          <DialogHeader className="relative overflow-hidden border-b border-neutral-200 px-7 py-7">
            <DotField />

            <div className="relative z-10 flex items-center gap-4">
              <SwingingBell />

              <div className="text-left">
                <DialogTitle className="text-lg font-semibold tracking-tight text-black">
                  {isEditing ? "Edit reminder" : "New reminder"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[13px] text-neutral-500">
                  {isEditing
                    ? "Change when and how this reminder appears."
                    : "Pick a time and we'll nudge you."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-9 px-7 py-8">
              {/* ---------- Task ---------- */}
              <section>
                <UnderlineInput className="text-xl font-semibold tracking-tight">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What do you need to remember?"
                    autoFocus
                    className="w-full bg-transparent py-3 text-xl font-semibold tracking-tight text-black outline-none placeholder:text-neutral-300"
                  />
                </UnderlineInput>

                <UnderlineInput>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add details (optional)"
                    rows={2}
                    className="w-full resize-none bg-transparent py-3 text-sm leading-6 text-neutral-700 outline-none placeholder:text-neutral-300"
                  />
                </UnderlineInput>
              </section>

              {/* ---------- Schedule: inputs + spring clock ---------- */}
              <section>
                <Label>When</Label>

                <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <LabeledInput label="Date">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="h-9 w-full bg-transparent text-sm tabular-nums text-black outline-none"
                        />
                      </LabeledInput>

                      <LabeledInput label="Time">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="h-9 w-full bg-transparent text-sm tabular-nums text-black outline-none"
                        />
                      </LabeledInput>
                    </div>

                    <div className="rounded-xl bg-black px-4 py-3 text-white">
                      <p className="text-sm font-semibold tabular-nums">
                        {when.label}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {when.relative}
                      </p>
                    </div>
                  </div>

                  <AnalogClock time={time} />
                </div>
              </section>

              {/* ---------- Priority ---------- */}
              <section>
                <Label>Priority</Label>
                <Segmented<Priority>
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: "low", label: "Low", icon: <Bars level={1} /> },
                    { value: "medium", label: "Medium", icon: <Bars level={2} /> },
                    { value: "high", label: "High", icon: <Bars level={3} /> },
                  ]}
                />
              </section>

              {/* ---------- Repeat ---------- */}
              <section>
                <Label icon={<Repeat2 size={13} />}>Repeat</Label>
                <Segmented<RepeatOption>
                  value={repeat}
                  onChange={setRepeat}
                  options={[
                    { value: "none", label: "Once" },
                    { value: "daily", label: "Daily" },
                    { value: "weekdays", label: "Weekdays" },
                    { value: "weekly", label: "Weekly" },
                  ]}
                />
              </section>

              {/* ---------- Sound ---------- */}
              <section>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  aria-pressed={soundEnabled}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-200 px-4 py-3.5 text-left transition hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-black">
                      {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-black">
                        Notification sound
                      </p>
                      <p className="text-xs text-neutral-500">
                        {soundEnabled
                          ? "Plays when the reminder goes off."
                          : "The reminder will be silent."}
                      </p>
                    </div>
                  </div>

                  <Toggle checked={soundEnabled} />
                </button>
              </section>

              {/* ---------- Animation ---------- */}
              <section>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <Label className="mb-1">Animation</Label>
                    <p className="text-xs text-neutral-500">
                      {isEditing
                        ? "Saved with this reminder."
                        : "Your pick also becomes the default for new reminders."}
                    </p>
                  </div>

                  {selectedAnimation && (
                    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-neutral-200 py-1 pl-1 pr-3.5">
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-base">
                        <AnimationVisual animation={selectedAnimation} />
                      </span>
                      <span className="max-w-[120px] truncate text-xs font-medium text-black">
                        {selectedAnimation.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid max-h-[380px] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
                  {animationLibrary.map((animation) => (
                    <AnimationCard
                      key={animation.id}
                      animation={animation}
                      selected={animation.id === animationId}
                      onSelect={() => handleAnimationSelect(animation.id)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* ---------- Footer ---------- */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white/90 px-7 py-4 backdrop-blur">
              <button
                type="button"
                onClick={handleClose}
                className="h-11 rounded-xl px-4 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                Cancel
              </button>

              <MagneticButton disabled={saving || !title.trim()}>
                <Check size={15} />
                {saving
                  ? isEditing
                    ? "Saving…"
                    : "Creating…"
                  : isEditing
                    ? "Save changes"
                    : "Create reminder"}
              </MagneticButton>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ================================================================== */
/*  HELPERS                                                           */
/* ================================================================== */

function today() {
  return new Date().toISOString().split("T")[0]
}

function describeWhen(date: string, time: string) {
  const d = new Date(`${date}T${time || "00:00"}`)
  if (Number.isNaN(d.getTime())) {
    return { label: "Choose a date and time", relative: "" }
  }

  const now = new Date()
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 864e5)

  const day =
    dayDiff === 0
      ? "Today"
      : dayDiff === 1
        ? "Tomorrow"
        : dayDiff === -1
          ? "Yesterday"
          : d.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })

  const clock = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })

  const ms = d.getTime() - now.getTime()
  if (ms <= 0) return { label: `${day} at ${clock}`, relative: "This time has passed" }

  const mins = Math.round(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const rem = mins % 60

  const parts = [
    days && `${days}d`,
    hours && `${hours}h`,
    !days && `${rem}m`,
  ].filter(Boolean)

  return { label: `${day} at ${clock}`, relative: `In ${parts.join(" ")}` }
}

/* ================================================================== */
/*  HEADER: DOT FIELD                                                 */
/* ------------------------------------------------------------------ */
/*  Grid of dots. Each dot has                                        */
/*   • an ambient traveling wave   sin(ωt + φ(x, y))                  */
/*   • a Gaussian repulsion from the cursor  exp(-r² / 2σ²)           */
/*     pushing along the radial unit vector                           */
/* ================================================================== */

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
    const sigma = 70
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

    const mouse = { tx: -999, ty: -999, x: -999, y: -999, on: 0, s: 0 }

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.tx = e.clientX - r.left
      mouse.ty = e.clientY - r.top
      if (mouse.on === 0) {
        mouse.x = mouse.tx
        mouse.y = mouse.ty
      }
      mouse.on = 1
    }
    const leave = () => (mouse.on = 0)

    parent.addEventListener("pointermove", move)
    parent.addEventListener("pointerleave", leave)
    window.addEventListener("resize", resize)

    let raf = 0
    const frame = (now: number) => {
      const t = now / 1000

      // Exponential smoothing of the cursor + strength envelope
      mouse.x += (mouse.tx - mouse.x) * 0.16
      mouse.y += (mouse.ty - mouse.y) * 0.16
      mouse.s += (mouse.on - mouse.s) * 0.08

      ctx.clearRect(0, 0, w, h)

      for (let gx = gap / 2; gx < w; gx += gap) {
        for (let gy = gap / 2; gy < h; gy += gap) {
          const dx = gx - mouse.x
          const dy = gy - mouse.y
          const r2 = dx * dx + dy * dy
          const r = Math.sqrt(r2) || 1

          const f = mouse.s * Math.exp(-r2 / (2 * sigma * sigma))
          const push = f * 20

          const wave = reduce ? 0 : Math.sin(t * 1.1 + (gx + gy) * 0.035)

          const x = gx + (dx / r) * push
          const y = gy + (dy / r) * push
          const size = 1 + 0.45 * wave + f * 1.8
          const alpha = 0.14 + 0.1 * wave + f * 0.65

          ctx.beginPath()
          ctx.arc(x, y, Math.max(size, 0.4), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(0,0,0,${clamp(alpha, 0.03, 0.9)})`
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
        WebkitMaskImage: "linear-gradient(to right, black 15%, transparent 95%)",
        maskImage: "linear-gradient(to right, black 15%, transparent 95%)",
      }}
    />
  )
}

/* ================================================================== */
/*  BELL: damped pendulum                                             */
/*      θ(t) = A e^(-γt) cos(ωt)                                      */
/*  (an under-damped spring, kicked once on mount)                    */
/* ================================================================== */

function SwingingBell() {
  const { x, kick } = useSpring(0, 55, 2.6)

  useEffect(() => {
    const id = setTimeout(() => kick(520), 180)
    return () => clearTimeout(id)
  }, [kick])

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={() => kick(520)}
      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white"
    >
      <Bell
        size={18}
        style={{
          transform: `rotate(${x}deg)`,
          transformOrigin: "50% 10%",
        }}
      />
    </button>
  )
}

/* ================================================================== */
/*  CLOCK                                                             */
/* ------------------------------------------------------------------ */
/*  Hand tip = center + L·(sin θ, −cos θ).                            */
/*  Angles are springs; the target is unwrapped so 11:59 → 12:00      */
/*  rotates forward one minute instead of spinning back 359°:         */
/*      θ' = θ + 360·round((θ_prev − θ) / 360)                        */
/* ================================================================== */

function useUnwrapped(angle: number) {
  const prev = useRef(angle)
  const out = angle + 360 * Math.round((prev.current - angle) / 360)
  prev.current = out
  return out
}

function AnalogClock({ time }: { time: string }) {
  const [hh, mm] = time.split(":").map((n) => Number(n))
  const h = Number.isFinite(hh) ? hh : 0
  const m = Number.isFinite(mm) ? mm : 0

  const hourTarget = useUnwrapped(((h % 12) + m / 60) * 30)
  const minuteTarget = useUnwrapped(m * 6)

  const hour = useSpring(hourTarget, 90, 11)
  const minute = useSpring(minuteTarget, 130, 11)

  const point = (deg: number, len: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: 50 + len * Math.sin(rad), y: 50 - len * Math.cos(rad) }
  }

  const hourTip = point(hour.x, 22)
  const hourTail = point(hour.x + 180, 5)
  const minTip = point(minute.x, 33)
  const minTail = point(minute.x + 180, 7)

  return (
    <div className="mx-auto flex flex-col items-center">
      <svg
        viewBox="0 0 100 100"
        className="h-[120px] w-[120px]"
        role="img"
        aria-label={`Analog clock showing ${time}`}
      >
        <circle cx="50" cy="50" r="47" fill="white" stroke="black" strokeWidth="1.5" />

        {Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0
          const quarter = i % 15 === 0
          const a = point(i * 6, 43)
          const b = point(i * 6, quarter ? 35 : major ? 38 : 41)
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="black"
              strokeOpacity={major ? 1 : 0.25}
              strokeWidth={quarter ? 1.8 : major ? 1.2 : 0.6}
              strokeLinecap="round"
            />
          )
        })}

        <line
          x1={hourTail.x}
          y1={hourTail.y}
          x2={hourTip.x}
          y2={hourTip.y}
          stroke="black"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <line
          x1={minTail.x}
          y1={minTail.y}
          x2={minTip.x}
          y2={minTip.y}
          stroke="black"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="3" fill="black" />
        <circle cx="50" cy="50" r="1.1" fill="white" />
      </svg>

      <span className="mt-1.5 text-[11px] font-medium tabular-nums text-neutral-500">
        {h >= 12 ? "PM" : "AM"}
      </span>
    </div>
  )
}

/* ================================================================== */
/*  SEGMENTED CONTROL                                                 */
/*  Indicator position is a spring in "index units"; its width        */
/*  stretches with |velocity| (squash-and-stretch).                   */
/* ================================================================== */

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  const n = options.length
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const { x, v } = useSpring(index, 280, 21)
  const stretch = 1 + clamp(Math.abs(v) * 0.03, 0, 0.22)

  return (
    <div
      role="radiogroup"
      className="relative grid rounded-2xl bg-neutral-100 p-1"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-xl bg-black shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
        style={{
          width: `calc((100% - 8px) / ${n})`,
          transform: `translateX(${x * 100}%) scaleX(${stretch})`,
        }}
      />

      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 flex h-10 items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
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

function Bars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={i * 5}
          y={12 - (i + 1) * 4}
          width="3.4"
          height={(i + 1) * 4}
          rx="1"
          fill="currentColor"
          opacity={i < level ? 1 : 0.3}
        />
      ))}
    </svg>
  )
}

/* ================================================================== */
/*  TOGGLE: spring thumb that stretches when it moves                 */
/* ================================================================== */

function Toggle({ checked }: { checked: boolean }) {
  const { x, v } = useSpring(checked ? 1 : 0, 340, 22)
  const grey = Math.round(229 - clamp(x, 0, 1) * (229 - 10))

  return (
    <span
      className="relative block h-7 w-12 shrink-0 rounded-full"
      style={{ background: `rgb(${grey},${grey},${grey})` }}
    >
      <span
        className="absolute top-1 h-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
        style={{
          left: 4 + x * 20,
          width: 20 + clamp(Math.abs(v) * 2, 0, 9),
          transform: v > 0 ? "none" : undefined,
        }}
      />
    </span>
  )
}

/* ================================================================== */
/*  ANIMATION CARD                                                    */
/*  Pointer → normalized coords (nx, ny) ∈ [-1, 1]                    */
/*  rotateY = 10·nx, rotateX = −10·ny, all through springs.           */
/*  A radial "spotlight" tracks the cursor via CSS variables.         */
/* ================================================================== */

function AnimationCard({
  animation,
  selected,
  onSelect,
}: {
  animation: AnimationItem
  selected: boolean
  onSelect: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [t, setT] = useState({ rx: 0, ry: 0, s: 1 })
  const [hover, setHover] = useState(false)

  const rx = useSpring(t.rx, 220, 20)
  const ry = useSpring(t.ry, 220, 20)
  const sc = useSpring(t.s, 320, 17)

  // Pop when it becomes selected
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (selected) sc.kick(10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    const nx = (px / r.width) * 2 - 1
    const ny = (py / r.height) * 2 - 1

    el.style.setProperty("--mx", `${px}px`)
    el.style.setProperty("--my", `${py}px`)
    setT((p) => ({ rx: -ny * 10, ry: nx * 10, s: p.s === 0.95 ? 0.95 : 1.04 }))
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onPointerEnter={() => setHover(true)}
      onPointerMove={onMove}
      onPointerLeave={() => {
        setHover(false)
        setT({ rx: 0, ry: 0, s: 1 })
      }}
      onPointerDown={() => setT((p) => ({ ...p, s: 0.95 }))}
      onPointerUp={() => setT((p) => ({ ...p, s: 1.04 }))}
      className={`relative overflow-hidden rounded-2xl border p-2.5 text-left will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
        selected
          ? "border-black bg-neutral-50 shadow-[0_10px_28px_rgba(0,0,0,0.14)]"
          : "border-neutral-200 bg-white"
      }`}
      style={{
        transform: `perspective(700px) rotateX(${rx.x}deg) rotateY(${ry.x}deg) scale(${sc.x})`,
        transition: "border-color 200ms, background-color 200ms, box-shadow 200ms",
      }}
    >
      {/* spotlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0,
          background:
            "radial-gradient(130px circle at var(--mx, 50%) var(--my, 50%), rgba(0,0,0,0.08), transparent 65%)",
        }}
      />

      {/* check, stroke drawn with pathLength=1 */}
      <span
        className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black transition-transform duration-300"
        style={{
          transform: selected ? "scale(1)" : "scale(0)",
          transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            key={String(selected)}
            d="M2.5 6.5l2.3 2.3 4.7-5"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            style={{
              animation: selected ? "ct-draw 380ms 120ms ease-out both" : undefined,
            }}
          />
        </svg>
      </span>

      <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 text-3xl">
        <AnimationVisual animation={animation} />
      </div>

      <p className="relative mt-2.5 truncate text-[13px] font-medium text-black">
        {animation.name}
      </p>
      <p className="relative mt-0.5 truncate text-xs text-neutral-500">
        {animation.category}
      </p>
    </button>
  )
}

/* ================================================================== */
/*  MAGNETIC BUTTON                                                   */
/*  The button is pulled toward the cursor:                           */
/*      offset = clamp(k · (cursor − center))                         */
/*  and released with a springy overshoot.                            */
/* ================================================================== */

function MagneticButton({
  children,
  disabled,
}: {
  children: ReactNode
  disabled?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState({ x: 0, y: 0, s: 1 })

  const sx = useSpring(target.x, 200, 13)
  const sy = useSpring(target.y, 200, 13)
  const ss = useSpring(target.s, 320, 16)

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    const el = wrap.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    setTarget((p) => ({
      ...p,
      x: clamp(dx * 0.3, -10, 10),
      y: clamp(dy * 0.4, -6, 6),
    }))
  }

  return (
    // Padding gives the magnet a larger catch area than the button itself
    <div
      ref={wrap}
      className="-m-3 p-3"
      onPointerMove={onMove}
      onPointerLeave={() => setTarget({ x: 0, y: 0, s: 1 })}
      onPointerDown={() => !disabled && setTarget((p) => ({ ...p, s: 0.94 }))}
      onPointerUp={() => setTarget((p) => ({ ...p, s: 1 }))}
    >
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-black px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
        style={{
          transform: `translate(${sx.x}px, ${sy.x}px) scale(${ss.x})`,
        }}
      >
        {children}
      </button>
    </div>
  )
}

/* ================================================================== */
/*  SMALL PIECES                                                      */
/* ================================================================== */

function AnimationVisual({ animation }: { animation: AnimationItem }) {
  if (
    animation.mediaSrc &&
    (animation.mediaType === "image" || animation.mediaType === "gif")
  ) {
    return (
      <img
        src={animation.mediaSrc}
        alt={animation.name}
        draggable={false}
        className="h-full w-full select-none object-contain"
      />
    )
  }

  return (
    <span aria-hidden="true" className="select-none leading-none">
      {animation.preview}
    </span>
  )
}

function Label({
  children,
  icon,
  className = "",
}: {
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <p
      className={`mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-black ${className}`}
    >
      {icon && <span className="text-neutral-400">{icon}</span>}
      {children}
    </p>
  )
}

// Input with a hairline that draws itself left→right on focus
function UnderlineInput({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`group relative border-b border-neutral-200 ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="absolute -bottom-px left-0 h-[2px] w-full origin-left scale-x-0 bg-black transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-focus-within:scale-x-100"
      />
    </div>
  )
}

function LabeledInput({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block rounded-xl border border-neutral-200 bg-white px-3.5 pt-2 transition focus-within:border-black focus-within:ring-4 focus-within:ring-neutral-100">
      <span className="text-[11px] font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  )
}