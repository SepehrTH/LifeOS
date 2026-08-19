"use client";

import { useState } from "react";
import Board, { type Point } from "@/components/Board";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import DeadlinesWindow from "@/components/DeadlinesWindow";
import DueDatePicker, { type DuePickerState } from "@/components/DueDatePicker";
import TextBlock from "@/components/TextBlock";
import TodoWindow from "@/components/TodoWindow";
import Window from "@/components/Window";
import { useBoard, type Block, type BlockKind, type Item } from "@/lib/useBoard";

export default function TodoPage() {
  const board = useBoard("todo");
  const [menu, setMenu] = useState<MenuState>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [renameTokens, setRenameTokens] = useState<Record<string, number>>({});
  const [freshText, setFreshText] = useState<string | null>(null);
  const [duePicker, setDuePicker] = useState<DuePickerState>(null);
  // Bumped whenever a deadline changes, so the roll-up window refetches.
  const [deadlineTick, setDeadlineTick] = useState(0);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function nextSpot(): Point {
    const n = board.blocks.length;
    return { x: 60 + (n % 4) * 360, y: 60 + Math.floor(n / 4) * 200 };
  }

  async function newBox(kind: BlockKind, at?: Point) {
    const spot = at ?? nextSpot();
    const block = await board.addBlock({
      kind,
      title:
        kind === "daily"
          ? "Today"
          : kind === "text"
            ? "Text"
            : kind === "deadlines"
              ? "Deadlines"
              : "New list",
      x: spot.x,
      y: spot.y,
    });
    if (block && kind === "text") setFreshText(block.id);
  }

  /** Right-click on a single todo: deadline controls, plus delete. */
  function itemMenu(e: React.MouseEvent, item: Item) {
    e.preventDefault();
    e.stopPropagation();
    const at = { x: e.clientX, y: e.clientY };
    setMenu({
      ...at,
      entries: [
        {
          type: "item",
          label: item.dueAt ? "Change deadline…" : "Set deadline…",
          onSelect: () => setDuePicker({ ...at, itemId: item.id, dueAt: item.dueAt }),
        },
        ...(item.dueAt
          ? [
              {
                type: "item" as const,
                label: "Clear deadline",
                onSelect: () => setDue(item.id, ""),
              },
            ]
          : []),
        {
          type: "item",
          label: item.recurring ? "Make one-off" : "Make recurring",
          onSelect: () => board.patchItem(item.id, { recurring: !item.recurring }),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Delete todo",
          danger: true,
          onSelect: () => {
            board.removeItem(item.id);
            setDeadlineTick((n) => n + 1);
          },
        },
      ],
    });
  }

  function setDue(itemId: string, dueAt: string) {
    board.patchItem(itemId, { dueAt });
    setDeadlineTick((n) => n + 1);
  }

  function rename(id: string) {
    setRenameTokens((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function textMenu(e: React.MouseEvent, block: Block) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: [
        {
          type: "item",
          label: "Delete text",
          danger: true,
          onSelect: () => board.removeBlock(block.id),
        },
      ],
    });
  }

  function blockMenu(e: React.MouseEvent, block: Block) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: [
        {
          type: "item",
          label: "Add todo",
          onSelect: () => {
            if (block.minimized) board.patchBlock(block.id, { minimized: false });
            setAddingIn(block.id);
          },
        },
        { type: "item", label: "Rename box", onSelect: () => rename(block.id) },
        {
          type: "item",
          label: block.minimized ? "Expand" : "Minimize",
          onSelect: () => board.patchBlock(block.id, { minimized: !block.minimized }),
        },
        ...(block.kind === "daily" && block.items.some((i) => !i.recurring)
          ? [
              {
                type: "item" as const,
                label: "Make all recurring",
                onSelect: () => {
                  for (const item of block.items) {
                    if (!item.recurring) board.patchItem(item.id, { recurring: true });
                  }
                },
              },
            ]
          : []),
        ...(block.items.some((i) => i.done)
          ? [
              {
                type: "item" as const,
                label: "Clear completed",
                onSelect: () => {
                  for (const item of block.items) if (item.done) board.removeItem(item.id);
                },
              },
            ]
          : []),
        { type: "sep" },
        {
          type: "item",
          label: "Delete box",
          danger: true,
          onSelect: () => {
            if (confirm(`Delete “${block.title}” and its todos?`)) board.removeBlock(block.id);
          },
        },
      ],
    });
  }

  function backgroundMenu(e: React.MouseEvent, point: Point) {
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: [
        { type: "item", label: "Add todo box here", onSelect: () => newBox("general", point) },
        { type: "item", label: "Add today box here", onSelect: () => newBox("daily", point) },
        { type: "item", label: "Add deadlines here", onSelect: () => newBox("deadlines", point) },
        { type: "item", label: "Add text here", onSelect: () => newBox("text", point) },
      ],
    });
  }

  return (
    <main className="page">
      <div className="bar">
        <h1>Todo</h1>
        <span className="bar-sub">{today}</span>
        <div className="bar-actions">
          <button className="btn btn-ghost" onClick={() => newBox("text")}>
            Add text
          </button>
          <button className="btn btn-ghost" onClick={() => newBox("deadlines")}>
            Add deadlines
          </button>
          <button className="btn btn-ghost" onClick={() => newBox("daily")}>
            Add today box
          </button>
          <button className="btn" onClick={() => newBox("general")}>
            Add todo box
          </button>
        </div>
      </div>

      <Board
        blocks={board.blocks}
        empty={board.loading ? "" : "Add a todo box, or right-click the board."}
        onBackgroundMenu={backgroundMenu}
      >
        {board.blocks.map((block) =>
          block.kind === "text" ? (
            <TextBlock
              key={block.id}
              block={block}
              autoFocus={freshText === block.id}
              onChange={(patch) => board.patchBlock(block.id, patch)}
              onFocus={() => board.bringToFront(block.id)}
              onMenu={(e) => textMenu(e, block)}
            />
          ) : block.kind === "deadlines" ? (
            <Window
              key={block.id}
              block={block}
              tag="deadlines"
              renameToken={renameTokens[block.id] ?? 0}
              onChange={(patch) => board.patchBlock(block.id, patch)}
              onFocus={() => board.bringToFront(block.id)}
              onMenu={(e) => blockMenu(e, block)}
            >
              <DeadlinesWindow refreshKey={deadlineTick} />
            </Window>
          ) : (
            <Window
              key={block.id}
              block={block}
              tag={block.kind === "daily" ? "today" : undefined}
              renameToken={renameTokens[block.id] ?? 0}
              onChange={(patch) => board.patchBlock(block.id, patch)}
              onFocus={() => board.bringToFront(block.id)}
              onMenu={(e) => blockMenu(e, block)}
            >
              <TodoWindow
                block={block}
                adding={addingIn === block.id}
                onStartAdd={() => setAddingIn(block.id)}
                onStopAdd={() => setAddingIn((cur) => (cur === block.id ? null : cur))}
                onAddItem={(text) => board.addItem(block.id, text)}
                onPatchItem={(itemId, patch) => {
                  board.patchItem(itemId, patch);
                  if (patch.done !== undefined) setDeadlineTick((n) => n + 1);
                }}
                onRemoveItem={board.removeItem}
                onItemMenu={itemMenu}
              />
            </Window>
          )
        )}
      </Board>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      <DueDatePicker state={duePicker} onPick={setDue} onClose={() => setDuePicker(null)} />
    </main>
  );
}
