"use client";

import { useCallback, useEffect, useState } from "react";
import DayPanel from "@/components/DayPanel";
import Heatmap, { HeatLegend } from "@/components/Heatmap";
import type { DayScore } from "@/lib/scoring";

export default function HomePage() {
  const [days, setDays] = useState<DayScore[]>([]);
  const [today, setToday] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/history?days=182", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { today: string; days: DayScore[] };
    setDays(data.days);
    setToday(data.today);
    setSelected((cur) => cur ?? data.today);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const heading = today
    ? new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <main className="page page-scroll">
      <div className="bar">
        <h1>{heading}</h1>
      </div>

      <section className="card">
        <Heatmap days={days} selected={selected} onSelect={setSelected} />
        <HeatLegend />
      </section>

      {selected ? <DayPanel day={selected} /> : null}
    </main>
  );
}
