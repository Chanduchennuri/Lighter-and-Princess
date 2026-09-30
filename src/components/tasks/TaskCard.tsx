import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Repeat2,
  Play,
  X,
} from "lucide-react"

import { invoke } from "@tauri-apps/api/core"

import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react"

import { createPortal } from "react-dom"

import type { Task } from "../../lib/types"
import {
  getAnimationById,
  type AnimationItem,
} from "../../lib/animationLibrary"

interface TaskCardProps {
  task: Task
}

export function TaskCard({
  task,
}: TaskCardProps) {
  const [detailsOpen, setDetailsOpen] =
    useState(false)

  const priorityStyles = {
    low: {
      badge:
        "border-slate-200 bg-slate-100 text-slate-700",
      dot: "bg-slate-500",
      accent: "bg-slate-400",
    },

    medium: {
      badge:
        "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      accent: "bg-amber-500",
    },

    high: {
      badge:
        "border-red-200 bg-red-50 text-red-600",
      dot: "bg-red-500",
      accent: "bg-red-500",
    },
  }

  const priority =
    priorityStyles[task.priority]

  const selectedAnimation =
    getAnimationById(task.animationId)

  const isCompleted =
    task.status === "completed"

  const handlePreview = async (
    event?: ReactMouseEvent<HTMLElement>,
  ) => {
    event?.stopPropagation()

    try {
      await invoke(
        "preview_task",
        {
          id: task.id,
        },
      )
    } catch (error) {
      console.error(
        "Failed to preview task:",
        error,
      )
    }
  }

  function openDetails() {
    setDetailsOpen(true)
  }

  function closeDetails() {
    setDetailsOpen(false)
  }

  useEffect(() => {
    if (!detailsOpen) {
      return
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape"
      ) {
        closeDetails()
      }
    }

    function handlePointerDown(
      event: MouseEvent,
    ) {
      const target =
        event.target as Node

      const dialog =
        document.getElementById(
          "lp-task-details",
        )

      if (
        dialog &&
        dialog.contains(target)
      ) {
        return
      }

      closeDetails()
    }

    document.addEventListener(
      "keydown",
      handleEscape,
    )

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    )

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      )

      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      )
    }
  }, [detailsOpen])

  const detailBoard =
    detailsOpen
      ? createPortal(
          <div
            className="
              fixed
              inset-0
              z-[9998]
              flex
              items-center
              justify-center
              bg-slate-900/20
              p-5
              backdrop-blur-[3px]
            "
          >
            <div
              id="lp-task-details"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lp-task-title"
              className="
                relative
                w-full
                max-w-[720px]
                overflow-hidden
                rounded-[24px]
                border
                border-slate-200
                bg-white
                shadow-[0_30px_90px_rgba(15,23,42,0.22)]
              "
            >
              {/* TOP ACCENT */}

              <div
                className={`
                  absolute
                  left-0
                  right-0
                  top-0
                  h-[4px]
                  ${priority.accent}
                `}
              />

              {/* HEADER */}

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-5
                  border-b
                  border-slate-200
                  bg-[#f7f8fa]
                  px-6
                  py-5
                  md:px-8
                  md:py-6
                "
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {isCompleted ? (
                      <CheckCircle2
                        size={22}
                        strokeWidth={1.9}
                        className="shrink-0 text-emerald-500"
                      />
                    ) : (
                      <CalendarClock
                        size={22}
                        strokeWidth={1.8}
                        className="shrink-0 text-slate-400"
                      />
                    )}

                    <span
                      className="
                        font-mono
                        text-[13px]
                        font-bold
                        uppercase
                        tracking-[0.13em]
                        text-slate-500
                      "
                    >
                      {isCompleted
                        ? "Completed Task"
                        : "Reminder Task"}
                    </span>
                  </div>

                  <h2
                    id="lp-task-title"
                    className={`
                      mt-3
                      font-serif
                      text-[32px]
                      font-bold
                      leading-[1.05]
                      tracking-[-0.045em]
                      md:text-[40px]
                      ${
                        isCompleted
                          ? "text-slate-400 line-through"
                          : "text-[#172033]"
                      }
                    `}
                  >
                    {task.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-[11px]
                    border
                    border-slate-200
                    bg-white
                    text-slate-400
                    transition-all
                    duration-200
                    hover:border-slate-300
                    hover:text-[#172033]
                  "
                  aria-label="Close task details"
                >
                  <X size={19} />
                </button>
              </div>

              {/* CONTENT */}

              <div
                className="
                  max-h-[70vh]
                  overflow-y-auto
                  px-6
                  py-6
                  md:px-8
                  md:py-7
                "
              >
                {/* DESCRIPTION */}

                <section>
                  <p
                    className="
                      font-mono
                      text-[12px]
                      font-bold
                      uppercase
                      tracking-[0.15em]
                      text-slate-400
                    "
                  >
                    Description
                  </p>

                  <div
                    className="
                      mt-3
                      rounded-[16px]
                      border
                      border-slate-200
                      bg-slate-50
                      px-5
                      py-5
                    "
                  >
                    <p
                      className="
                        whitespace-pre-wrap
                        break-words
                        text-[16px]
                        font-medium
                        leading-7
                        text-slate-600
                        md:text-[17px]
                      "
                    >
                      {task.description?.trim()
                        ? task.description
                        : "No detailed description was added for this task."}
                    </p>
                  </div>
                </section>

                {/* TASK DETAILS */}

                <section className="mt-6">
                  <p
                    className="
                      font-mono
                      text-[12px]
                      font-bold
                      uppercase
                      tracking-[0.15em]
                      text-slate-400
                    "
                  >
                    Task Details
                  </p>

                  <div
                    className="
                      mt-3
                      grid
                      grid-cols-1
                      gap-3
                      sm:grid-cols-2
                    "
                  >
                    <DetailItem
                      icon={
                        <Clock3
                          size={18}
                          strokeWidth={1.8}
                        />
                      }
                      label="Scheduled Time"
                      value={task.dueAt}
                    />

                    <DetailItem
                      label="Priority"
                      value={
                        task.priority
                          .charAt(0)
                          .toUpperCase() +
                        task.priority.slice(1)
                      }
                    />

                    <DetailItem
                      icon={
                        <Repeat2
                          size={18}
                          strokeWidth={1.8}
                        />
                      }
                      label="Repeat"
                      value={
                        formatRepeat(
                          task.repeat,
                        )
                      }
                    />

                    <DetailItem
                      label="Status"
                      value={
                        isCompleted
                          ? "Completed"
                          : "Active"
                      }
                    />
                  </div>
                </section>

                {/* ANIMATION */}

                <section className="mt-6">
                  <p
                    className="
                      font-mono
                      text-[12px]
                      font-bold
                      uppercase
                      tracking-[0.15em]
                      text-slate-400
                    "
                  >
                    Reminder Animation
                  </p>

                  <div
                    className="
                      mt-3
                      flex
                      items-center
                      gap-4
                      rounded-[16px]
                      border
                      border-slate-200
                      bg-white
                      p-4
                    "
                  >
                    <div
                      className="
                        flex
                        h-[68px]
                        w-[68px]
                        shrink-0
                        items-center
                        justify-center
                        rounded-[17px]
                        border
                        border-slate-200
                        bg-slate-50
                        text-[38px]
                        shadow-inner
                      "
                    >
                      <AnimationPreview
                        animation={selectedAnimation}
                        size="detail"
                      />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="
                          text-[17px]
                          font-bold
                          text-[#172033]
                        "
                      >
                        {
                          selectedAnimation?.name ??
                          "Default Animation"
                        }
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className="
                            rounded-full
                            border
                            border-slate-200
                            bg-slate-50
                            px-2.5
                            py-1
                            font-mono
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-[0.09em]
                            text-slate-400
                          "
                        >
                          {selectedAnimation?.category ??
                            "Custom"}
                        </span>

                        <span
                          className="
                            rounded-full
                            border
                            border-slate-200
                            bg-white
                            px-2.5
                            py-1
                            font-mono
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-[0.09em]
                            text-slate-400
                          "
                        >
                          {selectedAnimation?.motion ??
                            "float"}
                        </span>
                      </div>

                      <p
                        className="
                          mt-2
                          break-all
                          font-mono
                          text-[11px]
                          font-semibold
                          uppercase
                          tracking-[0.08em]
                          text-slate-400
                        "
                      >
                        ID · {task.animationId}
                      </p>
                    </div>
                  </div>
                </section>

                {/* FOOTER ACTIONS */}

                <div
                  className="
                    mt-7
                    flex
                    flex-col-reverse
                    gap-3
                    border-t
                    border-slate-100
                    pt-5
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`
                        h-3
                        w-3
                        rounded-full
                        ${
                          isCompleted
                            ? "bg-slate-300"
                            : "bg-emerald-500"
                        }
                      `}
                    />

                    <span
                      className="
                        text-[14px]
                        font-semibold
                        text-slate-500
                      "
                    >
                      {isCompleted
                        ? "This reminder is completed."
                        : "This reminder is armed and ready."}
                    </span>
                  </div>

                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={handlePreview}
                      className="
                        inline-flex
                        h-11
                        items-center
                        justify-center
                        gap-2
                        rounded-[12px]
                        bg-[#172033]
                        px-5
                        font-mono
                        text-[13px]
                        font-bold
                        uppercase
                        tracking-[0.08em]
                        text-white
                        shadow-sm
                        transition-all
                        duration-200
                        hover:-translate-y-px
                        hover:bg-[#243049]
                        hover:shadow-md
                      "
                    >
                      <Bell
                        size={16}
                        strokeWidth={2}
                      />

                      Preview Reminder
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        aria-label={`Open details for ${task.title}`}
        onClick={openDetails}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault()
            openDetails()
          }
        }}
        className={`
          group
          relative
          cursor-pointer
          overflow-hidden
          rounded-[22px]
          border
          bg-white
          shadow-[0_10px_30px_rgba(30,45,65,0.055)]
          outline-none
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:shadow-[0_18px_42px_rgba(30,45,65,0.10)]
          focus-visible:ring-4
          focus-visible:ring-slate-200
          ${
            isCompleted
              ? "border-slate-200/80 opacity-80"
              : "border-slate-200"
          }
        `}
      >
        {/* PRIORITY ACCENT */}

        <div
          className={`
            absolute
            left-0
            top-0
            h-full
            w-[4px]
            ${priority.accent}
          `}
        />

        <div className="p-5 md:p-7">
          {/* TOP META */}

          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              {/* TIME */}

              <div
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-slate-200
                  bg-slate-50
                  px-3.5
                  py-2
                "
              >
                <Clock3
                  size={16}
                  strokeWidth={1.8}
                  className="text-slate-400"
                />

                <span
                  className="
                    font-mono
                    text-[13px]
                    font-bold
                    tracking-wide
                    text-slate-600
                  "
                >
                  {task.dueAt}
                </span>
              </div>

              {/* PRIORITY */}

              <span
                className={`
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  px-3.5
                  py-2
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.09em]
                  ${priority.badge}
                `}
              >
                <span
                  className={`
                    h-2
                    w-2
                    rounded-full
                    ${priority.dot}
                  `}
                />

                {task.priority}
              </span>

              {/* REPEAT */}

              {task.repeat &&
                task.repeat !==
                  "none" && (
                  <span
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-full
                      border
                      border-slate-200
                      bg-white
                      px-3.5
                      py-2
                      font-mono
                      text-[12px]
                      font-bold
                      uppercase
                      tracking-[0.07em]
                      text-slate-500
                    "
                  >
                    <Repeat2
                      size={14}
                      strokeWidth={1.8}
                    />

                    {formatRepeat(
                      task.repeat,
                    )}
                  </span>
                )}
            </div>

            {/* OPTIONS */}

            <button
              type="button"
              aria-label="Open task details"
              title="Open task details"
              onClick={(event) => {
                event.stopPropagation()
                openDetails()
              }}
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-full
                text-slate-300
                transition-all
                duration-200
                hover:bg-slate-100
                hover:text-slate-700
              "
            >
              <ChevronRight
                size={20}
                strokeWidth={1.9}
              />
            </button>
          </div>

          {/* TITLE */}

          <div className="mt-6">
            <div className="mb-2.5 flex items-center gap-2.5">
              {isCompleted ? (
                <CheckCircle2
                  size={19}
                  className="shrink-0 text-emerald-500"
                />
              ) : (
                <CalendarClock
                  size={19}
                  className="shrink-0 text-slate-400"
                />
              )}

              <span
                className="
                  font-mono
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-slate-400
                "
              >
                {isCompleted
                  ? "Completed"
                  : "Reminder Task"}
              </span>
            </div>

            <h2
              className={`
                max-w-4xl
                font-serif
                text-[32px]
                font-bold
                leading-[1.06]
                tracking-[-0.045em]
                md:text-[40px]
                ${
                  isCompleted
                    ? "text-slate-400 line-through decoration-slate-300"
                    : "text-[#172033]"
                }
              `}
            >
              {task.title}
            </h2>

            {task.description && (
              <p
                className="
                  mt-4
                  max-w-4xl
                  text-[16px]
                  font-medium
                  leading-7
                  text-slate-500
                  md:text-[17px]
                "
              >
                {task.description}
              </p>
            )}

            <p
              className="
                mt-3
                text-[13px]
                font-semibold
                text-slate-400
              "
            >
              Click to view full task details
            </p>
          </div>

          {/* DIVIDER */}

          <div className="my-6 border-t border-slate-100" />

          {/* BOTTOM */}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* ANIMATION */}

            <div className="flex min-w-0 items-center gap-3.5">
              <div
                className="
                  flex
                  h-[62px]
                  w-[62px]
                  shrink-0
                  items-center
                  justify-center
                  rounded-[16px]
                  border
                  border-slate-200
                  bg-slate-50
                  text-[34px]
                  shadow-inner
                  transition-transform
                  duration-300
                  group-hover:scale-105
                "
              >
                <AnimationPreview
                  animation={selectedAnimation}
                  size="card"
                />
              </div>

              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-[16px]
                    font-bold
                    text-[#172033]
                  "
                >
                  {
                    selectedAnimation?.name ??
                    "Default Animation"
                  }
                </p>

                {selectedAnimation?.description && (
                  <p className="mt-1.5 line-clamp-1 text-[12px] font-medium text-slate-400">
                    {selectedAnimation.description}
                  </p>
                )}

                <div className="mt-1.5 flex items-center gap-2">
                  <Play
                    size={12}
                    className="fill-slate-400 text-slate-400"
                  />

                  <span
                    className="
                      font-mono
                      text-[12px]
                      font-semibold
                      uppercase
                      tracking-[0.08em]
                      text-slate-400
                    "
                  >
                    {selectedAnimation?.category ??
                      "Custom"}
                  </span>
                </div>
              </div>
            </div>

            {/* STATE + PREVIEW */}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  {!isCompleted && (
                    <span
                      className="
                        absolute
                        h-full
                        w-full
                        animate-ping
                        rounded-full
                        bg-emerald-400
                        opacity-30
                      "
                    />
                  )}

                  <span
                    className={`
                      relative
                      h-3
                      w-3
                      rounded-full
                      ${
                        isCompleted
                          ? "bg-slate-300"
                          : "bg-emerald-500"
                      }
                    `}
                  />
                </span>

                <span
                  className="
                    whitespace-nowrap
                    font-mono
                    text-[12px]
                    font-bold
                    uppercase
                    tracking-[0.10em]
                    text-slate-400
                  "
                >
                  {isCompleted
                    ? "Completed"
                    : "Reminder armed"}
                </span>
              </div>

              {!isCompleted && (
                <button
                  type="button"
                  onClick={handlePreview}
                  className="
                    flex
                    h-11
                    items-center
                    gap-2
                    rounded-[12px]
                    bg-[#172033]
                    px-5
                    text-[13px]
                    font-bold
                    tracking-wide
                    text-white
                    shadow-sm
                    transition-all
                    duration-200
                    hover:-translate-y-px
                    hover:bg-[#243049]
                    hover:shadow-md
                    active:translate-y-0
                  "
                >
                  <Bell
                    size={15}
                    strokeWidth={2}
                  />

                  Preview
                </button>
              )}
            </div>
          </div>
        </div>
      </article>

      {detailBoard}
    </>
  )
}

/* ============================================================
   ANIMATION PREVIEW
   ============================================================ */

function AnimationPreview({
  animation,
  size,
}: {
  animation: AnimationItem | null
  size: "card" | "detail"
}) {
  const boxClass =
    size === "detail"
      ? "h-full w-full rounded-[15px]"
      : "h-full w-full rounded-[14px]"

  const mediaClass =
    size === "detail"
      ? "h-[58px] w-[58px] object-contain"
      : "h-[52px] w-[52px] object-contain"

  if (
    animation?.mediaSrc &&
    (animation.mediaType === "image" ||
      animation.mediaType === "gif")
  ) {
    return (
      <div
        className={`
          flex
          items-center
          justify-center
          ${boxClass}
          overflow-hidden
          bg-white
        `}
      >
        <img
          src={animation.mediaSrc}
          alt={animation.name}
          draggable={false}
          className={`${mediaClass} select-none`}
        />
      </div>
    )
  }

  return (
    <span
      className={`
        ${size === "detail" ? "text-[36px]" : "text-[34px]"}
        select-none
        leading-none
        transition-transform
        duration-300
      `}
      aria-hidden="true"
    >
      {animation?.preview ?? "✨"}
    </span>
  )
}

/* ============================================================
   DETAIL ITEM
   ============================================================ */

function DetailItem({
  icon,
  label,
  value,
}: {
  icon?: ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="
        rounded-[15px]
        border
        border-slate-200
        bg-slate-50
        px-4
        py-4
      "
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-slate-400">
            {icon}
          </span>
        )}

        <p
          className="
            font-mono
            text-[11px]
            font-bold
            uppercase
            tracking-[0.12em]
            text-slate-400
          "
        >
          {label}
        </p>
      </div>

      <p
        className="
          mt-2
          text-[16px]
          font-bold
          text-[#172033]
        "
      >
        {value}
      </p>
    </div>
  )
}

/* ============================================================
   REPEAT
   ============================================================ */

function formatRepeat(
  repeat: string,
): string {
  switch (repeat) {
    case "none":
      return "Once"

    case "daily":
      return "Daily"

    case "weekdays":
      return "Weekdays"

    case "weekly":
      return "Weekly"

    default:
      return repeat
  }
}