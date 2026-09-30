import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Search,
  X,
} from "lucide-react"

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react"

import { CreateTaskDialog } from "../components/tasks/CreateTaskDialog"
import { useTasks } from "../lib/appState"
import { getAnimationById } from "../lib/animationLibrary"
import type { DatabaseTask } from "../lib/types"

/* ============================================================
   CONSTANTS
   ============================================================ */

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const MAX_TASKS_PER_DAY = 2

type StatusFilter = "all" | "active" | "done"

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
]

// Physics (fixed timestep spring, used for animated counters)
const STEP = 1 / 240

/* ============================================================
   PHYSICS
   Damped harmonic oscillator: x'' = -w^2 (x - target) - 2 z w x'
   ============================================================ */

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

/** Number that springs to its target instead of snapping. */
function useSpringNumber(target: number) {
  const [value, setValue] = useState(target)
  const springRef = useRef(new Spring(target))

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      springRef.current.x = target
      setValue(target)
      return
    }

    const spring = springRef.current
    let frame = 0
    let last = performance.now()
    let acc = 0

    const loop = (now: number) => {
      acc += Math.min((now - last) / 1000, 0.05)
      last = now

      while (acc >= STEP) {
        acc -= STEP
        spring.step(target, 14, 0.8, STEP)
      }

      const settled =
        Math.abs(spring.x - target) < 0.01 && Math.abs(spring.v) < 0.01

      if (settled) {
        spring.x = target
        spring.v = 0
        setValue(target)
        return
      }

      setValue(Math.round(spring.x))
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(frame)
  }, [target])

  return value
}

function AnimatedNumber({ value }: { value: number }) {
  return <>{useSpringNumber(value)}</>
}

/* ============================================================
   DATE + TASK HELPERS
   ============================================================ */

const pad = (n: number) => String(n).padStart(2, "0")

function toKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}

