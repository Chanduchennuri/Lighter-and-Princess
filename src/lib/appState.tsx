import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  listen,
  type UnlistenFn,
} from "@tauri-apps/api/event"

import { invoke } from "@tauri-apps/api/core"

import {
  APP_NAME,
  type AppSettings,
  type AppTheme,
  type DatabaseTask,
  type SettingsChangeEvent,
  type TaskChangeEvent,
} from "./types"

import {
  getAnimationById,
} from "./animationLibrary"

// ============================================================
// L&P — LUNAR & POWER
// GLOBAL APPLICATION STATE
// ============================================================

// ------------------------------------------------------------
// DEFAULT SETTINGS
// ------------------------------------------------------------

export const DEFAULT_APP_SETTINGS: AppSettings = {
  notifications: true,
  sound: true,
  animationEnabled: true,
  launchAtStartup: false,
  theme: "system",
}

const SELECTED_ANIMATION_STORAGE_KEY = "lp.selected-animation-id"
const DEFAULT_ANIMATION_ID = "pig_runner"

// ------------------------------------------------------------
// STATE TYPE
// ------------------------------------------------------------

interface AppStateContextValue {
  // Application
  appName: string

  // Tasks
  tasks: DatabaseTask[]
  tasksLoading: boolean
  tasksError: string | null

  // Animation selection
  selectedAnimationId: string
  setSelectedAnimationId: (id: string) => void
  selectedAnimationExists: boolean

  // Settings
  settings: AppSettings
  settingsLoading: boolean
  settingsError: string | null

  // Reload
  refreshTasks: () => Promise<void>
  refreshSettings: () => Promise<void>
  refreshAll: () => Promise<void>

  // Task helpers
  getTaskById: (
    id: string,
  ) => DatabaseTask | null

  getTasksForDate: (
    date: string,
  ) => DatabaseTask[]

  getTasksForMonth: (
    year: number,
    month: number,
  ) => DatabaseTask[]

  // Settings
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>

  setTheme: (
    theme: AppTheme,
  ) => Promise<void>

  // Backend mutations
  createTask: (
    task: {
      title: string
      description: string | null
      due_date: string
      due_time: string
      priority: string
      repeat: string
      sound_enabled: boolean
      animation_id: string
    },
  ) => Promise<DatabaseTask>

  updateTask: (
    task: {
      id: string
      title: string
      description: string | null
      due_date: string
      due_time: string
      priority: string
      repeat: string
      sound_enabled: boolean
      animation_id: string
    },
  ) => Promise<DatabaseTask>

  completeTask: (
    id: string,
    completed: boolean,
  ) => Promise<void>

  deleteTask: (
    id: string,
  ) => Promise<void>

  extendTask: (
    id: string,
    minutes: number,
  ) => Promise<DatabaseTask>

  dismissTask: (
    id: string,
  ) => Promise<DatabaseTask>
}

// ============================================================
// CONTEXT
// ============================================================

const AppStateContext =
  createContext<AppStateContextValue | null>(
    null,
  )

// ============================================================
// PROVIDER
// ============================================================

interface AppStateProviderProps {
  children: ReactNode
}

