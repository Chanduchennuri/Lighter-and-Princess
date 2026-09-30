CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,

    title TEXT NOT NULL,

    description TEXT,

    due_date TEXT NOT NULL,

    due_time TEXT NOT NULL,

    priority TEXT NOT NULL DEFAULT 'medium',

    repeat TEXT NOT NULL DEFAULT 'none',

    sound_enabled INTEGER NOT NULL DEFAULT 1,

    animation_id TEXT NOT NULL DEFAULT 'pig_runner',

    completed INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL,

    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_completed
ON tasks(completed);

CREATE INDEX IF NOT EXISTS idx_tasks_due_datetime
ON tasks(due_date, due_time);