"use client";

import { useEffect, useMemo, useState } from "react";
import Sparkline, { type Point } from "@/components/Sparkline";
import type { Metric } from "@/lib/metrics";
import type { DayScore } from "@/lib/scoring";
import { formatDuration } from "@/lib/duration";

type Payload = {
  days: DayScore[];
  metrics: Metric[];
  values: Array<{ metricId: string; day: string; num: number | null; text: string }>;
  focusByDay: Record<string, number>;
  focusByProject: Array<{ projectId: string; title: string; color: string; minutes: number }>;
};

const RANGES = [30, 60, 180];

/** Graphs over the check-in data: the score itself, then every metric being tracked. */
export default function CheckinInsights() {
  const [range, setRange] = useState(60);
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch(`/api/insights?days=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [range]);

  const summary = useMemo(() => {
    if (!data) return null;
    const scored = data.days.filter((d) => d.score !== null);
    const checkins = scored.length;
    const avg = checkins
      ? Math.round(scored.reduce((sum, d) => sum + (d.score ?? 0), 0) / checkins)
      : 0;
    const done = data.days.reduce((sum, d) => sum + d.done, 0);
    const deep = data.days.filter((d) =>
      d.parts.some((p) => p.key === "deep_work" && (p.value ?? 0) > 0)
    ).length;
    const focus = Object.values(data.focusByDay ?? {}).reduce((sum, m) => sum + m, 0);
    return { checkins, avg, done, deep, focus, total: data.days.length };
  }, [data]);

  if (!data || !summary) return <div className="checkin" />;

  const dayList = data.days.map((d) => d.day);
  const pointsFor = (metric: Metric): Point[] =>
    dayList.map((day) => {
      const v = data.values.find((x) => x.metricId === metric.id && x.day === day);
      return { day, value: v && v.num !== null ? v.num : null };
    });

  return (
    <div className="insights">
      <div className="insights-head">
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r} data-active={range === r} onClick={() => setRange(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="stat-row">
        <Stat label="Checked in" value={`${summary.checkins}/${summary.total}`} />
        <Stat label="Average score" value={summary.avg || "—"} />
        <Stat label="Todos done" value={summary.done} />
        <Stat label="Deep-work days" value={summary.deep} />
        <Stat label="Focus time" value={formatDuration(summary.focus)} />
      </div>

      <section className="card">
        <div className="rail-section">Daily score</div>
        <Sparkline
          points={data.days.map((d) => ({ day: d.day, value: d.score }))}
          color="#3fa66a"
          max={115}
          height={90}
        />
      </section>

      <section className="card">
        <div className="rail-section">Focus time</div>
        <Sparkline
          points={dayList.map((day) => ({ day, value: data.focusByDay?.[day] ?? null }))}
          color="#d9822b"
          height={72}
        />
      </section>

      <div className="insight-grid">
        {data.metrics.map((m) => (
          <section className="card" key={m.id}>
            <div className="rail-section">
              {m.color ? <span className="dot" style={{ background: m.color }} /> : null}
              {m.name}
              {m.unit ? <span className="rail-count">{m.unit}</span> : null}
            </div>
            <Sparkline
              points={pointsFor(m)}
              color={m.color || "#8c8c88"}
              bars={m.type === "boolean"}
              max={m.type === "scale" ? m.max : undefined}
              min={m.type === "scale" ? m.min - 1 : 0}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
