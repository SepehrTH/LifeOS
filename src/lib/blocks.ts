import { db, uid } from "./db";
import { nthProjectColor } from "./palette";
import { recordEvent, recordSnapshot } from "./events";
import { projectIdOfTab } from "./projectTab";

export { mapTabFor, projectIdOfTab } from "./projectTab";

export type Item = {
  id: string;
  text: string;
  done: boolean;
  position: number;
  /** Daily-box items marked recurring survive the nightly refresh; the rest are cleared. */
  recurring: boolean;
  /** Project todos marked as milestones drive the progress bar in "milestones" mode. */
  milestone: boolean;
  /** Set on a todo-box copy: the project todo it mirrors. Checking either checks both. */
  linkId: string;
  /** Where a copy came from, so the Todo tab can colour-code it by project. */
  origin: { projectId: string; title: string; color: string; milestone: boolean } | null;
  /** Set on a project todo that has been sent to one or more todo boxes. */
  sent: boolean;
  /** Optional deadline as a local YYYY-MM-DD string; empty when there is none. */
  dueAt: string;
};

export type BlockKind = "daily" | "general" | "project" | "text" | "deadlines";


export type ProgressMode = "manual" | "milestones";

export type Block = {
  id: string;
  tab: string;
  kind: BlockKind;
  title: string;
  description: string;
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  progress: number;
  progressMode: ProgressMode;
  /** Fixed accent for projects; empty for every other kind of block. */
  color: string;
  items: Item[];
};

type BlockRow = {
  id: string;
  tab: string;
  kind: BlockKind;
  title: string;
  description: string;
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: number;
  progress: number;
  progress_mode: ProgressMode;
  color: string;
  last_reset: string;
};

type ItemRow = {
  id: string;
  text: string;
  done: number;
  position: number;
  recurring: number;
  milestone: number;
  link_id: string;
  due_at: string;
  origin_project: string | null;
  origin_title: string | null;
  origin_color: string | null;
  origin_milestone: number | null;
  copies: number;
};

const DEFAULTS: Record<BlockKind, { w: number; h: number }> = {
  daily: { w: 340, h: 360 },
  general: { w: 340, h: 360 },
  project: { w: 300, h: 170 },
  text: { w: 260, h: 60 },
  deadlines: { w: 320, h: 300 },
};

const BLOCK_COLUMNS = `id, tab, kind, title, description, content, x, y, w, h, z,
  minimized, progress, progress_mode, color, last_reset`;

/**
 * Items plus the project they were copied from (for colour coding in the Todo tab) and
 * whether they have copies of their own (so the project rail can mark them as sent).
 */
const ITEM_QUERY = `
  SELECT i.id, i.text, i.done, i.position, i.recurring, i.milestone, i.link_id, i.due_at,
         p.id AS origin_project, p.title AS origin_title, p.color AS origin_color,
         src.milestone AS origin_milestone,
         (SELECT COUNT(*) FROM items c WHERE c.link_id = i.id) AS copies
  FROM items i
  LEFT JOIN items src ON src.id = i.link_id
  LEFT JOIN blocks p ON p.id = src.block_id
  WHERE i.block_id = ?
  ORDER BY i.position ASC, i.created_at ASC`;

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    text: row.text,
    done: !!row.done,
    position: row.position,
    recurring: !!row.recurring,
    milestone: !!row.milestone,
    linkId: row.link_id,
    origin: row.origin_project
      ? {
          projectId: row.origin_project,
          title: row.origin_title ?? "",
          color: row.origin_color || nthProjectColor(0),
          milestone: !!row.origin_milestone,
        }
      : null,
    sent: row.copies > 0,
    dueAt: row.due_at ?? "",
  };
}

/** Milestone-mode projects derive their percentage from completed milestone todos. */
function milestoneProgress(items: Item[]): number | null {
  const milestones = items.filter((i) => i.milestone);
  if (milestones.length === 0) return null;
  return Math.round((milestones.filter((i) => i.done).length / milestones.length) * 100);
}

