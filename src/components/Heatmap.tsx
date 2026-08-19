"use client";

import type { DayScore } from "@/lib/scoring";

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayOfWeek(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * GitHub-style year grid. Weeks run left to right, Sunday at the top. A day with no
 * check-in is drawn as an outline rather than a colour — it is missing, not a zero.
 */
export default function Heatmap({
  days,
  selected,
  onSelect,
}: {
  days: DayScore[];
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  if (days.length === 0) return null;

  const leading = dayOfWeek(days[0].day);
  const columns = Math.ceil((leading + days.length) / 7);
  const width = columns * STEP;
  const height = 7 * STEP + 16;

  const monthLabels: Array<{ x: number; label: string }> = [];
  let lastMonth = -1;
  let lastX = -999;
  days.forEach((d, i) => {
    const month = Number(d.day.slice(5, 7)) - 1;
    const x = Math.floor((leading + i) / 7) * STEP;
    // One label per month, and never close enough to collide with the previous one.
    if (month !== lastMonth && dayOfWeek(d.day) <= 1 && x - lastX >= 26) {
      monthLabels.push({ x, label: MONTHS[month] });
      lastMonth = month;
      lastX = x;
    }
  });

  return (
    <div className="heat-scroll">
      <svg className="heat" width={width} height={height} role="img" aria-label="Daily history">
        {monthLabels.map((m) => (
          <text key={`${m.label}-${m.x}`} className="heat-month" x={m.x} y={10}>
            {m.label}
          </text>
        ))}

        {days.map((d, i) => {
          const index = leading + i;
          return (
            <rect
              key={d.day}
              className="heat-cell"
              data-level={d.level}
              data-selected={selected === d.day ? "true" : undefined}
              x={Math.floor(index / 7) * STEP}
              y={(index % 7) * STEP + 16}
              width={CELL}
              height={CELL}
              rx={3}
              onClick={() => onSelect(d.day)}
            >
              <title>
                {d.day}
                {d.score === null ? " · no check-in" : ` · ${d.score}`}
                {d.planned > 0 ? ` · ${d.done}/${d.planned} todos` : ""}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="heat-legend">
      <span>Less</span>
      {[0, 1, 2, 3, 4, 5].map((level) => (
        <span key={level} className="heat-swatch" data-level={level} />
      ))}
      <span>More</span>
      <span className="heat-legend-sep" />
      <span className="heat-swatch" data-level={-1} />
      <span>No check-in</span>
    </div>
  );
}
