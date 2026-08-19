"use client";

import { useEffect, useRef, useState } from "react";

export type MenuEntry =
  | { type: "sep" }
  | { type: "label"; label: string }
  | { type: "item"; label: string; accent?: string; danger?: boolean; onSelect: () => void };

export type MenuState = { x: number; y: number; entries: MenuEntry[] } | null;

export default function ContextMenu({
  state,
  onClose,
}: {
  state: MenuState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!state) return;
    setPos({ x: state.x, y: state.y });
  }, [state]);

  /* Keep the menu inside the viewport. */
  useEffect(() => {
    if (!state || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.min(state.x, window.innerWidth - rect.width - 8);
    const y = Math.min(state.y, window.innerHeight - rect.height - 8);
    if (x !== state.x || y !== state.y) setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      className="menu"
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.entries.map((entry, i) =>
        entry.type === "sep" ? (
          <div className="menu-sep" key={`sep-${i}`} />
        ) : entry.type === "label" ? (
          <div className="menu-label" key={`label-${i}`}>
            {entry.label}
          </div>
        ) : (
          <button
            key={`${entry.label}-${i}`}
            className="menu-item"
            data-danger={entry.danger ? "true" : undefined}
            onClick={() => {
              entry.onSelect();
              onClose();
            }}
          >
            {entry.accent ? (
              <span className="dot" style={{ background: entry.accent }} />
            ) : null}
            {entry.label}
          </button>
        )
      )}
    </div>
  );
}
