import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { nthProjectColor } from "./palette";

/** OS_DB_PATH lets a throwaway instance (tests, experiments) use its own database file. */
const dbPath = process.env.OS_DB_PATH
  ? path.resolve(process.env.OS_DB_PATH)
  : path.join(process.cwd(), "data", "os.db");
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as { __osDb?: Database.Database };

function init(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      name       TEXT,
      image      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tab         TEXT NOT NULL,            -- 'todo' | 'projects'
      kind        TEXT NOT NULL,            -- 'daily' | 'general' | 'project'
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      x           REAL NOT NULL DEFAULT 40,
      y           REAL NOT NULL DEFAULT 40,
      w           REAL NOT NULL DEFAULT 300,
      h           REAL NOT NULL DEFAULT 320,
      z           INTEGER NOT NULL DEFAULT 1,
      minimized   INTEGER NOT NULL DEFAULT 0,
      progress    INTEGER NOT NULL DEFAULT 0,
      last_reset  TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS blocks_user_tab ON blocks(user_id, tab);

    CREATE TABLE IF NOT EXISTS items (
      id         TEXT PRIMARY KEY,
      block_id   TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      position   REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS items_block ON items(block_id);

    /* Append-only history. Rows outlive the items they describe, so a todo that was
       finished and cleared still shows up on its day. */
    CREATE TABLE IF NOT EXISTS item_events (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      item_id    TEXT NOT NULL,
      block_id   TEXT NOT NULL DEFAULT '',
      block_kind TEXT NOT NULL DEFAULT '',
      block_title TEXT NOT NULL DEFAULT '',
      project_id TEXT NOT NULL DEFAULT '',
      color      TEXT NOT NULL DEFAULT '',
      kind       TEXT NOT NULL,   -- created | completed | uncompleted | deleted | expired
      text       TEXT NOT NULL DEFAULT '',
      day        TEXT NOT NULL,   -- local YYYY-MM-DD, the day this is attributed to
      at         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS events_user_day ON item_events(user_id, day);
    CREATE INDEX IF NOT EXISTS events_item ON item_events(item_id);

    /* What gets asked in the daily check-in. Built-ins carry a key; the rest are yours. */
    CREATE TABLE IF NOT EXISTS metrics (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key        TEXT NOT NULL DEFAULT '',   -- grade | deep_work | all_done, '' when custom
      name       TEXT NOT NULL,
      type       TEXT NOT NULL,              -- scale | number | boolean | duration | note
      unit       TEXT NOT NULL DEFAULT '',
      min        REAL NOT NULL DEFAULT 1,
      max        REAL NOT NULL DEFAULT 5,
      color      TEXT NOT NULL DEFAULT '',
      position   REAL NOT NULL DEFAULT 0,
      weight     REAL NOT NULL DEFAULT 0,   -- relative pull on the day's score, 0 = not scored
      target     REAL NOT NULL DEFAULT 0,   -- what counts as "full marks" for number metrics
      archived   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS metrics_user ON metrics(user_id, position);

    /* One value per metric per day. */
    CREATE TABLE IF NOT EXISTS metric_values (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL,
      metric_id TEXT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
      day       TEXT NOT NULL,
      num       REAL,
      text      TEXT NOT NULL DEFAULT '',
      at        TEXT NOT NULL,
      UNIQUE(metric_id, day)
    );

    CREATE INDEX IF NOT EXISTS values_user_day ON metric_values(user_id, day);

    /* Focus sessions: timed, or typed in afterwards. A row with no ended_at is running. */
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL DEFAULT '',
      day        TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at   TEXT NOT NULL DEFAULT '',
      minutes    REAL NOT NULL DEFAULT 0,
      note       TEXT NOT NULL DEFAULT '',
      manual     INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS focus_user_day ON focus_sessions(user_id, day);

    /* Closed-out task counts for a day, written when the Today boxes roll over. */
    CREATE TABLE IF NOT EXISTS day_stats (
      user_id TEXT NOT NULL,
      day     TEXT NOT NULL,
      planned INTEGER NOT NULL DEFAULT 0,
      done    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    );
  `);

  migrate(db);
  return db;
}

/**
 * Adds a column unless it is already there. Several processes can open the database at once
 * (the dev server, a build, the background server), so this tolerates losing the race
 * rather than checking first and blowing up.
 */
function addColumn(db: Database.Database, table: string, column: string, ddl: string): boolean {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    return true;
  } catch (err) {
    if (String(err).includes("duplicate column name")) return false;
    throw err;
  }
}

/** Adds columns introduced after the first release, if they are not there yet. */
function migrate(db: Database.Database) {
  addColumn(db, "blocks", "content", "TEXT NOT NULL DEFAULT ''");
  addColumn(db, "blocks", "progress_mode", "TEXT NOT NULL DEFAULT 'manual'");
  addColumn(db, "blocks", "color", "TEXT NOT NULL DEFAULT ''");
  backfillProjectColors(db);
  // "Daily" boxes are called "Today" now.
  db.exec("UPDATE blocks SET title = 'Today' WHERE kind = 'daily' AND title = 'Daily'");

  addColumn(db, "metrics", "target", "REAL NOT NULL DEFAULT 0");
  if (addColumn(db, "metrics", "weight", "REAL NOT NULL DEFAULT 0")) {
    // Keep the scores that already exist: the old fixed weights become the starting ones.
    db.exec("UPDATE metrics SET weight = 45 WHERE key = 'grade'");
    db.exec("UPDATE metrics SET weight = 20 WHERE key = 'deep_work'");
    db.exec("UPDATE metrics SET weight = 15 WHERE key = 'all_done'");
  }

  addColumn(db, "items", "recurring", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "items", "milestone", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "items", "completed_at", "TEXT NOT NULL DEFAULT ''");
  // Optional deadline, local YYYY-MM-DD.
  addColumn(db, "items", "due_at", "TEXT NOT NULL DEFAULT ''");
  // A todo-box copy of a project todo points back at the original through link_id.
  addColumn(db, "items", "link_id", "TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE INDEX IF NOT EXISTS items_due ON items(due_at)");
  db.exec("CREATE INDEX IF NOT EXISTS items_link ON items(link_id)");
}

/** Projects created before colours existed get one, in the order they were made. */
function backfillProjectColors(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT id, user_id FROM blocks WHERE kind = 'project' AND color = ''
       ORDER BY user_id, created_at ASC`
    )
    .all() as { id: string; user_id: string }[];
  if (rows.length === 0) return;

  const setColor = db.prepare("UPDATE blocks SET color = ? WHERE id = ?");
  const seen = new Map<string, number>();
  const tx = db.transaction(() => {
    for (const row of rows) {
      const n = seen.get(row.user_id) ?? 0;
      setColor.run(nthProjectColor(n), row.id);
      seen.set(row.user_id, n + 1);
    }
  });
  tx();
}

export const db = globalForDb.__osDb ?? init();
if (process.env.NODE_ENV !== "production") globalForDb.__osDb = db;

export function uid(): string {
  return crypto.randomUUID();
}
