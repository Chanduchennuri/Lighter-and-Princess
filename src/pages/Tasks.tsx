import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Search,
  Trash2,
  X,
} from "lucide-react"

import {
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  CreateTaskDialog,
  type Task as DialogTask,
} from "../components/tasks/CreateTaskDialog"

import {
  useTasks,
} from "../lib/appState"

import {
  getAnimationById,
  type AnimationItem,
} from "../lib/animationLibrary"

import type {
  DatabaseTask,
  TaskPriority,
} from "../lib/types"


type Filter =
  | "all"
  | "active"
  | "completed"


const MAIN_TASK_LIMIT = 4


/* ============================================================
   TASKS
   ============================================================ */

export function Tasks() {
  const {
    tasks,
    tasksLoading,
    tasksError,
    completeTask,
    deleteTask,
  } = useTasks()

  const [
    filter,
    setFilter,
  ] = useState<Filter>("all")

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    createTaskOpen,
    setCreateTaskOpen,
  ] = useState(false)

  const [
    editingTask,
    setEditingTask,
  ] = useState<DatabaseTask | null>(null)

  const [
    actionTaskId,
    setActionTaskId,
  ] = useState<string | null>(null)

  const [
    allTasksOpen,
    setAllTasksOpen,
  ] = useState(false)

  const [
    selectedTaskId,
    setSelectedTaskId,
  ] = useState<string | null>(null)


  /* ==========================================================
     COUNTS
     ========================================================== */

  const activeCount = useMemo(
    () =>
      tasks.filter(
        (task) => !task.completed,
      ).length,
    [tasks],
  )

  const completedCount = useMemo(
    () =>
      tasks.filter(
        (task) => task.completed,
      ).length,
    [tasks],
  )


  /* ==========================================================
     FILTER
     ========================================================== */

  const filteredTasks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return [...tasks]
        .filter((task) => {
          const matchesFilter =
            filter === "all" ||
            (
              filter === "active" &&
              !task.completed
            ) ||
            (
              filter === "completed" &&
              task.completed
            )

          const matchesSearch =
            task.title
              .toLowerCase()
              .includes(query) ||
            (task.description ?? "")
              .toLowerCase()
              .includes(query)

          return (
            matchesFilter &&
            matchesSearch
          )
        })
        .sort((a, b) => {
          if (
            a.completed !==
            b.completed
          ) {
            return a.completed
              ? 1
              : -1
          }

          if (
            a.due_date !==
            b.due_date
          ) {
            return a.due_date.localeCompare(
              b.due_date,
            )
          }

          return a.due_time.localeCompare(
            b.due_time,
          )
        })
    }, [
      tasks,
      filter,
      search,
    ])


  const previewTasks =
    filteredTasks.slice(
      0,
      MAIN_TASK_LIMIT,
    )

  const hasMoreTasks =
    filteredTasks.length >
    MAIN_TASK_LIMIT


  /* ==========================================================
     SELECTED TASK
     ========================================================== */

  const selectedTask =
    useMemo(() => {
      if (!selectedTaskId) {
        return null
      }

      return (
        tasks.find(
          (task) =>
            task.id ===
            selectedTaskId,
        ) ?? null
      )
    }, [
      tasks,
      selectedTaskId,
    ])


  /* ==========================================================
     CREATE
     ========================================================== */

  function handleCreate() {
    setEditingTask(null)
    setCreateTaskOpen(true)
  }


  /* ==========================================================
     EDIT
     ========================================================== */

  function handleEdit(
    task: DatabaseTask,
  ) {
    setEditingTask(task)
    setCreateTaskOpen(true)
  }


  /* ==========================================================
     CLOSE DIALOG
     ========================================================== */

  function handleDialogChange(
    open: boolean,
  ) {
    setCreateTaskOpen(open)

    if (!open) {
      setEditingTask(null)
    }
  }


  /* ==========================================================
     OPEN DETAIL
     ========================================================== */

  function handleOpenDetails(
    task: DatabaseTask,
  ) {
    setSelectedTaskId(task.id)
  }


  /* ==========================================================
     CLOSE DETAIL
     ========================================================== */

  function handleCloseDetails() {
    setSelectedTaskId(null)
  }


  /* ==========================================================
     COMPLETE
     ========================================================== */

  async function handleComplete(
    task: DatabaseTask,
  ) {
    if (actionTaskId) {
      return
    }

    try {
      setActionTaskId(task.id)

      await completeTask(
        task.id,
        !task.completed,
      )
    } catch (error) {
      console.error(
        "FAILED TO UPDATE TASK:",
        error,
      )
    } finally {
      setActionTaskId(null)
    }
  }


  /* ==========================================================
     DELETE
     ========================================================== */

  async function handleDelete(
    task: DatabaseTask,
  ) {
    if (actionTaskId) {
      return
    }

    try {
      setActionTaskId(task.id)

      await deleteTask(task.id)

      if (
        selectedTaskId ===
        task.id
      ) {
        setSelectedTaskId(null)
      }
    } catch (error) {
      console.error(
        "FAILED TO DELETE TASK:",
        error,
      )
    } finally {
      setActionTaskId(null)
    }
  }


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      <div
        className="
          px-5
          py-6
          md:px-7
          md:py-7
        "
      >

        {/* ======================================================
            HEADER
            ====================================================== */}

        <section
          className="
            flex
            flex-col
            gap-5
            md:flex-row
            md:items-end
            md:justify-between
          "
        >
          <div>
            <p
              className="
                mb-2.5
                font-mono
                text-[13px]
                font-bold
                uppercase
                tracking-[0.20em]
                text-slate-400
              "
            >
              Workspace
            </p>

            <h1
              className="
                font-serif
                text-[46px]
                font-bold
                italic
                leading-none
                tracking-[-0.045em]
                text-[#182033]
                md:text-[54px]
              "
            >
              Tasks
            </h1>

            <p
              className="
                mt-3
                max-w-xl
                text-[16px]
                font-medium
                leading-6
                text-slate-400
              "
            >
              Manage your reminders,
              scheduled tasks, and
              daily actions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="
              inline-flex
              h-12
              shrink-0
              items-center
              justify-center
              gap-2.5
              rounded-[13px]
              bg-[#172033]
              px-5
              text-[14px]
              font-bold
              tracking-wide
              text-white
              shadow-[0_10px_24px_rgba(23,32,51,0.15)]
              transition-all
              duration-200
              hover:-translate-y-px
              hover:bg-[#202b43]
              hover:shadow-[0_14px_30px_rgba(23,32,51,0.18)]
              active:translate-y-0
            "
          >
            <Plus
              size={18}
              strokeWidth={2}
            />

            New Task
          </button>
        </section>


        {/* ======================================================
            SUMMARY
            ====================================================== */}

        <section
          className="
            mt-6
            grid
            grid-cols-2
            gap-3
            md:grid-cols-4
          "
        >
          <SummaryCard
            label="Total"
            value={String(
              tasks.length,
            )}
          />

          <SummaryCard
            label="Active"
            value={String(
              activeCount,
            )}
          />

          <SummaryCard
            label="Completed"
            value={String(
              completedCount,
            )}
          />

          <SummaryCard
            label="Showing"
            value={String(
              filteredTasks.length,
            )}
          />
        </section>


        {/* ======================================================
            TOOLBAR
            ====================================================== */}

        <section
          className="
            mt-6
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          {/* FILTERS */}

          <div
            className="
              flex
              w-fit
              items-center
              gap-1
              rounded-[13px]
              border
              border-slate-200
              bg-white
              p-1.5
            "
          >
            <FilterButton
              active={
                filter === "all"
              }
              onClick={() =>
                setFilter("all")
              }
            >
              All
            </FilterButton>

            <FilterButton
              active={
                filter === "active"
              }
              onClick={() =>
                setFilter("active")
              }
            >
              Active
            </FilterButton>

            <FilterButton
              active={
                filter === "completed"
              }
              onClick={() =>
                setFilter("completed")
              }
            >
              Completed
            </FilterButton>
          </div>


          {/* SEARCH */}

          <div
            className="
              relative
              w-full
              md:w-[310px]
            "
          >
            <Search
              size={18}
              strokeWidth={1.8}
              className="
                pointer-events-none
                absolute
                left-3.5
                top-1/2
                -translate-y-1/2
                text-slate-300
              "
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search tasks..."
              className="
                h-12
                w-full
                rounded-[13px]
                border
                border-slate-200
                bg-white
                pl-11
                pr-4
                text-[15px]
                font-medium
                text-slate-700
                outline-none
                transition
                placeholder:text-slate-300
                focus:border-slate-300
                focus:ring-4
                focus:ring-slate-100
              "
            />
          </div>
        </section>


        {/* ======================================================
            RESULT HEADER
            ====================================================== */}

        <div
          className="
            mt-6
            flex
            items-center
            justify-between
            gap-4
          "
        >
          <div>
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
              {filteredTasks.length}{" "}
              {filteredTasks.length === 1
                ? "Task"
                : "Tasks"}
            </p>

            <p
              className="
                mt-1
                text-[14px]
                font-medium
                text-slate-400
              "
            >
              {hasMoreTasks
                ? `Showing the first ${MAIN_TASK_LIMIT}.`
                : "All matching tasks are visible."}
            </p>
          </div>

          {hasMoreTasks && (
            <button
              type="button"
              onClick={() =>
                setAllTasksOpen(true)
              }
              className="
                inline-flex
                h-10
                shrink-0
                items-center
                gap-2
                rounded-[11px]
                border
                border-slate-200
                bg-white
                px-4
                text-[13px]
                font-bold
                text-slate-600
                transition-all
                duration-200
                hover:border-slate-300
                hover:bg-slate-50
                hover:text-[#172033]
              "
            >
              View all
              <span
                className="
                  rounded-full
                  bg-slate-100
                  px-2
                  py-0.5
                  font-mono
                  text-[11px]
                  font-bold
                  text-slate-500
                "
              >
                {filteredTasks.length}
              </span>
            </button>
          )}
        </div>


        {/* ======================================================
            ERROR
            ====================================================== */}

        {tasksError && (
          <div
            className="
              mt-4
              rounded-[13px]
              border
              border-red-100
              bg-red-50/80
              px-5
              py-4
              text-[14px]
              font-medium
              text-red-500
            "
          >
            Failed to load tasks:{" "}
            {tasksError}
          </div>
        )}


        {/* ======================================================
            LOADING
            ====================================================== */}

        {tasksLoading ? (
          <section className="mt-4">
            <div
              className="
                animate-pulse
                rounded-[20px]
                border
                border-slate-200
                bg-white
                p-6
              "
            >
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="mt-5 h-8 w-2/3 rounded bg-slate-100" />
              <div className="mt-3 h-5 w-full rounded bg-slate-100" />
              <div className="mt-5 flex gap-3">
                <div className="h-9 w-28 rounded-lg bg-slate-100" />
                <div className="h-9 w-24 rounded-lg bg-slate-100" />
              </div>
            </div>
          </section>
        ) : (
          /* ====================================================
             LIMITED TASK PREVIEW

             ONLY FOUR TASKS LIVE ON THE MAIN PAGE.
             EVERYTHING ELSE GOES INTO THE POPUP.
             ==================================================== */

          <section className="mt-4">
            {previewTasks.length === 0 ? (
              <EmptyTasks
                search={search}
                filter={filter}
                onCreate={handleCreate}
              />
            ) : (
              <div className="space-y-3">
                {previewTasks.map(
                  (task) => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      busy={
                        actionTaskId ===
                        task.id
                      }
                      onOpen={() =>
                        handleOpenDetails(
                          task,
                        )
                      }
                      onComplete={() =>
                        void handleComplete(
                          task,
                        )
                      }
                      onDelete={() =>
                        void handleDelete(
                          task,
                        )
                      }
                      onEdit={() =>
                        handleEdit(
                          task,
                        )
                      }
                    />
                  ),
                )}
              </div>
            )}
          </section>
        )}


        {/* ======================================================
            VIEW ALL BAR
            ====================================================== */}

        {!tasksLoading &&
          hasMoreTasks && (
            <button
              type="button"
              onClick={() =>
                setAllTasksOpen(true)
              }
              className="
                mt-4
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-[14px]
                border
                border-dashed
                border-slate-300
                bg-white/60
                py-4
                text-[14px]
                font-bold
                text-slate-500
                transition-all
                duration-200
                hover:border-slate-400
                hover:bg-white
                hover:text-[#172033]
              "
            >
              View all{" "}
              {filteredTasks.length} tasks
            </button>
          )}
      </div>


      {/* ========================================================
          ALL TASKS POPUP
          ======================================================== */}

      {allTasksOpen && (
        <div
          className="
            fixed
            inset-0
            z-[9990]
            flex
            items-center
            justify-center
            bg-slate-900/20
            p-4
            backdrop-blur-[3px]
            md:p-8
          "
          role="dialog"
          aria-modal="true"
          aria-label="All tasks"
        >
          <div
            className="
              flex
              max-h-[88vh]
              w-full
              max-w-[940px]
              flex-col
              overflow-hidden
              rounded-[24px]
              border
              border-slate-200
              bg-white
              shadow-[0_30px_90px_rgba(15,23,42,0.22)]
            "
          >
            {/* POPUP HEADER */}

            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                gap-5
                border-b
                border-slate-200
                bg-[#f7f8fa]
                px-5
                py-5
                md:px-7
              "
            >
              <div>
                <p
                  className="
                    font-mono
                    text-[12px]
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-slate-400
                  "
                >
                  L&P Task Board
                </p>

                <h2
                  className="
                    mt-1.5
                    font-serif
                    text-[30px]
                    font-bold
                    italic
                    leading-none
                    tracking-[-0.04em]
                    text-[#172033]
                    md:text-[36px]
                  "
                >
                  All Tasks
                </h2>

                <p
                  className="
                    mt-2
                    text-[14px]
                    font-medium
                    text-slate-400
                  "
                >
                  {filteredTasks.length}{" "}
                  matching{" "}
                  {filteredTasks.length ===
                  1
                    ? "task"
                    : "tasks"}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAllTasksOpen(
                    false,
                  )
                }
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-[12px]
                  border
                  border-slate-200
                  bg-white
                  text-slate-400
                  transition
                  hover:border-slate-300
                  hover:text-[#172033]
                "
                aria-label="Close all tasks"
              >
                <X size={20} />
              </button>
            </div>


            {/* POPUP TOOLBAR */}

            <div
              className="
                flex
                shrink-0
                flex-col
                gap-3
                border-b
                border-slate-100
                px-5
                py-4
                md:flex-row
                md:items-center
                md:justify-between
                md:px-7
              "
            >
              <div
                className="
                  flex
                  w-fit
                  items-center
                  gap-1
                  rounded-[11px]
                  border
                  border-slate-200
                  bg-white
                  p-1
                "
              >
                <FilterButton
                  active={
                    filter === "all"
                  }
                  onClick={() =>
                    setFilter("all")
                  }
                >
                  All
                </FilterButton>

                <FilterButton
                  active={
                    filter === "active"
                  }
                  onClick={() =>
                    setFilter("active")
                  }
                >
                  Active
                </FilterButton>

                <FilterButton
                  active={
                    filter === "completed"
                  }
                  onClick={() =>
                    setFilter(
                      "completed",
                    )
                  }
                >
                  Completed
                </FilterButton>
              </div>

              <p
                className="
                  text-[13px]
                  font-medium
                  text-slate-400
                "
              >
                Search and filters remain active.
              </p>
            </div>


            {/* POPUP CONTENT

                THIS IS THE ONLY SCROLLING TASK
                REGION IN THE POPUP. */}

            <div
              className="
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
                px-5
                py-5
                md:px-7
                md:py-6
              "
              style={{
                scrollbarWidth: "thin",
              }}
            >
              {filteredTasks.length ===
              0 ? (
                <EmptyTasks
                  search={search}
                  filter={filter}
                  onCreate={() => {
                    setAllTasksOpen(false)
                    handleCreate()
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map(
                    (task) => (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        busy={
                          actionTaskId ===
                          task.id
                        }
                        onOpen={() =>
                          handleOpenDetails(
                            task,
                          )
                        }
                        onComplete={() =>
                          void handleComplete(
                            task,
                          )
                        }
                        onDelete={() =>
                          void handleDelete(
                            task,
                          )
                        }
                        onEdit={() =>
                          handleEdit(
                            task,
                          )
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </div>


            {/* POPUP FOOTER */}

            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                border-t
                border-slate-100
                bg-slate-50/60
                px-5
                py-3
                md:px-7
              "
            >
              <span
                className="
                  font-mono
                  text-[11px]
                  font-bold
                  uppercase
                  tracking-[0.11em]
                  text-slate-300
                "
              >
                Lighter & Princess
              </span>

              <span
                className="
                  text-[13px]
                  font-semibold
                  text-slate-400
                "
              >
                {filteredTasks.length}{" "}
                visible
              </span>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================
          TASK DETAIL POPUP
          ======================================================== */}

      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          busy={
            actionTaskId ===
            selectedTask.id
          }
          onClose={
            handleCloseDetails
          }
          onComplete={() =>
            void handleComplete(
              selectedTask,
            )
          }
          onDelete={() =>
            void handleDelete(
              selectedTask,
            )
          }
          onEdit={() => {
            handleCloseDetails()
            handleEdit(
              selectedTask,
            )
          }}
        />
      )}


      {/* ========================================================
          CREATE / EDIT
          ======================================================== */}

      <CreateTaskDialog
        open={createTaskOpen}
        task={
          editingTask as
            DialogTask | null
        }
        onOpenChange={
          handleDialogChange
        }
      />
    </>
  )
}


/* ============================================================
   SUMMARY CARD
   ============================================================ */

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      className="
        rounded-[16px]
        border
        border-slate-200/80
        bg-white
        px-5
        py-4
        shadow-[0_3px_12px_rgba(15,23,42,0.025)]
      "
    >
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
        {label}
      </p>

      <p
        className="
          mt-2
          text-[27px]
          font-bold
          leading-none
          tracking-[-0.04em]
          text-[#172033]
        "
      >
        {value}
      </p>
    </div>
  )
}


/* ============================================================
   TASK ITEM
   ============================================================ */

function TaskListItem({
  task,
  busy,
  onOpen,
  onComplete,
  onDelete,
  onEdit,
}: {
  task: DatabaseTask
  busy: boolean
  onOpen: () => void
  onComplete: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const animation =
    getAnimationById(
      task.animation_id,
    )

  return (
    <div
      className="
        group
        relative
        overflow-hidden
        rounded-[19px]
        border
        border-slate-200
        bg-white
        shadow-[0_4px_16px_rgba(30,45,65,0.035)]
        transition-all
        duration-200
        hover:-translate-y-px
        hover:border-slate-300
        hover:shadow-[0_10px_25px_rgba(30,45,65,0.07)]
      "
    >
      {/* CLICKABLE CONTENT */}

      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="
          block
          w-full
          text-left
          outline-none
          focus-visible:ring-4
          focus-visible:ring-inset
          focus-visible:ring-slate-100
        "
      >
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4">

            {/* CHECK STATUS */}

            <div
              className={`
                mt-0.5
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-[12px]
                border
                ${
                  task.completed
                    ? "border-emerald-100 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }
              `}
            >
              {task.completed ? (
                <CheckCircle2
                  size={20}
                  strokeWidth={1.9}
                  className="text-emerald-500"
                />
              ) : (
                <Clock3
                  size={20}
                  strokeWidth={1.8}
                  className="text-slate-400"
                />
              )}
            </div>


            {/* MAIN */}

            <div className="min-w-0 flex-1">
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2.5
                "
              >
                <h2
                  className={`
                    min-w-0
                    text-[20px]
                    font-bold
                    leading-6
                    tracking-[-0.02em]
                    ${
                      task.completed
                        ? "text-slate-400 line-through"
                        : "text-[#172033]"
                    }
                  `}
                >
                  {task.title}
                </h2>

                <PriorityBadge
                  priority={
                    task.priority
                  }
                />
              </div>

              {task.description && (
                <p
                  className="
                    mt-2
                    line-clamp-2
                    text-[15px]
                    font-medium
                    leading-6
                    text-slate-500
                  "
                >
                  {task.description}
                </p>
              )}

              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <MetaBadge>
                  <Clock3
                    size={14}
                    strokeWidth={1.8}
                  />
                  {formatTaskTime(
                    task.due_time,
                  )}
                </MetaBadge>

                <MetaBadge>
                  <Repeat2
                    size={14}
                    strokeWidth={1.8}
                  />
                  {formatRepeat(
                    task.repeat,
                  )}
                </MetaBadge>

                <MetaBadge>
                  <CalendarDays
                    size={14}
                    strokeWidth={1.8}
                  />
                  {task.due_date}
                </MetaBadge>

                <AnimationMetaBadge
                  animation={animation}
                  fallbackId={task.animation_id}
                />
              </div>
            </div>


            {/* OPEN DETAILS */}

            <div
              className="
                hidden
                shrink-0
                items-center
                text-slate-300
                transition-all
                duration-200
                group-hover:translate-x-0.5
                group-hover:text-slate-500
                sm:flex
              "
              aria-hidden="true"
            >
              <ChevronRight
                size={22}
                strokeWidth={1.8}
              />
            </div>
          </div>
        </div>
      </button>


      {/* ACTION BAR */}

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
          border-t
          border-slate-100
          bg-slate-50/55
          px-5
          py-3
          md:px-6
        "
      >
        <span
          className={`
            flex
            items-center
            gap-2
            text-[13px]
            font-semibold
            ${
              task.completed
                ? "text-slate-400"
                : "text-emerald-600"
            }
          `}
        >
          <span
            className={`
              h-2.5
              w-2.5
              rounded-full
              ${
                task.completed
                  ? "bg-slate-300"
                  : "bg-emerald-500"
              }
            `}
          />

          {task.completed
            ? "Completed"
            : "Active reminder"}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onComplete}
            disabled={busy}
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-[9px]
              px-3
              py-2
              text-[13px]
              font-bold
              text-slate-500
              transition
              hover:bg-white
              hover:text-[#172033]
              disabled:cursor-wait
              disabled:opacity-50
            "
          >
            <Check
              size={14}
              strokeWidth={2}
            />
            {task.completed
              ? "Mark active"
              : "Complete"}
          </button>

          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-[9px]
              px-3
              py-2
              text-[13px]
              font-bold
              text-slate-400
              transition
              hover:bg-white
              hover:text-[#172033]
              disabled:cursor-wait
              disabled:opacity-50
            "
          >
            <Pencil
              size={14}
              strokeWidth={1.9}
            />
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-[9px]
              text-slate-300
              transition
              hover:bg-red-50
              hover:text-red-500
              disabled:cursor-wait
              disabled:opacity-50
            "
            aria-label="Delete task"
          >
            <Trash2
              size={15}
              strokeWidth={1.8}
            />
          </button>
        </div>
      </div>
    </div>
  )
}


/* ============================================================
   FILTER BUTTON
   ============================================================ */

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-[9px]
        px-4
        py-2.5
        text-[13px]
        font-bold
        transition-all
        duration-150
        ${
          active
            ? "bg-[#172033] text-white shadow-sm"
            : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        }
      `}
    >
      {children}
    </button>
  )
}


/* ============================================================
   PRIORITY BADGE
   ============================================================ */

function PriorityBadge({
  priority,
}: {
  priority: TaskPriority
}) {
  const styles: Record<
    TaskPriority,
    string
  > = {
    low:
      "bg-slate-100 text-slate-600",

    medium:
      "bg-amber-50 text-amber-700",

    high:
      "bg-red-50 text-red-600",
  }

  return (
    <span
      className={`
        shrink-0
        rounded-full
        px-2.5
        py-1
        text-[11px]
        font-bold
        uppercase
        tracking-[0.08em]
        ${styles[priority]}
      `}
    >
      {priority}
    </span>
  )
}


/* ============================================================
   META BADGE
   ============================================================ */

function MetaBadge({
  children,
}: {
  children: ReactNode
}) {
  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-[8px]
        border
        border-slate-200
        bg-slate-50
        px-2.5
        py-1.5
        font-mono
        text-[11px]
        font-bold
        tracking-[0.04em]
        text-slate-500
      "
    >
      {children}
    </span>
  )
}


/* ============================================================
   ANIMATION PREVIEW
   ============================================================ */

function AnimationPreview({
  animation,
  size = "small",
}: {
  animation: AnimationItem | null
  size?: "small" | "large"
}) {
  const isMedia =
    animation?.mediaType === "image" ||
    animation?.mediaType === "gif"

  const boxClass =
    size === "large"
      ? "h-[88px] w-[88px] rounded-[18px] text-[42px]"
      : "h-8 w-8 rounded-[8px] text-[18px]"

  if (isMedia && animation?.mediaSrc) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50 ${boxClass}`}
      >
        <img
          src={animation.mediaSrc}
          alt={animation.name}
          className="
            h-full
            w-full
            object-contain
            select-none
          "
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center border border-slate-200 bg-slate-50 ${boxClass}`}
      aria-label={
        animation?.name ??
        "Default animation"
      }
    >
      {animation?.preview ?? "✨"}
    </div>
  )
}


/* ============================================================
   ANIMATION META BADGE
   ============================================================ */

function AnimationMetaBadge({
  animation,
  fallbackId,
}: {
  animation: AnimationItem | null
  fallbackId: string
}) {
  return (
    <span
      className="
        inline-flex
        max-w-full
        items-center
        gap-1.5
        rounded-[8px]
        border
        border-slate-200
        bg-slate-50
        px-2.5
        py-1.5
        font-mono
        text-[11px]
        font-bold
        tracking-[0.04em]
        text-slate-500
      "
      title={
        animation?.description ??
        fallbackId
      }
    >
      {animation ? (
        <AnimationPreview
          animation={animation}
          size="small"
        />
      ) : (
        <Play
          size={13}
          strokeWidth={1.9}
        />
      )}

      <span className="truncate">
        {animation?.name ??
          fallbackId}
      </span>
    </span>
  )
}


/* ============================================================
   DETAIL DIALOG
   ============================================================ */

function TaskDetailsDialog({
  task,
  busy,
  onClose,
  onComplete,
  onDelete,
  onEdit,
}: {
  task: DatabaseTask
  busy: boolean
  onClose: () => void
  onComplete: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const animation =
    getAnimationById(
      task.animation_id,
    )

  return (
    <div
      className="
        fixed
        inset-0
        z-[10000]
        flex
        items-center
        justify-center
        bg-slate-900/20
        p-4
        backdrop-blur-[3px]
        md:p-8
      "
      role="dialog"
      aria-modal="true"
      aria-label="Task details"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div
        className="
          flex
          max-h-[88vh]
          w-full
          max-w-[720px]
          flex-col
          overflow-hidden
          rounded-[24px]
          border
          border-slate-200
          bg-white
          shadow-[0_30px_90px_rgba(15,23,42,0.22)]
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            shrink-0
            items-start
            justify-between
            gap-5
            border-b
            border-slate-200
            bg-[#f7f8fa]
            px-6
            py-6
            md:px-7
          "
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {task.completed ? (
                <CheckCircle2
                  size={20}
                  className="text-emerald-500"
                />
              ) : (
                <Clock3
                  size={20}
                  className="text-slate-400"
                />
              )}

              <span
                className="
                  font-mono
                  text-[12px]
                  font-bold
                  uppercase
                  tracking-[0.14em]
                  text-slate-400
                "
              >
                {task.completed
                  ? "Completed Task"
                  : "Reminder Task"}
              </span>
            </div>

            <h2
              className="
                mt-3
                font-serif
                text-[34px]
                font-bold
                leading-[1.05]
                tracking-[-0.045em]
                text-[#172033]
                md:text-[40px]
              "
            >
              {task.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-[12px]
              border
              border-slate-200
              bg-white
              text-slate-400
              transition
              hover:border-slate-300
              hover:text-[#172033]
            "
            aria-label="Close task details"
          >
            <X size={20} />
          </button>
        </div>


        {/* CONTENT */}

        <div
          className="
            min-h-0
            overflow-y-auto
            px-6
            py-6
            md:px-7
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
                tracking-[0.14em]
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
                "
              >
                {task.description?.trim()
                  ? task.description
                  : "No detailed description was added for this task."}
              </p>
            </div>
          </section>


          {/* DETAILS */}

          <section className="mt-6">
            <p
              className="
                font-mono
                text-[12px]
                font-bold
                uppercase
                tracking-[0.14em]
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
              <DetailBlock
                label="Date"
                value={task.due_date}
              />

              <DetailBlock
                label="Time"
                value={formatTaskTime(
                  task.due_time,
                )}
              />

              <DetailBlock
                label="Priority"
                value={capitalize(
                  task.priority,
                )}
              />

              <DetailBlock
                label="Repeat"
                value={formatRepeat(
                  task.repeat,
                )}
              />

              <DetailBlock
                label="Sound"
                value={
                  task.sound_enabled
                    ? "Enabled"
                    : "Disabled"
                }
              />

              <DetailBlock
                label="Status"
                value={
                  task.completed
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
                tracking-[0.14em]
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
              <AnimationPreview
                animation={animation}
                size="large"
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="
                      text-[18px]
                      font-bold
                      text-[#172033]
                    "
                  >
                    {animation?.name ??
                      "Default Animation"}
                  </p>

                  {animation && (
                    <span
                      className="
                        inline-flex
                        items-center
                        rounded-full
                        bg-slate-100
                        px-2.5
                        py-1
                        font-mono
                        text-[10px]
                        font-bold
                        uppercase
                        tracking-[0.10em]
                        text-slate-500
                      "
                    >
                      {animation.category}
                    </span>
                  )}
                </div>

                <p
                  className="
                    mt-1.5
                    break-all
                    font-mono
                    text-[12px]
                    font-semibold
                    uppercase
                    tracking-[0.08em]
                    text-slate-400
                  "
                >
                  {task.animation_id}
                </p>

                {animation?.description && (
                  <p
                    className="
                      mt-2
                      text-[14px]
                      font-medium
                      leading-5
                      text-slate-500
                    "
                  >
                    {animation.description}
                  </p>
                )}
              </div>
            </div>
          </section>


          {/* ACTIONS */}

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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                className="
                  inline-flex
                  h-11
                  items-center
                  gap-2
                  rounded-[11px]
                  border
                  border-slate-200
                  bg-white
                  px-5
                  text-[13px]
                  font-bold
                  text-slate-600
                  transition
                  hover:border-slate-300
                  hover:text-[#172033]
                  disabled:opacity-50
                "
              >
                <Pencil
                  size={15}
                  strokeWidth={1.9}
                />
                Edit
              </button>

              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="
                  inline-flex
                  h-11
                  items-center
                  gap-2
                  rounded-[11px]
                  border
                  border-red-100
                  bg-red-50
                  px-5
                  text-[13px]
                  font-bold
                  text-red-500
                  transition
                  hover:bg-red-100
                  disabled:opacity-50
                "
              >
                <Trash2
                  size={15}
                  strokeWidth={1.9}
                />
                Delete
              </button>
            </div>

            <button
              type="button"
              onClick={onComplete}
              disabled={busy}
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-[11px]
                bg-[#172033]
                px-5
                text-[13px]
                font-bold
                uppercase
                tracking-[0.06em]
                text-white
                transition
                hover:bg-[#243049]
                disabled:cursor-wait
                disabled:opacity-50
              "
            >
              <Check size={16} />

              {task.completed
                ? "Mark Active"
                : "Complete Task"}
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

function DetailBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      className="
        rounded-[14px]
        border
        border-slate-200
        bg-slate-50
        px-4
        py-4
      "
    >
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
   EMPTY STATE
   ============================================================ */

function EmptyTasks({
  search,
  filter,
  onCreate,
}: {
  search: string
  filter: Filter
  onCreate: () => void
}) {
  const message =
    search.length > 0
      ? "No tasks match your search."
      : filter === "completed"
        ? "You don't have any completed tasks yet."
        : "Nothing is scheduled here yet."

  const description =
    search.length > 0
      ? "Try another title or description."
      : "Create a reminder and it will appear in your local workspace."

  return (
    <div
      className="
        flex
        min-h-[280px]
        flex-col
        items-center
        justify-center
        rounded-[20px]
        border-2
        border-dashed
        border-slate-200
        bg-white/60
        px-6
        py-10
        text-center
      "
    >
      <div
        className="
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-[16px]
          border
          border-slate-200
          bg-slate-50
        "
      >
        <Check
          size={24}
          strokeWidth={1.7}
          className="text-slate-300"
        />
      </div>

      <p
        className="
          mt-4
          text-[18px]
          font-bold
          text-slate-700
        "
      >
        {message}
      </p>

      <p
        className="
          mt-2
          max-w-md
          text-[14px]
          font-medium
          leading-6
          text-slate-400
        "
      >
        {description}
      </p>

      {!search &&
        filter !==
          "completed" && (
          <button
            type="button"
            onClick={onCreate}
            className="
              mt-5
              inline-flex
              h-11
              items-center
              gap-2
              rounded-[11px]
              bg-[#172033]
              px-5
              text-[13px]
              font-bold
              text-white
              transition
              hover:bg-[#202b43]
            "
          >
            <Plus
              size={15}
              strokeWidth={2}
            />

            Create Task
          </button>
        )}
    </div>
  )
}


/* ============================================================
   TIME
   ============================================================ */

function formatTaskTime(
  time: string,
): string {
  if (!time) {
    return "--:--"
  }

  const [
    hours,
    minutes,
  ] = time.split(":")

  const hour =
    Number(hours)

  if (
    Number.isNaN(hour) ||
    !minutes
  ) {
    return time
  }

  const suffix =
    hour >= 12
      ? "PM"
      : "AM"

  const displayHour =
    hour % 12 || 12

  return `${displayHour}:${minutes} ${suffix}`
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


/* ============================================================
   TEXT
   ============================================================ */

function capitalize(
  value: string,
): string {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  )
}