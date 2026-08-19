"use client";

import { useCallback, useEffect, useState } from "react";
import CheckinInsights from "@/components/CheckinInsights";
import CheckinToday from "@/components/CheckinToday";
import MetricEditor from "@/components/MetricEditor";
import type { Metric, MetricType, MetricValue } from "@/lib/metrics";
import type { DayScore } from "@/lib/scoring";

type Inner = "today" | "insights" | "metrics";

export default function CheckinPage() {
  const [inner, setInner] = useState<Inner>("today");
  const [day, setDay] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [values, setValues] = useState<MetricValue[]>([]);
  const [score, setScore] = useState<DayScore | null>(null);

  const load = useCallback(async (forDay?: string) => {
    const res = await fetch(`/api/checkin${forDay ? `?day=${forDay}` : ""}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    setDay(data.day);
    setMetrics(data.metrics);
    setValues(data.values);
    setScore(data.score);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(metricId: string, value: { num?: number | null; text?: string }) {
    setValues((prev) => {
      const rest = prev.filter((v) => v.metricId !== metricId);
      const empty = (value.num === null || value.num === undefined) && !value.text;
      return empty
        ? rest
        : [...rest, { metricId, num: value.num ?? null, text: value.text ?? "" }];
    });

    const res = await fetch("/api/checkin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, metricId, ...value }),
    });
    if (res.ok) setScore((await res.json()).score);
  }

  async function createMetric(input: { name: string; type: MetricType; unit: string }) {
    const res = await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) load(day);
  }

  async function patchMetric(id: string, patch: Partial<Metric>) {
    await fetch(`/api/metrics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load(day);
  }

  async function deleteMetric(id: string) {
    await fetch(`/api/metrics/${id}`, { method: "DELETE" });
    load(day);
  }

  const heading = day
    ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <main className="page page-scroll">
      <div className="bar">
        <h1>Check-in</h1>
        <span className="bar-sub">{heading}</span>
        <div className="bar-actions">
          <div className="seg">
            <button data-active={inner === "today"} onClick={() => setInner("today")}>
              Today
            </button>
            <button data-active={inner === "insights"} onClick={() => setInner("insights")}>
              Insights
            </button>
            <button data-active={inner === "metrics"} onClick={() => setInner("metrics")}>
              Metrics
            </button>
          </div>
        </div>
      </div>

      {inner === "today" ? (
        <CheckinToday
          day={day}
          metrics={metrics}
          values={values}
          score={score}
          onSave={save}
        />
      ) : inner === "insights" ? (
        <CheckinInsights />
      ) : (
        <MetricEditor
          metrics={metrics}
          onCreate={createMetric}
          onPatch={patchMetric}
          onDelete={deleteMetric}
        />
      )}
    </main>
  );
}
