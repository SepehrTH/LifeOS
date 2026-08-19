import { db, uid } from "./db";

/** "auto" metrics are filled in by the app itself — today only the todo ratio. */
export type MetricType = "scale" | "number" | "boolean" | "duration" | "note" | "auto";

export type Metric = {
  id: string;
  key: string;
  name: string;
  type: MetricType;
  unit: string;
  min: number;
  max: number;
  color: string;
  position: number;
  /** Relative pull on the day's score. 0 means the metric is tracked but not scored. */
  weight: number;
  /** What counts as full marks for a number or duration metric. */
  target: number;
  archived: boolean;
};

export type MetricValue = { metricId: string; num: number | null; text: string };

type MetricRow = Omit<Metric, "archived"> & { archived: number };

const TYPES: MetricType[] = ["scale", "number", "boolean", "duration", "note"];

/** Only these can contribute to the score; a note has nothing to normalise. */
export function isScorable(metric: Metric): boolean {
  if (metric.type === "note") return false;
  if (metric.type === "number" || metric.type === "duration") return metric.target > 0;
  return true;
}

/** A value expressed as 0–1, or null when it cannot be scored. */
export function normalise(metric: Metric, num: number | null): number | null {
  if (num === null || !isScorable(metric)) return null;
  if (metric.type === "boolean") return num > 0 ? 1 : 0;
  if (metric.type === "scale") {
    const span = Math.max(1, metric.max - metric.min);
    return Math.min(1, Math.max(0, (num - metric.min) / span));
  }
  return Math.min(1, Math.max(0, num / metric.target));
}

/** The three the heatmap score depends on. They are created once and cannot be deleted. */
const BUILT_INS: Array<Omit<Metric, "id" | "archived">> = [
  {
    key: "todos",
    name: "Todos done",
    type: "auto",
    unit: "",
    min: 0,
    max: 1,
    color: "#8c8c88",
    position: 0,
    weight: 20,
    target: 0,
  },
  {
    key: "grade",
    name: "Productivity",
    type: "scale",
    unit: "",
    min: 1,
    max: 5,
    color: "#3fa66a",
    position: 1,
    weight: 45,
    target: 0,
  },
  {
    key: "deep_work",
    name: "Deep work",
    type: "boolean",
    unit: "",
    min: 0,
    max: 1,
    color: "#4f8ff7",
    position: 2,
    weight: 20,
    target: 0,
  },
  {
    key: "all_done",
    name: "Did everything I needed",
    type: "boolean",
    unit: "",
    min: 0,
    max: 1,
    color: "#9a6ad6",
    position: 3,
    weight: 15,
    target: 0,
  },
];

function toMetric(row: MetricRow): Metric {
  return { ...row, archived: !!row.archived };
}

export function ensureBuiltIns(userId: string) {
  const have = new Set(
    (
      db.prepare("SELECT key FROM metrics WHERE user_id = ? AND key != ''").all(userId) as {
        key: string;
      }[]
    ).map((r) => r.key)
  );

  const insert = db.prepare(
    `INSERT INTO metrics (id, user_id, key, name, type, unit, min, max, color, position, weight, target)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const m of BUILT_INS) {
    if (have.has(m.key)) continue;
    insert.run(
      uid(),
      userId,
      m.key,
      m.name,
      m.type,
      m.unit,
      m.min,
      m.max,
      m.color,
      m.position,
      m.weight,
      m.target
    );
  }
}

export function listMetrics(userId: string, includeArchived = false): Metric[] {
  ensureBuiltIns(userId);
  const rows = db
    .prepare(
      `SELECT id, key, name, type, unit, min, max, color, position, weight, target, archived
       FROM metrics WHERE user_id = ? ${includeArchived ? "" : "AND archived = 0"}
       ORDER BY position ASC, created_at ASC`
    )
    .all(userId) as MetricRow[];
  return rows.map(toMetric);
}

export function createMetric(
  userId: string,
  input: {
    name: string;
    type: MetricType;
    unit?: string;
    min?: number;
    max?: number;
    color?: string;
    weight?: number;
    target?: number;
  }
): Metric {
  const id = uid();
  const type: MetricType = TYPES.includes(input.type) ? input.type : "number";
  const bottom = db
    .prepare("SELECT COALESCE(MAX(position), 0) AS p FROM metrics WHERE user_id = ?")
    .get(userId) as { p: number };

  db.prepare(
    `INSERT INTO metrics (id, user_id, key, name, type, unit, min, max, color, position, weight, target)
     VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    input.name.slice(0, 60),
    type,
    input.unit?.slice(0, 12) ?? "",
    input.min ?? (type === "scale" ? 1 : 0),
    input.max ?? (type === "scale" ? 5 : 0),
    input.color ?? "",
    bottom.p + 1,
    // New metrics are tracked but unscored until a weight is given, so adding one never
    // silently rebalances the score.
    Math.max(0, input.weight ?? 0),
    Math.max(0, input.target ?? 0)
  );

  return listMetrics(userId, true).find((m) => m.id === id)!;
}

