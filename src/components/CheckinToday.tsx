"use client";

import { useEffect, useState } from "react";
import type { Metric, MetricValue } from "@/lib/metrics";
import type { DayScore } from "@/lib/scoring";

/** The fifteen-second form: one row per metric, saved as you touch it. */
export default function CheckinToday({
  day,
  metrics,
  values,
  score,
  onSave,
}: {
  day: string;
  metrics: Metric[];
  values: MetricValue[];
  score: DayScore | null;
  onSave: (metricId: string, value: { num?: number | null; text?: string }) => void;
}) {
  const valueOf = (id: string) => values.find((v) => v.metricId === id);
  const shareOf = (id: string) => score?.parts.find((p) => p.metricId === id)?.share ?? 0;

  return (
    <div className="checkin">
      <div className="checkin-score">
        <span className="day-score" data-level={score?.level ?? -1}>
          {score?.score === null || !score ? "—" : score.score}
        </span>
        <div>
          <strong>Today&rsquo;s score</strong>
          <p>
            {score?.score === null
              ? "Fill anything in and the day stops being blank on the heatmap."
              : `${score?.done ?? 0} of ${score?.planned ?? 0} todos in your Today boxes.`}
          </p>
        </div>
      </div>

      <ul className="metric-list">
        {metrics.map((m) => (
          <li key={m.id} className="metric-row">
            <div className="metric-label">
              {m.color ? <span className="dot" style={{ background: m.color }} /> : null}
              <span>{m.name}</span>
              {m.unit ? <em>{m.unit}</em> : null}
              {shareOf(m.id) > 0 ? (
                <em className="metric-share">{Math.round(shareOf(m.id))} pts</em>
              ) : null}
            </div>
            {m.type === "auto" ? (
              <span className="metric-auto">
                {score && score.planned > 0
                  ? `${score.done}/${score.planned} · ${Math.round((score.done / score.planned) * 100)}%`
                  : "nothing planned"}
              </span>
            ) : (
              <MetricInput
                key={`${m.id}-${day}`}
                metric={m}
                value={valueOf(m.id)}
                onSave={(v) => onSave(m.id, v)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricInput({
  metric,
  value,
  onSave,
}: {
  metric: Metric;
  value: MetricValue | undefined;
  onSave: (value: { num?: number | null; text?: string }) => void;
}) {
  const [draft, setDraft] = useState(value?.num ?? null);
  const [text, setText] = useState(value?.text ?? "");

  useEffect(() => {
    setDraft(value?.num ?? null);
    setText(value?.text ?? "");
  }, [value?.num, value?.text]);

  if (metric.type === "scale") {
    const options: number[] = [];
    for (let n = metric.min; n <= metric.max; n++) options.push(n);
    return (
      <div className="scale">
        {options.map((n) => (
          <button
            key={n}
            data-active={draft === n ? "true" : undefined}
            onClick={() => {
              const next = draft === n ? null : n;
              setDraft(next);
              onSave({ num: next });
            }}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (metric.type === "boolean") {
    return (
      <div className="scale">
        <button
          data-active={draft === 1 ? "true" : undefined}
          onClick={() => {
            const next = draft === 1 ? null : 1;
            setDraft(next);
            onSave({ num: next });
          }}
        >
          Yes
        </button>
        <button
          data-active={draft === 0 ? "true" : undefined}
          onClick={() => {
            const next = draft === 0 ? null : 0;
            setDraft(next);
            onSave({ num: next });
          }}
        >
          No
        </button>
      </div>
    );
  }

  if (metric.type === "note") {
    return (
      <input
        className="metric-input"
        value={text}
        placeholder="…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave({ text })}
      />
    );
  }

  return (
    <input
      className="metric-input metric-input-num"
      type="number"
      inputMode="decimal"
      step={metric.type === "duration" ? 15 : "any"}
      value={draft ?? ""}
      placeholder={metric.type === "duration" ? "minutes" : metric.unit || "0"}
      onChange={(e) => setDraft(e.target.value === "" ? null : Number(e.target.value))}
      onBlur={() => onSave({ num: draft })}
    />
  );
}
