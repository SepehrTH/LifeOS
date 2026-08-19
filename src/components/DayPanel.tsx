"use client";

import { useEffect, useState } from "react";
import { VOLUME_BONUS, type DayScore } from "@/lib/scoring";
import type { Metric, MetricValue } from "@/lib/metrics";
import type { ItemEvent } from "@/lib/events";

type Detail = {
  score: DayScore;
  completed: ItemEvent[];
  events: ItemEvent[];
  metrics: Metric[];
  values: MetricValue[];
};

const EVENT_LABEL: Record<string, string> = {
  completed: "Done",
  created: "Added",
  uncompleted: "Unchecked",
  deleted: "Deleted",
  expired: "Expired",
};

function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** What one square is made of: the arithmetic, the todos, and that day's check-in. */
export default function DayPanel({ day }: { day: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/history/day?day=${day}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live) setDetail(d);
      });
    return () => {
      live = false;
    };
  }, [day]);

  if (!detail) return <div className="day-panel" />;

  const { score, completed, events: other, metrics, values } = detail;
  const parts = [
    ...score.parts
      .filter((p) => p.share > 0)
      .map((p) => ({
        label: p.name,
        value: p.points,
        of: p.share,
        blank: p.value === null,
        color: p.color,
      })),
    {
      label: "Volume bonus",
      value: score.bonus,
      of: VOLUME_BONUS,
      blank: false,
      color: "",
    },
  ];

  return (
    <div className="day-panel">
      <div className="day-head">
        <h2>{longDate(day)}</h2>
        <span className="day-score" data-level={score.level}>
          {score.score === null ? "No check-in" : score.score}
        </span>
      </div>

      {score.score !== null ? (
        <ul className="score-parts">
          {parts.map((p) => (
            <li key={p.label} data-blank={p.blank ? "true" : undefined}>
              <span className="score-label">
                {p.label}
                {p.blank ? <em> not filled in</em> : null}
              </span>
              <span className="score-bar">
                <span
                  style={{
                    width: `${p.of > 0 ? (p.value / p.of) * 100 : 0}%`,
                    background: p.color || undefined,
                  }}
                />
              </span>
              <span className="score-num">
                {Math.round(p.value)}
                <em>/{Math.round(p.of)}</em>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="win-empty">
          Nothing was logged for this day, so it stays empty rather than counting as a zero.
        </p>
      )}

      <div className="day-cols">
        <section>
          <div className="rail-section">
            Completed <span className="rail-count">{completed.length}</span>
          </div>
          {completed.length === 0 ? (
            <p className="win-empty">Nothing ticked off.</p>
          ) : (
            <ul className="day-list">
              {completed.map((e) => (
                <li key={e.id} style={e.color ? ({ "--accent": e.color } as React.CSSProperties) : undefined}>
                  {e.color ? <span className="dot" style={{ background: e.color }} /> : null}
                  <span>{e.text}</span>
                  <em>{e.blockTitle}</em>
                </li>
              ))}
            </ul>
          )}

          {other.length > 0 ? (
            <>
              <div className="rail-section">Also that day</div>
              <ul className="day-list day-list-dim">
                {other.map((e) => (
                  <li key={e.id}>
                    <span>{e.text}</span>
                    <em>{EVENT_LABEL[e.kind] ?? e.kind}</em>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section>
          <div className="rail-section">Check-in</div>
          {values.length === 0 ? (
            <p className="win-empty">Not filled in.</p>
          ) : (
            <ul className="day-list">
              {metrics.map((m) => {
                const v = values.find((x) => x.metricId === m.id);
                if (!v || (v.num === null && !v.text)) return null;
                const shown =
                  m.type === "boolean"
                    ? v.num
                      ? "Yes"
                      : "No"
                    : m.type === "note"
                      ? v.text
                      : `${v.num}${m.type === "scale" ? ` / ${m.max}` : m.unit ? ` ${m.unit}` : ""}`;
                return (
                  <li key={m.id}>
                    {m.color ? <span className="dot" style={{ background: m.color }} /> : null}
                    <span>{m.name}</span>
                    <em>{shown}</em>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
