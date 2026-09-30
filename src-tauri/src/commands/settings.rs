// ============================================================
// L&P — LUNAR & POWER
// SETTINGS COMMANDS
// ============================================================
//
// React talks to these commands through Tauri:
//
//     get_app_settings
//     update_app_setting
//
// The repository handles SQLite persistence.
// This module handles:
//     • Tauri command input
//     • validation boundary
//     • settings-changed event emission
// ============================================================

use serde_json::Value;

use tauri::{
    AppHandle,
    Emitter,
    State,
};

use crate::db::Database;
use crate::repositories::{
    AppSettings,
    SettingsRepository,
};

// ============================================================
// SETTINGS EVENT
// ============================================================
//
// This is consumed by:
//
//     src/lib/appState.tsx
//
// Event name:
//
//     settings-changed
// ============================================================

#[derive(Debug, Clone, serde::Serialize)]
pub struct SettingsChangeEvent {
    pub settings: AppSettings,
}

// ============================================================
// GET SETTINGS
// ============================================================

#[tauri::command]
pub async fn get_app_settings(
    database: State<'_, Database>,
) -> Result<AppSettings, String> {
    let repository =
        SettingsRepository::new(
            database.inner().clone(),
        );

    repository.get_all().await
}

// ============================================================
// UPDATE SETTING
// ============================================================
//
// React sends:
//
//     key:   "notifications"
//     value: true
//
// or:
//
//     key:   "theme"
//     value: "dark"
//
// We normalize both into the string format used by SQLite.
// ============================================================

#[tauri::command]
pub async fn update_app_setting(
    app: AppHandle,
    database: State<'_, Database>,
    key: String,
    value: Value,
) -> Result<AppSettings, String> {
    // --------------------------------------------------------
    // Convert incoming JSON value to database string
    // --------------------------------------------------------

    let normalized_value =
        match value {
            Value::Bool(boolean) => {
                boolean.to_string()
            }

            Value::String(string) => {
                string
            }

            Value::Number(number) => {
                number.to_string()
            }

            Value::Null => {
                return Err(
                    format!(
                        "Setting '{}' cannot be null",
                        key
                    )
                );
            }

            Value::Array(_) => {
                return Err(
                    format!(
                        "Setting '{}' must be a scalar value",
                        key
                    )
                );
            }

            Value::Object(_) => {
                return Err(
                    format!(
                        "Setting '{}' must be a scalar value",
                        key
                    )
                );
            }
        };

    // --------------------------------------------------------
    // Persist
    // --------------------------------------------------------

    let repository =
        SettingsRepository::new(
            database.inner().clone(),
        );

    let settings =
        repository
            .set(
                &key,
                &normalized_value,
            )
            .await?;

    // --------------------------------------------------------
    // Notify every frontend window
    // --------------------------------------------------------
    //
    // This is the important synchronization step.
    //
    // Settings page changes SQLite
    //         ↓
    // backend emits event
    //         ↓
    // AppStateProvider receives it
    //         ↓
    // application state updates
    // --------------------------------------------------------

    app.emit(
        "settings-changed",
        SettingsChangeEvent {
            settings: settings.clone(),
        },
    )
    .map_err(|error| {
        format!(
            "Failed to emit settings-changed event: {}",
            error
        )
    })?;

    println!(
        "[Settings] Updated '{}' -> '{}'",
        key,
        normalized_value
    );

    Ok(settings)
}