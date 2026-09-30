use crate::db::Database;
use crate::models::Task;
use crate::repositories::TaskRepository;

use std::sync::{
    atomic::{
        AtomicBool,
        Ordering,
    },
    Arc,
};

use tauri::{
    AppHandle,
    Emitter,
    Manager,
    State,
    WebviewUrl,
    WebviewWindowBuilder,
    WindowEvent,
};

use tauri::window::Color;

const ANIMAL_WIDTH: f64 = 120.0;
const ANIMAL_HEIGHT: f64 = 120.0;

const EDGE_MARGIN: f64 = 40.0;

const FOCUS_GRACE_PERIOD_MS: u128 = 1000;

// ======================================================
// INTERNAL REMINDER MANAGER
// ======================================================
//
// This contains the actual logic that opens the
// desktop animal reminder.
//
// It can be called from:
//   1. preview_task()         -> frontend Preview button
//   2. ReminderScheduler      -> automatic reminder
//
pub(crate) async fn show_task_reminder(
    app: AppHandle,
    database: Database,
    id: String,
) -> Result<Task, String> {
    // ==================================================
    // LOAD TASK
    // ==================================================

    let repository =
        TaskRepository::new(database.clone());

    let task = repository
        .get_by_id(&id)
        .await?
        .ok_or_else(|| {
            "Task not found".to_string()
        })?;

    println!(
        "[Reminder] Previewing task: {} ({})",
        task.title,
        task.id
    );

    // ==================================================
    // FIND MONITOR
    // ==================================================

    let monitor = app
        .get_webview_window("main")
        .and_then(|main| {
            main.current_monitor()
                .ok()
                .flatten()
        })
        .or_else(|| {
            app.primary_monitor()
                .ok()
                .flatten()
        })
        .ok_or_else(|| {
            "Could not determine monitor"
                .to_string()
        })?;

    let scale =
        monitor.scale_factor();

    let work_area =
        monitor.work_area();

    let area_x =
        work_area.position.x as f64
            / scale;

    let area_y =
        work_area.position.y as f64
            / scale;

    let area_width =
        work_area.size.width as f64
            / scale;

    let area_height =
        work_area.size.height as f64
            / scale;

    // ==================================================
    // BOTTOM-RIGHT START
    // ==================================================

    let start_x =
        area_x
            + area_width
            - ANIMAL_WIDTH
            - EDGE_MARGIN;

    let start_y =
        area_y
            + area_height
            - ANIMAL_HEIGHT
            - EDGE_MARGIN;

    println!(
        "[Reminder] Work area: x={} y={} width={} height={}",
        area_x,
        area_y,
        area_width,
        area_height
    );

    println!(
        "[Reminder] Animal start position: ({}, {})",
        start_x,
        start_y
    );

    // ==================================================
    // EXISTING REMINDER WINDOW
    // ==================================================

    if let Some(window) =
        app.get_webview_window("reminder")
    {
        window
            .set_size(
                tauri::Size::Logical(
                    tauri::LogicalSize::new(
                        ANIMAL_WIDTH,
                        ANIMAL_HEIGHT,
                    ),
                ),
            )
            .map_err(|e| e.to_string())?;

        window
            .set_position(
                tauri::Position::Logical(
                    tauri::LogicalPosition::new(
                        start_x,
                        start_y,
                    ),
                ),
            )
            .map_err(|e| e.to_string())?;

        window
            .emit(
                "reminder-task",
                &task,
            )
            .map_err(|e| e.to_string())?;

        window
            .show()
            .map_err(|e| e.to_string())?;

        window
            .set_focus()
            .map_err(|e| e.to_string())?;

        return Ok(task);
    }

    // ==================================================
    // CREATE INVISIBLE ANIMAL WINDOW
    // ==================================================

    let url =
        format!(
            "reminder/{}",
            task.id
        );

    let window =
        WebviewWindowBuilder::new(
            &app,
            "reminder",
            WebviewUrl::App(
                url.into(),
            ),
        )
        .title(
            "Lighter & Princess",
        )

        // ----------------------------------------------
        // ONLY THE ANIMAL WINDOW
        // ----------------------------------------------

        .position(
            start_x,
            start_y,
        )
        .inner_size(
            ANIMAL_WIDTH,
            ANIMAL_HEIGHT,
        )

        // ----------------------------------------------
        // NO NORMAL WINDOW
        // ----------------------------------------------

        .resizable(false)
        .decorations(false)
        .shadow(false)

        // ----------------------------------------------
        // TRANSPARENCY
        // ----------------------------------------------

        .transparent(true)

        // Explicit transparent RGBA background.
        .background_color(
            Color(0, 0, 0, 0),
        )

        // Prevent Windows transparent-window flash.
        .no_redirection_bitmap(true)

        // ----------------------------------------------
        // DESKTOP COMPANION
        // ----------------------------------------------

        .always_on_top(true)
        .skip_taskbar(true)

        // Animal needs mouse interaction.
        .focusable(true)
        .focused(false)

        // Special reminder window.
        .devtools(false)

        .visible(false)

        .build()
        .map_err(|e| e.to_string())?;

    // ==================================================
    // IGNORE INITIAL FOCUS TRANSITION
    // ==================================================

    let created_at =
        std::time::Instant::now();

    let reminder_window =
        window.clone();

    let has_received_focus =
        Arc::new(
            AtomicBool::new(false),
        );

    let focus_state =
        has_received_focus.clone();

    window.on_window_event(
        move |event| {
            match event {
                WindowEvent::Focused(
                    true,
                ) => {
                    focus_state.store(
                        true,
                        Ordering::SeqCst,
                    );

                    println!(
                        "[Reminder] Animal window focused"
                    );
                }

                WindowEvent::Focused(
                    false,
                ) => {
                    let elapsed =
                        created_at
                            .elapsed()
                            .as_millis();

                    // Don't interpret the first
                    // focus transition as an
                    // outside click.
                    if elapsed
                        < FOCUS_GRACE_PERIOD_MS
                    {
                        println!(
                            "[Reminder] \
                             Ignoring initial focus loss"
                        );

                        return;
                    }

                    if focus_state.load(
                        Ordering::SeqCst,
                    ) {
                        println!(
                            "[Reminder] \
                             Outside click -> closing animal"
                        );

                        let _ =
                            reminder_window
                                .close();
                    }
                }

                _ => {}
            }
        },
    );

    // ==================================================
    // SEND TASK
    // ==================================================

    window
        .emit(
            "reminder-task",
            &task,
        )
        .map_err(|e| e.to_string())?;

    // ==================================================
    // SHOW
    // ==================================================

    window
        .show()
        .map_err(|e| e.to_string())?;

    // Give WebView2 a moment to render before focusing.
    let focus_window =
        window.clone();

    tauri::async_runtime::spawn(
        async move {
            tokio::time::sleep(
                std::time::Duration::from_millis(
                    350,
                ),
            )
            .await;

            let _ =
                focus_window.set_focus();
        },
    );

    println!(
        "[Reminder] \
         Invisible animal window created"
    );

    Ok(task)
}

// ======================================================
// FRONTEND TAURI COMMAND
// ======================================================
//
// Your React frontend can continue calling:
//
// invoke("preview_task", { id: task.id })
//
#[tauri::command]
pub async fn preview_task(
    app: AppHandle,
    database: State<'_, Database>,
    id: String,
) -> Result<Task, String> {
    show_task_reminder(
        app,
        database.inner().clone(),
        id,
    )
    .await
}