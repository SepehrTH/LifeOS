"use client";

export type Point = { day: string; value: number | null };

/**
 * One metric over time. Hand-drawn SVG: a line for continuous metrics, bars for the
 * yes/no ones, gaps where nothing was logged.
 */
export default function Sparkline({
  points,
  color,
  bars = false,
  max,
  min = 0,
  height = 64,
}: {
  points: Point[];
  color: string;
  bars?: boolean;
  max?: number;
  min?: number;
  height?: number;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0) {
    return <p className="win-empty">Nothing logged yet.</p>;
  }

  const top = max ?? Math.max(...values, 1);
  const bottom = Math.min(min, ...values);
  const span = Math.max(1, top - bottom);
  const width = Math.max(points.length * 8, 120);
  const y = (v: number) => height - ((v - bottom) / span) * (height - 8) - 4;
  const x = (i: number) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width);

  if (bars) {
    const barW = Math.max(2, width / points.length - 2);
    return (
      <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {points.map((p, i) =>
          p.value ? (
            <rect
              key={p.day}
              x={x(i) - barW / 2}
              y={4}
              width={barW}
              height={height - 8}
              rx={1.5}
              fill={color}
              opacity={0.85}
            />
          ) : null
        )}
      </svg>
    );
  }

  // Break the line wherever a day is missing rather than interpolating over it.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  });
  if (current.length) segments.push(current.join(" "));

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      ))}
      {points.map((p, i) =>
        p.value === null ? null : (
          <circle key={p.day} cx={x(i)} cy={y(p.value)} r={1.8} fill={color} />
        )
      )}
    </svg>
  );
}
