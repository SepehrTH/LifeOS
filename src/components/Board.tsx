"use client";

import { useRef } from "react";
import type { Block } from "@/lib/useBoard";

export type Point = { x: number; y: number };

export default function Board({
  blocks,
  empty,
  onBackgroundMenu,
  children,
}: {
  blocks: Block[];
  empty?: string;
  onBackgroundMenu?: (e: React.MouseEvent, point: Point) => void;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Canvas grows to hold every block, plus room to drag into. Empty boards just fill the view. */
  const width = blocks.length ? Math.max(1200, ...blocks.map((b) => b.x + b.w + 160)) : undefined;
  const height = blocks.length
    ? Math.max(800, ...blocks.map((b) => b.y + (b.minimized ? 40 : b.h) + 160))
    : undefined;

  function toPoint(e: React.MouseEvent): Point {
    const wrap = wrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + wrap.scrollLeft,
      y: e.clientY - rect.top + wrap.scrollTop,
    };
  }

  return (
    <div className="board-wrap" ref={wrapRef}>
      <div
        className="board"
        style={{ width, height }}
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          onBackgroundMenu?.(e, toPoint(e));
        }}
      >
        {blocks.length === 0 && empty ? <div className="board-empty">{empty}</div> : null}
        {children}
      </div>
    </div>
  );
}
