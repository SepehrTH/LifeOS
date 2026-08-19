import { db, uid } from "./db";
import { serverToday } from "./blocks";

export type FocusSession = {
  id: string;
  projectId: string;
  projectTitle: string;
  color: string;
  day: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  note: string;
  manual: boolean;
  running: boolean;
};

/** A session left running for longer than this was almost certainly forgotten about. */
export const MAX_SESSION_MINUTES = 12 * 60;

const SESSION_QUERY = `
  SELECT f.id, f.project_id, f.day, f.started_at, f.ended_at, f.minutes, f.note, f.manual,
         COALESCE(p.title, '') AS project_title, COALESCE(p.color, '') AS color
  FROM focus_sessions f
  LEFT JOIN blocks p ON p.id = f.project_id
  WHERE f.user_id = ?`;

type Row = {
  id: string;
  project_id: string;
  day: string;
  started_at: string;
  ended_at: string;
  minutes: number;
  note: string;
  manual: number;
  project_title: string;
  color: string;
};

function toSession(row: Row): FocusSession {
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    color: row.color,
    day: row.day,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    minutes: row.minutes,
    note: row.note,
    manual: !!row.manual,
    running: !row.ended_at,
  };
}

export function runningSession(userId: string): FocusSession | null {
  const row = db
    .prepare(`${SESSION_QUERY} AND f.ended_at = '' ORDER BY f.started_at DESC LIMIT 1`)
    .get(userId) as Row | undefined;
  return row ? toSession(row) : null;
}

/** Starts a session, closing any that was already running so only one can be live. */
export function startSession(userId: string, projectId: string): FocusSession {
  const already = runningSession(userId);
  if (already) stopSession(userId, already.id);

  const id = uid();
  db.prepare(
    `INSERT INTO focus_sessions (id, user_id, project_id, day, started_at)
     VALUES (?, ?, ?, date('now','localtime'), datetime('now','localtime'))`
  ).run(id, userId, projectId);

  return getSession(userId, id)!;
}

export function stopSession(userId: string, id: string): FocusSession | null {
  const session = getSession(userId, id);
  if (!session || !session.running) return session;

  const elapsed =
    (Date.now() - new Date(session.startedAt.replace(" ", "T")).getTime()) / 60_000;
  const minutes = Math.min(MAX_SESSION_MINUTES, Math.max(0, Math.round(elapsed)));

  // Anything under half a minute was a misclick — drop it rather than log a 0m session.
  if (minutes < 1) {
    deleteSession(userId, id);
    return null;
  }

  db.prepare(
    `UPDATE focus_sessions SET ended_at = datetime('now','localtime'), minutes = ?
     WHERE user_id = ? AND id = ?`
  ).run(minutes, userId, id);

  return getSession(userId, id);
}

export function addManualSession(
  userId: string,
  input: { projectId: string; minutes: number; day?: string; note?: string }
): FocusSession {
  const id = uid();
  const day = input.day || serverToday();
  db.prepare(
    `INSERT INTO focus_sessions
       (id, user_id, project_id, day, started_at, ended_at, minutes, note, manual)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    id,
    userId,
    input.projectId,
    day,
    `${day} 00:00:00`,
    `${day} 00:00:00`,
    Math.max(1, Math.round(input.minutes)),
    input.note ?? ""
  );
  return getSession(userId, id)!;
}

export function getSession(userId: string, id: string): FocusSession | null {
  const row = db.prepare(`${SESSION_QUERY} AND f.id = ?`).get(userId, id) as Row | undefined;
  return row ? toSession(row) : null;
}

export function deleteSession(userId: string, id: string): boolean {
  return (
    db.prepare("DELETE FROM focus_sessions WHERE user_id = ? AND id = ?").run(userId, id)
      .changes > 0
  );
}

export function sessionsSince(userId: string, fromDay: string): FocusSession[] {
  const rows = db
    .prepare(`${SESSION_QUERY} AND f.day >= ? ORDER BY f.started_at DESC`)
    .all(userId, fromDay) as Row[];
  return rows.map(toSession);
}

/** Finished minutes per day, for the graphs. */
export function minutesByDay(
  userId: string,
  fromDay: string,
  toDay: string
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT day, SUM(minutes) AS total FROM focus_sessions
       WHERE user_id = ? AND day BETWEEN ? AND ? AND ended_at != ''
       GROUP BY day`
    )
    .all(userId, fromDay, toDay) as { day: string; total: number }[];
  return Object.fromEntries(rows.map((r) => [r.day, r.total]));
}

/** Minutes per project over a window — what the week's breakdown bars show. */
export function minutesByProject(
  userId: string,
  fromDay: string
): Array<{ projectId: string; title: string; color: string; minutes: number }> {
  const rows = db
    .prepare(
      `SELECT f.project_id, COALESCE(p.title, '') AS title, COALESCE(p.color, '') AS color,
              SUM(f.minutes) AS minutes
       FROM focus_sessions f
       LEFT JOIN blocks p ON p.id = f.project_id
       WHERE f.user_id = ? AND f.day >= ? AND f.ended_at != ''
       GROUP BY f.project_id
       ORDER BY minutes DESC`
    )
    .all(userId, fromDay) as {
    project_id: string;
    title: string;
    color: string;
    minutes: number;
  }[];

  return rows.map((r) => ({
    projectId: r.project_id,
    title: r.title || "No project",
    color: r.color,
    minutes: r.minutes,
  }));
}
