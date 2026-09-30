pub(crate) mod commands;
mod db;
mod models;
mod repositories;
mod services;

use db::Database;
use services::reminder_scheduler::ReminderScheduler;

use tauri::{
    Manager,
    WindowEvent,
};

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // ==================================================
    // SINGLE INSTANCE
    // ==================================================
    //
    // L&P must have only one running application instance.
    //
    // If the user launches L&P again while it is already
    // running, the second instance is stopped by the plugin
    // and the existing main window is brought back/focused.
    //
    // This is especially important because closing the main
    // window only hides it so the Rust scheduler can continue
    // running in the background.
    //
    // Supported by the official Tauri Single Instance plugin
    // on desktop platforms.
    //
    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_single_instance::init(
                |app, _args, _cwd| {
                    if let Some(window) =
                        app.get_webview_window("main")
                    {
                        // The main window may have been hidden
                        // when the user previously clicked X.
                        let _ = window.show();

                        // Bring it back if it was minimized.
                        let _ = window.unminimize();
                        let _ = window.maximize();
                        // Bring the existing instance to the front.
                        let _ = window.set_focus();
                    }
                },
            ),
        );
    }

    builder = builder
        // ==================================================
        // KEEP APPLICATION ALIVE WHEN MAIN WINDOW CLOSES
        // ==================================================
        //
        // Clicking X means:
        //
        //     hide main UI
        //
        // NOT:
        //
        //     terminate Rust process
        //
        // This allows the scheduler to continue running.
        //
        .on_window_event(
            |window, event| {
                if window.label() != "main" {
                    return;
                }

                if let WindowEvent::CloseRequested {
                    api,
                    ..
                } = event
                {
                    println!(
                        "[App] Main window close requested -> hiding"
                    );

                    // Prevent the actual window destruction.
                    api.prevent_close();

                    // Hide the main UI.
                    if let Err(error) =
                        window.hide()
                    {
                        eprintln!(
                            "[App] Failed to hide main window: {}",
                            error
                        );
                    }
                }
            },
        )

        // ==================================================
        // APPLICATION SETUP
        // ==================================================

        .setup(|app| {
            let app_handle =
                app.handle().clone();

            tauri::async_runtime::block_on(
                async move {
                    // --------------------------------------
                    // APPLICATION DATA DIRECTORY
                    // --------------------------------------

                    let app_data_dir =
                        app_handle
                            .path()
                            .app_data_dir()
                            .expect(
                                "Failed to get application data directory"
                            );

                    std::fs::create_dir_all(
                        &app_data_dir
                    )
                    .expect(
                        "Failed to create application data directory"
                    );

                    // --------------------------------------
                    // DATABASE
                    // --------------------------------------

                    let database_path =
                        app_data_dir.join(
                            "lighter_princess.db"
                        );

                    println!(
                        "Lighter Princess database: {}",
                        database_path.display()
                    );

                    let database_url =
                        format!(
                            "sqlite:{}",
                            database_path
                                .to_string_lossy()
                        );

                    let database =
                        Database::new(
                            &database_url
                        )
                        .await
                        .expect(
                            "Failed to connect to database"
                        );

                    // --------------------------------------
                    // MIGRATION
                    // --------------------------------------

                    database
                        .migrate()
                        .await
                        .expect(
                            "Failed to run database migrations"
                        );

                    // --------------------------------------
                    // TAURI STATE
                    // --------------------------------------

                    app_handle.manage(
                        database.clone()
                    );

                    // --------------------------------------
                    // START SCHEDULER
                    // --------------------------------------

                    let scheduler =
                        ReminderScheduler::new(
                            database,
                            app_handle.clone(),
                        );

                    scheduler.start();

                    println!(
                        "[ReminderScheduler] \
                         Background scheduler initialized"
                    );
                },
            );

            Ok(())
        })

        // ==================================================
        // COMMANDS
        // ==================================================

        .invoke_handler(
            tauri::generate_handler![
                // --------------------------------------------------
                // Tasks
                // --------------------------------------------------

                commands::create_task,
                commands::get_tasks,
                commands::get_task,
                commands::get_tasks_for_date,
                commands::complete_task,
                commands::delete_task,
                commands::update_task,
                commands::get_tasks_for_month,
                commands::extend_task,
                commands::dismiss_task,

                // --------------------------------------------------
                // Reminder
                // --------------------------------------------------

                commands::reminders::preview_task,

                // --------------------------------------------------
                // Settings
                // --------------------------------------------------

                commands::get_app_settings,
                commands::update_app_setting,
            ],
        );

    // ==================================================
    // RUN
    // ==================================================

    builder
        .run(
            tauri::generate_context!()
        )
        .expect(
            "error while running tauri application"
        );
}