export function updateMetric(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      Metric,
      "name" | "unit" | "min" | "max" | "color" | "position" | "weight" | "target" | "archived"
    >
  >
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of ["name", "unit", "color"] as const) {
    if (patch[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(String(patch[field]));
    }
  }
  for (const field of ["min", "max", "position", "weight", "target"] as const) {
    if (patch[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(Number(patch[field]));
    }
  }
  if (patch.archived !== undefined) {
    sets.push("archived = ?");
    values.push(patch.archived ? 1 : 0);
  }
  if (sets.length === 0) return false;

  values.push(userId, id);
  return (
    db
      .prepare(`UPDATE metrics SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`)
      .run(...(values as never[])).changes > 0
  );
}

/** Custom metrics can be deleted outright; built-ins are kept because the score needs them. */
export function deleteMetric(userId: string, id: string): boolean {
  const row = db
    .prepare("SELECT key FROM metrics WHERE user_id = ? AND id = ?")
    .get(userId, id) as { key: string } | undefined;
  if (!row || row.key) return false;

  db.prepare("DELETE FROM metric_values WHERE metric_id = ?").run(id);
  db.prepare("DELETE FROM metrics WHERE user_id = ? AND id = ?").run(userId, id);
  return true;
}

export function valuesForDay(userId: string, day: string): MetricValue[] {
  const rows = db
    .prepare("SELECT metric_id, num, text FROM metric_values WHERE user_id = ? AND day = ?")
    .all(userId, day) as { metric_id: string; num: number | null; text: string }[];
  return rows.map((r) => ({ metricId: r.metric_id, num: r.num, text: r.text }));
}

/** Writes one metric's value for a day; passing null/"" clears it. */
export function setValue(
  userId: string,
  metricId: string,
  day: string,
  value: { num?: number | null; text?: string }
): boolean {
  const owns = db
    .prepare("SELECT id FROM metrics WHERE user_id = ? AND id = ?")
    .get(userId, metricId);
  if (!owns) return false;

  const num = value.num ?? null;
  const text = value.text ?? "";

  if (num === null && text === "") {
    db.prepare("DELETE FROM metric_values WHERE metric_id = ? AND day = ?").run(metricId, day);
    return true;
  }

  db.prepare(
    `INSERT INTO metric_values (id, user_id, metric_id, day, num, text, at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(metric_id, day)
     DO UPDATE SET num = excluded.num, text = excluded.text, at = excluded.at`
  ).run(uid(), userId, metricId, day, num, text);
  return true;
}

/** Every value in a date range, for the graphs. */
export function valuesInRange(
  userId: string,
  fromDay: string,
  toDay: string
): Array<{ metricId: string; day: string; num: number | null; text: string }> {
  const rows = db
    .prepare(
      `SELECT metric_id, day, num, text FROM metric_values
       WHERE user_id = ? AND day BETWEEN ? AND ? ORDER BY day ASC`
    )
    .all(userId, fromDay, toDay) as {
    metric_id: string;
    day: string;
    num: number | null;
    text: string;
  }[];
  return rows.map((r) => ({ metricId: r.metric_id, day: r.day, num: r.num, text: r.text }));
}
