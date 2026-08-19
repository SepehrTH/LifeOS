"use client";

import { useEffect, useRef, useState } from "react";
import ItemText from "@/components/ItemText";
import { dueLabel, dueTone } from "@/lib/dates";
import type { Block, Item, ItemPatch } from "@/lib/useBoard";

export default function TodoWindow({
  block,
  adding,
  onStartAdd,
  onStopAdd,
  onAddItem,
  onPatchItem,
  onRemoveItem,
  onItemMenu,
  showOrigin = true,
}: {
  block: Block;
  adding: boolean;
  onStartAdd: () => void;
  onStopAdd: () => void;
  onAddItem: (text: string) => void;
  onPatchItem: (itemId: string, patch: ItemPatch) => void;
  onRemoveItem: (itemId: string) => void;
  onItemMenu: (e: React.MouseEvent, item: Item) => void;
  /** A project's own board colours everything the same, so the dots are just noise there. */
  showOrigin?: boolean;
}) {
  const daily = block.kind === "daily";
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) draftRef.current?.focus();
  }, [adding]);

  function commitDraft(keepOpen: boolean) {
    const text = draft.trim();
    if (text) onAddItem(text);
    setDraft("");
    if (!keepOpen) onStopAdd();
  }

  return (
    <div className="win-body">
      {block.items.length === 0 && !adding ? (
        <p className="win-empty">
          {daily
            ? "Right-click for “Add todo”. Mark one ↻ to keep it every day."
            : "Right-click for “Add todo”."}
        </p>
      ) : null}

      <ul className="todo-list">
        {block.items.map((item) => (
          <li
            className="todo"
            key={item.id}
            data-done={item.done ? "true" : undefined}
            data-recurring={daily && item.recurring ? "true" : undefined}
            data-linked={showOrigin && item.origin ? "true" : undefined}
            onContextMenu={(e) => onItemMenu(e, item)}
            style={
              showOrigin && item.origin
                ? ({ "--accent": item.origin.color } as React.CSSProperties)
                : undefined
            }
          >
            <input
              className="todo-check"
              type="checkbox"
              checked={item.done}
              onChange={(e) => onPatchItem(item.id, { done: e.target.checked })}
            />
            {showOrigin && item.origin ? (
              <span
                className="dot"
                style={{ background: item.origin.color }}
                title={`From ${item.origin.title}`}
              />
            ) : null}
            {!showOrigin && item.origin?.milestone ? (
              <span className="map-star" title="Milestone">
                ★
              </span>
            ) : null}
            <ItemText value={item.text} onCommit={(text) => onPatchItem(item.id, { text })} />
            {item.dueAt ? (
              <span className="due-chip" data-tone={dueTone(item.dueAt)} title={item.dueAt}>
                {dueLabel(item.dueAt)}
              </span>
            ) : null}
            {daily ? (
              <button
                className={item.recurring ? "todo-flag" : "todo-flag todo-del"}
                title={
                  item.recurring
                    ? "Recurring — comes back tomorrow. Click to make it one-off."
                    : "One-off — clears tomorrow. Click to make it recurring."
                }
                onClick={() => onPatchItem(item.id, { recurring: !item.recurring })}
              >
                ↻
              </button>
            ) : null}
            <button
              className="todo-del"
              title="Delete"
              onClick={() => onRemoveItem(item.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="todo">
          <input className="todo-check" type="checkbox" disabled />
          <input
            ref={draftRef}
            className="todo-text"
            placeholder="New todo…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraft(true);
              if (e.key === "Escape") {
                setDraft("");
                onStopAdd();
              }
            }}
            onBlur={() => commitDraft(false)}
          />
        </div>
      ) : (
        <button className="win-add" onClick={onStartAdd}>
          + Add todo
        </button>
      )}
    </div>
  );
}
