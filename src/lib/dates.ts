/** Shared date helpers for deadlines — everything is a local YYYY-MM-DD string. */

export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(dueAt: string): number {
  const [y, m, d] = dueAt.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - midnight.getTime()) / 86_400_000);
}

/** "Overdue 2d", "Today", "Tomorrow", "Fri", "12 Sep" — short enough for a chip. */
export function dueLabel(dueAt: string): string {
  if (!dueAt) return "";
  const diff = daysUntil(dueAt);
  if (diff < -1) return `${-diff}d late`;
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";

  const [y, m, d] = dueAt.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** How a deadline should read: late, today, soon, or just scheduled. */
export function dueTone(dueAt: string): "late" | "today" | "soon" | "later" {
  const diff = daysUntil(dueAt);
  if (diff < 0) return "late";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "later";
}
