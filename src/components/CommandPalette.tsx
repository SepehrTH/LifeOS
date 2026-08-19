"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Block } from "@/lib/useBoard";

type Command = {
  id: string;
  label: string;
  hint?: string;
  color?: string;
  run: () => void | Promise<void>;
};

const TABS = [
  { href: "/home", label: "Home" },
  { href: "/todo", label: "Todo" },
  { href: "/projects", label: "Projects" },
  { href: "/calendar", label: "Calendar" },
  { href: "/focus", label: "Focus" },
  { href: "/checkin", label: "Check-in" },
];

/**
 * ⌘K from anywhere: type a todo and pick the box it goes in, or jump somewhere. Loads the
 * boxes and projects the first time it opens, not on every page.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [boxes, setBoxes] = useState<Block[]>([]);
  const [projects, setProjects] = useState<Block[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [todo, proj] = await Promise.all([
      fetch("/api/blocks?tab=todo&today=x", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/blocks?tab=projects&today=x", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setBoxes((todo.blocks as Block[]).filter((b) => b.kind === "daily" || b.kind === "general"));
    setProjects((proj.blocks as Block[]).filter((b) => b.kind === "project"));
    setLoaded(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((was) => !was);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setNote("");
      setCursor(0);
      return;
    }
    inputRef.current?.focus();
    if (!loaded) load();
  }, [open, loaded, load]);

  const flash = (message: string) => {
    setNote(message);
    setQuery("");
    setTimeout(() => setOpen(false), 550);
  };

  async function addTodo(box: Block, text: string) {
    await fetch(`/api/blocks/${box.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    flash(`Added to ${box.title}`);
  }

  const commands = useMemo<Command[]>(() => {
    const text = query.trim();
    const lower = text.toLowerCase();

    if (text) {
      const capture: Command[] = boxes.map((box) => ({
        id: `add-${box.id}`,
        label: `Add “${text}” to ${box.title}`,
        hint: box.kind === "daily" ? "today" : "list",
        run: () => addTodo(box, text),
      }));

      const jumps: Command[] = [
        ...TABS.filter((t) => t.label.toLowerCase().includes(lower)).map((t) => ({
          id: `go-${t.href}`,
          label: `Go to ${t.label}`,
          hint: "tab",
          run: () => router.push(t.href),
        })),
        ...projects
          .filter((p) => p.title.toLowerCase().includes(lower))
          .map((p) => ({
            id: `proj-${p.id}`,
            label: p.title,
            hint: "project",
            color: p.color,
            run: () => router.push(`/projects/${p.id}`),
          })),
      ];

      return [...capture, ...jumps];
    }

    return [
      ...TABS.map((t) => ({
        id: `go-${t.href}`,
        label: `Go to ${t.label}`,
        hint: "tab",
        run: () => router.push(t.href),
      })),
      ...projects.map((p) => ({
        id: `proj-${p.id}`,
        label: p.title,
        hint: "project",
        color: p.color,
        run: () => router.push(`/projects/${p.id}`),
      })),
    ];
    // addTodo is stable enough for this list; it only closes over fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, boxes, projects, router]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const choose = (command: Command) => {
    const result = command.run();
    if (result instanceof Promise) return;
    setOpen(false);
  };

  return (
    <div className="palette-backdrop" onPointerDown={() => setOpen(false)}>
      <div className="palette" onPointerDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a todo, or jump somewhere…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(commands.length - 1, c + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            }
            if (e.key === "Enter" && commands[cursor]) {
              e.preventDefault();
              choose(commands[cursor]);
            }
          }}
        />

        {note ? <div className="palette-note">{note}</div> : null}

        <ul className="palette-list">
          {commands.length === 0 ? (
            <li className="palette-empty">Nothing matches.</li>
          ) : (
            commands.map((c, i) => (
              <li key={c.id}>
                <button
                  data-active={i === cursor ? "true" : undefined}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(c)}
                >
                  {c.color ? <span className="dot" style={{ background: c.color }} /> : null}
                  <span className="palette-label">{c.label}</span>
                  {c.hint ? <span className="tag">{c.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
