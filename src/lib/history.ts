import { db } from "./db";
import { eventsOnDay, netCompletedOnDay, type ItemEvent } from "./events";
import { listMetrics, normalise, valuesForDay, type Metric } from "./metrics";
import { scoreDay, type DayScore, type PartInput } from "./scoring";
import { serverToday } from "./blocks";

/** Task counts for a day: closed days come from day_stats, today is counted live. */
function taskCounts(userId: string, day: string): { planned: number; done: number } {
  if (day !== serverToday()) {
    const row = db
      .prepare("SELECT planned, done FROM day_stats WHERE user_id = ? AND day = ?")
      .get(userId, day) as { planned: number; done: number } | undefined;
    if (row) return row;

    // No snapshot (the app was not opened that day) — fall back to what the log saw.
    const logged = netCompletedOnDay(userId, day).length;
    return { planned: logged, done: logged };
  }

  const row = db
    .prepare(
      `SELECT COUNT(*) AS planned, COALESCE(SUM(i.done), 0) AS done
       FROM items i JOIN blocks b ON b.id = i.block_id
       WHERE b.user_id = ? AND b.kind = 'daily'`
    )
    .get(userId) as { planned: number; done: number };
  return row;
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

/** Trailing median of daily completions — the bar the volume bonus is measured against. */
function trailingMedian(userId: string, day: string, window = 30): number {
  const rows = db
    .prepare(
      `SELECT done FROM day_stats
       WHERE user_id = ? AND day < ? AND day >= ? AND planned > 0
       ORDER BY day DESC`
    )
    .all(userId, day, shiftDay(day, -window)) as { done: number }[];
  if (rows.length === 0) return 0;

  const sorted = rows.map((r) => r.done).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function scoreFor(userId: string, day: string, metrics?: Metric[]): DayScore {
  const all = (metrics ?? listMetrics(userId, true)).filter((m) => !m.archived);
  const values = valuesForDay(userId, day);
  const counts = taskCounts(userId, day);

  const parts: PartInput[] = all.map((metric) => {
    if (metric.type === "auto" && metric.key === "todos") {
      return {
        metricId: metric.id,
        key: metric.key,
        name: metric.name,
        color: metric.color,
        weight: metric.weight,
        value: counts.planned > 0 ? Math.min(1, counts.done / counts.planned) : null,
        auto: true,
        // Nothing on the board means there was nothing to complete: leave it out of the
        // split rather than scoring a zero for it.
        skip: counts.planned === 0,
      };
    }

    const value = values.find((v) => v.metricId === metric.id);
    return {
      metricId: metric.id,
      key: metric.key,
      name: metric.name,
      color: metric.color,
      weight: metric.weight,
      value: normalise(metric, value?.num ?? null),
      auto: false,
    };
  });

  return scoreDay({
    day,
    planned: counts.planned,
    done: counts.done,
    parts,
    // Auto values do not count as checking in — the day stays blank until you say something.
    hasCheckin: values.length > 0,
    median: trailingMedian(userId, day),
  });
}

/** The first day this user has any record of — the grid starts there, not before. */
function firstRecordedDay(userId: string): string | null {
  const row = db
    .prepare(
      `SELECT MIN(day) AS day FROM (
         SELECT MIN(day) AS day FROM item_events WHERE user_id = ?
         UNION ALL SELECT MIN(day) FROM day_stats WHERE user_id = ?
         UNION ALL SELECT MIN(day) FROM metric_values WHERE user_id = ?
       )`
    )
    .get(userId, userId, userId) as { day: string | null };
  return row.day;
}

/**
 * One entry per day in the window, oldest first — everything the heatmap draws. Days from
 * before you started using the app are left out rather than drawn as empty squares.
 */
export function history(userId: string, days: number): DayScore[] {
  const today = serverToday();
  const metrics = listMetrics(userId, true);
  const first = firstRecordedDay(userId);
  // Always show at least four weeks, even on a fresh install.
  const earliest = first && first > shiftDay(today, -days) ? first : shiftDay(today, -days);
  const start = earliest < shiftDay(today, -27) ? earliest : shiftDay(today, -27);

  const out: DayScore[] = [];
  for (let day = start; day <= today; day = shiftDay(day, 1)) {
    out.push(scoreFor(userId, day, metrics));
  }
  return out;
}

export type DayDetail = {
  score: DayScore;
  /** Todos that ended the day ticked off, deduplicated. */
  completed: ItemEvent[];
  /** Everything else that happened — added, deleted, expired at midnight. */
  events: ItemEvent[];
  metrics: Metric[];
  values: ReturnType<typeof valuesForDay>;
};

export function dayDetail(userId: string, day: string): DayDetail {
  const metrics = listMetrics(userId, true);
  return {
    score: scoreFor(userId, day, metrics),
    completed: netCompletedOnDay(userId, day),
    events: eventsOnDay(userId, day).filter(
      (e) => e.kind !== "completed" && e.kind !== "uncompleted"
    ),
    metrics,
    values: valuesForDay(userId, day),
  };
}
