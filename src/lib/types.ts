// ============================================================
// L&P — LUNAR & POWER
// Shared application types
// ============================================================

export type TaskPriority =
  | "low"
  | "medium"
  | "high"

export type TaskStatus =
  | "pending"
  | "completed"
  | "dismissed"

export type RepeatRule =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"

// ============================================================
// DATABASE TASK
// ============================================================
//
// This is the canonical shape returned by Rust / SQLite.
//
// Keep this shape aligned with the backend Task struct.
// Components that need camelCase UI values can map from this
// type explicitly.
//
export interface DatabaseTask {
  id: string

  title: string

  description: string | null

  due_date: string

  due_time: string

  priority: TaskPriority

  repeat: string

  sound_enabled: boolean

  animation_id: string

  completed: boolean

  created_at: string

  updated_at: string
}

// ============================================================
// FRONTEND TASK
// ============================================================
//
// Used by visual components such as TaskCard and Reminder.
//
// This keeps backend/database concerns separate from UI concerns.
//
export interface Task {
  id: string

  title: string

  description: string

  dueAt: string

  priority: TaskPriority

  animationId: string

  status: TaskStatus

  repeat: string
}

// ============================================================
// APPLICATION SETTINGS
// ============================================================
//
// These values are persisted through the Rust/SQLite backend.
//
// They are intentionally application-level settings rather than
// task-specific settings.
//
export type AppTheme =
  | "system"
  | "light"
  | "dark"

export interface AppSettings {
  notifications: boolean

  sound: boolean

  animationEnabled: boolean

  launchAtStartup: boolean

  theme: AppTheme
}

// ============================================================
// TASK EVENTS
// ============================================================
//
// Rust will broadcast this event whenever task data changes.
//
// Instead of every page independently guessing when it should
// reload, the shared application state listens for this event.
//
export type TaskChangeAction =
  | "created"
  | "updated"
  | "completed"
  | "deleted"

export interface TaskChangeEvent {
  action: TaskChangeAction

  taskId: string

  task?: DatabaseTask
}

// ============================================================
// SETTINGS EVENTS
// ============================================================
//
// Broadcast whenever persisted settings change.
//
export interface SettingsChangeEvent {
  settings: AppSettings
}

// ============================================================
// APPLICATION BRAND
// ============================================================

export const APP_NAME = "L&P"

export const APP_FULL_NAME =
  "Lunar & Power"