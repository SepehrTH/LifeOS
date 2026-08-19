"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ContextMenu, { type MenuEntry, type MenuState } from "@/components/ContextMenu";
import ItemText from "@/components/ItemText";
import ProjectMap from "@/components/ProjectMap";
import DueDatePicker, { type DuePickerState } from "@/components/DueDatePicker";
import { dueLabel, dueTone } from "@/lib/dates";
import { renderMarkdown } from "@/lib/markdown";
import type { Block, Item, ItemPatch } from "@/lib/useBoard";
import { progressOf, useProject } from "@/lib/useProject";

const RAIL_KEY = "os.project.rail";
const MIN_RAIL = 190;
const MAX_RAIL = 560;

export default function ProjectWorkspace({ initial }: { initial: Block }) {
  const {
    project,
    saving,
    patch,
    addItem,
    patchItem,
    removeItem,
    listTodoBoxes,
    listMapGroups,
    sendItem,
    reload,
    reorder,
  } = useProject(initial);
  const [railWidth, setRailWidth] = useState(300);
  const [preview, setPreview] = useState(false);
  const [pane, setPane] = useState<"notes" | "map">("notes");
  // Bumped whenever the rail changes something the map should re-read.
  const [mapKey, setMapKey] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [duePicker, setDuePicker] = useState<DuePickerState>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const accent = project.color || undefined;

  /** Right-clicking a todo offers to copy it into any box on the Todo tab. */
  async function todoMenu(e: React.MouseEvent, item: Item) {
    e.preventDefault();
    const at = { x: e.clientX, y: e.clientY };

    const base: MenuEntry[] = [
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
              onSelect: () => patchItem(item.id, { dueAt: "" }),
            },
          ]
        : []),
      {
        type: "item",
        label: item.milestone ? "Remove as milestone" : "Mark as milestone",
        onSelect: () => patchItem(item.id, { milestone: !item.milestone }),
      },
      {
        type: "item",
        label: "Delete todo",
        danger: true,
        onSelect: () => removeItem(item.id),
      },
    ];

    setMenu({ ...at, entries: [{ type: "label", label: "Loading boxes…" }, ...base] });

    const [boxes, groups] = await Promise.all([listTodoBoxes(), listMapGroups()]);

    const sendEntries: MenuEntry[] =
      boxes.length === 0
        ? [{ type: "label", label: "No todo boxes yet" }]
        : boxes.map((box) => ({
            type: "item" as const,
            label: box.title,
            accent,
            onSelect: () => sendItem(item.id, box.id),
          }));

    const groupEntries: MenuEntry[] = groups.map((group) => ({
      type: "item" as const,
      label: group.title,
      accent,
      onSelect: async () => {
        await sendItem(item.id, group.id);
        setPane("map");
        setMapKey((n) => n + 1);
      },
    }));

    setMenu({
      ...at,
      entries: [
        ...(groupEntries.length > 0
          ? ([{ type: "label", label: "Put on the map" }, ...groupEntries, { type: "sep" }] as MenuEntry[])
          : []),
        { type: "label", label: "Send a copy to" },
        ...sendEntries,
        { type: "sep" },
        ...base,
      ],
    });
  }

  /* Rail edits can change what the map shows, so nudge it after each one. */
  const railPatch = (id: string, patch: ItemPatch) => {
    patchItem(id, patch);
    setMapKey((n) => n + 1);
  };

  const railRemove = (id: string) => {
    removeItem(id);
    setMapKey((n) => n + 1);
  };

  /**
   * Reordering by dragging a row. The list reorders live under the cursor and the final
   * order is written once, on release.
   */
  function startRowDrag(e: React.PointerEvent, id: string, section: Item[]) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, textarea, input")) return;
    e.preventDefault();
    setDragId(id);

    const list = section.map((i) => i.id);
    let order = [...list];

    const move = (ev: PointerEvent) => {
      const rows = document.querySelectorAll<HTMLElement>(".rail .todo[data-id]");
      const positions = [...rows]
        .filter((row) => list.includes(row.dataset.id ?? ""))
        .map((row) => ({ id: row.dataset.id!, mid: row.getBoundingClientRect().top + row.offsetHeight / 2 }));

      const target = positions.findIndex((p) => ev.clientY < p.mid);
      const to = target === -1 ? positions.length - 1 : target;
      const from = order.indexOf(id);
      if (to === from || to < 0) return;

      order = order.filter((x) => x !== id);
      order.splice(to, 0, id);
      setDragOrder([...order]);
    };

    const up = () => {
      setDragId(null);
      setDragOrder(null);
      if (order.join() !== list.join()) reorder(order);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  useEffect(() => {
    const saved = Number(localStorage.getItem(RAIL_KEY));
    if (saved >= MIN_RAIL && saved <= MAX_RAIL) setRailWidth(saved);
  }, []);

  const milestoneMode = project.progressMode === "milestones";
  const percent = progressOf(project);
  const inDragOrder = (items: Item[]) => {
    if (!dragOrder) return items;
    const known = new Set(items.map((i) => i.id));
    if (!dragOrder.every((id) => known.has(id))) return items;
    const byId = new Map(items.map((i) => [i.id, i]));
    return dragOrder.map((id) => byId.get(id)!).filter(Boolean);
  };

  const milestones = inDragOrder(project.items.filter((i) => i.milestone));
  const rest = inDragOrder(project.items.filter((i) => !i.milestone));

  function startRailDrag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const origin = railWidth;

    const move = (ev: PointerEvent) =>
      setRailWidth(Math.min(MAX_RAIL, Math.max(MIN_RAIL, origin + (ev.clientX - startX))));
    const up = (ev: PointerEvent) => {
      const final = Math.min(MAX_RAIL, Math.max(MIN_RAIL, origin + (ev.clientX - startX)));
      localStorage.setItem(RAIL_KEY, String(Math.round(final)));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const setFromPointer = useCallback(
    (clientX: number, track: HTMLElement) => {
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      patch({ progress: Math.min(100, Math.max(0, Math.round(ratio * 100))) }, 250);
    },
    [patch]
  );

  function startProgressDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (milestoneMode || e.button !== 0) return;
    const track = e.currentTarget;
    setFromPointer(e.clientX, track);

    const move = (ev: PointerEvent) => setFromPointer(ev.clientX, track);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const html = useMemo(
    () => (preview ? renderMarkdown(project.content) : ""),
    [preview, project.content]
  );

  return (
    <main className="page">
      <div className="bar">
        <h1>
          {accent ? <span className="dot dot-lg" style={{ background: accent }} /> : null}
          {project.title}
        </h1>
        <span className="bar-sub">{project.description || "No description yet."}</span>
        <div className="bar-actions">
          <Link className="btn btn-ghost" href="/projects">
            Back to board
          </Link>
        </div>
      </div>

      <div className="proj-progress">
        <div className="seg">
          <button
            data-active={!milestoneMode}
            onClick={() => patch({ progressMode: "manual" }, 0)}
            title="Set the percentage yourself"
          >
            Manual
          </button>
          <button
            data-active={milestoneMode}
            onClick={() => patch({ progressMode: "milestones" }, 0)}
            title="Derive it from completed milestones"
          >
            Milestones
          </button>
        </div>

        <div className="prog-drag">
          <div
            className="prog-track"
            data-locked={milestoneMode ? "true" : undefined}
            onPointerDown={startProgressDrag}
            title={milestoneMode ? "Set by milestones" : "Drag to set progress"}
          >
            <div className="prog-fill" style={{ width: `${percent}%` }} />
            {!milestoneMode ? <div className="prog-knob" style={{ left: `${percent}%` }} /> : null}
          </div>
          <span className="prog-value">
            {percent}%
            {milestoneMode
              ? ` · ${milestones.filter((m) => m.done).length}/${milestones.length}`
              : ""}
          </span>
        </div>
      </div>

      <div className="split" ref={splitRef}>
        <aside className="rail" style={{ width: railWidth }}>
          <div className="rail-head">
            Todo
            <span className="rail-count">
              {project.items.filter((i) => !i.done).length} open
            </span>
          </div>
          <div className="rail-body">
            {project.items.length === 0 ? (
              <p className="win-empty">
                Nothing yet. Add todos below, and star the ones that are stepping stones.
              </p>
            ) : null}

            {milestones.length > 0 ? (
              <>
                <div className="rail-section">Milestones</div>
                <ul className="todo-list">
                  {milestones.map((item) => (
                    <TodoRow
                      key={item.id}
                      item={item}
                      accent={accent}
                      onPatch={railPatch}
                      onRemove={railRemove}
                      onMenu={todoMenu}
                      onDragStart={(e) => startRowDrag(e, item.id, milestones)}
                      dragging={dragId === item.id}
                    />
                  ))}
                </ul>
                {rest.length > 0 ? <div className="rail-section">Todos</div> : null}
              </>
            ) : null}

            <ul className="todo-list">
              {rest.map((item) => (
                <TodoRow
                  key={item.id}
                  item={item}
                  accent={accent}
                  onPatch={railPatch}
                  onRemove={railRemove}
                  onMenu={todoMenu}
                  onDragStart={(e) => startRowDrag(e, item.id, rest)}
                  dragging={dragId === item.id}
                />
              ))}
            </ul>

            <AddTodo onAdd={addItem} />
          </div>
        </aside>

        <div className="split-handle" onPointerDown={startRailDrag} />

        <section className="md">
          <div className="md-head">
            <div className="seg">
              <button data-active={pane === "notes"} onClick={() => setPane("notes")}>
                Notes
              </button>
              <button data-active={pane === "map"} onClick={() => setPane("map")}>
                Map
              </button>
            </div>

            {pane === "notes" ? (
              <>
                <div className="seg">
                  <button data-active={!preview} onClick={() => setPreview(false)}>
                    Write
                  </button>
                  <button data-active={preview} onClick={() => setPreview(true)}>
                    Preview
                  </button>
                </div>
                <span className="md-status">{saving ? "Saving…" : "Saved"}</span>
              </>
            ) : null}
          </div>

          {pane === "map" ? (
            <ProjectMap
              projectId={project.id}
              reloadKey={mapKey}
              onItemsChanged={reload}
            />
          ) : preview ? (
            project.content.trim() ? (
              <div className="md-view" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div className="md-view md-empty">Nothing written yet.</div>
            )
          ) : (
            <textarea
              className="md-area"
              value={project.content}
              placeholder={"# Notes\n\nMarkdown goes here — everything about this project."}
              onChange={(e) => patch({ content: e.target.value })}
              spellCheck={false}
            />
          )}
        </section>
      </div>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      <DueDatePicker
        state={duePicker}
        onPick={(itemId, dueAt) => patchItem(itemId, { dueAt })}
        onClose={() => setDuePicker(null)}
      />
    </main>
  );
}

function TodoRow({
  item,
  accent,
  dragging,
  onPatch,
  onRemove,
  onMenu,
  onDragStart,
}: {
  item: Item;
  accent?: string;
  dragging?: boolean;
  onPatch: (id: string, patch: ItemPatch) => void;
  onRemove: (id: string) => void;
  onMenu: (e: React.MouseEvent, item: Item) => void;
  onDragStart: (e: React.PointerEvent) => void;
}) {
  return (
    <li
      className="todo todo-draggable"
      data-id={item.id}
      data-done={item.done ? "true" : undefined}
      data-milestone={item.milestone ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
      onContextMenu={(e) => onMenu(e, item)}
    >
      <span
        className="row-grip"
        title="Drag to reorder"
        onPointerDown={onDragStart}
        aria-hidden="true"
      >
        ⠿
      </span>
      <input
        className="todo-check"
        type="checkbox"
        checked={item.done}
        onChange={(e) => onPatch(item.id, { done: e.target.checked })}
      />
      <ItemText value={item.text} onCommit={(text) => onPatch(item.id, { text })} />
      {item.dueAt ? (
        <span className="due-chip" data-tone={dueTone(item.dueAt)} title={item.dueAt}>
          {dueLabel(item.dueAt)}
        </span>
      ) : null}
      {item.sent ? (
        <span className="todo-sent" title="Also on the map or the Todo tab — ticks off in both">
          ↗
        </span>
      ) : null}
      <button
        className="milestone-star"
        title={item.milestone ? "Remove as milestone" : "Mark as milestone"}
        onClick={() => onPatch(item.id, { milestone: !item.milestone })}
      >
        {item.milestone ? "★" : "☆"}
      </button>
      <button className="todo-del" title="Delete" onClick={() => onRemove(item.id)}>
        ×
      </button>
    </li>
  );
}

function AddTodo({ onAdd }: { onAdd: (text: string, flags?: { milestone?: boolean }) => void }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  function commit(keepOpen: boolean) {
    const text = draft.trim();
    if (text) onAdd(text);
    setDraft("");
    if (!keepOpen) setOpen(false);
  }

  if (!open) {
    return (
      <button className="win-add" onClick={() => setOpen(true)}>
        + Add todo
      </button>
    );
  }

  return (
    <div className="todo">
      <input className="todo-check" type="checkbox" disabled />
      <input
        ref={ref}
        className="todo-text"
        placeholder="New todo…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(true);
          if (e.key === "Escape") {
            setDraft("");
            setOpen(false);
          }
        }}
        onBlur={() => commit(false)}
      />
    </div>
  );
}
