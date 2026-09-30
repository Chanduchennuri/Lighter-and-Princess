use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTask {
    pub title: String,

    pub description: Option<String>,

    pub due_date: String,

    pub due_time: String,

    pub priority: String,

    pub repeat: String,

    pub sound_enabled: bool,

    pub animation_id: String,
}