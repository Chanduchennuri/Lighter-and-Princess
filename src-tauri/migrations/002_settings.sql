-- ============================================================
-- L&P — LUNAR & POWER
-- Application Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,

    value TEXT NOT NULL,

    updated_at TEXT NOT NULL
);

-- ============================================================
-- DEFAULT SETTINGS
-- ============================================================

INSERT OR IGNORE INTO settings (
    key,
    value,
    updated_at
)
VALUES
(
    'notifications',
    'true',
    datetime('now')
),
(
    'sound',
    'true',
    datetime('now')
),
(
    'animationEnabled',
    'true',
    datetime('now')
),
(
    'launchAtStartup',
    'false',
    datetime('now')
),
(
    'theme',
    'system',
    datetime('now')
);