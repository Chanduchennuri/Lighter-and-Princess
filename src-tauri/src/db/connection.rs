use sqlx::{
    sqlite::{
        SqliteConnectOptions,
        SqlitePool,
    },
    Pool,
    Sqlite,
};

use std::str::FromStr;

// ============================================================
// L&P — LUNAR & POWER
// DATABASE
// ============================================================
//
// This layer is intentionally small.
//
// Responsibilities:
//   1. Open the SQLite database.
//   2. Create the database file when necessary.
//   3. Run all SQLx migrations.
//
// Repositories are responsible for actually reading/writing
// application data.
// ============================================================

#[derive(Clone)]
pub struct Database {
    pub pool: Pool<Sqlite>,
}

impl Database {

    // ========================================================
    // CONNECT
    // ========================================================

    pub async fn new(
        database_url: &str,
    ) -> Result<Self, sqlx::Error> {

        let options =
            SqliteConnectOptions::from_str(
                database_url,
            )?
            .create_if_missing(true);

        let pool =
            SqlitePool::connect_with(
                options,
            )
            .await?;

        Ok(Self {
            pool,
        })
    }

    // ========================================================
    // MIGRATIONS
    // ========================================================
    //
    // SQLx embeds the migration files at compile time.
    //
    // Every migration inside:
    //
    //     src-tauri/migrations/
    //
    // is applied automatically when the application starts.
    //
    // This is where we'll add the persistent settings table
    // in the next step.
    // ========================================================

    pub async fn migrate(
        &self,
    ) -> Result<(), sqlx::Error> {

        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await?;

        Ok(())
    }
}