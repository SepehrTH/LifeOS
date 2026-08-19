"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localToday, type Block, type Item, type ItemPatch } from "./useBoard";

type ProjectPatch = Partial<
  Pick<Block, "title" | "description" | "content" | "progress" | "progressMode">
>;

/** Single-project version of useBoard: optimistic edits, batched writes. */
export function useProject(initial: Block) {
  const [project, setProject] = useState<Block>(initial);
  const [saving, setSaving] = useState(false);
  const pending = useRef<ProjectPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    await fetch(`/api/blocks/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }, [initial.id]);

  useEffect(() => {
    const onLeave = () => flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      flush();
    };
  }, [flush]);

  const patch = useCallback(
    (next: ProjectPatch, delay = 500) => {
      setProject((prev) => ({ ...prev, ...next }));
      pending.current = { ...pending.current, ...next };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush]
  );

  const addItem = useCallback(
    async (text: string, flags: ItemPatch = {}) => {
      const res = await fetch(`/api/blocks/${initial.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...flags }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: Item };
      setProject((prev) => ({ ...prev, items: [...prev.items, item] }));
    },
    [initial.id]
  );

  const patchItem = useCallback(async (itemId: string, next: ItemPatch) => {
    setProject((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, ...next } : i)),
    }));
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }, []);

  /** The Todo tab's boxes, fetched the first time a "send to" menu is opened. */
  const listTodoBoxes = useCallback(async (): Promise<Block[]> => {
    const res = await fetch(`/api/blocks?tab=todo&today=${localToday()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const { blocks } = (await res.json()) as { blocks: Block[] };
    return blocks.filter((b) => b.kind === "daily" || b.kind === "general");
  }, []);

  /** The groups on this project's own board. */
  const listMapGroups = useCallback(async (): Promise<Block[]> => {
    const res = await fetch(`/api/blocks?tab=project:${initial.id}&today=${localToday()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const { blocks } = (await res.json()) as { blocks: Block[] };
    return blocks.filter((b) => b.kind === "general");
  }, [initial.id]);

  /** Reload just the project's todos — used after the map changes something. */
  const reload = useCallback(async () => {
    const res = await fetch(`/api/blocks/${initial.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const { block } = (await res.json()) as { block: Block };
    // Keep anything typed but not yet saved; take everything else from the server.
    setProject({ ...block, ...pending.current });
  }, [initial.id]);

  /** Drag-to-reorder in the rail. */
  const reorder = useCallback(
    async (ids: string[]) => {
      setProject((prev) => {
        const byId = new Map(prev.items.map((i) => [i.id, i]));
        const moved = ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
        const rest = prev.items.filter((i) => !ids.includes(i.id));
        return { ...prev, items: [...moved, ...rest] };
      });
      await fetch(`/api/blocks/${initial.id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    [initial.id]
  );

  /** Sends a copy of a project todo to one of those boxes; the two stay linked. */
  const sendItem = useCallback(async (itemId: string, blockId: string) => {
    const res = await fetch(`/api/items/${itemId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId }),
    });
    if (!res.ok) return false;
    setProject((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, sent: true } : i)),
    }));
    return true;
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setProject((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) }));
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
  }, []);

  return {
    project,
    saving,
    patch,
    flush,
    addItem,
    patchItem,
    removeItem,
    listTodoBoxes,
    listMapGroups,
    sendItem,
    reload,
    reorder,
  };
}

/** Percentage shown for a project: derived from milestones, or the manual value. */
export function progressOf(project: Block): number {
  if (project.progressMode !== "milestones") return project.progress;
  const milestones = project.items.filter((i) => i.milestone);
  if (milestones.length === 0) return 0;
  return Math.round((milestones.filter((i) => i.done).length / milestones.length) * 100);
}
