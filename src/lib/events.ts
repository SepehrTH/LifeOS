import { db, uid } from "./db";

export type EventKind =
  | "created"
  | "completed"
  | "uncompleted"
  | "deleted"
  | "expired";

export type ItemEvent = {
  id: string;
  itemId: string;
  kind: EventKind;
  text: string;
  blockTitle: string;
  blockKind: string;
  projectId: string;
  color: string;
  day: string;
  at: string;
};

type ContextRow = {
  user_id: string;
  block_id: string;
  block_kind: string;
  block_title: string;
  project_id: string;
  color: string;
  text: string;
};

/**
 * Everything the history needs about where an item lives: its box, and the project it
 * belongs to (directly, or through the todo it was copied from).
 */
const CONTEXT_QUERY = `
  SELECT b.user_id, b.id AS block_id, b.kind AS block_kind, b.title AS block_title, i.text,
         CASE WHEN b.kind = 'project' THEN b.id ELSE COALESCE(p.id, '') END AS project_id,
         CASE WHEN b.kind = 'project' THEN b.color ELSE COALESCE(p.color, '') END AS color
  FROM items i
  JOIN blocks b ON b.id = i.block_id
  LEFT JOIN items src ON src.id = i.link_id
  LEFT JOIN blocks p ON p.id = src.block_id
  WHERE i.id = ?`;

function contextOf(itemId: string): ContextRow | undefined {
  return db.prepare(CONTEXT_QUERY).get(itemId) as ContextRow | undefined;
}

const insert = db.prepare(
  `INSERT INTO item_events
     (id, user_id, item_id, block_id, block_kind, block_title, project_id, color, kind, text, day, at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now','localtime'), datetime('now','localtime'))`
);

/** Records an event for an item that still exists. */
export function recordEvent(itemId: string, kind: EventKind) {
  const ctx = contextOf(itemId);
  if (!ctx) return;
  insert.run(
    uid(),
    ctx.user_id,
    itemId,
    ctx.block_id,
    ctx.block_kind,
    ctx.block_title,
    ctx.project_id,
    ctx.color,
    kind,
    ctx.text
  );
}

/** Records an event for an item that is about to disappear (rollover, delete). */
export function recordSnapshot(
  userId: string,
  itemId: string,
  kind: EventKind,
  snapshot: { text: string; blockId: string; blockKind: string; blockTitle: string }
) {
  insert.run(
    uid(),
    userId,
    itemId,
    snapshot.blockId,
    snapshot.blockKind,
    snapshot.blockTitle,
    "",
    "",
    kind,
    snapshot.text
  );
}

/** Every event on one day, newest first — what the heatmap's day panel shows. */
export function eventsOnDay(userId: string, day: string): ItemEvent[] {
  const rows = db
    .prepare(
      `SELECT id, item_id, kind, text, block_title, block_kind, project_id, color, day, at
       FROM item_events WHERE user_id = ? AND day = ? ORDER BY at DESC`
    )
    .all(userId, day) as Record<string, string>[];

  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    kind: r.kind as EventKind,
    text: r.text,
    blockTitle: r.block_title,
    blockKind: r.block_kind,
    projectId: r.project_id,
    color: r.color,
    day: r.day,
    at: r.at,
  }));
}

/**
 * The todos that ended the day ticked off — one row per item, using its *last* tick that
 * day. Checking and unchecking the same todo repeatedly must not stack up, and a todo you
 * unchecked before the day was out is not a completion at all.
 *
 * rowid orders the events rather than `at`, which only has second resolution.
 */
export function netCompletedOnDay(userId: string, day: string): ItemEvent[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.item_id, e.kind, e.text, e.block_title, e.block_kind,
              e.project_id, e.color, e.day, e.at
       FROM item_events e
       JOIN (
         SELECT item_id, MAX(rowid) AS last_rowid FROM item_events
         WHERE user_id = ? AND day = ? AND kind IN ('completed', 'uncompleted')
         GROUP BY item_id
       ) last ON last.last_rowid = e.rowid
       WHERE e.kind = 'completed'
       ORDER BY e.at DESC`
    )
    .all(userId, day) as Record<string, string>[];

  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    kind: r.kind as EventKind,
    text: r.text,
    blockTitle: r.block_title,
    blockKind: r.block_kind,
    projectId: r.project_id,
    color: r.color,
    day: r.day,
    at: r.at,
  }));
}
