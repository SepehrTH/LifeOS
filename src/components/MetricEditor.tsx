"use client";

import { useState } from "react";
import type { Metric, MetricType } from "@/lib/metrics";

const TYPES: Array<{ value: MetricType; label: string }> = [
  { value: "scale", label: "Scale" },
  { value: "boolean", label: "Yes / no" },
  { value: "number", label: "Number" },
  { value: "duration", label: "Duration" },
  { value: "note", label: "Note" },
];

/** Add, rename and remove the things you track. Built-ins can be renamed but not deleted. */
export default function MetricEditor({
  metrics,
  onCreate,
  onPatch,
  onDelete,
}: {
  metrics: Metric[];
  onCreate: (input: { name: string; type: MetricType; unit: string }) => void;
  onPatch: (id: string, patch: Partial<Metric>) => void;
  onDelete: (id: string) => void;
}) {
  // Weights are relative: what matters is each one's slice of their total.
  const totalWeight = metrics
    .filter((m) => m.weight > 0 && m.type !== "note")
    .reduce((sum, m) => sum + m.weight, 0);
  const [name, setName] = useState("");
  const [type, setType] = useState<MetricType>("scale");
  const [unit, setUnit] = useState("");

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), type, unit: unit.trim() });
    setName("");
    setUnit("");
  }

  const needsTarget = (m: Metric) => m.type === "number" || m.type === "duration";

  return (
    <div className="metric-editor">
      <p className="win-empty">
        Weights are relative — 45/20/15/20 and 9/4/3/4 behave identically. Each one&rsquo;s share
        of the total becomes its slice of the day&rsquo;s 100 points. Leave a weight at 0 to track
        something without letting it move the score.
      </p>

      <ul className="metric-list">
        {metrics.map((m) => (
          <li key={m.id} className="metric-row">
            <div className="metric-label">
              {m.color ? <span className="dot" style={{ background: m.color }} /> : null}
              <input
                className="metric-input"
                defaultValue={m.name}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== m.name) onPatch(m.id, { name: next });
                }}
              />
            </div>
            <span className="metric-type">
              {m.type === "auto"
                ? "Automatic"
                : TYPES.find((t) => t.value === m.type)?.label}
              {m.type === "scale" ? ` ${m.min}–${m.max}` : m.unit ? ` · ${m.unit}` : ""}
            </span>

            {needsTarget(m) ? (
              <label className="metric-target" title="Full marks at this value">
                target
                <input
                  className="metric-input metric-input-num"
                  type="number"
                  min={0}
                  defaultValue={m.target || ""}
                  placeholder="—"
                  onBlur={(e) => {
                    const next = Number(e.target.value) || 0;
                    if (next !== m.target) onPatch(m.id, { target: next });
                  }}
                />
              </label>
            ) : null}

            {m.type === "note" ? (
              <span className="metric-share">not scored</span>
            ) : (
              <label className="metric-weight" title="Relative weight in the day's score">
                <input
                  className="metric-input metric-input-num"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={m.weight}
                  onBlur={(e) => {
                    const next = Math.max(0, Number(e.target.value) || 0);
                    if (next !== m.weight) onPatch(m.id, { weight: next });
                  }}
                />
                <span className="metric-share">
                  {m.weight > 0 && totalWeight > 0
                    ? `${Math.round((m.weight / totalWeight) * 100)}%`
                    : "—"}
                </span>
              </label>
            )}
            {m.key ? (
              <span className="tag">built-in</span>
            ) : (
              <button
                className="todo-del"
                title="Delete metric and its history"
                onClick={() => {
                  if (confirm(`Delete “${m.name}” and everything logged for it?`)) onDelete(m.id);
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="metric-new">
        <input
          className="metric-input"
          placeholder="New metric — sleep, weight, pages read…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <select className="select" value={type} onChange={(e) => setType(e.target.value as MetricType)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {type === "number" || type === "duration" ? (
          <input
            className="metric-input metric-input-unit"
            placeholder="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        ) : null}
        <button className="btn" onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}
