/** Parsing and printing the durations the Focus tab deals in. */

/** Accepts "90", "1h30", "1.5h", "45m", "2 h 15" — returns minutes, or null if unreadable. */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const compound = text.match(/^(\d+(?:\.\d+)?)\s*h\s*(\d+(?:\.\d+)?)?\s*m?$/);
  if (compound) {
    return Math.round(Number(compound[1]) * 60 + Number(compound[2] ?? 0));
  }

  const single = text.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)?$/);
  if (!single) return null;

  const value = Number(single[1]);
  const unit = single[2] ?? "m";
  const minutes = unit.startsWith("h") ? value * 60 : value;
  return minutes > 0 ? Math.round(minutes) : null;
}

/** 95 → "1h 35m", 40 → "40m", 120 → "2h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Seconds → "12:34" / "1:02:03", for the running clock. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}
