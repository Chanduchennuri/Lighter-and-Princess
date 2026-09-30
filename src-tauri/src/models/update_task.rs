use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct UpdateTask {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: String,
    pub due_time: String,
    pub priority: String,
    pub repeat: String,
    pub sound_enabled: bool,
    pub animation_id: String,
}