function toBlock(row: BlockRow, items: Item[]): Block {
  const derived = row.progress_mode === "milestones" ? milestoneProgress(items) : null;
  return {
    id: row.id,
    tab: row.tab,
    kind: row.kind,
    title: row.title,
    description: row.description,
    content: row.content,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    z: row.z,
    minimized: !!row.minimized,
    progress: derived ?? row.progress,
    progressMode: row.progress_mode,
    color: row.color,
    items,
  };
}

/** Seeds the two starter boxes the first time the Todo board is opened. */
function seedTodo(userId: string, today: string) {
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM blocks WHERE user_id = ? AND tab = 'todo'")
    .get(userId) as { n: number };
  if (count.n > 0) return;

  const insert = db.prepare(
    `INSERT INTO blocks (id, user_id, tab, kind, title, x, y, w, h, z, last_reset)
     VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run(uid(), userId, "daily", "Today", 60, 60, 340, 360, 1, today);
  insert.run(uid(), userId, "general", "General", 440, 60, 340, 360, 2, "");
}

/**
 * Rolls daily boxes over to `today`: recurring items come back unchecked, one-off items
 * are cleared out.
 */
function rollDailies(userId: string, today: string) {
  const stale = db
    .prepare(
      "SELECT id, last_reset FROM blocks WHERE user_id = ? AND kind = 'daily' AND last_reset != ?"
    )
    .all(userId, today) as { id: string; last_reset: string }[];
  if (stale.length === 0) return;

  const countItems = db.prepare(
    "SELECT COUNT(*) AS planned, SUM(done) AS done FROM items WHERE block_id = ?"
  );
  const saveStats = db.prepare(
    `INSERT INTO day_stats (user_id, day, planned, done) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, day)
     DO UPDATE SET planned = planned + excluded.planned, done = done + excluded.done`
  );

  const listOneOffs = db.prepare(
    `SELECT i.id, i.text, i.done, b.kind AS block_kind, b.title AS block_title
     FROM items i JOIN blocks b ON b.id = i.block_id
     WHERE i.block_id = ? AND i.recurring = 0`
  );
  const dropOneOffs = db.prepare("DELETE FROM items WHERE block_id = ? AND recurring = 0");
  const uncheck = db.prepare("UPDATE items SET done = 0, completed_at = '' WHERE block_id = ?");
  const stamp = db.prepare("UPDATE blocks SET last_reset = ? WHERE id = ?");

  const tx = db.transaction(() => {
    for (const b of stale) {
      // Close the books on the day this box was last seen, before anything is cleared.
      if (b.last_reset) {
        const counts = countItems.get(b.id) as { planned: number; done: number | null };
        saveStats.run(userId, b.last_reset, counts.planned, counts.done ?? 0);
      }

      // Unfinished one-offs are logged as they expire, so the day keeps its record.
      const doomed = listOneOffs.all(b.id) as {
        id: string;
        text: string;
        done: number;
        block_kind: string;
        block_title: string;
      }[];
      for (const item of doomed) {
        if (item.done) continue;
        recordSnapshot(userId, item.id, "expired", {
          text: item.text,
          blockId: b.id,
          blockKind: item.block_kind,
          blockTitle: item.block_title,
        });
      }
      dropOneOffs.run(b.id);
      uncheck.run(b.id);
      stamp.run(today, b.id);
    }
  });
  tx();
}

/**
 * The day the server itself is on. Rollovers use this rather than the date the browser
 * sends: a wrong value from a client would clear a day's todos for good.
 */
export function serverToday(): string {
  return (db.prepare("SELECT date('now','localtime') AS d").get() as { d: string }).d;
}

export function listBlocks(userId: string, tab: string, _today: string): Block[] {
  if (tab === "todo") {
    const today = serverToday();
    seedTodo(userId, today);
    rollDailies(userId, today);
  }

  const rows = db
    .prepare(
      `SELECT ${BLOCK_COLUMNS} FROM blocks WHERE user_id = ? AND tab = ? ORDER BY z ASC`
    )
    .all(userId, tab) as BlockRow[];

  const itemStmt = db.prepare(ITEM_QUERY);

  return rows.map((r) => toBlock(r, (itemStmt.all(r.id) as ItemRow[]).map(toItem)));
}

export function createBlock(
  userId: string,
  input: {
    tab: string;
    kind: BlockKind;
    title: string;
    description?: string;
    content?: string;
    x?: number;
    y?: number;
    today?: string;
  }
): Block {
  const id = uid();
  const size = DEFAULTS[input.kind] ?? DEFAULTS.general;
  const top = db
    .prepare("SELECT COALESCE(MAX(z), 0) AS z FROM blocks WHERE user_id = ? AND tab = ?")
    .get(userId, input.tab) as { z: number };

  let color = "";
  if (input.kind === "project") {
    const made = db
      .prepare("SELECT COUNT(*) AS n FROM blocks WHERE user_id = ? AND kind = 'project'")
      .get(userId) as { n: number };
    color = nthProjectColor(made.n);
  }

  db.prepare(
    `INSERT INTO blocks (id, user_id, tab, kind, title, description, content, x, y, w, h, z, color, last_reset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    input.tab,
    input.kind,
    input.title,
    input.description ?? "",
    input.content ?? "",
    input.x ?? 60,
    input.y ?? 60,
    size.w,
    size.h,
    top.z + 1,
    color,
    input.kind === "daily" ? serverToday() : ""
  );

  return getBlock(userId, id)!;
}

