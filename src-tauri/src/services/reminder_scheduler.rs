use std::collections::{
    HashMap,
    HashSet,
};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::{
    Datelike,
    Local,
    NaiveDate,
    NaiveTime,
    Weekday,
};

use tauri::{
    AppHandle,
    Manager,
};
use tokio::sync::Mutex;
use tokio::time::sleep;

use crate::db::Database;
use crate::repositories::TaskRepository;

pub struct ReminderScheduler {
    database: Database,
    app: AppHandle,

    // --------------------------------------------------
    // task_id -> last triggered occurrence
    //
    // Example:
    //
    // "abc123" -> "2026-09-28 23:05"
    //
    // This prevents the same occurrence from firing
    // every second.
    // --------------------------------------------------
    triggered_tasks:
        Arc<Mutex<HashMap<String, String>>>,

    // --------------------------------------------------
    // Persistent reminder state file
    // --------------------------------------------------
    state_path: PathBuf,
}

impl ReminderScheduler {
    pub fn new(
        database: Database,
        app: AppHandle,
    ) -> Self {
        // --------------------------------------------------
        // Determine persistent state location
        // --------------------------------------------------

        let state_path = match app
            .path()
            .app_data_dir()
        {
            Ok(mut directory) => {
                directory.push(
                    "reminder_scheduler_state.txt",
                );

                directory
            }

            Err(error) => {
                eprintln!(
                    "[ReminderScheduler] \
                     Failed to determine app data directory: {}",
                    error
                );

                // Fallback.
                PathBuf::from(
                    "reminder_scheduler_state.txt",
                )
            }
        };

        // --------------------------------------------------
        // Load previously triggered reminders
        // --------------------------------------------------

        let persisted_state =
            Self::load_state(
                &state_path,
            );

        println!(
            "[ReminderScheduler] Loaded {} persisted reminder states",
            persisted_state.len()
        );

        Self {
            database,
            app,
            triggered_tasks: Arc::new(
                Mutex::new(
                    persisted_state,
                ),
            ),
            state_path,
        }
    }

    // ==================================================
    // START
    // ==================================================

    pub fn start(self) {
        tokio::spawn(async move {
            self.run().await;
        });
    }

    // ==================================================
    // MAIN LOOP
    // ==================================================

    async fn run(self) {
        println!(
            "[ReminderScheduler] Started"
        );

        loop {
            if let Err(error) =
                self.check_due_tasks().await
            {
                eprintln!(
                    "[ReminderScheduler] Error: {}",
                    error
                );
            }

            // Check every second.
            sleep(
                Duration::from_secs(1)
            )
            .await;
        }
    }

    // ==================================================
    // CHECK ALL TASKS
    // ==================================================

    async fn check_due_tasks(
        &self,
    ) -> Result<(), String> {
        let repository =
            TaskRepository::new(
                self.database.clone(),
            );

        let tasks =
            repository.get_all().await?;

        let now =
            Local::now();

        let today =
            now.date_naive();

        let current_time =
            now.time();

        // Used to remove state belonging to deleted tasks.
        let mut existing_task_ids =
            HashSet::new();

        let mut state_changed =
            false;

        // ==================================================
        // CHECK EVERY TASK
        // ==================================================

        for task in tasks {
            existing_task_ids.insert(
                task.id.clone(),
            );

            // ==============================================
            // COMPLETED TASK
            // ==============================================

            if task.completed {
                continue;
            }

            // ==============================================
            // PARSE ORIGINAL DUE DATE
            // ==============================================

            let due_date =
                match NaiveDate::parse_from_str(
                    &task.due_date,
                    "%Y-%m-%d",
                ) {
                    Ok(date) => date,

                    Err(error) => {
                        eprintln!(
                            "[ReminderScheduler] \
                             Invalid date for {}: {}",
                            task.id,
                            error
                        );

                        continue;
                    }
                };

            // ==============================================
            // PARSE DUE TIME
            // ==============================================

            let due_time =
                match NaiveTime::parse_from_str(
                    &task.due_time,
                    "%H:%M",
                ) {
                    Ok(time) => time,

                    Err(error) => {
                        eprintln!(
                            "[ReminderScheduler] \
                             Invalid time for {}: {}",
                            task.id,
                            error
                        );

                        continue;
                    }
                };

            // ==============================================
            // DETERMINE TODAY'S OCCURRENCE
            // ==============================================

            let occurrence_date =
                match Self::get_occurrence_date(
                    &task.repeat,
                    due_date,
                    today,
                ) {
                    Some(date) => date,
                    None => continue,
                };

            // The actual reminder time is still the
            // configured task time.
            if due_time > current_time {
                continue;
            }

            // ==============================================
            // IDENTIFY OCCURRENCE
            // ==============================================

            let trigger_key =
                format!(
                    "{} {}",
                    occurrence_date,
                    task.due_time
                );

            // ==============================================
            // DUPLICATE PROTECTION
            // ==============================================

            {
                let triggered =
                    self.triggered_tasks
                        .lock()
                        .await;

                if let Some(
                    previous_key,
                ) =
                    triggered.get(&task.id)
                {
                    if previous_key
                        == &trigger_key
                    {
                        continue;
                    }
                }
            }

            // ==============================================
            // TASK IS DUE
            // ==============================================

            println!(
                "[ReminderScheduler] \
                 Task due: {} ({})",
                task.title,
                task.id
            );

            println!(
                "[ReminderScheduler] \
                 Occurrence: {}",
                trigger_key
            );

            // ==============================================
            // SHOW REMINDER
            // ==============================================

            match self
                .handle_due_task(
                    &task.id,
                )
                .await
            {
                Ok(()) => {
                    // --------------------------------------
                    // Mark occurrence as triggered
                    // --------------------------------------

                    {
                        let mut triggered =
                            self.triggered_tasks
                                .lock()
                                .await;

                        triggered.insert(
                            task.id.clone(),
                            trigger_key,
                        );
                    }

                    state_changed = true;

                    println!(
                        "[ReminderScheduler] \
                         Reminder triggered: {}",
                        task.id
                    );
                }

                Err(error) => {
                    // --------------------------------------
                    // Do NOT mark it as triggered.
                    //
                    // Next tick will retry.
                    // --------------------------------------

                    eprintln!(
                        "[ReminderScheduler] \
                         Failed to trigger {}: {}",
                        task.id,
                        error
                    );
                }
            }
        }

        // ==================================================
        // REMOVE STATE FOR DELETED TASKS
        // ==================================================

        {
            let mut triggered =
                self.triggered_tasks
                    .lock()
                    .await;

            let before =
                triggered.len();

            triggered.retain(
                |task_id, _| {
                    existing_task_ids
                        .contains(task_id)
                },
            );

            if triggered.len()
                != before
            {
                state_changed = true;

                println!(
                    "[ReminderScheduler] \
                     Removed stale reminder states"
                );
            }
        }

        // ==================================================
        // SAVE STATE
        // ==================================================

        if state_changed {
            self.persist_state().await;
        }

        Ok(())
    }

