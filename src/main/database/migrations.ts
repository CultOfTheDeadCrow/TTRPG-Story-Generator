import Database from 'better-sqlite3'

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      // D-01: Single entities table with type column discriminator
      db.exec(`
        CREATE TABLE IF NOT EXISTS entities (
          id         TEXT PRIMARY KEY NOT NULL,
          type       TEXT NOT NULL CHECK(type IN ('character', 'location', 'event')),
          name       TEXT NOT NULL,
          status     TEXT NOT NULL DEFAULT 'unknown',
          tags       TEXT NOT NULL DEFAULT '[]',
          description TEXT NOT NULL DEFAULT '',
          notes      TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
        CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      `)

      // D-03: entity_history with per-field rows
      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_history (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_id  TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
          field      TEXT NOT NULL,
          old_value  TEXT,
          new_value  TEXT,
          reason     TEXT,
          source     TEXT NOT NULL CHECK(source IN ('manual_edit', 'story_generation', 'session_import')),
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_history_entity ON entity_history(entity_id, created_at DESC);
      `)

      // Sessions table for session protocol import records
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id         TEXT PRIMARY KEY NOT NULL,
          title      TEXT NOT NULL DEFAULT '',
          date       INTEGER NOT NULL DEFAULT (unixepoch()),
          raw_notes  TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS stories (
          id                  TEXT PRIMARY KEY NOT NULL,
          prompt              TEXT NOT NULL DEFAULT '',
          story_text          TEXT NOT NULL DEFAULT '',
          context_entity_ids  TEXT NOT NULL DEFAULT '[]',
          proposed_updates    TEXT NOT NULL DEFAULT '[]',
          status              TEXT NOT NULL DEFAULT 'draft'
                              CHECK(status IN ('draft', 'applied')),
          created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          applied_at          INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status, created_at DESC);
      `)
    }
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`ALTER TABLE sessions ADD COLUMN applied_entity_ids TEXT NOT NULL DEFAULT '[]'`)
    }
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pending_sessions (
          id             TEXT PRIMARY KEY NOT NULL,
          title          TEXT NOT NULL DEFAULT '',
          raw_notes      TEXT NOT NULL DEFAULT '',
          analysis_text  TEXT NOT NULL DEFAULT '',
          entity_updates TEXT NOT NULL DEFAULT '[]',
          new_entities   TEXT NOT NULL DEFAULT '[]',
          created_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_pending_sessions_created
          ON pending_sessions(created_at DESC);
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  const pending = migrations.filter(m => m.version > currentVersion)

  if (pending.length === 0) {
    console.log('[db] No pending migrations (version:', currentVersion, ')')
    return
  }

  for (const migration of pending) {
    console.log('[db] Running migration', migration.version)
    db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })()
  }

  console.log('[db] Migrations complete, now at version', migrations[migrations.length - 1].version)
}