export function getBlock(userId: string, id: string): Block | null {
  const row = db
    .prepare(`SELECT ${BLOCK_COLUMNS} FROM blocks WHERE user_id = ? AND id = ?`)
    .get(userId, id) as BlockRow | undefined;
  if (!row) return null;

  const items = (db.prepare(ITEM_QUERY).all(id) as ItemRow[]).map(toItem);

  return toBlock(row, items);
}

const TEXT_FIELDS = ["title", "description", "content"] as const;
const NUMBER_FIELDS = ["x", "y", "w", "h", "z", "progress"] as const;

export function updateBlock(userId: string, id: string, patch: Record<string, unknown>): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of TEXT_FIELDS) {
    if (field in patch) {
      sets.push(`${field} = ?`);
      values.push(String(patch[field]));
    }
  }
  for (const field of NUMBER_FIELDS) {
    if (field in patch) {
      sets.push(`${field} = ?`);
      values.push(Number(patch[field]));
    }
  }
  if ("minimized" in patch) {
    sets.push("minimized = ?");
    values.push(patch.minimized ? 1 : 0);
  }
  if ("progressMode" in patch) {
    sets.push("progress_mode = ?");
    values.push(patch.progressMode === "milestones" ? "milestones" : "manual");
  }
  if (sets.length === 0) return false;

  values.push(userId, id);
  const res = db
    .prepare(`UPDATE blocks SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`)
    .run(...(values as never[]));
  return res.changes > 0;
}

export function deleteBlock(userId: string, id: string): boolean {
  return db.prepare("DELETE FROM blocks WHERE user_id = ? AND id = ?").run(userId, id).changes > 0;
}

