import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

import { CreateTaskDialog } from "../components/tasks/CreateTaskDialog"
import { TaskCard } from "../components/tasks/TaskCard"
import { ModernClock } from "../components/dashboard/ModernClock"

import { useTasks } from "../lib/appState"

import type { DatabaseTask, TaskPriority, TaskStatus } from "../lib/types"

/* ============================================================
   CONSTANTS
   ============================================================ */

const TODAY_TASK_LIMIT = 4

const STEP = 1 / 240

type StatusFilter = "all" | "active" | "done"

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
]

/* ============================================================
   TYPES
   ============================================================ */

interface TodayProps {
  onNavigate: (page: "today" | "tasks" | "calendar" | "gallery" | "settings") => void
}

interface TaskCardTask {
  id: string
  title: string
  description: string
  dueAt: string
  animationId: string
  status: TaskStatus
  priority: TaskPriority
  repeat: string
}

interface ToastState {
  id: number
  message: string
  onUndo?: () => void
}

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

/** A number that springs to its target instead of snapping. */
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

      if (Math.abs(spring.x - target) < 0.01 && Math.abs(spring.v) < 0.01) {
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
   STYLES
   ============================================================ */

const CSS = `
  @keyframes td-backdrop { from { opacity: 0; } to { opacity: 1; } }
  .td-backdrop { animation: td-backdrop 200ms ease both; }

  /* Modals rise and settle with a small overshoot. */
  @keyframes td-modal {
    0%   { opacity: 0; transform: translateY(18px) scale(0.955); }
    100% { opacity: 1; transform: none; }
  }
  .td-modal { animation: td-modal 420ms cubic-bezier(0.22, 1.25, 0.36, 1) both; }

  @keyframes td-item-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  .td-item-in {
    animation: td-item-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--d, 0ms);
  }

  /* Check circle pops when a task is completed. */
  @keyframes td-check {
    0%   { transform: scale(0.6); }
    55%  { transform: scale(1.18); }
    100% { transform: scale(1); }
  }
  .td-check-pop { animation: td-check 380ms cubic-bezier(0.22, 1.2, 0.36, 1) both; }

  @keyframes td-toast {
    from { opacity: 0; transform: translate(-50%, 16px) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
  }
  .td-toast { animation: td-toast 360ms cubic-bezier(0.22, 1.2, 0.36, 1) both; }

  .td-ring { transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1); }
  .td-fill { transition: width 1000ms cubic-bezier(0.22, 1, 0.36, 1); }
  .td-marker { transition: left 1000ms cubic-bezier(0.22, 1, 0.36, 1); }

  @media (prefers-reduced-motion: reduce) {
    .td-backdrop, .td-modal, .td-item-in, .td-check-pop, .td-toast { animation: none; }
    .td-ring, .td-fill, .td-marker { transition: none; }
  }
`

/* ============================================================
   TODAY
   ============================================================ */

export function Today({ onNavigate }: TodayProps) {
  const {
    getTasksForDate,
    tasksLoading,
    tasksError,
    refreshTasks,
    completeTask,
    deleteTask,
  } = useTasks()

  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [allTasksOpen, setAllTasksOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [actionTaskId, setActionTaskId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [toast, setToast] = useState<ToastState | null>(null)

  /* ==========================================================
     LIVE CLOCK
     Refreshes every 30s so the date rolls over at midnight and
     countdowns, overdue state and the timeline stay correct.
     ========================================================== */

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  /* ==========================================================
     TASKS
     ========================================================== */

  const tasks = useMemo(
    () => [...getTasksForDate(todayDate)].sort(byTime),
    [getTasksForDate, todayDate],
  )

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks])
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks])

  const overdueCount = useMemo(
    () => activeTasks.filter((task) => minutesOf(task.due_time) < nowMinutes).length,
    [activeTasks, nowMinutes],
  )

  const progress = tasks.length ? completedTasks.length / tasks.length : 0

  /* ==========================================================
     NEXT + PRIORITY
     ========================================================== */

  const nextTask = activeTasks[0] ?? null

  const priorityTask = useMemo(() => {
    const order: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 }

    return [...activeTasks].sort((a, b) => order[b.priority] - order[a.priority])[0] ?? null
  }, [activeTasks])

  const nextCountdown = nextTask ? countdown(minutesOf(nextTask.due_time) - nowMinutes) : null

  /* ==========================================================
     FILTERED LIST + PREVIEW
     ========================================================== */

  const visibleTasks = useMemo(() => {
    if (statusFilter === "active") return activeTasks
    if (statusFilter === "done") return completedTasks
    return tasks
  }, [statusFilter, tasks, activeTasks, completedTasks])

  const previewTasks = visibleTasks.slice(0, TODAY_TASK_LIMIT)
  const hasMoreTasks = visibleTasks.length > TODAY_TASK_LIMIT

  /* ==========================================================
     SELECTED TASK
     ========================================================== */

  const selectedTask = useMemo(
    () => (selectedTaskId ? (tasks.find((task) => task.id === selectedTaskId) ?? null) : null),
    [tasks, selectedTaskId],
  )

  const greeting = getGreeting(now)

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  /* ==========================================================
     TOAST
     ========================================================== */

  function showToast(message: string, onUndo?: () => void) {
    setToast({ id: Date.now(), message, onUndo })
  }

  useEffect(() => {
    if (!toast) return

    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  /* ==========================================================
     KEYBOARD SHORTCUTS
     Esc closes the top-most popup, N opens New Task.
     ========================================================== */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedTaskId) setSelectedTaskId(null)
        else if (allTasksOpen) setAllTasksOpen(false)
        return
      }

      if (
        (event.key === "n" || event.key === "N") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !createTaskOpen &&
        !selectedTaskId &&
        !allTasksOpen
      ) {
        const target = event.target as HTMLElement | null

        if (target?.closest("input, textarea, select, [contenteditable='true']")) return

        event.preventDefault()
        setCreateTaskOpen(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedTaskId, allTasksOpen, createTaskOpen])

  /* ==========================================================
     CREATE TASK
     ========================================================== */

  function handleCreateTaskChange(open: boolean) {
    setCreateTaskOpen(open)

    if (!open) {
      void refreshTasks()
    }
  }

  /* ==========================================================
     DETAILS
     ========================================================== */

  function openTaskDetails(task: DatabaseTask) {
    setSelectedTaskId(task.id)
  }

  function closeTaskDetails() {
    setSelectedTaskId(null)
  }

  /* ==========================================================
     COMPLETE
     ========================================================== */

  async function handleComplete(task: DatabaseTask) {
    if (actionTaskId) return

    try {
      setActionTaskId(task.id)

      await completeTask(task.id, !task.completed)

      showToast(task.completed ? "Marked as active" : "Task completed", () => {
        // Undo = set it back to what it was.
        void completeTask(task.id, task.completed).catch((error) =>
          console.error("FAILED TO UNDO TASK:", error),
        )
      })
    } catch (error) {
      console.error("FAILED TO UPDATE TASK:", error)
    } finally {
      setActionTaskId(null)
    }
  }

  /* ==========================================================
     DELETE
     ========================================================== */

  async function handleDelete(task: DatabaseTask) {
    if (actionTaskId) return

    try {
      setActionTaskId(task.id)

      await deleteTask(task.id)

      if (selectedTaskId === task.id) {
        setSelectedTaskId(null)
      }

      showToast("Task deleted")
    } catch (error) {
      console.error("FAILED TO DELETE TASK:", error)
    } finally {
      setActionTaskId(null)
    }
  }

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      <style>{CSS}</style>

      <div className="px-5 py-6 md:px-7 md:py-7">
        {/* ======================================================
            HEADER
            ====================================================== */}

        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <Sparkles size={17} strokeWidth={1.8} className="text-slate-400" />

              <span className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Today
              </span>
            </div>

            <h1 className="font-serif text-[46px] font-bold italic leading-none tracking-[-0.045em] text-[#182033] md:text-[54px]">
              {greeting}
            </h1>

            <p className="mt-3 text-[16px] font-medium leading-6 text-slate-400">
              {dateLabel}. Your reminders and scheduled tasks for today.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateTaskOpen(true)}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-[13px] bg-[#172033] px-5 text-[14px] font-bold tracking-wide text-white shadow-[0_10px_24px_rgba(23,32,51,0.15)] transition-all duration-200 hover:-translate-y-px hover:bg-[#202b43] hover:shadow-[0_14px_30px_rgba(23,32,51,0.18)] active:translate-y-0 active:scale-[0.98]"
          >
            <Plus size={18} strokeWidth={2} />
            New Task
          </button>
        </section>

        {/* ======================================================
            CLOCK
            ====================================================== */}

        <section className="mt-6">
          <ModernClock />
        </section>

        {/* ======================================================
            ERROR
            ====================================================== */}

        {tasksError && (
          <div className="mt-5 rounded-[14px] border border-red-100 bg-red-50/80 px-5 py-4 text-[14px] font-medium text-red-500">
            Failed to load today's tasks.
          </div>
        )}

        {/* ======================================================
            STATS
            ====================================================== */}

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Active"
            hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
            hintTone={overdueCount > 0 ? "danger" : "muted"}
          >
            <AnimatedNumber value={activeTasks.length} />
          </Stat>

          <Stat label="Completed" aside={<ProgressRing value={progress} />}>
            <AnimatedNumber value={completedTasks.length} />
          </Stat>

          <Stat
            label="Next reminder"
            hint={nextCountdown?.text}
            hintTone={nextCountdown?.late ? "danger" : "muted"}
          >
            {nextTask ? formatTaskTime(nextTask.due_time) : "--:--"}
          </Stat>

          <Stat label="Priority">
            {priorityTask ? capitalize(priorityTask.priority) : "None"}
          </Stat>
        </section>

        {/* ======================================================
            DAY AT A GLANCE
            ====================================================== */}

        {tasks.length > 0 && !tasksLoading && (
          <section className="mt-3 rounded-[16px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_3px_12px_rgba(15,23,42,0.025)]">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[15px] font-bold tracking-[-0.02em] text-[#172033]">
                Day at a glance
              </p>

              <p className="text-[13px] font-semibold text-slate-400">
                {completedTasks.length} of {tasks.length} done
              </p>
            </div>

            {/* Progress */}

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="td-fill h-full rounded-full bg-[#172033]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            {/* Timeline */}

            <DayTimeline
              tasks={tasks}
              nowMinutes={nowMinutes}
              onOpen={(task) => openTaskDetails(task)}
            />
          </section>
        )}

        {/* ======================================================
            NEXT REMINDER
            ====================================================== */}

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[13px] font-bold uppercase tracking-[0.17em] text-slate-500">
                Next Reminder
              </p>

              <p className="mt-1.5 text-[14px] font-medium text-slate-400">
                Your next scheduled task.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {nextTask && (
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                )}

                <span
                  className={`relative h-2.5 w-2.5 rounded-full ${
                    nextTask ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
              </span>

              <span
                className={`font-mono text-[12px] font-bold uppercase tracking-[0.12em] ${
                  nextTask ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {nextTask ? "Armed" : "Idle"}
              </span>
            </div>
          </div>

          {tasksLoading ? (
            <LoadingCard />
          ) : nextTask ? (
            <TaskCard task={toTaskCardTask(nextTask)} />
          ) : (
            <EmptyToday />
          )}
        </section>

        {/* ======================================================
            TODAY'S TASKS
            ====================================================== */}

        {!tasksLoading && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[13px] font-bold uppercase tracking-[0.17em] text-slate-500">
                  Today's Tasks
                </p>

                <p className="mt-1.5 text-[14px] font-medium text-slate-400">
                  {tasks.length === 0
                    ? "Nothing scheduled."
                    : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} scheduled.`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {tasks.length > 0 && (
                  <div
                    role="group"
                    aria-label="Filter today's tasks"
                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5"
                  >
                    {FILTERS.map((filter) => {
                      const count =
                        filter.id === "all"
                          ? tasks.length
                          : filter.id === "active"
                            ? activeTasks.length
                            : completedTasks.length

                      return (
                        <button
                          key={filter.id}
                          type="button"
                          aria-pressed={statusFilter === filter.id}
                          onClick={() => setStatusFilter(filter.id)}
                          className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition-all duration-200 ${
                            statusFilter === filter.id
                              ? "bg-[#172033] text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {filter.label}
                          <span className="ml-1.5 opacity-60">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {hasMoreTasks && (
                  <button
                    type="button"
                    onClick={() => setAllTasksOpen(true)}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[11px] border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-[#172033] active:scale-95"
                  >
                    View all
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500">
                      {visibleTasks.length}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* EMPTY */}

            {tasks.length === 0 ? (
              <EmptyToday />
            ) : visibleTasks.length === 0 ? (
              <div className="rounded-[18px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-8 text-center">
                <p className="text-[16px] font-bold text-slate-600">
                  {statusFilter === "done" ? "Nothing completed yet" : "All caught up"}
                </p>

                <p className="mt-1.5 text-[14px] font-medium text-slate-400">
                  {statusFilter === "done"
                    ? "Finished tasks will show up here."
                    : "No active reminders left for today."}
                </p>
              </div>
            ) : (
              <>
                {/* LIMITED PREVIEW */}

                <div key={statusFilter} className="space-y-3">
                  {previewTasks.map((task, index) => (
                    <TodayTaskRow
                      key={task.id}
                      task={task}
                      now={nowMinutes}
                      delay={index * 55}
                      busy={actionTaskId === task.id}
                      onOpen={() => openTaskDetails(task)}
                      onComplete={() => void handleComplete(task)}
                    />
                  ))}
                </div>

                {/* VIEW MORE */}

                {hasMoreTasks && (
                  <button
                    type="button"
                    onClick={() => setAllTasksOpen(true)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-slate-200 bg-white/60 py-4 text-[14px] font-bold text-slate-500 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-[#172033]"
                  >
                    View all {visibleTasks.length} tasks
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* ======================================================
            CALENDAR SHORTCUT
            ====================================================== */}

        <section className="mt-6 rounded-[20px] border border-dashed border-slate-200 bg-white/50 px-6 py-7">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-50">
              <CalendarDays size={23} strokeWidth={1.8} className="text-slate-400" />
            </div>

            <p className="mt-4 text-[18px] font-bold text-slate-700">Plan ahead</p>

            <p className="mt-2 max-w-md text-[14px] font-medium leading-6 text-slate-400">
              View your complete schedule and upcoming reminders in Calendar.
            </p>

            <button
              type="button"
              onClick={() => onNavigate("calendar")}
              aria-label="Open calendar"
              className="group mt-4 inline-flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-[#172033]"
            >
              View calendar
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </button>
          </div>
        </section>
      </div>

      {/* ========================================================
          ALL TODAY TASKS POPUP
          ======================================================== */}

      {allTasksOpen && (
        <div
          className="td-backdrop fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-[3px] md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="All today's tasks"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setAllTasksOpen(false)
            }
          }}
        >
          <div className="td-modal flex max-h-[88vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
            {/* HEADER */}

            <div className="flex shrink-0 items-center justify-between gap-5 border-b border-slate-200 bg-[#f7f8fa] px-5 py-5 md:px-7">
              <div>
                <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  L&P Today
                </p>

                <h2 className="mt-1.5 font-serif text-[31px] font-bold italic leading-none tracking-[-0.04em] text-[#172033] md:text-[38px]">
                  All Today's Tasks
                </h2>

                <p className="mt-2 text-[14px] font-medium text-slate-400">
                  {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}
                  {statusFilter === "all" ? " scheduled today." : ` (${statusFilter}).`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAllTasksOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
                aria-label="Close today's tasks"
              >
                <X size={20} />
              </button>
            </div>

            {/* SCROLLING TASK REGION */}

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6"
              style={{ scrollbarWidth: "thin" }}
            >
              <div className="space-y-3">
                {visibleTasks.map((task, index) => (
                  <TodayTaskRow
                    key={task.id}
                    task={task}
                    now={nowMinutes}
                    delay={Math.min(index, 8) * 40}
                    busy={actionTaskId === task.id}
                    onOpen={() => openTaskDetails(task)}
                    onComplete={() => void handleComplete(task)}
                  />
                ))}
              </div>
            </div>

            {/* FOOTER */}

            <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 md:px-7">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.11em] text-slate-300">
                Lighter & Princess
              </span>

              <span className="text-[13px] font-semibold text-slate-400">
                {completedTasks.length} completed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TASK DETAILS POPUP
          ======================================================== */}

      {selectedTask && (
        <TodayTaskDetails
          task={selectedTask}
          now={nowMinutes}
          busy={actionTaskId === selectedTask.id}
          onClose={closeTaskDetails}
          onComplete={() => void handleComplete(selectedTask)}
          onDelete={() => void handleDelete(selectedTask)}
        />
      )}

      {/* ========================================================
          TOAST
          ======================================================== */}

      {toast && (
        <div
          key={toast.id}
          role="status"
          className="td-toast fixed bottom-6 left-1/2 z-[10010] flex items-center gap-4 rounded-[14px] bg-[#172033] py-3 pl-5 pr-3 text-white shadow-[0_18px_44px_rgba(15,23,42,0.32)]"
        >
          <span className="text-[14px] font-semibold">{toast.message}</span>

          {toast.onUndo && (
            <button
              type="button"
              onClick={() => {
                toast.onUndo?.()
                setToast(null)
              }}
              className="rounded-[9px] bg-white/10 px-3 py-1.5 text-[13px] font-bold transition hover:bg-white/20 active:scale-95"
            >
              Undo
            </button>
          )}

          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================
          CREATE TASK
          ======================================================== */}

      <CreateTaskDialog open={createTaskOpen} onOpenChange={handleCreateTaskChange} />
    </>
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
        className="td-ring"
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
   STAT CARD
   ============================================================ */

function Stat({
  label,
  children,
  hint,
  hintTone = "muted",
  aside,
}: {
  label: string
  children: ReactNode
  hint?: string
  hintTone?: "muted" | "danger"
  aside?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_3px_12px_rgba(15,23,42,0.025)]">
      <div className="min-w-0">
        <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>

        <p
          className="mt-2 truncate text-[27px] font-bold leading-none tracking-[-0.04em] text-[#172033]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {children}
        </p>

        {hint && (
          <p
            className={`mt-1.5 truncate text-[12px] font-semibold ${
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
   DAY TIMELINE
   Every task placed on a 24h track, with a live "now" marker.
   ============================================================ */

function DayTimeline({
  tasks,
  nowMinutes,
  onOpen,
}: {
  tasks: DatabaseTask[]
  nowMinutes: number
  onOpen: (task: DatabaseTask) => void
}) {
  const nowPercent = (nowMinutes / 1440) * 100

  return (
    <div className="mt-5">
      <div className="relative h-8">
        {/* Track */}

        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-slate-100">
          {/* Elapsed part of the day */}
          <div
            className="td-fill h-full rounded-full bg-slate-200"
            style={{ width: `${nowPercent}%` }}
          />
        </div>

        {/* Tasks */}

        {tasks.map((task) => {
          const left = (minutesOf(task.due_time) / 1440) * 100
          const late = !task.completed && minutesOf(task.due_time) < nowMinutes

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpen(task)}
              title={`${task.title}, ${formatTaskTime(task.due_time)}`}
              aria-label={`${task.title} at ${formatTaskTime(task.due_time)}`}
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_6px_rgba(23,32,51,0.3)] transition-transform duration-150 hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:scale-125 focus-visible:outline-none ${
                task.completed
                  ? "bg-slate-300"
                  : late
                    ? "bg-red-500"
                    : task.priority === "high"
                      ? "bg-red-400"
                      : task.priority === "medium"
                        ? "bg-amber-400"
                        : "bg-[#172033]"
              }`}
              style={{ left: `${left}%` }}
            />
          )
        })}

        {/* Now */}

        <span
          aria-hidden
          className="td-marker pointer-events-none absolute top-0 h-full w-px bg-[#172033]"
          style={{ left: `${nowPercent}%` }}
        >
          <span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#172033]" />
        </span>
      </div>

      <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-400">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  )
}

/* ============================================================
   TODAY TASK ROW
   ============================================================ */

function TodayTaskRow({
  task,
  now,
  delay,
  busy,
  onOpen,
  onComplete,
}: {
  task: DatabaseTask
  now: number
  delay: number
  busy: boolean
  onOpen: () => void
  onComplete: () => void
}) {
  const overdue = !task.completed && minutesOf(task.due_time) < now

  return (
    <div
      className="td-item-in group relative overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_4px_16px_rgba(30,45,65,0.035)] transition-all duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_10px_25px_rgba(30,45,65,0.07)]"
      style={{ "--d": `${delay}ms` } as CSSProperties}
    >
      {/* Priority rail */}

      {!task.completed && (
        <span
          aria-hidden
          className={`absolute left-0 top-0 h-full w-[3px] ${
            overdue
              ? "bg-red-500"
              : task.priority === "high"
                ? "bg-red-400"
                : task.priority === "medium"
                  ? "bg-amber-400"
                  : "bg-transparent"
          }`}
        />
      )}

      <div className="flex items-stretch">
        {/* COMPLETE */}

        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          className="flex w-[68px] shrink-0 items-center justify-center border-r border-slate-100 bg-slate-50/60 transition hover:bg-slate-100 disabled:cursor-wait"
          aria-label={task.completed ? "Mark task active" : "Complete task"}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
              task.completed
                ? "td-check-pop border-[#172033] bg-[#172033] text-white"
                : "border-slate-300 bg-white text-transparent group-hover:border-slate-400"
            } ${busy ? "opacity-50" : ""}`}
          >
            <Check size={15} strokeWidth={3} />
          </span>
        </button>

        {/* CONTENT */}

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 px-5 py-4 text-left outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-slate-100"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p
              className={`min-w-0 truncate text-[18px] font-bold leading-6 tracking-[-0.02em] ${
                task.completed ? "text-slate-400 line-through" : "text-[#172033]"
              }`}
            >
              {task.title}
            </p>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                task.priority === "high"
                  ? "bg-red-50 text-red-600"
                  : task.priority === "medium"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {task.priority}
            </span>

            {overdue && (
              <span className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                Overdue
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-1.5 line-clamp-1 text-[14px] font-medium leading-5 text-slate-400">
              {task.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-bold text-slate-500">
              <Clock3 size={14} strokeWidth={1.8} />
              {formatTaskTime(task.due_time)}
            </span>

            <span className="h-1 w-1 rounded-full bg-slate-300" />

            <span className="font-mono text-[12px] font-bold text-slate-400">
              {capitalize(task.repeat === "none" ? "once" : task.repeat)}
            </span>
          </div>
        </button>

        {/* OPEN DETAIL */}

        <button
          type="button"
          onClick={onOpen}
          className="flex w-[58px] shrink-0 items-center justify-center border-l border-slate-100 text-slate-300 transition hover:bg-slate-50 hover:text-slate-600"
          aria-label="Open task details"
        >
          <MoreHorizontal size={21} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   TASK DETAILS
   ============================================================ */

function TodayTaskDetails({
  task,
  now,
  busy,
  onClose,
  onComplete,
  onDelete,
}: {
  task: DatabaseTask
  now: number
  busy: boolean
  onClose: () => void
  onComplete: () => void
  onDelete: () => void
}) {
  // Two-step delete: first click arms it, second confirms.
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!confirmDelete) return

    const id = window.setTimeout(() => setConfirmDelete(false), 3000)
    return () => window.clearTimeout(id)
  }, [confirmDelete])

  const relative = task.completed ? null : countdown(minutesOf(task.due_time) - now)

  return (
    <div
      className="td-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-[3px] md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Today's task details"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="td-modal flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
        {/* HEADER */}

        <div className="flex shrink-0 items-start justify-between gap-5 border-b border-slate-200 bg-[#f7f8fa] px-6 py-6 md:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {task.completed ? (
                <CheckCircle2 size={21} className="text-emerald-500" />
              ) : (
                <Clock3 size={21} className="text-slate-400" />
              )}

              <span className="font-mono text-[12px] font-bold uppercase tracking-[0.13em] text-slate-400">
                {task.completed ? "Completed Today" : "Today's Reminder"}
              </span>

              {relative && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    relative.late ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {relative.text}
                </span>
              )}
            </div>

            <h2 className="mt-3 font-serif text-[34px] font-bold leading-[1.05] tracking-[-0.045em] text-[#172033] md:text-[40px]">
              {task.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
            aria-label="Close task details"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}

        <div className="min-h-0 overflow-y-auto px-6 py-6 md:px-7 md:py-7">
          {/* DESCRIPTION */}

          <section>
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Description
            </p>

            <div className="mt-3 rounded-[16px] border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="whitespace-pre-wrap break-words text-[16px] font-medium leading-7 text-slate-600">
                {task.description?.trim()
                  ? task.description
                  : "No detailed description was added for this task."}
              </p>
            </div>
          </section>

          {/* DETAILS */}

          <section className="mt-6">
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Task Details
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailBlock label="Date" value={task.due_date} />
              <DetailBlock label="Time" value={formatTaskTime(task.due_time)} />
              <DetailBlock label="Priority" value={capitalize(task.priority)} />
              <DetailBlock
                label="Repeat"
                value={capitalize(task.repeat === "none" ? "once" : task.repeat)}
              />
              <DetailBlock label="Sound" value={task.sound_enabled ? "Enabled" : "Disabled"} />
              <DetailBlock label="Status" value={task.completed ? "Completed" : "Active"} />
            </div>
          </section>

          {/* ACTIONS */}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                if (confirmDelete) onDelete()
                else setConfirmDelete(true)
              }}
              disabled={busy}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-[11px] border px-5 text-[13px] font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                confirmDelete
                  ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                  : "border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
              }`}
            >
              <Trash2 size={15} />
              {confirmDelete ? "Click again to confirm" : "Delete"}
            </button>

            <button
              type="button"
              onClick={onComplete}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[#172033] px-5 text-[13px] font-bold uppercase tracking-[0.06em] text-white transition hover:bg-[#243049] active:scale-95 disabled:cursor-wait disabled:opacity-50"
            >
              <Check size={16} />
              {task.completed ? "Mark Active" : "Complete Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   DETAIL BLOCK
   ============================================================ */

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-[16px] font-bold text-[#172033]">{value}</p>
    </div>
  )
}

/* ============================================================
   LOADING
   ============================================================ */

function LoadingCard() {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-6">
      <div className="animate-pulse">
        <div className="h-4 w-28 rounded bg-slate-100" />
        <div className="mt-5 h-9 w-2/3 rounded bg-slate-100" />
        <div className="mt-3 h-5 w-full rounded bg-slate-100" />

        <div className="mt-5 flex gap-3">
          <div className="h-10 w-28 rounded-lg bg-slate-100" />
          <div className="h-10 w-24 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   EMPTY
   ============================================================ */

function EmptyToday() {
  return (
    <div className="rounded-[20px] border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-50">
        <CalendarDays size={23} strokeWidth={1.8} className="text-slate-400" />
      </div>

      <p className="mt-4 text-[19px] font-bold text-slate-700">No reminders today</p>

      <p className="mx-auto mt-2 max-w-md text-[14px] font-medium leading-6 text-slate-400">
        Your day is clear. Create a reminder whenever you need one. Press N to start one quickly.
      </p>
    </div>
  )
}

/* ============================================================
   TASK CARD MAPPING
   ============================================================ */

function toTaskCardTask(task: DatabaseTask): TaskCardTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    dueAt: formatTaskTime(task.due_time),
    animationId: task.animation_id,
    priority: task.priority,
    repeat: task.repeat,
    status: task.completed ? "completed" : "pending",
  }
}

/* ============================================================
   TIME HELPERS
   ============================================================ */

function minutesOf(value: string): number {
  const [h, m] = (value || "0:0").split(":").map(Number)
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m)
}

const byTime = (a: DatabaseTask, b: DatabaseTask) =>
  (a.due_time ?? "").localeCompare(b.due_time ?? "")

/** diffMin > 0 = in the future. */
function countdown(diffMin: number): { text: string; late: boolean } {
  const abs = Math.abs(diffMin)

  if (abs < 1) return { text: "Right now", late: false }

  let span: string

  if (abs < 60) span = `${abs}m`
  else {
    const h = Math.floor(abs / 60)
    const m = abs % 60
    span = m ? `${h}h ${m}m` : `${h}h`
  }

  return diffMin > 0
    ? { text: `In ${span}`, late: false }
    : { text: `Overdue by ${span}`, late: true }
}

function formatTaskTime(value: string): string {
  if (!value) {
    return "--:--"
  }

  const [hours, minutes] = value.split(":")
  const hour = Number(hours)

  if (Number.isNaN(hour)) {
    return value
  }

  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minutes ?? "00"} ${suffix}`
}

/* ============================================================
   TEXT
   ============================================================ */

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/* ============================================================
   GREETING
   ============================================================ */

function getGreeting(date: Date): string {
  const hour = date.getHours()

  if (hour < 5) return "Good night"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 21) return "Good evening"

  return "Good night"
}