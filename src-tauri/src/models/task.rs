use serde::{Deserialize, Serialize};

#[derive(
    Debug,
    Clone,
    Serialize,
    Deserialize,
    sqlx::FromRow,
)]
pub struct Task {
    pub id: String,

    pub title: String,

    pub description: Option<String>,

    pub due_date: String,

    pub due_time: String,

    pub priority: String,

    pub repeat: String,

    pub sound_enabled: bool,

    pub animation_id: String,

    pub completed: bool,

    pub created_at: String,

    pub updated_at: String,
}