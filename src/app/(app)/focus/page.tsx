"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock, formatDuration, parseDuration } from "@/lib/duration";
import type { FocusSession } from "@/lib/focus";
import type { Block } from "@/lib/useBoard";

type Payload = {
  today: string;
  running: FocusSession | null;
  sessions: FocusSession[];
  totals: {
    today: number;
    week: number;
    byProject: Array<{ projectId: string; title: string; color: string; minutes: number }>;
  };
};

/** Local wall-clock timestamps come back as "YYYY-MM-DD HH:MM:SS". */
function parseLocal(stamp: string): number {
  return new Date(stamp.replace(" ", "T")).getTime();
}

export default function FocusPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [projects, setProjects] = useState<Block[]>([]);
  const [projectId, setProjectId] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const [manualTime, setManualTime] = useState("");
  const [manualDay, setManualDay] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualError, setManualError] = useState("");

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/focus", { cache: "no-store" });
    if (!res.ok) return;
    const payload = (await res.json()) as Payload;
    setData(payload);
    setManualDay((cur) => cur || payload.today);
    if (payload.running) setProjectId(payload.running.projectId);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/blocks?tab=projects&today=x", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setProjects((d.blocks as Block[]).filter((b) => b.kind === "project")));
  }, [load]);

  /* The running clock is derived from the session's start time, so a reload picks it up. */
  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    const running = data?.running;
    if (!running) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed((Date.now() - parseLocal(running.startedAt)) / 1000);
    update();
    tick.current = setInterval(update, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [data?.running]);

  async function send(body: Record<string, unknown>) {
    const res = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
    return res.ok;
  }

  async function remove(id: string) {
    await fetch(`/api/focus/${id}`, { method: "DELETE" });
    load();
  }

  function addManual() {
    const minutes = parseDuration(manualTime);
    if (!minutes) {
      setManualError("Try 90, 1h30 or 45m.");
      return;
    }
    setManualError("");
    setManualTime("");
    setManualNote("");
    send({ minutes, projectId, day: manualDay, note: manualNote });
  }

  const running = data?.running ?? null;
  const project = projects.find((p) => p.id === projectId);
  const sessions = data?.sessions ?? [];
  const week = data?.totals.byProject ?? [];
  const weekMax = Math.max(1, ...week.map((w) => w.minutes));

  return (
    <main className="page page-scroll">
      <div className="bar">
        <h1>Focus</h1>
        <span className="bar-sub">
          {formatDuration(data?.totals.today ?? 0)} today · {formatDuration(data?.totals.week ?? 0)}{" "}
          this week
        </span>
      </div>

      <section className="card focus-card">
        <div className="focus-clock" data-running={running ? "true" : undefined}>
          {running ? formatClock(elapsed) : "0:00"}
        </div>

        <div className="focus-controls">
          <select
            className="select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!!running}
            aria-label="Project"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {running ? (
            <>
              <button className="btn" onClick={() => send({ action: "stop" })}>
                Stop
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (confirm("Throw this session away?")) remove(running.id);
                }}
              >
                Discard
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => send({ action: "start", projectId })}>
              Start
            </button>
          )}

          {project ? (
            <span className="focus-on">
              <span className="dot" style={{ background: project.color }} />
              {project.title}
            </span>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="rail-section">Add time by hand</div>
        <div className="focus-manual">
          <input
            className="metric-input"
            placeholder="90, 1h30, 45m"
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
          />
          <input
            className="metric-input"
            type="date"
            value={manualDay}
            max={data?.today}
            onChange={(e) => setManualDay(e.target.value)}
          />
          <input
            className="metric-input focus-note"
            placeholder="Note (optional)"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
          />
          <button className="btn" onClick={addManual}>
            Add
          </button>
          {manualError ? <span className="focus-error">{manualError}</span> : null}
        </div>
        <p className="win-empty">
          Uses the project selected above — handy for the sessions you forgot to time.
        </p>
      </section>

      {week.length > 0 ? (
        <section className="card">
          <div className="rail-section">This week by project</div>
          <ul className="focus-bars">
            {week.map((w) => (
              <li key={w.projectId || "none"}>
                <span className="focus-bar-label">
                  {w.color ? <span className="dot" style={{ background: w.color }} /> : null}
                  {w.title}
                </span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{
                      width: `${(w.minutes / weekMax) * 100}%`,
                      background: w.color || undefined,
                    }}
                  />
                </span>
                <span className="focus-bar-value">{formatDuration(w.minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <div className="rail-section">
          Last 7 days <span className="rail-count">{sessions.length} sessions</span>
        </div>
        {sessions.length === 0 ? (
          <p className="win-empty">Nothing logged yet.</p>
        ) : (
          <ul className="day-list">
            {sessions.map((s) => (
              <li key={s.id}>
                {s.color ? <span className="dot" style={{ background: s.color }} /> : null}
                <span>
                  {s.projectTitle || "No project"}
                  {s.note ? <span className="deadline-where">{s.note}</span> : null}
                </span>
                <em>
                  {s.day}
                  {s.manual ? " · by hand" : ""}
                  {s.running ? " · running" : ` · ${formatDuration(s.minutes)}`}
                </em>
                <button className="todo-del" title="Delete session" onClick={() => remove(s.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
