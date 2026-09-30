import {
  BellRing,
  CheckCircle2,
  Clock3,
  Database,
  ListTodo,
  RefreshCw,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useSettings, useTasks } from "../../lib/appState"

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDue(task: {
  due_date: string
  due_time: string
}) {
  const due = new Date(
    `${task.due_date}T${task.due_time}:00`,
  )

  return Number.isNaN(due.getTime())
    ? null
    : due
}

function formatDue(
  date: string,
  time: string,
) {
  const due = parseDue({
    due_date: date,
    due_time: time,
  })

  if (!due) {
    return `${date} ${time}`
  }

  const now = new Date()

  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()

  if (sameDay) {
    return due.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return due.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })
}

export function RuntimeHealth() {
  const {
    tasks,
    tasksLoading,
    tasksError,
    refreshTasks,
  } = useTasks()

  const { settings } = useSettings()

  const [
    now,
    setNow,
  ] = useState(() => new Date())

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  useEffect(() => {
    const timer =
      window.setInterval(
        () => setNow(new Date()),
        30_000,
      )

    return () =>
      window.clearInterval(timer)
  }, [])

  const runtime = useMemo(() => {
    const today =
      getDateKey(now)

    const todayTasks =
      tasks.filter(
        (task) =>
          task.due_date === today,
      )

    const completedToday =
      todayTasks.filter(
        (task) => task.completed,
      ).length

    const pendingToday =
      todayTasks.length -
      completedToday

    const upcoming =
      tasks
        .filter(
          (task) => !task.completed,
        )
        .map((task) => ({
          task,
          due: parseDue(task),
        }))
        .filter(
          (item) =>
            item.due !== null &&
            item.due.getTime() >=
              now.getTime(),
        )
        .sort(
          (a, b) =>
            a.due!.getTime() -
            b.due!.getTime(),
        )

    const overdue =
      tasks.filter(
        (task) => {
          if (task.completed) {
            return false
          }

          const due =
            parseDue(task)

          return (
            due !== null &&
            due.getTime() <
              now.getTime()
          )
        },
      ).length

    return {
      total: tasks.length,
      today: todayTasks.length,
      completedToday,
      pendingToday,
      overdue,
      next: upcoming[0]?.task ?? null,
    }
  }, [
    now,
    tasks,
  ])

  async function handleRefresh() {
    if (
      refreshing ||
      tasksLoading
    ) {
      return
    }

    try {
      setRefreshing(true)
      await refreshTasks()
    } finally {
      setRefreshing(false)
    }
  }

  const engineStatus =
    tasksError
      ? "Attention"
      : tasksLoading ||
          refreshing
        ? "Syncing"
        : "Stable"

  return (
    <section
      className="
        flex
        h-[216px]
        min-h-[216px]
        max-h-[216px]
        min-w-0
        flex-col
        overflow-hidden
        rounded-[24px]
        border
        border-slate-200/80
        bg-white/90
        p-5
        shadow-[0_12px_35px_rgba(30,45,65,0.07)]
        backdrop-blur-xl
      "
    >

      {/* HEADER */}

      <div
        className="
          mb-3
          flex
          items-center
          justify-between
          gap-2
        "
      >

        <div
          className="
            flex
            min-w-0
            items-center
            gap-2
          "
        >

          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-slate-200
              bg-slate-50
            "
          >
            <BellRing
              size={17}
              strokeWidth={1.8}
              className="text-slate-500"
            />
          </div>

          <div className="min-w-0">

            <p
              className="
                truncate
                text-[15px]
                font-semibold
                tracking-[-0.02em]
                text-[#182033]
              "
            >
              Reminder Engine
            </p>

            <p
              className="
                truncate
                font-mono
                text-[8px]
                font-semibold
                uppercase
                tracking-[0.16em]
                text-slate-400
              "
            >
              Local scheduler
              <span className="mx-1">
                •
              </span>
              SQLite
            </p>

          </div>

        </div>

        <div
          className="
            flex
            shrink-0
            items-center
            gap-1.5
          "
        >

          <span
            className={`
              rounded-full
              px-2
              py-1
              font-mono
              text-[8px]
              font-semibold
              uppercase
              tracking-[0.11em]
              ${
                tasksError
                  ? "bg-red-50 text-red-500"
                  : "bg-emerald-50 text-emerald-600"
              }
            `}
          >
            {engineStatus}
          </span>

          <button
            type="button"
            onClick={() =>
              void handleRefresh()
            }
            disabled={
              refreshing ||
              tasksLoading
            }
            aria-label="Refresh reminder data"
            title="Refresh"
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              border
              border-slate-200
              bg-white
              text-slate-400
              transition
              hover:border-slate-300
              hover:text-slate-700
              disabled:cursor-wait
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={14}
              strokeWidth={1.8}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
          </button>

        </div>

      </div>


      {/* SCROLLING ENGINE CONTENT */}

      <div
        className="
          min-h-0
          flex-1
          overflow-y-auto
          overflow-x-hidden
          pr-1
        "
        style={{
          scrollbarWidth: "thin",
        }}
      >

      {/* COMPACT METRICS */}

      <div
        className="
          grid
          grid-cols-4
          gap-1.5
        "
      >

        <MetricCard
          icon={
            <ListTodo
              size={14}
              strokeWidth={1.8}
            />
          }
          label="All"
          value={runtime.total}
        />

        <MetricCard
          icon={
            <Clock3
              size={14}
              strokeWidth={1.8}
            />
          }
          label="Today"
          value={runtime.today}
        />

        <MetricCard
          icon={
            <CheckCircle2
              size={14}
              strokeWidth={1.8}
            />
          }
          label="Done"
          value={
            runtime.completedToday
          }
        />

        <MetricCard
          icon={
            <BellRing
              size={14}
              strokeWidth={1.8}
            />
          }
          label="Pending"
          value={
            runtime.pendingToday
          }
        />

      </div>


      {/* NEXT REMINDER */}

      <div
        className="
          mt-2
          flex
          items-center
          justify-between
          gap-3
          rounded-xl
          border
          border-slate-200
          bg-slate-50/80
          px-3
          py-2.5
        "
      >

        <div className="min-w-0">

          <p
            className="
              font-mono
              text-[8px]
              font-semibold
              uppercase
              tracking-[0.16em]
              text-slate-400
            "
          >
            Next reminder
          </p>

          <p
            className="
              mt-0.5
              truncate
              text-[14px]
              font-semibold
              tracking-[-0.01em]
              text-[#182033]
            "
          >
            {runtime.next
              ? runtime.next.title
              : "Nothing scheduled"}
          </p>

        </div>

        <div
          className="
            shrink-0
            text-right
          "
        >

          <p
            className="
              font-mono
              text-[8px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-slate-400
            "
          >
            {runtime.next
              ? formatDue(
                  runtime.next.due_date,
                  runtime.next.due_time,
                )
              : "Queue clear"}
          </p>

          <p
            className="
              mt-0.5
              text-[10px]
              font-medium
              text-slate-400
            "
          >
            {settings.notifications
              ? "Delivery on"
              : "Paused"}
          </p>

        </div>

      </div>


      {/* ENGINE STRIP */}

      <div
        className="
          mt-2
          grid
          grid-cols-3
          gap-1.5
        "
      >

        <StatusItem
          icon={
            <Database
              size={13}
              strokeWidth={1.8}
            />
          }
          label="SQLite"
          value={
            tasksError
              ? "Error"
              : "OK"
          }
          tone={
            tasksError
              ? "error"
              : "good"
          }
        />

        <StatusItem
          icon={
            <BellRing
              size={13}
              strokeWidth={1.8}
            />
          }
          label="Alerts"
          value={
            settings.notifications
              ? "ON"
              : "OFF"
          }
          tone={
            settings.notifications
              ? "good"
              : "neutral"
          }
        />

        <StatusItem
          icon={
            <Clock3
              size={13}
              strokeWidth={1.8}
            />
          }
          label="Late"
          value={String(
            runtime.overdue,
          )}
          tone={
            runtime.overdue > 0
              ? "warning"
              : "good"
          }
        />

      </div>

      </div>

    </section>
  )
}


function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div
      className="
        min-w-0
        rounded-xl
        border
        border-slate-200/80
        bg-white
        px-2
        py-2
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
          gap-1
        "
      >

        <span className="text-slate-400">
          {icon}
        </span>

        <span
          className="
            font-mono
            text-[8px]
            font-semibold
            uppercase
            tracking-[0.1em]
            text-slate-400
          "
        >
          {label}
        </span>

      </div>

      <p
        className="
          mt-1
          text-[24px]
          font-semibold
          leading-none
          tracking-[-0.04em]
          text-[#182033]
        "
      >
        {value}
      </p>

    </div>
  )
}


function StatusItem({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone:
    | "good"
    | "warning"
    | "error"
    | "neutral"
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "error"
          ? "text-red-500"
          : "text-slate-500"

  return (
    <div
      className="
        flex
        min-w-0
        items-center
        justify-between
        gap-1
        rounded-lg
        border
        border-slate-200/70
        bg-white
        px-2
        py-1.5
      "
    >

      <div
        className="
          flex
          min-w-0
          items-center
          gap-1
        "
      >

        <span className="shrink-0 text-slate-400">
          {icon}
        </span>

        <span
          className="
            truncate
            font-mono
            text-[8px]
            font-semibold
            uppercase
            tracking-[0.08em]
            text-slate-400
          "
        >
          {label}
        </span>

      </div>

      <span
        className={`
          shrink-0
          text-[8px]
          font-semibold
          ${valueClass}
        `}
      >
        {value}
      </span>

    </div>
  )
}
