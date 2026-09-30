use crate::db::Database;
use crate::models::{CreateTask, Task, UpdateTask};

use chrono::Utc;
use uuid::Uuid;
use chrono::{
    Duration,
    NaiveDate,
    NaiveTime,
};
#[derive(Clone)]
pub struct TaskRepository {
    database: Database,
}

impl TaskRepository {
    pub fn new(database: Database) -> Self {
        Self { database }
    }

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    pub async fn create(
        &self,
        input: CreateTask,
    ) -> Result<Task, String> {
        let id = Uuid::new_v4().to_string();

        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO tasks (
                id,
                title,
                description,
                due_date,
                due_time,
                priority,
                repeat,
                sound_enabled,
                animation_id,
                completed,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.due_date)
        .bind(&input.due_time)
        .bind(&input.priority)
        .bind(&input.repeat)
        .bind(input.sound_enabled)
        .bind(&input.animation_id)
        .bind(false)
        .bind(&now)
        .bind(&now)
        .execute(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        self.get_by_id(&id)
            .await?
            .ok_or_else(|| {
                "Task was created but could not be retrieved".to_string()
            })
    }

    // --------------------------------------------------
    // GET ALL
    // --------------------------------------------------

    pub async fn get_all(&self) -> Result<Vec<Task>, String> {
        let tasks = sqlx::query_as::<_, Task>(
            r#"
            SELECT
                id,
                title,
                description,
                due_date,
                due_time,
                priority,
                repeat,
                sound_enabled,
                animation_id,
                completed,
                created_at,
                updated_at
            FROM tasks
            ORDER BY due_date ASC, due_time ASC
            "#,
        )
        .fetch_all(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(tasks)
    }

    // --------------------------------------------------
    // GET BY ID
    // --------------------------------------------------

    pub async fn get_by_id(
        &self,
        id: &str,
    ) -> Result<Option<Task>, String> {
        let task = sqlx::query_as::<_, Task>(
            r#"
            SELECT
                id,
                title,
                description,
                due_date,
                due_time,
                priority,
                repeat,
                sound_enabled,
                animation_id,
                completed,
                created_at,
                updated_at
            FROM tasks
            WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(task)
    }

    // --------------------------------------------------
    // GET TASKS FOR DATE
    // --------------------------------------------------

    pub async fn get_for_date(
        &self,
        date: &str,
    ) -> Result<Vec<Task>, String> {
        let tasks = sqlx::query_as::<_, Task>(
            r#"
            SELECT
                id,
                title,
                description,
                due_date,
                due_time,
                priority,
                repeat,
                sound_enabled,
                animation_id,
                completed,
                created_at,
                updated_at
            FROM tasks
            WHERE due_date = ?
            ORDER BY due_time ASC
            "#,
        )
        .bind(date)
        .fetch_all(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(tasks)
    }

    // --------------------------------------------------
    // COMPLETE
    // --------------------------------------------------

    pub async fn complete(
        &self,
        id: &str,
        completed: bool,
    ) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            r#"
            UPDATE tasks
            SET
                completed = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(completed)
        .bind(&now)
        .bind(id)
        .execute(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        if result.rows_affected() == 0 {
            return Err("Task not found".to_string());
        }

        Ok(())
    }

    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    pub async fn update(
        &self,
        input: UpdateTask,
    ) -> Result<Task, String> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            r#"
            UPDATE tasks
            SET
                title = ?,
                description = ?,
                due_date = ?,
                due_time = ?,
                priority = ?,
                repeat = ?,
                sound_enabled = ?,
                animation_id = ?,
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.due_date)
        .bind(&input.due_time)
        .bind(&input.priority)
        .bind(&input.repeat)
        .bind(input.sound_enabled)
        .bind(&input.animation_id)
        .bind(&now)
        .bind(&input.id)
        .execute(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        if result.rows_affected() == 0 {
            return Err("Task not found".to_string());
        }

        self.get_by_id(&input.id)
            .await?
            .ok_or_else(|| {
                "Task was updated but could not be retrieved".to_string()
            })
    }
    
    // --------------------------------------------------
// GET TASKS FOR MONTH
// --------------------------------------------------

pub async fn get_for_month(
    &self,
    year: i32,
    month: u32,
) -> Result<Vec<Task>, String> {
    let start_date = format!("{:04}-{:02}-01", year, month);

    let next_month = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    let tasks = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id,
            title,
            description,
            due_date,
            due_time,
            priority,
            repeat,
            sound_enabled,
            animation_id,
            completed,
            created_at,
            updated_at
        FROM tasks
        WHERE due_date >= ?
          AND due_date < ?
        ORDER BY due_date ASC, due_time ASC
        "#,
    )
    .bind(&start_date)
    .bind(&next_month)
    .fetch_all(&self.database.pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(tasks)
}
    // --------------------------------------------------
    // DELETE
    // --------------------------------------------------
    pub async fn extend(
    &self,
    id: &str,
    minutes: i64,
) -> Result<Task, String> {
    if minutes <= 0 {
        return Err(
            "Extension must be greater than zero".to_string()
        );
    }

    let task = self
        .get_by_id(id)
        .await?
        .ok_or_else(|| "Task not found".to_string())?;

    let date = NaiveDate::parse_from_str(
        &task.due_date,
        "%Y-%m-%d",
    )
    .map_err(|_| "Invalid task date".to_string())?;

    let time = NaiveTime::parse_from_str(
        &task.due_time,
        "%H:%M",
    )
    .map_err(|_| "Invalid task time".to_string())?;

    let datetime = date.and_time(time);

    let new_datetime =
        datetime + Duration::minutes(minutes);

    let new_date =
        new_datetime
            .date()
            .format("%Y-%m-%d")
            .to_string();

    let new_time =
        new_datetime
            .time()
            .format("%H:%M")
            .to_string();

    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        UPDATE tasks
        SET
            due_date = ?,
            due_time = ?,
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&new_date)
    .bind(&new_time)
    .bind(&now)
    .bind(id)
    .execute(&self.database.pool)
    .await
    .map_err(|error| error.to_string())?;

    self.get_by_id(id)
        .await?
        .ok_or_else(|| {
            "Task was extended but could not be retrieved"
                .to_string()
        })
}
    pub async fn dismiss(
    &self,
    id: &str,
) -> Result<Task, String> {
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        UPDATE tasks
        SET
            completed = true,
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&now)
    .bind(id)
    .execute(&self.database.pool)
    .await
    .map_err(|error| error.to_string())?;

    self.get_by_id(id)
        .await?
        .ok_or_else(|| "Task not found".to_string())
}
    pub async fn delete(
        &self,
        id: &str,
    ) -> Result<(), String> {
        let result = sqlx::query(
            r#"
            DELETE FROM tasks
            WHERE id = ?
            "#,
        )
        .bind(id)
        .execute(&self.database.pool)
        .await
        .map_err(|error| error.to_string())?;

        if result.rows_affected() == 0 {
            return Err("Task not found".to_string());
        }

        Ok(())
    }
}