"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, BlockKind, Item, ProgressMode } from "./blocks";

export type { Block, BlockKind, Item, ProgressMode };

export type ItemPatch = {
  text?: string;
  done?: boolean;
  recurring?: boolean;
  milestone?: boolean;
  /** Local YYYY-MM-DD, or "" to clear the deadline. */
  dueAt?: string;
};

export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type BlockPatch = Partial<
  Pick<
    Block,
    | "title"
    | "description"
    | "content"
    | "x"
    | "y"
    | "w"
    | "h"
    | "z"
    | "minimized"
    | "progress"
    | "progressMode"
  >
>;

/** `tab` is "todo", "projects", or a project's own board: `project:<id>`. */
export function useBoard(tab: string) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const pending = useRef<Map<string, BlockPatch>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/blocks?tab=${tab}&today=${localToday()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    setBlocks(data.blocks as Block[]);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  /* Pick up changes made on a project page while this tab was in the background. */
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  /* Roll the daily boxes over when the clock passes midnight while the tab is open. */
  useEffect(() => {
    let day = localToday();
    const id = setInterval(() => {
      const now = localToday();
      if (now !== day) {
        day = now;
        load();
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const flush = useCallback(() => {
    const entries = [...pending.current.entries()];
    pending.current.clear();
    for (const [id, patch] of entries) {
      fetch(`/api/blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }
  }, []);

  /** Optimistic block update; the server write is batched. */
  const patchBlock = useCallback(
    (id: string, patch: BlockPatch) => {
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
      pending.current.set(id, { ...pending.current.get(id), ...patch });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush]
  );

  useEffect(() => {
    const onLeave = () => flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      flush();
    };
  }, [flush]);

  const bringToFront = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        const top = prev.reduce((m, b) => Math.max(m, b.z), 0);
        const target = prev.find((b) => b.id === id);
        if (!target || target.z === top) return prev;
        pending.current.set(id, { ...pending.current.get(id), z: top + 1 });
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 400);
        return prev.map((b) => (b.id === id ? { ...b, z: top + 1 } : b));
      });
    },
    [flush]
  );

  const addBlock = useCallback(
    async (input: {
      kind: BlockKind;
      title: string;
      x: number;
      y: number;
      content?: string;
    }) => {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, today: localToday(), ...input }),
      });
      if (!res.ok) return null;
      const { block } = (await res.json()) as { block: Block };
      setBlocks((prev) => [...prev, block]);
      return block;
    },
    [tab]
  );

  const removeBlock = useCallback(async (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    pending.current.delete(id);
    await fetch(`/api/blocks/${id}`, { method: "DELETE" });
  }, []);

  const addItem = useCallback(async (blockId: string, text: string, flags: ItemPatch = {}) => {
    const res = await fetch(`/api/blocks/${blockId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...flags }),
    });
    if (!res.ok) return;
    const { item } = await res.json();
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, items: [...b.items, item] } : b))
    );
  }, []);

  const patchItem = useCallback(
    async (itemId: string, patch: ItemPatch) => {
      setBlocks((prev) =>
        prev.map((b) => ({
          ...b,
          items: b.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
        }))
      );
      await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    []
  );

  const removeItem = useCallback(async (itemId: string) => {
    setBlocks((prev) =>
      prev.map((b) => ({ ...b, items: b.items.filter((i) => i.id !== itemId) }))
    );
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
  }, []);

  return {
    blocks,
    loading,
    reload: load,
    addBlock,
    patchBlock,
    removeBlock,
    bringToFront,
    addItem,
    patchItem,
    removeItem,
  };
}