export function AppStateProvider({
  children,
}: AppStateProviderProps) {
  const [tasks, setTasks] =
    useState<DatabaseTask[]>([])

  const [tasksLoading, setTasksLoading] =
    useState(true)

  const [tasksError, setTasksError] =
    useState<string | null>(null)

  const [selectedAnimationId, setSelectedAnimationIdState] =
    useState<string>(() => {
      try {
        const stored =
          localStorage.getItem(
            SELECTED_ANIMATION_STORAGE_KEY,
          )

        if (stored && getAnimationById(stored)) {
          return stored
        }
      } catch (error) {
        console.warn(
          `[${APP_NAME}] Failed to restore selected animation:`,
          error,
        )
      }

      return DEFAULT_ANIMATION_ID
    })

  const selectedAnimationExists =
    Boolean(getAnimationById(selectedAnimationId))

  const setSelectedAnimationId =
    useCallback((id: string) => {
      if (!getAnimationById(id)) {
        console.warn(
          `[${APP_NAME}] Ignoring unknown animation ID:`,
          id,
        )
        return
      }

      setSelectedAnimationIdState(id)

      try {
        localStorage.setItem(
          SELECTED_ANIMATION_STORAGE_KEY,
          id,
        )
      } catch (error) {
        console.warn(
          `[${APP_NAME}] Failed to persist selected animation:`,
          error,
        )
      }
    }, [])

  const [settings, setSettings] =
    useState<AppSettings>(
      DEFAULT_APP_SETTINGS,
    )

  const [settingsLoading, setSettingsLoading] =
    useState(true)

  const [settingsError, setSettingsError] =
    useState<string | null>(null)

  // ==========================================================
  // LOAD TASKS
  // ==========================================================

  const refreshTasks =
    useCallback(async () => {
      try {
        setTasksLoading(true)
        setTasksError(null)

        const result =
          await invoke<DatabaseTask[]>(
            "get_tasks",
          )

        setTasks(result)
      } catch (error) {
        console.error(
          `[${APP_NAME}] Failed to load tasks:`,
          error,
        )

        setTasksError(
          error instanceof Error
            ? error.message
            : String(error),
        )
      } finally {
        setTasksLoading(false)
      }
    }, [])

  // ==========================================================
  // LOAD SETTINGS
  // ==========================================================
  //
  // Backend commands are added in the next backend step:
  //
  // get_app_settings
  //
  // This keeps the React state architecture ready for the
  // persistent settings implementation.
  // ==========================================================

  const refreshSettings =
    useCallback(async () => {
      try {
        setSettingsLoading(true)
        setSettingsError(null)

        const result =
          await invoke<AppSettings>(
            "get_app_settings",
          )

        setSettings({
          ...DEFAULT_APP_SETTINGS,
          ...result,
        })
      } catch (error) {
        console.error(
          `[${APP_NAME}] Failed to load settings:`,
          error,
        )

        setSettingsError(
          error instanceof Error
            ? error.message
            : String(error),
        )

        // Keep the application usable even if settings
        // haven't been connected yet.
        setSettings(
          DEFAULT_APP_SETTINGS,
        )
      } finally {
        setSettingsLoading(false)
      }
    }, [])

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    void refreshTasks()
    void refreshSettings()
  }, [
    refreshTasks,
    refreshSettings,
  ])

  // ==========================================================
  // TASK EVENT LISTENER
  // ==========================================================
  //
  // Rust will emit:
  //
  // task-changed
  //
  // whenever create/update/complete/delete/extend happens.
  //
  // We refresh the central task state immediately.
  // ==========================================================

  useEffect(() => {
    let mounted = true

    let unlisten:
      | UnlistenFn
      | null = null

    async function subscribe() {
      try {
        unlisten =
          await listen<TaskChangeEvent>(
            "task-changed",
            (event) => {
              if (!mounted) {
                return
              }

              console.log(
                `[${APP_NAME}] Task state changed:`,
                event.payload,
              )

              // ------------------------------------------------
              // FAST PATH
              // ------------------------------------------------
              //
              // If Rust gives us the changed task, update
              // the existing object immediately instead of
              // waiting for another database query.
              //
              if (
                event.payload.task
              ) {
                const changedTask =
                  event.payload.task

                setTasks(
                  (current) => {
                    const exists =
                      current.some(
                        (task) =>
                          task.id ===
                          changedTask.id,
                      )

                    if (exists) {
                      return current.map(
                        (task) =>
                          task.id ===
                          changedTask.id
                            ? changedTask
                            : task,
                      )
                    }

                    return [
                      ...current,
                      changedTask,
                    ]
                  },
                )
              }

              // ------------------------------------------------
              // DELETE
              // ------------------------------------------------

              if (
                event.payload.action ===
                "deleted"
              ) {
                setTasks(
                  (current) =>
                    current.filter(
                      (task) =>
                        task.id !==
                        event.payload.taskId,
                    ),
                )

                return
              }

              // ------------------------------------------------
              // SAFETY REFRESH
              // ------------------------------------------------
              //
              // This makes the UI resilient even if the
              // event payload is incomplete.
              //

              void refreshTasks()
            },
          )
      } catch (error) {
        console.error(
          `[${APP_NAME}] Failed to subscribe to task events:`,
          error,
        )
      }
    }

    void subscribe()

    return () => {
      mounted = false

      if (unlisten) {
        unlisten()
      }
    }
  }, [refreshTasks])

  // ==========================================================
  // SETTINGS EVENT LISTENER
  // ==========================================================

  useEffect(() => {
    let mounted = true

    let unlisten:
      | UnlistenFn
      | null = null

    async function subscribe() {
      try {
        unlisten =
          await listen<SettingsChangeEvent>(
            "settings-changed",
            (event) => {
              if (!mounted) {
                return
              }

              console.log(
                `[${APP_NAME}] Settings changed:`,
                event.payload,
              )

              if (
                event.payload.settings
              ) {
                setSettings({
                  ...DEFAULT_APP_SETTINGS,
                  ...event.payload.settings,
                })
              }
            },
          )
      } catch (error) {
        console.error(
          `[${APP_NAME}] Failed to subscribe to settings events:`,
          error,
        )
      }
    }

    void subscribe()

    return () => {
      mounted = false

      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  // ==========================================================
  // GET ONE TASK
  // ==========================================================

  const getTaskById =
    useCallback(
      (
        id: string,
      ) => {
        return (
          tasks.find(
            (task) =>
              task.id === id,
          ) ?? null
        )
      },
      [tasks],
    )

  // ==========================================================
  // GET TASKS FOR DATE
  // ==========================================================

  const getTasksForDate =
    useCallback(
      (
        date: string,
      ) => {
        return tasks.filter(
          (task) =>
            task.due_date === date,
        )
      },
      [tasks],
    )

  // ==========================================================
  // GET TASKS FOR MONTH
  // ==========================================================

  const getTasksForMonth =
    useCallback(
      (
        year: number,
        month: number,
      ) => {
        const prefix =
          `${year}-${String(
            month,
          ).padStart(2, "0")}`

        return tasks.filter(
          (task) =>
            task.due_date.startsWith(
              `${prefix}-`,
            ),
        )
      },
      [tasks],
    )

  // ==========================================================
  // UPDATE SETTING
  // ==========================================================

  const updateSetting =
    useCallback(
      async <
        K extends keyof AppSettings,
      >(
        key: K,
        value: AppSettings[K],
      ) => {
        try {
          setSettingsError(null)

          // --------------------------------------------------
          // OPTIMISTIC UPDATE
          // --------------------------------------------------
          //
          // The interface responds immediately.
          // SQLite remains the source of truth.
          //

          setSettings(
            (current) => ({
              ...current,
              [key]: value,
            }),
          )

          await invoke(
            "update_app_setting",
            {
              key,
              value,
            },
          )
        } catch (error) {
          console.error(
            `[${APP_NAME}] Failed to update setting "${String(
              key,
            )}":`,
            error,
          )

          setSettingsError(
            error instanceof Error
              ? error.message
              : String(error),
          )

          // Roll back by reloading the
          // persisted values.
          await refreshSettings()

          throw error
        }
      },
      [refreshSettings],
    )

  // ==========================================================
  // THEME
  // ==========================================================

  const setTheme =
    useCallback(
      async (
        theme: AppTheme,
      ) => {
        await updateSetting(
          "theme",
          theme,
        )
      },
      [updateSetting],
    )

  // ==========================================================
  // CREATE TASK
  // ==========================================================

  const createTask =
    useCallback(
      async (
        task: {
          title: string
          description: string | null
          due_date: string
          due_time: string
          priority: string
          repeat: string
          sound_enabled: boolean
          animation_id: string
        },
      ) => {
        const created =
          await invoke<DatabaseTask>(
            "create_task",
            {
              task,
            },
          )

        // The Rust backend will emit task-changed.
        // Updating locally as well gives immediate UI response.
        setTasks(
          (current) => [
            ...current,
            created,
          ],
        )

        return created
      },
      [],
    )

  // ==========================================================
  // UPDATE TASK
  // ==========================================================

  const updateTask =
    useCallback(
      async (
        task: {
          id: string
          title: string
          description: string | null
          due_date: string
          due_time: string
          priority: string
          repeat: string
          sound_enabled: boolean
          animation_id: string
        },
      ) => {
        const updated =
          await invoke<DatabaseTask>(
            "update_task",
            {
              task,
            },
          )

        setTasks(
          (current) =>
            current.map(
              (item) =>
                item.id === updated.id
                  ? updated
                  : item,
            ),
        )

        return updated
      },
      [],
    )

  // ==========================================================
  // COMPLETE TASK
  // ==========================================================

  const completeTask =
    useCallback(
      async (
        id: string,
        completed: boolean,
      ) => {
        await invoke(
          "complete_task",
          {
            id,
            completed,
          },
        )

        // Backend event will also update state.
        // This immediate local update ensures the UI
        // does not wait for the event round-trip.
        setTasks(
          (current) =>
            current.map(
              (task) =>
                task.id === id
                  ? {
                      ...task,
                      completed,
                    }
                  : task,
            ),
        )
      },
      [],
    )

  // ==========================================================
  // DELETE TASK
  // ==========================================================

  const deleteTask =
    useCallback(
      async (
        id: string,
      ) => {
        await invoke(
          "delete_task",
          {
            id,
          },
        )

        // Remove immediately.
        setTasks(
          (current) =>
            current.filter(
              (task) =>
                task.id !== id,
            ),
        )
      },
      [],
    )

  // ==========================================================
  // EXTEND TASK
  // ==========================================================

  const extendTask =
    useCallback(
      async (
        id: string,
        minutes: number,
      ) => {
        const updated =
          await invoke<DatabaseTask>(
            "extend_task",
            {
              id,
              minutes,
            },
          )

        setTasks(
          (current) =>
            current.map(
              (task) =>
                task.id === updated.id
                  ? updated
                  : task,
            ),
        )

        return updated
      },
      [],
    )

  // ==========================================================
  // DISMISS TASK
  // ==========================================================

  const dismissTask =
    useCallback(
      async (
        id: string,
      ) => {
        const updated =
          await invoke<DatabaseTask>(
            "dismiss_task",
            {
              id,
            },
          )

        setTasks(
          (current) =>
            current.map(
              (task) =>
                task.id === updated.id
                  ? updated
                  : task,
            ),
        )

        return updated
      },
      [],
    )

  // ==========================================================
  // REFRESH EVERYTHING
  // ==========================================================

  const refreshAll =
    useCallback(async () => {
      await Promise.all([
        refreshTasks(),
        refreshSettings(),
      ])
    }, [
      refreshTasks,
      refreshSettings,
    ])

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value =
    useMemo<AppStateContextValue>(
      () => ({
        appName: APP_NAME,

        tasks,
        tasksLoading,
        tasksError,

        selectedAnimationId,
        setSelectedAnimationId,
        selectedAnimationExists,

        settings,
        settingsLoading,
        settingsError,

        refreshTasks,
        refreshSettings,
        refreshAll,

        getTaskById,
        getTasksForDate,
        getTasksForMonth,

        updateSetting,
        setTheme,

        createTask,
        updateTask,
        completeTask,
        deleteTask,
        extendTask,
        dismissTask,
      }),
      [
        tasks,
        tasksLoading,
        tasksError,

        selectedAnimationId,
        setSelectedAnimationId,
        selectedAnimationExists,

        settings,
        settingsLoading,
        settingsError,

        refreshTasks,
        refreshSettings,
        refreshAll,

        getTaskById,
        getTasksForDate,
        getTasksForMonth,

        updateSetting,
        setTheme,

        createTask,
        updateTask,
        completeTask,
        deleteTask,
        extendTask,
        dismissTask,
      ],
    )

  return (
    <AppStateContext.Provider
      value={value}
    >
      {children}
    </AppStateContext.Provider>
  )
}

// ============================================================
// HOOK
// ============================================================

export function useAppState() {
  const context =
    useContext(
      AppStateContext,
    )

  if (!context) {
    throw new Error(
      "useAppState must be used inside AppStateProvider",
    )
  }

  return context
}

// ============================================================
// CONVENIENCE HOOKS
// ============================================================

export function useTasks() {
  const {
    tasks,
    tasksLoading,
    tasksError,
    refreshTasks,
    getTaskById,
    getTasksForDate,
    getTasksForMonth,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    extendTask,
    dismissTask,
  } = useAppState()

  return {
    tasks,
    tasksLoading,
    tasksError,

    refreshTasks,

    getTaskById,
    getTasksForDate,
    getTasksForMonth,

    createTask,
    updateTask,
    completeTask,
    deleteTask,
    extendTask,
    dismissTask,
  }
}

export function useSettings() {
  const {
    settings,
    settingsLoading,
    settingsError,
    refreshSettings,
    updateSetting,
    setTheme,
  } = useAppState()

  return {
    settings,
    settingsLoading,
    settingsError,

    refreshSettings,

    updateSetting,
    setTheme,
  }
}

// ============================================================
// ANIMATION SELECTION
// ============================================================

export function useAnimationSelection() {
  const {
    selectedAnimationId,
    setSelectedAnimationId,
    selectedAnimationExists,
  } = useAppState()

  return {
    selectedAnimationId,
    setSelectedAnimationId,
    selectedAnimationExists,
  }
}