export function addItem(
  userId: string,
  blockId: string,
  text: string,
  flags: { recurring?: boolean; milestone?: boolean; dueAt?: string } = {}
): Item | null {
  const owns = db
    .prepare("SELECT id, tab FROM blocks WHERE user_id = ? AND id = ?")
    .get(userId, blockId) as { id: string; tab: string } | undefined;
  if (!owns) return null;

  /*
   * A todo added to a group on a project's board belongs to the project first: the real
   * todo goes into the project's own list, and what sits on the board is a linked copy.
   * Ticking either one ticks both, and the left rail always shows everything.
   */
  const mapProject = projectIdOfTab(owns.tab);
  if (mapProject) {
    const root = addItem(userId, mapProject, text, flags);
    if (!root) return null;
    return sendItemToBlock(userId, root.id, blockId);
  }

  const next = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS p FROM items WHERE block_id = ?")
    .get(blockId) as { p: number };

  const id = uid();
  db.prepare(
    `INSERT INTO items (id, block_id, text, position, recurring, milestone, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    blockId,
    text,
    next.p + 1,
    flags.recurring ? 1 : 0,
    flags.milestone ? 1 : 0,
    flags.dueAt ?? ""
  );
  recordEvent(id, "created");

  return {
    id,
    text,
    done: false,
    position: next.p + 1,
    recurring: !!flags.recurring,
    milestone: !!flags.milestone,
    linkId: "",
    origin: null,
    sent: false,
    dueAt: flags.dueAt ?? "",
  };
}

/**
 * Copies a project todo into one of the Todo tab's boxes. The copy stays linked: ticking
 * it off in either place ticks off the other, and editing the text keeps them in step.
 */
export function sendItemToBlock(
  userId: string,
  itemId: string,
  targetBlockId: string
): Item | null {
  const source = db
    .prepare(
      `SELECT i.id, i.text, i.done, i.link_id, i.due_at
       FROM items i JOIN blocks b ON b.id = i.block_id
       WHERE i.id = ? AND b.user_id = ?`
    )
    .get(itemId, userId) as
    | { id: string; text: string; done: number; link_id: string; due_at: string }
    | undefined;
  if (!source) return null;

  const target = db
    .prepare("SELECT id, kind, tab FROM blocks WHERE id = ? AND user_id = ?")
    .get(targetBlockId, userId) as { id: string; kind: BlockKind; tab: string } | undefined;
  // Todo-tab boxes and groups on a project's board can both hold copies.
  if (!target || (target.kind !== "daily" && target.kind !== "general")) return null;

  // Always link to the original, never to another copy.
  const rootId = source.link_id || source.id;

  const existing = db
    .prepare("SELECT id FROM items WHERE block_id = ? AND link_id = ?")
    .get(targetBlockId, rootId) as { id: string } | undefined;
  if (existing) return null;

  const next = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS p FROM items WHERE block_id = ?")
    .get(targetBlockId) as { p: number };

  const id = uid();
  db.prepare(
    `INSERT INTO items (id, block_id, text, done, position, link_id, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, targetBlockId, source.text, source.done, next.p + 1, rootId, source.due_at);
  recordEvent(id, "created");

  const row = db.prepare(ITEM_QUERY.replace("WHERE i.block_id = ?", "WHERE i.id = ?")).get(id) as
    | ItemRow
    | undefined;
  return row ? toItem(row) : null;
}

/** Rewrites the order of a block's todos to match the ids given. */
export function reorderItems(userId: string, blockId: string, ids: string[]): boolean {
  const owns = db
    .prepare("SELECT id FROM blocks WHERE user_id = ? AND id = ?")
    .get(userId, blockId);
  if (!owns) return false;

  const move = db.prepare("UPDATE items SET position = ? WHERE id = ? AND block_id = ?");
  const tx = db.transaction(() => {
    ids.forEach((id, index) => move.run(index + 1, id, blockId));
  });
  tx();
  return true;
}

function ownsItem(userId: string, itemId: string): boolean {
  return !!db
    .prepare(
      `SELECT items.id FROM items
       JOIN blocks ON blocks.id = items.block_id
       WHERE items.id = ? AND blocks.user_id = ?`
    )
    .get(itemId, userId);
}

export function updateItem(
  userId: string,
  itemId: string,
  patch: {
    text?: string;
    done?: boolean;
    recurring?: boolean;
    milestone?: boolean;
    dueAt?: string;
  }
): boolean {
  if (!ownsItem(userId, itemId)) return false;
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.text !== undefined) {
    sets.push("text = ?");
    values.push(String(patch.text));
  }
  if (patch.dueAt !== undefined) {
    sets.push("due_at = ?");
    values.push(String(patch.dueAt));
  }
  if (patch.done !== undefined) {
    sets.push("completed_at = ?");
    values.push(patch.done ? new Date().toISOString() : "");
  }
  for (const flag of ["done", "recurring", "milestone"] as const) {
    if (patch[flag] !== undefined) {
      sets.push(`${flag} = ?`);
      values.push(patch[flag] ? 1 : 0);
    }
  }
  if (sets.length === 0) return false;

  values.push(itemId);
  db.prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`).run(...(values as never[]));

  if (patch.done !== undefined) recordEvent(itemId, patch.done ? "completed" : "uncompleted");
  syncLinked(itemId, patch);
  return true;
}

/** Mirrors a tick or a text edit onto the original todo and its other copies. */
function syncLinked(itemId: string, patch: { text?: string; done?: boolean }) {
  const shared: string[] = [];
  const values: unknown[] = [];
  if (patch.text !== undefined) {
    shared.push("text = ?");
    values.push(String(patch.text));
  }
  if (patch.done !== undefined) {
    shared.push("done = ?", "completed_at = ?");
    values.push(patch.done ? 1 : 0, patch.done ? new Date().toISOString() : "");
  }
  if (shared.length === 0) return;

  const row = db.prepare("SELECT link_id FROM items WHERE id = ?").get(itemId) as
    | { link_id: string }
    | undefined;
  if (!row) return;

  const rootId = row.link_id || itemId;
  db.prepare(`UPDATE items SET ${shared.join(", ")} WHERE (id = ? OR link_id = ?) AND id != ?`)
    .run(...(values as never[]), rootId, rootId, itemId);
}

export function deleteItem(userId: string, itemId: string): boolean {
  if (!ownsItem(userId, itemId)) return false;
  recordEvent(itemId, "deleted");
  // Deleting the original takes its copies with it; deleting a copy leaves the original.
  db.prepare("DELETE FROM items WHERE id = ? OR link_id = ?").run(itemId, itemId);
  return true;
}

export type Deadline = {
  itemId: string;
  text: string;
  dueAt: string;
  done: boolean;
  where: string;
  color: string;
  projectId: string;
};

/**
 * Every unfinished todo that has a deadline, across all boxes and projects, soonest first.
 * Linked copies are folded into their original so a sent todo is only listed once.
 */
export function listDeadlines(userId: string): Deadline[] {
  const rows = db
    .prepare(
      `SELECT i.id, i.text, i.due_at, i.done, i.link_id,
              b.kind AS block_kind, b.title AS block_title, b.color AS block_color,
              COALESCE(p.id, '') AS project_id, COALESCE(p.title, '') AS project_title,
              COALESCE(p.color, '') AS project_color
       FROM items i
       JOIN blocks b ON b.id = i.block_id
       LEFT JOIN items src ON src.id = i.link_id
       LEFT JOIN blocks p ON p.id = src.block_id
       WHERE b.user_id = ? AND i.due_at != '' AND i.done = 0
       ORDER BY i.due_at ASC`
    )
    .all(userId) as {
    id: string;
    text: string;
    due_at: string;
    done: number;
    link_id: string;
    block_kind: string;
    block_title: string;
    block_color: string;
    project_id: string;
    project_title: string;
    project_color: string;
  }[];

  const seen = new Set<string>();
  const out: Deadline[] = [];

  for (const r of rows) {
    // A copy and its original are the same todo; keep whichever comes first.
    const key = r.link_id || r.id;
    if (seen.has(key)) continue;
    seen.add(key);

    const isProject = r.block_kind === "project";
    out.push({
      itemId: r.id,
      text: r.text,
      dueAt: r.due_at,
      done: !!r.done,
      where: isProject ? r.block_title : r.project_title || r.block_title,
      color: isProject ? r.block_color : r.project_color,
      projectId: isProject ? "" : r.project_id,
    });
  }

  return out;
}
