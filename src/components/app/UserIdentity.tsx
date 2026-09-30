import {
  Check,
  Clock3,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Target,
  TimerReset,
  X,
} from "lucide-react"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import { createPortal } from "react-dom"

interface MiniGoal {
  id: number
  title: string
  completed: boolean
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remainingSeconds).padStart(2, "0")}`
  )
}

export function UserIdentity() {
  const [seconds, setSeconds] = useState(15 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [customMinutes, setCustomMinutes] = useState("")

  const [goalText, setGoalText] = useState("")
  const [goals, setGoals] = useState<MiniGoal[]>([])

  const [goalsOpen, setGoalsOpen] = useState(false)

  const goalsButtonRef =
    useRef<HTMLButtonElement | null>(null)

  const [goalBoardPosition, setGoalBoardPosition] =
    useState({
      top: 0,
      left: 0,
    })

  /* =======================================================
     TIMER
     ======================================================= */

  useEffect(() => {
    if (!timerRunning) {
      return
    }

    if (seconds <= 0) {
      setTimerRunning(false)
      return
    }

    const interval = window.setInterval(() => {
      setSeconds((current) =>
        Math.max(0, current - 1),
      )
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [timerRunning, seconds])

  /* =======================================================
     TIMER ACTIONS
     ======================================================= */

  function setTimer(minutes: number) {
    setSeconds(minutes * 60)
    setTimerRunning(false)
  }

  function applyCustomTimer() {
    const minutes = Number(customMinutes)

    if (
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      return
    }

    setTimer(Math.floor(minutes))
    setCustomMinutes("")
  }

  function resetTimer() {
    setTimer(15)
  }

  /* =======================================================
     GOAL ACTIONS
     ======================================================= */

  function addGoal() {
    const title = goalText.trim()

    if (!title) {
      return
    }

    setGoals((current) => [
      ...current,
      {
        id: Date.now(),
        title,
        completed: false,
      },
    ])

    setGoalText("")
  }

  function toggleGoal(id: number) {
    setGoals((current) =>
      current.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              completed: !goal.completed,
            }
          : goal,
      ),
    )
  }

  function removeGoal(id: number) {
    setGoals((current) =>
      current.filter(
        (goal) => goal.id !== id,
      ),
    )
  }

  /* =======================================================
     GOAL BOARD POSITION
     ======================================================= */

  function openGoals() {
    const button =
      goalsButtonRef.current

    if (!button) {
      return
    }

    const rect =
      button.getBoundingClientRect()

    const boardWidth = 340
    const boardHeight = 460

    const gap = 12

    let left =
      rect.right -
      boardWidth

    let top =
      rect.bottom +
      gap

    if (
      left <
      12
    ) {
      left = 12
    }

    if (
      left + boardWidth >
      window.innerWidth - 12
    ) {
      left =
        window.innerWidth -
        boardWidth -
        12
    }

    const spaceBelow =
      window.innerHeight -
      rect.bottom

    const spaceAbove =
      rect.top

    if (
      spaceBelow <
        boardHeight &&
      spaceAbove >
        boardHeight
    ) {
      top =
        rect.top -
        boardHeight -
        gap
    }

    setGoalBoardPosition({
      top,
      left,
    })

    setGoalsOpen(true)
  }

  /* =======================================================
     CLOSE BOARD
     ======================================================= */

  useEffect(() => {
    if (!goalsOpen) {
      return
    }

    function handlePointerDown(
      event: MouseEvent,
    ) {
      const target =
        event.target as Node

      const board =
        document.getElementById(
          "lp-goals-board",
        )

      if (
        board &&
        board.contains(target)
      ) {
        return
      }

      if (
        goalsButtonRef.current?.contains(
          target,
        )
      ) {
        return
      }

      setGoalsOpen(false)
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape"
      ) {
        setGoalsOpen(false)
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    )

    document.addEventListener(
      "keydown",
      handleEscape,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      )

      document.removeEventListener(
        "keydown",
        handleEscape,
      )
    }
  }, [goalsOpen])

  const activeGoals =
    goals.filter(
      (goal) => !goal.completed,
    ).length

  const goalBoard = goalsOpen
    ? createPortal(
        <div
          id="lp-goals-board"
          className="
            fixed
            z-[9999]
            w-[340px]
            max-w-[calc(100vw-24px)]
            overflow-hidden
            rounded-[20px]
            border
            border-slate-200
            bg-white
            shadow-[0_25px_70px_rgba(15,23,42,0.20)]
          "
          style={{
            top:
              goalBoardPosition.top,
            left:
              goalBoardPosition.left,
          }}
        >
          {/* BOARD HEADER */}

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-slate-200
              bg-[#f4f6f8]
              px-5
              py-4
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-[12px]
                  bg-[#172033]
                  text-white
                "
              >
                <Target
                  size={20}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <p
                  className="
                    font-mono
                    text-[12px]
                    font-bold
                    uppercase
                    tracking-[0.13em]
                    text-slate-500
                  "
                >
                  Deep Focus
                </p>

                <h3
                  className="
                    mt-0.5
                    font-serif
                    text-[23px]
                    font-bold
                    italic
                    leading-none
                    tracking-[-0.035em]
                    text-[#172033]
                  "
                >
                  Mini Goals
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setGoalsOpen(false)
              }
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-[10px]
                text-slate-400
                transition
                hover:bg-white
                hover:text-[#172033]
              "
              aria-label="Close goals"
            >
              <X size={18} />
            </button>
          </div>

          {/* BOARD SUMMARY */}

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-slate-100
              px-5
              py-3
            "
          >
            <span
              className="
                text-[14px]
                font-medium
                text-slate-500
              "
            >
              Keep today's small wins moving.
            </span>

            <span
              className="
                shrink-0
                rounded-full
                border
                border-slate-200
                bg-slate-50
                px-3
                py-1.5
                font-mono
                text-[12px]
                font-bold
                text-slate-600
              "
            >
              {activeGoals} active
            </span>
          </div>

          {/* ADD GOAL */}

          <div className="px-5 pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={goalText}
                onChange={(event) =>
                  setGoalText(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    addGoal()
                  }
                }}
                placeholder="Add a small goal..."
                autoFocus
                className="
                  h-11
                  min-w-0
                  flex-1
                  rounded-[12px]
                  border
                  border-slate-200
                  bg-white
                  px-3.5
                  text-[15px]
                  font-medium
                  text-slate-700
                  outline-none
                  transition
                  placeholder:text-slate-300
                  focus:border-slate-400
                  focus:ring-4
                  focus:ring-slate-100
                "
              />

              <button
                type="button"
                onClick={addGoal}
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-[12px]
                  bg-[#172033]
                  text-white
                  transition-all
                  duration-200
                  hover:bg-[#243049]
                "
                aria-label="Add goal"
              >
                <Plus size={19} />
              </button>
            </div>
          </div>

          {/* GOAL LIST */}

          <div className="px-5 pb-5 pt-4">
            {goals.length > 0 ? (
              <div
                className="
                  lp-goals-board-scroll
                  max-h-[295px]
                  overflow-y-auto
                  overscroll-contain
                  rounded-[15px]
                  border
                  border-slate-200
                  bg-[#f7f8fa]
                  p-2
                  scroll-smooth
                "
              >
                <div className="space-y-2">
                  {goals.map(
                    (goal) => (
                      <div
                        key={goal.id}
                        className="
                          flex
                          min-h-[54px]
                          items-center
                          gap-3
                          rounded-[13px]
                          border
                          border-slate-200
                          bg-white
                          px-3.5
                          py-2.5
                          transition-all
                          duration-200
                        "
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleGoal(
                              goal.id,
                            )
                          }
                          aria-label={
                            goal.completed
                              ? "Mark goal active"
                              : "Complete goal"
                          }
                          className={`
                            flex
                            h-6
                            w-6
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            border-2
                            transition-all
                            duration-200
                            ${
                              goal.completed
                                ? "border-[#172033] bg-[#172033] text-white"
                                : "border-slate-300 bg-white text-transparent hover:border-slate-500"
                            }
                          `}
                        >
                          <Check
                            size={13}
                            strokeWidth={3}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleGoal(
                              goal.id,
                            )
                          }
                          className="
                            min-w-0
                            flex-1
                            text-left
                          "
                        >
                          <span
                            className={`
                              block
                              truncate
                              text-[15px]
                              font-semibold
                              leading-5
                              ${
                                goal.completed
                                  ? "text-slate-300 line-through"
                                  : "text-[#172033]"
                              }
                            `}
                          >
                            {goal.title}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeGoal(
                              goal.id,
                            )
                          }
                          className="
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center
                            rounded-[8px]
                            text-slate-300
                            transition
                            hover:bg-red-50
                            hover:text-red-400
                          "
                          aria-label={`Delete ${goal.title}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div
                className="
                  rounded-[15px]
                  border-2
                  border-dashed
                  border-slate-200
                  bg-[#f7f8fa]
                  px-5
                  py-10
                  text-center
                "
              >
                <Target
                  size={28}
                  strokeWidth={1.5}
                  className="
                    mx-auto
                    text-slate-300
                  "
                />

                <p
                  className="
                    mt-3
                    text-[16px]
                    font-semibold
                    text-slate-500
                  "
                >
                  No mini goals yet
                </p>

                <p
                  className="
                    mt-1
                    text-[14px]
                    leading-5
                    text-slate-400
                  "
                >
                  Add something small and
                  finish it.
                </p>
              </div>
            )}
          </div>

          {/* BOARD FOOTER */}

          <div
            className="
              flex
              items-center
              justify-between
              border-t
              border-slate-100
              px-5
              py-3
            "
          >
            <span
              className="
                font-mono
                text-[11px]
                font-bold
                uppercase
                tracking-[0.12em]
                text-slate-300
              "
            >
              Lighter & Princess
            </span>

            <span
              className="
                font-mono
                text-[11px]
                font-semibold
                text-slate-400
              "
            >
              {goals.length} total
            </span>
          </div>

          <style>
            {`
              .lp-goals-board-scroll::-webkit-scrollbar {
                width: 6px;
              }

              .lp-goals-board-scroll::-webkit-scrollbar-track {
                background: transparent;
              }

              .lp-goals-board-scroll::-webkit-scrollbar-thumb {
                background: rgba(100,116,139,0.30);
                border-radius: 999px;
              }

              .lp-goals-board-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(100,116,139,0.45);
              }
            `}
          </style>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <section
        className="
          relative
          rounded-[22px]
          border
          border-slate-200/80
          bg-white/95
          p-5
          shadow-[0_14px_40px_rgba(30,45,65,0.08)]
          backdrop-blur-xl
        "
      >
        {/* TOP ACCENT */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute
            left-8
            right-8
            top-0
            h-[2px]
            rounded-full
            bg-gradient-to-r
            from-transparent
            via-slate-400
            to-transparent
          "
        />

        {/* HEADER */}

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <TimerReset
                size={20}
                strokeWidth={1.8}
                className="text-slate-500"
              />

              <p
                className="
                  font-mono
                  text-[13px]
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-slate-500
                "
              >
                Focus Hub
              </p>
            </div>

            <h2
              className="
                mt-2
                font-serif
                text-[30px]
                font-bold
                italic
                leading-none
                tracking-[-0.045em]
                text-[#172033]
              "
            >
              Time & Goals
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* GOALS BUTTON */}

            <div className="relative">
              <button
                ref={goalsButtonRef}
                type="button"
                onClick={() => {
                  if (goalsOpen) {
                    setGoalsOpen(false)
                  } else {
                    openGoals()
                  }
                }}
                className="
                  group
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-[13px]
                  border
                  border-slate-200
                  bg-slate-50
                  text-slate-500
                  shadow-sm
                  transition-all
                  duration-200
                  hover:-translate-y-0.5
                  hover:border-slate-300
                  hover:bg-white
                  hover:text-[#172033]
                  hover:shadow-md
                  active:translate-y-0
                "
                aria-label="View goals"
                aria-expanded={
                  goalsOpen
                }
              >
                <Target
                  size={20}
                  strokeWidth={1.8}
                />

                {activeGoals > 0 && (
                  <span
                    className="
                      absolute
                      -right-1
                      -top-1
                      flex
                      h-5
                      min-w-5
                      items-center
                      justify-center
                      rounded-full
                      border-2
                      border-white
                      bg-[#172033]
                      px-1
                      font-mono
                      text-[9px]
                      font-bold
                      text-white
                    "
                  >
                    {activeGoals >
                    9
                      ? "9+"
                      : activeGoals}
                  </span>
                )}

                {/* TOOLTIP */}

                <span
                  className="
                    pointer-events-none
                    absolute
                    right-0
                    top-[calc(100%+8px)]
                    z-50
                    whitespace-nowrap
                    rounded-[9px]
                    bg-[#172033]
                    px-3
                    py-2
                    font-mono
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.08em]
                    text-white
                    opacity-0
                    shadow-lg
                    transition-all
                    duration-150
                    group-hover:translate-y-0
                    group-hover:opacity-100
                    translate-y-[-3px]
                  "
                >
                  View goals
                </span>
              </button>
            </div>

          </div>
        </div>

        {/* TIMER */}

        <div
          className="
            mt-5
            rounded-[18px]
            border
            border-slate-200
            bg-[#f4f6f8]
            p-4
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="
                  font-mono
                  text-[13px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-slate-500
                "
              >
                Quick Timer
              </p>

              <p
                className="
                  mt-1
                  text-[14px]
                  font-medium
                  text-slate-400
                "
              >
                Focus for a while
              </p>
            </div>

            <Clock3
              size={21}
              strokeWidth={1.7}
              className="text-slate-400"
            />
          </div>

          {/* COUNTDOWN */}

          <div className="mt-3">
            <p
              className="
                font-mono
                text-[54px]
                font-bold
                leading-none
                tracking-[-0.07em]
                text-[#172033]
              "
            >
              {formatTime(seconds)}
            </p>
          </div>

          {/* PRESETS */}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[5, 15, 30].map(
              (minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() =>
                    setTimer(
                      minutes,
                    )
                  }
                  className="
                    rounded-[10px]
                    border
                    border-slate-200
                    bg-white
                    py-2.5
                    font-mono
                    text-[13px]
                    font-bold
                    text-slate-600
                    transition-all
                    duration-200
                    hover:-translate-y-px
                    hover:border-slate-300
                    hover:text-[#172033]
                  "
                >
                  {minutes} min
                </button>
              ),
            )}
          </div>

          {/* CUSTOM */}

          <div className="mt-2 flex gap-2">
            <input
              type="number"
              min="1"
              max="180"
              value={customMinutes}
              onChange={(event) =>
                setCustomMinutes(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  applyCustomTimer()
                }
              }}
              placeholder="Custom minutes"
              className="
                h-10
                min-w-0
                flex-1
                rounded-[10px]
                border
                border-slate-200
                bg-white
                px-3
                text-[14px]
                font-medium
                text-slate-700
                outline-none
                transition
                placeholder:text-slate-300
                focus:border-slate-400
                focus:ring-4
                focus:ring-slate-100
              "
            />

            <button
              type="button"
              onClick={
                applyCustomTimer
              }
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-[10px]
                bg-[#172033]
                text-white
                transition-all
                duration-200
                hover:bg-[#243049]
              "
              aria-label="Set custom timer"
            >
              <Check size={17} />
            </button>
          </div>

          {/* TIMER CONTROLS */}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setTimerRunning(
                  (value) =>
                    !value,
                )
              }
              disabled={
                seconds <= 0
              }
              className="
                flex
                h-10
                flex-1
                items-center
                justify-center
                gap-2
                rounded-[10px]
                bg-[#172033]
                font-mono
                text-[13px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-white
                transition-all
                duration-200
                hover:bg-[#243049]
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              {timerRunning ? (
                <Pause size={16} />
              ) : (
                <Play
                  size={16}
                  className="fill-current"
                />
              )}

              {timerRunning
                ? "Pause"
                : "Start"}
            </button>

            <button
              type="button"
              onClick={resetTimer}
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-[10px]
                border
                border-slate-200
                bg-white
                text-slate-500
                transition-all
                duration-200
                hover:border-slate-300
                hover:text-[#172033]
              "
              aria-label="Reset timer"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* MINI GOAL HINT */}

        <button
          type="button"
          onClick={openGoals}
          className="
            mt-4
            flex
            w-full
            items-center
            justify-between
            rounded-[13px]
            border
            border-dashed
            border-slate-200
            bg-slate-50/70
            px-4
            py-3
            text-left
            transition-all
            duration-200
            hover:border-slate-300
            hover:bg-slate-50
          "
        >
          <div className="flex items-center gap-3">
            <Target
              size={19}
              strokeWidth={1.8}
              className="text-slate-400"
            />

            <div>
              <p
                className="
                  text-[15px]
                  font-semibold
                  text-[#172033]
                "
              >
                Mini Goals
              </p>

              <p
                className="
                  mt-0.5
                  text-[13px]
                  text-slate-400
                "
              >
                {goals.length === 0
                  ? "No goals yet"
                  : `${activeGoals} active · ${goals.length} total`}
              </p>
            </div>
          </div>

          <span
            className="
              font-mono
              text-[12px]
              font-bold
              uppercase
              tracking-[0.08em]
              text-slate-400
            "
          >
            View →
          </span>
        </button>
      </section>

      {goalBoard}
    </>
  )
}