use crate::db::Database;
use crate::models::{CreateTask, Task, UpdateTask};
use crate::repositories::TaskRepository;

use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskChangeEvent {
    pub action: String,
    pub task_id: String,
    pub task: Option<Task>,
}

// ============================================================
// CREATE TASK
// ============================================================

#[tauri::command]
pub async fn create_task(
    app: AppHandle,
    database: State<'_, Database>,
    task: CreateTask,
) -> Result<Task, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    let created_task =
        repository.create(task).await?;

    app.emit(
        "task-changed",
        TaskChangeEvent {
            action: "created".to_string(),
            task_id: created_task.id.clone(),
            task: Some(created_task.clone()),
        },
    )
    .map_err(|error| {
        format!(
            "Task created, but failed to emit task-changed event: {}",
            error
        )
    })?;

    Ok(created_task)
}

// ============================================================
// GET ALL TASKS
// ============================================================

#[tauri::command]
pub async fn get_tasks(
    database: State<'_, Database>,
) -> Result<Vec<Task>, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    repository.get_all().await
}

// ============================================================
// GET TASK BY ID
// ============================================================

#[tauri::command]
pub async fn get_task(
    database: State<'_, Database>,
    id: String,
) -> Result<Task, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    repository
        .get_by_id(&id)
        .await?
        .ok_or_else(|| "Task not found".to_string())
}

// ============================================================
// GET TASKS FOR DATE
// ============================================================

#[tauri::command]
pub async fn get_tasks_for_date(
    database: State<'_, Database>,
    date: String,
) -> Result<Vec<Task>, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    repository.get_for_date(&date).await
}

// ============================================================
// COMPLETE / UN-COMPLETE TASK
// ============================================================

#[tauri::command]
pub async fn complete_task(
    app: AppHandle,
    database: State<'_, Database>,
    id: String,
    completed: bool,
) -> Result<(), String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    repository.complete(&id, completed).await?;

    let updated_task = repository
        .get_by_id(&id)
        .await?
        .ok_or_else(|| "Task not found after completion update".to_string())?;

    let action =
        if completed {
            "completed"
        } else {
            "updated"
        };

    app.emit(
        "task-changed",
        TaskChangeEvent {
            action: action.to_string(),
            task_id: updated_task.id.clone(),
            task: Some(updated_task),
        },
    )
    .map_err(|error| {
        format!(
            "Task updated, but failed to emit task-changed event: {}",
            error
        )
    })?;

    Ok(())
}

// ============================================================
// UPDATE TASK
// ============================================================

#[tauri::command]
pub async fn update_task(
    app: AppHandle,
    database: State<'_, Database>,
    task: UpdateTask,
) -> Result<Task, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    let updated_task =
        repository.update(task).await?;

    app.emit(
        "task-changed",
        TaskChangeEvent {
            action: "updated".to_string(),
            task_id: updated_task.id.clone(),
            task: Some(updated_task.clone()),
        },
    )
    .map_err(|error| {
        format!(
            "Task updated, but failed to emit task-changed event: {}",
            error
        )
    })?;

    Ok(updated_task)
}

// ============================================================
// DELETE TASK
// ============================================================

#[tauri::command]
pub async fn delete_task(
    app: AppHandle,
    database: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    repository.delete(&id).await?;

    app.emit(
        "task-changed",
        TaskChangeEvent {
            action: "deleted".to_string(),
            task_id: id,
            task: None,
        },
    )
    .map_err(|error| {
        format!(
            "Task deleted, but failed to emit task-changed event: {}",
            error
        )
    })?;

    Ok(())
}

// ============================================================
// GET TASKS FOR MONTH
// ============================================================

#[tauri::command]
pub async fn get_tasks_for_month(
    database: State<'_, Database>,
    year: i32,
    month: u32,
) -> Result<Vec<Task>, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    repository.get_for_month(year, month).await
}

// ============================================================
// EXTEND TASK
// ============================================================

#[tauri::command]
pub async fn extend_task(
    app: AppHandle,
    database: State<'_, Database>,
    id: String,
    minutes: i64,
) -> Result<Task, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    let updated_task =
        repository.extend(&id, minutes).await?;

    app.emit(
        "task-changed",
        TaskChangeEvent {
            action: "updated".to_string(),
            task_id: updated_task.id.clone(),
            task: Some(updated_task.clone()),
        },
    )
    .map_err(|error| {
        format!(
            "Task extended, but failed to emit task-changed event: {}",
            error
        )
    })?;

    Ok(updated_task)
}

// ============================================================
// DISMISS TASK
// ============================================================

#[tauri::command]
pub async fn dismiss_task(
    app: AppHandle,
    database: State<'_, Database>,
    id: String,
) -> Result<Task, String> {
    let repository =
        TaskRepository::new(database.inner().clone());

    let updated_task =
        repository.dismiss(&id).await?;

    app.emit(
        "task-changed",
        TaskChangeEvent {
            action: "completed".to_string(),
            task_id: updated_task.id.clone(),
            task: Some(updated_task.clone()),
        },
    )
    .map_err(|error| {
        format!(
            "Task dismissed, but failed to emit task-changed event: {}",
            error
        )
    })?;

    Ok(updated_task)
}