    // ==================================================
    // DETERMINE WHETHER TASK HAS AN OCCURRENCE TODAY
    // ==================================================

    fn get_occurrence_date(
        repeat: &str,
        due_date: NaiveDate,
        today: NaiveDate,
    ) -> Option<NaiveDate> {
        // --------------------------------------------------
        // NONE
        // --------------------------------------------------

        match repeat {
            "none" | "" => {
                if due_date == today {
                    Some(today)
                } else {
                    None
                }
            }

            // --------------------------------------------------
            // DAILY
            // --------------------------------------------------

            "daily" => {
                if today >= due_date {
                    Some(today)
                } else {
                    None
                }
            }

            // --------------------------------------------------
            // WEEKDAYS
            // --------------------------------------------------

            "weekdays" => {
                if today < due_date {
                    return None;
                }

                match today.weekday() {
                    Weekday::Sat |
                    Weekday::Sun => None,

                    _ => Some(today),
                }
            }

            // --------------------------------------------------
            // WEEKLY
            // --------------------------------------------------

            "weekly" => {
                if today < due_date {
                    return None;
                }

                let days_since =
                    today
                        .signed_duration_since(
                            due_date,
                        )
                        .num_days();

                if days_since % 7 == 0 {
                    Some(today)
                } else {
                    None
                }
            }

            // --------------------------------------------------
            // UNKNOWN VALUE
            // --------------------------------------------------

            other => {
                eprintln!(
                    "[ReminderScheduler] \
                     Unknown repeat rule '{}' \
                     for task date {}",
                    other,
                    due_date
                );

                None
            }
        }
    }

    // ==================================================
    // ACTUALLY SHOW REMINDER
    // ==================================================

    async fn handle_due_task(
        &self,
        task_id: &str,
    ) -> Result<(), String> {
        println!(
            "[ReminderScheduler] \
             Opening reminder for: {}",
            task_id
        );

        // Use the exact same reminder manager
        // used by the manual Preview button.

        crate::commands::reminders::show_task_reminder(
            self.app.clone(),
            self.database.clone(),
            task_id.to_string(),
        )
        .await?;

        Ok(())
    }

    // ==================================================
    // LOAD PERSISTENT STATE
    // ==================================================

    fn load_state(
        path: &PathBuf,
    ) -> HashMap<String, String> {
        let mut state =
            HashMap::new();

        let contents =
            match std::fs::read_to_string(
                path,
            ) {
                Ok(contents) => contents,

                Err(_) => {
                    // File doesn't exist yet.
                    return state;
                }
            };

        for line in contents.lines() {
            // Format:
            //
            // task_id<TAB>occurrence
            //
            if let Some(
                (task_id, occurrence),
            ) = line.split_once('\t')
            {
                if !task_id.is_empty()
                    && !occurrence.is_empty()
                {
                    state.insert(
                        task_id.to_string(),
                        occurrence.to_string(),
                    );
                }
            }
        }

        state
    }

    // ==================================================
    // SAVE PERSISTENT STATE
    // ==================================================

    async fn persist_state(
        &self,
    ) {
        let state = {
            let triggered =
                self.triggered_tasks
                    .lock()
                    .await;

            triggered.clone()
        };

        // --------------------------------------------------
        // Ensure parent directory exists
        // --------------------------------------------------

        if let Some(parent) =
            self.state_path.parent()
        {
            if let Err(error) =
                std::fs::create_dir_all(
                    parent,
                )
            {
                eprintln!(
                    "[ReminderScheduler] \
                     Failed to create state directory: {}",
                    error
                );

                return;
            }
        }

        // --------------------------------------------------
        // Build file content
        // --------------------------------------------------

        let mut contents =
            String::new();

        for (
            task_id,
            occurrence,
        ) in state
        {
            contents.push_str(
                &task_id,
            );

            contents.push('\t');

            contents.push_str(
                &occurrence,
            );

            contents.push('\n');
        }

        // --------------------------------------------------
        // Write state
        // --------------------------------------------------

        if let Err(error) =
            std::fs::write(
                &self.state_path,
                contents,
            )
        {
            eprintln!(
                "[ReminderScheduler] \
                 Failed to persist reminder state: {}",
                error
            );
        } else {
            println!(
                "[ReminderScheduler] \
                 Reminder state persisted"
            );
        }
    }
}