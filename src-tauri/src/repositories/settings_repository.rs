use chrono::Utc;
use sqlx::FromRow;

use crate::db::Database;

// ============================================================
// L&P — LUNAR & POWER
// SETTINGS REPOSITORY
// ============================================================
//
// Responsibilities:
//
//   • Read application settings from SQLite.
//   • Update individual settings.
//   • Return a complete settings object.
//   • Keep persistence separate from Tauri commands.
//
// The database stores settings as:
//
//     key | value | updated_at
//
// Values are stored as strings because settings contain both
// booleans and a string-based theme value.
// ============================================================

#[derive(Debug, Clone, FromRow)]
struct SettingRow {
    key: String,
    value: String,
    updated_at: String,
}

// ============================================================
// APPLICATION SETTINGS
// ============================================================
//
// This is the backend representation returned to React.
//
// serde rename keeps the JSON contract aligned with:
//
// src/lib/types.ts
//
// notifications
// sound
// animationEnabled
// launchAtStartup
// theme
// ============================================================

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub notifications: bool,
    pub sound: bool,
    pub animation_enabled: bool,
    pub launch_at_startup: bool,
    pub theme: String,
}

// ============================================================
// DEFAULTS
// ============================================================

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            notifications: true,
            sound: true,
            animation_enabled: true,
            launch_at_startup: false,
            theme: "system".to_string(),
        }
    }
}

// ============================================================
// REPOSITORY
// ============================================================

#[derive(Clone)]
pub struct SettingsRepository {
    database: Database,
}

impl SettingsRepository {
    pub fn new(
        database: Database,
    ) -> Self {
        Self {
            database,
        }
    }

    // ========================================================
    // GET ALL SETTINGS
    // ========================================================

    pub async fn get_all(
        &self,
    ) -> Result<AppSettings, String> {
        let rows =
            sqlx::query_as::<_, SettingRow>(
                r#"
                SELECT
                    key,
                    value,
                    updated_at
                FROM settings
                ORDER BY key ASC
                "#,
            )
            .fetch_all(
                &self.database.pool,
            )
            .await
            .map_err(|error| {
                error.to_string()
            })?;

        let mut settings =
            AppSettings::default();

        for row in rows {
            match row.key.as_str() {
                // ----------------------------------------
                // NOTIFICATIONS
                // ----------------------------------------

                "notifications" => {
                    settings.notifications =
                        parse_bool(
                            &row.value,
                        );
                }

                // ----------------------------------------
                // SOUND
                // ----------------------------------------

                "sound" => {
                    settings.sound =
                        parse_bool(
                            &row.value,
                        );
                }

                // ----------------------------------------
                // ANIMATION
                // ----------------------------------------

                "animationEnabled" => {
                    settings.animation_enabled =
                        parse_bool(
                            &row.value,
                        );
                }

                // ----------------------------------------
                // STARTUP
                // ----------------------------------------

                "launchAtStartup" => {
                    settings.launch_at_startup =
                        parse_bool(
                            &row.value,
                        );
                }

                // ----------------------------------------
                // THEME
                // ----------------------------------------

                "theme" => {
                    if matches!(
                        row.value.as_str(),
                        "system"
                            | "light"
                            | "dark"
                    ) {
                        settings.theme =
                            row.value;
                    } else {
                        eprintln!(
                            "[Settings] \
                             Unknown theme '{}', \
                             using system",
                            row.value
                        );
                    }
                }

                // ----------------------------------------
                // UNKNOWN SETTING
                // ----------------------------------------

                unknown => {
                    eprintln!(
                        "[Settings] \
                         Ignoring unknown setting '{}'",
                        unknown
                    );
                }
            }

            // `updated_at` is intentionally not exposed
            // to the frontend settings object.
            let _ =
                row.updated_at;
        }

        Ok(settings)
    }

    // ========================================================
    // GET ONE SETTING
    // ========================================================

    pub async fn get(
        &self,
        key: &str,
    ) -> Result<Option<String>, String> {
        let value =
            sqlx::query_scalar::<
                _,
                String,
            >(
                r#"
                SELECT value
                FROM settings
                WHERE key = ?
                "#,
            )
            .bind(key)
            .fetch_optional(
                &self.database.pool,
            )
            .await
            .map_err(|error| {
                error.to_string()
            })?;

        Ok(value)
    }

    // ========================================================
    // UPDATE ONE SETTING
    // ========================================================

    pub async fn set(
        &self,
        key: &str,
        value: &str,
    ) -> Result<AppSettings, String> {
        validate_setting(
            key,
            value,
        )?;

        let now =
            Utc::now()
                .to_rfc3339();

        let result =
            sqlx::query(
                r#"
                UPDATE settings
                SET
                    value = ?,
                    updated_at = ?
                WHERE key = ?
                "#,
            )
            .bind(value)
            .bind(&now)
            .bind(key)
            .execute(
                &self.database.pool,
            )
            .await
            .map_err(|error| {
                error.to_string()
            })?;

        if result.rows_affected() == 0 {
            return Err(
                format!(
                    "Unknown setting: {}",
                    key
                )
            );
        }

        self.get_all().await
    }
}

// ============================================================
// BOOLEAN PARSER
// ============================================================

fn parse_bool(
    value: &str,
) -> bool {
    match value {
        "true" | "1" | "TRUE" | "True" => true,

        "false" | "0" | "FALSE" | "False" => false,

        unknown => {
            eprintln!(
                "[Settings] \
                 Invalid boolean value '{}'; \
                 using false",
                unknown
            );

            false
        }
    }
}

// ============================================================
// VALIDATION
// ============================================================
//
// The frontend should never be able to accidentally store an
// arbitrary value under a known setting.
//
// This also gives us one place to expand settings safely later.
// ============================================================

fn validate_setting(
    key: &str,
    value: &str,
) -> Result<(), String> {
    match key {
        // ----------------------------------------------------
        // BOOLEAN SETTINGS
        // ----------------------------------------------------

        "notifications"
        | "sound"
        | "animationEnabled"
        | "launchAtStartup" => {
            match value {
                "true"
                | "false"
                | "1"
                | "0" => Ok(()),

                _ => Err(
                    format!(
                        "Invalid boolean value '{}' for setting '{}'",
                        value,
                        key
                    )
                ),
            }
        }

        // ----------------------------------------------------
        // THEME
        // ----------------------------------------------------

        "theme" => {
            match value {
                "system"
                | "light"
                | "dark" => Ok(()),

                _ => Err(
                    format!(
                        "Invalid theme '{}'",
                        value
                    )
                ),
            }
        }

        // ----------------------------------------------------
        // UNKNOWN SETTING
        // ----------------------------------------------------

        _ => Err(
            format!(
                "Unknown application setting '{}'",
                key
            )
        ),
    }
}