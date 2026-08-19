"use client";

import { useEffect, useRef } from "react";

export type DuePickerState = { x: number; y: number; itemId: string; dueAt: string } | null;

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Small popover for putting a deadline on a todo — quick picks plus a real date field. */
export default function DueDatePicker({
  state,
  onPick,
  onClose,
}: {
  state: DuePickerState;
  onPick: (itemId: string, dueAt: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const choose = (value: string) => {
    onPick(state.itemId, value);
    onClose();
  };

  const left = Math.min(state.x, (typeof window !== "undefined" ? window.innerWidth : 0) - 230);
  const top = Math.min(state.y, (typeof window !== "undefined" ? window.innerHeight : 0) - 190);

  return (
    <div className="due-pop" ref={ref} style={{ left: Math.max(8, left), top: Math.max(8, top) }}>
      <div className="menu-label">Due date</div>
      <button className="menu-item" onClick={() => choose(shift(0))}>
        Today
      </button>
      <button className="menu-item" onClick={() => choose(shift(1))}>
        Tomorrow
      </button>
      <button className="menu-item" onClick={() => choose(shift(7))}>
        Next week
      </button>
      <div className="menu-sep" />
      <input
        className="due-input"
        type="date"
        defaultValue={state.dueAt || shift(0)}
        onChange={(e) => e.target.value && choose(e.target.value)}
      />
      {state.dueAt ? (
        <>
          <div className="menu-sep" />
          <button className="menu-item" data-danger="true" onClick={() => choose("")}>
            Clear deadline
          </button>
        </>
      ) : null}
    </div>
  );
}
