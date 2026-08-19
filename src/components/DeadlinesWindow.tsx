"use client";

import { useCallback, useEffect, useState } from "react";
import { dueLabel, dueTone } from "@/lib/dates";
import type { Deadline } from "@/lib/blocks";

/**
 * Read-only roll-up of every todo that has a deadline, wherever it lives. Ticking one here
 * completes the underlying todo (and its linked copy, as usual).
 */
export default function DeadlinesWindow({ refreshKey }: { refreshKey: number }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/deadlines", { cache: "no-store" });
    if (!res.ok) return;
    const { deadlines } = (await res.json()) as { deadlines: Deadline[] };
    setDeadlines(deadlines);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function complete(itemId: string) {
    setDeadlines((prev) => prev.filter((d) => d.itemId !== itemId));
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
  }

  return (
    <div className="win-body">
      {loading ? null : deadlines.length === 0 ? (
        <p className="win-empty">
          No deadlines yet. Right-click any todo → <em>Set deadline</em>.
        </p>
      ) : null}

      <ul className="todo-list">
        {deadlines.map((d) => (
          <li
            className="todo deadline"
            key={d.itemId}
            style={d.color ? ({ "--accent": d.color } as React.CSSProperties) : undefined}
          >
            <input
              className="todo-check"
              type="checkbox"
              checked={false}
              onChange={() => complete(d.itemId)}
              title="Mark done"
            />
            {d.color ? <span className="dot" style={{ background: d.color }} /> : null}
            <span className="todo-text" title={d.where}>
              {d.text}
              {d.where ? <span className="deadline-where">{d.where}</span> : null}
            </span>
            <span className="due-chip" data-tone={dueTone(d.dueAt)}>
              {dueLabel(d.dueAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