function parseDue(date: string, time: string): Date | null {
  const [y, m, d] = (date ?? "").split("-").map(Number)
  const [hh, mm] = (time || "00:00").split(":").map(Number)

  if ([y, m, d].some((n) => Number.isNaN(n) || n === undefined)) return null

  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

function isOverdue(task: DatabaseTask, now: Date) {
  if (task.completed) return false
  const due = parseDue(task.due_date, task.due_time)
  return due !== null && due.getTime() < now.getTime()
}

/** "in 2h 15m", "40m ago", "in 3d" */
function relativeLabel(due: Date, now: Date) {
  const diffMin = Math.round((due.getTime() - now.getTime()) / 60000)
  const abs = Math.abs(diffMin)

  let text: string

  if (abs < 1) return "now"
  if (abs < 60) text = `${abs}m`
  else if (abs < 1440) {
    const h = Math.floor(abs / 60)
    const m = abs % 60
    text = m ? `${h}h ${m}m` : `${h}h`
  } else text = `${Math.floor(abs / 1440)}d`

  return diffMin > 0 ? `in ${text}` : `${text} ago`
}

function formatTaskTime(value: string) {
  if (!value) return "--:--"

  const [hours, minutes] = value.split(":")
  const hour = Number(hours)

  if (Number.isNaN(hour)) return value

  return `${hour % 12 || 12}:${minutes ?? "00"} ${hour >= 12 ? "PM" : "AM"}`
}

const byTime = (a: DatabaseTask, b: DatabaseTask) =>
  (a.due_time ?? "").localeCompare(b.due_time ?? "")

/* ============================================================
   STYLES
   ============================================================ */

const CSS = `
  /* Cells wave in from the direction of travel, diagonally staggered. */
  @keyframes cal-cell-in {
    from { opacity: 0; transform: translate3d(var(--dx, 0px), 8px, 0) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .cal-cell-in {
    animation: cal-cell-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--d, 0ms);
  }

  /* The selection marker slides between days with a slight overshoot. */
  .cal-select {
    transition: transform 420ms cubic-bezier(0.34, 1.35, 0.64, 1);
    will-change: transform;
  }

  /* Cursor spotlight over the grid. */
  .cal-spot {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: 0;
    transition: opacity 250ms ease;
    background: radial-gradient(
      260px circle at var(--mx, 50%) var(--my, 50%),
      rgba(23, 32, 51, 0.055),
      transparent 70%
    );
  }
  .cal-grid:hover .cal-spot { opacity: 1; }

  @keyframes cal-pop {
    from { opacity: 0; transform: translateY(-6px) scale(0.96); }
    to   { opacity: 1; transform: none; }
  }
  .cal-pop {
    transform-origin: top left;
    animation: cal-pop 260ms cubic-bezier(0.22, 1.2, 0.36, 1) both;
  }

  @keyframes cal-item-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  .cal-item-in {
    animation: cal-item-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--d, 0ms);
  }

  .cal-ring { transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1); }

  @media (prefers-reduced-motion: reduce) {
    .cal-cell-in, .cal-pop, .cal-item-in { animation: none; }
    .cal-select, .cal-ring { transition: none; }
  }
`

const spotlight = (event: PointerEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`)
}

/* ============================================================
   CALENDAR
   ============================================================ */

export function Calendar() {
  /* "now" refreshes every 30s so overdue state, countdowns and
     the today marker stay correct, even past midnight. */

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()
  const todayDay = now.getDate()

  const { getTasksForMonth, tasksLoading, tasksError } = useTasks()

  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */

  const [currentDate, setCurrentDate] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )

  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate())
  const [direction, setDirection] = useState<1 | -1>(1)

  const [createTaskOpen, setCreateTaskOpen] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear())

  const cellRefs = useRef(new Map<number, HTMLButtonElement>())
  const focusPendingRef = useRef(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  /* ==========================================================
     MONTH METADATA
     ========================================================== */

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Monday-first: Sunday (0) -> 6, Monday (1) -> 0
  const firstDay = new Date(year, month, 1).getDay()
  const startingOffset = firstDay === 0 ? 6 : firstDay - 1

  const rows = Math.ceil((startingOffset + daysInMonth) / 7)

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = Array(startingOffset).fill(null)

    for (let day = 1; day <= daysInMonth; day++) days.push(day)

    // Pad the last row so the grid always ends cleanly.
    while (days.length < rows * 7) days.push(null)

    return days
  }, [startingOffset, daysInMonth, rows])

  /* ==========================================================
     TASKS
     ========================================================== */

  const tasks = useMemo(
    () => getTasksForMonth(year, month + 1),
    [getTasksForMonth, year, month],
  )

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase()

    return tasks.filter((task) => {
      if (statusFilter === "active" && task.completed) return false
      if (statusFilter === "done" && !task.completed) return false

      if (q) {
        const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [tasks, statusFilter, query])

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, DatabaseTask[]> = {}

    for (const task of filteredTasks) {
      ;(grouped[task.due_date] ??= []).push(task)
    }

    for (const key of Object.keys(grouped)) grouped[key].sort(byTime)

    return grouped
  }, [filteredTasks])

  const getTasksForDay = (day: number) => tasksByDate[toKey(year, month, day)] ?? []

  /* ==========================================================
     SUMMARY (always unfiltered)
     ========================================================== */

  const activeMonthTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks])
  const completedMonthTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks])

  const overdueCount = useMemo(
    () => activeMonthTasks.filter((t) => isOverdue(t, now)).length,
    [activeMonthTasks, now],
  )

  const completion = tasks.length ? completedMonthTasks.length / tasks.length : 0

  const nextUp = useMemo(() => {
    let best: { task: DatabaseTask; due: Date } | null = null

    for (const task of activeMonthTasks) {
      const due = parseDue(task.due_date, task.due_time)

      if (!due || due.getTime() < now.getTime()) continue
      if (!best || due.getTime() < best.due.getTime()) best = { task, due }
    }

    return best
  }, [activeMonthTasks, now])

  /* ==========================================================
     NAVIGATION
     One entry point so direction + day clamping are consistent.
     ========================================================== */

  function navigate(target: Date, day: number) {
    const ty = target.getFullYear()
    const tm = target.getMonth()

    const nextIndex = ty * 12 + tm
    const currentIndex = year * 12 + month

    if (nextIndex !== currentIndex) {
      setDirection(nextIndex > currentIndex ? 1 : -1)
    }

    const max = new Date(ty, tm + 1, 0).getDate()

    setCurrentDate(new Date(ty, tm, 1))
    setSelectedDate(Math.min(Math.max(day, 1), max))
  }

  const shiftMonth = (delta: number) =>
    navigate(new Date(year, month + delta, 1), selectedDate)

  const goToToday = () =>
    navigate(new Date(todayYear, todayMonth, 1), todayDay)

  /** Move the selection by N days, crossing month boundaries. */
  function moveSelection(delta: number) {
    const d = new Date(year, month, selectedDate + delta)
    navigate(new Date(d.getFullYear(), d.getMonth(), 1), d.getDate())
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return

    switch (event.key) {
      case "ArrowLeft":
        moveSelection(-1)
        break
      case "ArrowRight":
        moveSelection(1)
        break
      case "ArrowUp":
        moveSelection(-7)
        break
      case "ArrowDown":
        moveSelection(7)
        break
      case "PageUp":
        shiftMonth(-1)
        break
      case "PageDown":
        shiftMonth(1)
        break
      case "Home":
        goToToday()
        break
      case "n":
      case "N":
        setCreateTaskOpen(true)
        break
      default:
        return
    }

    event.preventDefault()
    focusPendingRef.current = true
  }

  // After keyboard navigation, move DOM focus to the newly selected cell.
  useEffect(() => {
    if (focusPendingRef.current) {
      focusPendingRef.current = false
      cellRefs.current.get(selectedDate)?.focus()
    }
  }, [year, month, selectedDate])

  /* ==========================================================
     SELECTED DAY
     ========================================================== */

  const selectedDateLabel = new Date(year, month, selectedDate).toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  )

  const selectedTasks = getTasksForDay(selectedDate)

  // Position of the sliding selection marker.
  const selectedIndex = startingOffset + selectedDate - 1
  const selectedCol = selectedIndex % 7
  const selectedRow = Math.floor(selectedIndex / 7)

  const filtersActive = statusFilter !== "all" || query.trim() !== ""

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="px-5 py-6 md:px-7 md:py-7">
      <style>{CSS}</style>

      {/* ======================================================
          HEADER
          ====================================================== */}

      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <CalendarDays size={18} strokeWidth={1.8} className="text-slate-400" />

            <span className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Schedule
            </span>
          </div>

          <h1 className="font-serif text-[46px] font-bold italic leading-none tracking-[-0.045em] text-[#182033] md:text-[54px]">
            Calendar
          </h1>

          <p className="mt-3 text-[16px] font-medium leading-6 text-slate-400">
            Plan and inspect your reminder schedule.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateTaskOpen(true)}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-[13px] bg-[#172033] px-5 text-[14px] font-bold tracking-wide text-white shadow-[0_10px_24px_rgba(23,32,51,0.15)] transition-all duration-200 hover:-translate-y-px hover:bg-[#202b43] active:translate-y-0 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2} />
          New Task
        </button>
      </section>

      {/* ======================================================
          MONTH SUMMARY
          ====================================================== */}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <CalendarStat label="Month" hint={String(year)}>
          {monthNames[month]}
        </CalendarStat>

        <CalendarStat label="Scheduled">
          <AnimatedNumber value={tasks.length} />
        </CalendarStat>

        <CalendarStat
          label="Active"
          hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
          hintTone={overdueCount > 0 ? "danger" : "muted"}
        >
          <AnimatedNumber value={activeMonthTasks.length} />
        </CalendarStat>

        <CalendarStat
          label="Completed"
          aside={<ProgressRing value={completion} />}
        >
          <AnimatedNumber value={completedMonthTasks.length} />
        </CalendarStat>
      </section>

      {/* ======================================================
          NEXT UP
          ====================================================== */}

      {nextUp && (
        <button
          type="button"
          onClick={() => {
            const day = Number(nextUp.task.due_date.split("-")[2])
            if (!Number.isNaN(day)) setSelectedDate(day)
          }}
          className="mt-3 flex w-full items-center gap-4 rounded-[16px] border border-slate-200/80 bg-white px-5 py-3.5 text-left shadow-[0_3px_12px_rgba(15,23,42,0.025)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(30,45,65,0.06)]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-slate-50 text-[22px]">
            {(() => {
              const animation = getAnimationById(nextUp.task.animation_id)

              return animation?.mediaSrc &&
                (animation.mediaType === "image" || animation.mediaType === "gif") ? (
                <img
                  src={animation.mediaSrc}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              ) : (
                animation?.preview ?? "◉"
              )
            })()}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-slate-400">Next up</span>
            <span className="block truncate text-[16px] font-bold tracking-[-0.02em] text-[#172033]">
              {nextUp.task.title}
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block font-mono text-[13px] font-bold text-[#172033]">
              {relativeLabel(nextUp.due, now)}
            </span>
            <span className="block text-[12px] font-medium text-slate-400">
              {formatTaskTime(nextUp.task.due_time)}
            </span>
          </span>
        </button>
      )}

      {/* ======================================================
          CALENDAR + SELECTED DAY
          ====================================================== */}

      <section className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ====================================================
            CALENDAR
            ==================================================== */}

        <div className="rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(30,45,65,0.045)]">
          {/* MONTH HEADER */}

          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6">
            <div className="relative">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                onClick={() => {
                  setPickerYear(year)
                  setPickerOpen((open) => !open)
                }}
                className="group -m-2 rounded-[12px] p-2 text-left transition-colors hover:bg-slate-50"
              >
                <p className="font-serif text-[25px] font-bold italic leading-none tracking-[-0.035em] text-[#172033]">
                  {monthNames[month]}
                </p>

                <p className="mt-1.5 text-[14px] font-medium text-slate-400">{year}</p>
              </button>

              {/* MONTH PICKER */}

              {pickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setPickerOpen(false)}
                  />

                  <div
                    role="dialog"
                    aria-label="Choose month"
                    onKeyDown={(e) => e.key === "Escape" && setPickerOpen(false)}
                    className="cal-pop absolute left-0 top-full z-40 mt-3 w-[264px] rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(30,45,65,0.16)]"
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <button
                        type="button"
                        aria-label="Previous year"
                        onClick={() => setPickerYear((y) => y - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-[9px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className="text-[14px] font-bold text-[#172033]">{pickerYear}</span>

                      <button
                        type="button"
                        aria-label="Next year"
                        onClick={() => setPickerYear((y) => y + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-[9px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {monthNames.map((name, index) => {
                        const isCurrent = pickerYear === year && index === month
                        const isThisMonth = pickerYear === todayYear && index === todayMonth

                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              navigate(new Date(pickerYear, index, 1), selectedDate)
                              setPickerOpen(false)
                            }}
                            className={`h-10 rounded-[10px] text-[13px] font-semibold transition-all duration-150 active:scale-95 ${
                              isCurrent
                                ? "bg-[#172033] text-white"
                                : isThisMonth
                                  ? "border border-slate-300 text-[#172033] hover:bg-slate-50"
                                  : "text-slate-500 hover:bg-slate-100 hover:text-[#172033]"
                            }`}
                          >
                            {name.slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToToday}
                className="hidden h-10 rounded-[11px] border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#172033] active:scale-95 sm:block"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-slate-200 text-slate-400 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700 active:scale-95"
              >
                <ChevronLeft size={18} strokeWidth={1.8} />
              </button>

              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-slate-200 text-slate-400 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700 active:scale-95"
              >
                <ChevronRight size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* FILTER BAR */}

          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div
              role="group"
              aria-label="Filter by status"
              className="inline-flex self-start rounded-full border border-slate-200 bg-slate-50 p-0.5"
            >
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={statusFilter === filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all duration-200 ${
                    statusFilter === filter.id
                      ? "bg-[#172033] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="relative block sm:w-56">
              <Search
                size={15}
                strokeWidth={1.9}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this month"
                aria-label="Search tasks this month"
                className="h-9 w-full rounded-[11px] border border-slate-200 bg-white pl-9 pr-8 text-[13px] font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />

              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          {/* STATUS */}

          {tasksLoading && (
            <div className="border-b border-slate-100 px-5 py-2.5 text-center font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Syncing schedule...
            </div>
          )}

          {tasksError && (
            <div className="border-b border-red-100 bg-red-50/70 px-5 py-2.5 text-center text-[13px] font-medium text-red-500">
              Failed to load calendar tasks.
            </div>
          )}

          {/* WEEKDAYS */}

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={`px-1 py-3 text-center font-mono text-[12px] font-bold uppercase tracking-[0.10em] md:text-[13px] ${
                  index >= 5 ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* CALENDAR GRID */}

          <div
            role="group"
            aria-label={`${monthNames[month]} ${year}. Arrow keys move, Page Up and Page Down change month.`}
            onKeyDown={handleGridKeyDown}
            onPointerMove={spotlight}
            className="cal-grid relative overflow-hidden rounded-b-[22px] [--cell-h:112px] md:[--cell-h:132px]"
          >
            <div className="cal-spot" />

            {/* Re-keyed per month so the wave-in replays on navigation. */}
            <div
              key={`${year}-${month}`}
              className="relative grid grid-cols-7"
              style={{ "--dx": `${direction * 16}px` } as CSSProperties}
            >
              {/* Sliding selection marker */}

              <div
                aria-hidden
                className="cal-select pointer-events-none absolute left-0 top-0 z-[2] h-[var(--cell-h)] w-[calc(100%/7)] bg-slate-50"
                style={{
                  transform: `translate(${selectedCol * 100}%, calc(${selectedRow} * var(--cell-h)))`,
                }}
              >
                <span className="absolute left-0 top-0 h-full w-[3px] bg-[#172033]" />
              </div>

              {calendarDays.map((day, index) => {
                const col = index % 7
                const row = Math.floor(index / 7)
                const delay = `${(col + row) * 22}ms`

                if (day === null) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="h-[var(--cell-h)] border-b border-r border-slate-100 bg-slate-50/20"
                    />
                  )
                }

                const isToday =
                  day === todayDay && month === todayMonth && year === todayYear

                const isPast =
                  year < todayYear ||
                  (year === todayYear && month < todayMonth) ||
                  (year === todayYear && month === todayMonth && day < todayDay)

                const isSelected = day === selectedDate

                const dayTasks = getTasksForDay(day)
                const visibleTasks = dayTasks.slice(0, MAX_TASKS_PER_DAY)

                // Busier days get a slightly deeper tint.
                const heat = Math.min(dayTasks.length * 0.014, 0.05)

                return (
                  <button
                    key={day}
                    ref={(el) => {
                      if (el) cellRefs.current.set(day, el)
                      else cellRefs.current.delete(day)
                    }}
                    type="button"
                    tabIndex={isSelected ? 0 : -1}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                    aria-label={`${monthNames[month]} ${day}, ${dayTasks.length} ${
                      dayTasks.length === 1 ? "task" : "tasks"
                    }`}
                    onClick={() => setSelectedDate(day)}
                    style={{ "--d": delay } as CSSProperties}
                    className="cal-cell-in group relative z-[3] h-[var(--cell-h)] overflow-hidden border-b border-r border-slate-100 p-2 text-left outline-none transition-colors duration-200 hover:bg-slate-50/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 md:p-3"
                  >
                    {heat > 0 && (
                      <span
                        aria-hidden
                        className="absolute inset-0"
                        style={{ background: `rgba(23,32,51,${heat})` }}
                      />
                    )}

                    <div className="relative">
                      {/* DAY NUMBER */}

                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-[11px] font-mono text-[17px] font-bold transition-all duration-200 md:h-10 md:w-10 md:text-[18px] ${
                          isToday
                            ? "bg-[#172033] text-white shadow-sm"
                            : isSelected
                              ? "bg-slate-200 text-[#172033]"
                              : isPast
                                ? "text-slate-400 group-hover:bg-slate-100"
                                : "text-[#172033] group-hover:bg-slate-100"
                        }`}
                      >
                        {day}
                      </span>

                      {/* TASKS */}

                      {visibleTasks.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {visibleTasks.map((task) => (
                            <CalendarTask
                              key={task.id}
                              task={task}
                              overdue={isOverdue(task, now)}
                            />
                          ))}

                          {dayTasks.length > MAX_TASKS_PER_DAY && (
                            <div className="px-1 font-mono text-[10px] font-bold text-slate-400 md:text-[11px]">
                              +{dayTasks.length - MAX_TASKS_PER_DAY} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* KEYBOARD HINT */}

          <div className="hidden items-center gap-x-4 gap-y-1 border-t border-slate-100 px-6 py-3 text-[12px] font-medium text-slate-400 md:flex md:flex-wrap">
            <span>Arrows move</span>
            <span>Page Up / Down changes month</span>
            <span>Home jumps to today</span>
            <span>N creates a task</span>
          </div>
        </div>

        {/* ====================================================
            SELECTED DAY
            ==================================================== */}

        <aside className="flex max-h-[560px] min-h-[340px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(30,45,65,0.045)] xl:sticky xl:top-6">
          {/* HEADER */}

          <div className="shrink-0 border-b border-slate-100 bg-[#f7f8fa] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Selected Day
                </p>

                {/* Re-keyed so the label refreshes on selection. */}
                <h2
                  key={`${year}-${month}-${selectedDate}`}
                  className="cal-item-in mt-2 font-serif text-[25px] font-bold italic leading-tight tracking-[-0.035em] text-[#172033]"
                >
                  {selectedDateLabel}
                </h2>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white">
                <CalendarDays size={20} strokeWidth={1.7} className="text-slate-400" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[14px] font-medium text-slate-400">
                {selectedTasks.length} {selectedTasks.length === 1 ? "task" : "tasks"}
                {filtersActive && " (filtered)"}
              </span>

              {selectedTasks.length > 0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Scheduled
                </span>
              )}
            </div>
          </div>

          {/* TASKS */}

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {selectedTasks.length > 0 ? (
              <div
                key={`${year}-${month}-${selectedDate}-${statusFilter}-${query}`}
                className="space-y-3"
              >
                {selectedTasks.map((task, index) => (
                  <SelectedTask
                    key={task.id}
                    task={task}
                    now={now}
                    delay={index * 55}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[250px] flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-slate-200 bg-slate-50/50 px-5 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-slate-100">
                  <CalendarDays size={25} strokeWidth={1.6} className="text-slate-300" />
                </div>

                <p className="mt-4 text-[18px] font-bold text-slate-600">No reminders</p>

                <p className="mt-2 max-w-[220px] text-[14px] font-medium leading-6 text-slate-400">
                  {filtersActive
                    ? "Nothing matches your filters for this day."
                    : "Nothing is scheduled for this day."}
                </p>

                {filtersActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all")
                      setQuery("")
                    }}
                    className="mt-4 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreateTaskOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[#172033] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#202b43] active:scale-95"
                  >
                    <Plus size={14} strokeWidth={2.2} />
                    Add a task
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* ======================================================
          CREATE TASK
          ====================================================== */}

      <CreateTaskDialog open={createTaskOpen} onOpenChange={setCreateTaskOpen} />
    </div>
  )
}

/* ============================================================
   PROGRESS RING
   ============================================================ */

function ProgressRing({ value }: { value: number }) {
  const radius = 15
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      viewBox="0 0 40 40"
      className="h-10 w-10 shrink-0"
      role="img"
      aria-label={`${Math.round(value * 100)} percent complete`}
    >
      <circle cx="20" cy="20" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />

      <circle
        className="cal-ring"
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="#172033"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value)}
        transform="rotate(-90 20 20)"
      />
    </svg>
  )
}

/* ============================================================
   CALENDAR STAT
   ============================================================ */

function CalendarStat({
  label,
  children,
  hint,
  hintTone = "muted",
  aside,
  className = "",
}: {
  label: string
  children: ReactNode
  hint?: string
  hintTone?: "muted" | "danger"
  aside?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[16px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] ${className}`}
    >
      <div className="min-w-0">
        <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>

        <p
          className="mt-2 truncate text-[24px] font-bold leading-none tracking-[-0.035em] text-[#172033]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {children}
        </p>

        {hint && (
          <p
            className={`mt-1.5 text-[12px] font-semibold ${
              hintTone === "danger" ? "text-red-500" : "text-slate-400"
            }`}
          >
            {hint}
          </p>
        )}
      </div>

      {aside}
    </div>
  )
}

/* ============================================================
   CALENDAR TASK (chip inside a day cell)
   ============================================================ */

function CalendarTask({ task, overdue }: { task: DatabaseTask; overdue: boolean }) {
  const stateClass = task.completed
    ? "border-slate-200 bg-slate-50"
    : overdue
      ? "border-red-200 bg-red-50"
      : task.priority === "high"
        ? "border-red-100 bg-red-50/80"
        : task.priority === "medium"
          ? "border-amber-100 bg-amber-50/80"
          : "border-slate-200 bg-slate-50"

  const dotClass = task.completed
    ? "bg-slate-300"
    : task.priority === "high" || overdue
      ? "bg-red-500"
      : task.priority === "medium"
        ? "bg-amber-500"
        : "bg-slate-500"

  return (
    <div className={`overflow-hidden rounded-[9px] border px-2 py-1.5 ${stateClass}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotClass} ${
            overdue ? "animate-pulse" : ""
          }`}
        />

        <span
          className={`truncate font-mono text-[11px] font-bold md:text-[12px] ${
            task.completed ? "text-slate-400 line-through" : "text-slate-600"
          }`}
        >
          {formatTaskTime(task.due_time)}
        </span>
      </div>

      <p
        className={`mt-1 hidden truncate text-[12px] font-bold leading-4 sm:block ${
          task.completed ? "text-slate-400" : "text-slate-700"
        }`}
      >
        {task.title}
      </p>
    </div>
  )
}

/* ============================================================
   SELECTED TASK (card in the side panel)
   ============================================================ */

function SelectedTask({
  task,
  now,
  delay,
}: {
  task: DatabaseTask
  now: Date
  delay: number
}) {
  const animation = getAnimationById(task.animation_id)

  const due = parseDue(task.due_date, task.due_time)
  const overdue = isOverdue(task, now)

  const priorityClass = task.completed
    ? "bg-slate-100 text-slate-400"
    : task.priority === "high"
      ? "bg-red-50 text-red-500"
      : task.priority === "medium"
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-100 text-slate-500"

  return (
    <div
      className="cal-item-in rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)] transition-shadow duration-200 hover:shadow-[0_8px_20px_rgba(30,45,65,0.06)]"
      style={{ "--d": `${delay}ms` } as CSSProperties}
    >
      {/* TOP */}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${priorityClass}`}
          >
            {task.completed ? "Completed" : task.priority}
          </span>

          {overdue && (
            <span className="rounded-full bg-red-500 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white">
              Overdue
            </span>
          )}
        </div>

        <span className="font-mono text-[12px] font-bold text-slate-400">
          {formatTaskTime(task.due_time)}
        </span>
      </div>

      {/* TITLE */}

      <h3
        className={`mt-3 text-[18px] font-bold leading-6 tracking-[-0.02em] ${
          task.completed ? "text-slate-400 line-through decoration-slate-300" : "text-[#172033]"
        }`}
      >
        {task.title}
      </h3>

      {/* DESCRIPTION */}

      {task.description && (
        <p className="mt-2 line-clamp-3 text-[14px] font-medium leading-6 text-slate-400">
          {task.description}
        </p>
      )}

      {/* ANIMATION */}

      <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white text-[22px]">
          {animation?.mediaSrc &&
          (animation.mediaType === "image" || animation.mediaType === "gif") ? (
            <img
              src={animation.mediaSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : (
            animation?.preview ?? "◉"
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-slate-700">
            {animation?.name ?? task.animation_id}
          </p>

          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
            Reminder animation
          </p>
        </div>
      </div>

      {/* TIME */}

      <div
        className={`mt-3 flex items-center gap-2 ${
          overdue ? "text-red-500" : "text-slate-400"
        }`}
      >
        <Clock3 size={15} strokeWidth={1.8} />

        <span className="text-[13px] font-semibold">
          Reminder at {formatTaskTime(task.due_time)}
          {due && !task.completed && ` · ${relativeLabel(due, now)}`}
        </span>
      </div>
    </div>
  )
}