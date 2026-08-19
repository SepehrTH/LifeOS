"use client";

import { useEffect, useRef, useState } from "react";
import type { Block } from "@/lib/useBoard";

const MIN_W = 200;
const MIN_H = 110;
const HEAD_H = 39;

export default function Window({
  block,
  tag,
  accent,
  renameToken = 0,
  onChange,
  onFocus,
  onMenu,
  children,
}: {
  block: Block;
  tag?: string;
  /** Project accent shown as a bullet before the title. */
  accent?: string;
  /** Bump to put the title into edit mode from outside (context menu → Rename). */
  renameToken?: number;
  onChange: (patch: Partial<Block>) => void;
  onFocus: () => void;
  onMenu: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [dragging, setDragging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleRef.current?.select();
  }, [editingTitle]);

  useEffect(() => {
    if (renameToken > 0) setEditingTitle(true);
  }, [renameToken]);

  function startDrag(e: React.PointerEvent) {
    if (e.button !== 0 || editingTitle) return;
    if ((e.target as HTMLElement).closest("button, input")) return;
    e.preventDefault();
    onFocus();
    setDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = block.x;
    const originY = block.y;

    const move = (ev: PointerEvent) => {
      onChange({
        x: Math.max(0, originX + (ev.clientX - startX)),
        y: Math.max(0, originY + (ev.clientY - startY)),
      });
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent, axis: "x" | "y" | "both") {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const originW = block.w;
    const originH = block.h;

    const move = (ev: PointerEvent) => {
      const patch: Partial<Block> = {};
      if (axis !== "y") patch.w = Math.max(MIN_W, originW + (ev.clientX - startX));
      if (axis !== "x") patch.h = Math.max(MIN_H, originH + (ev.clientY - startY));
      onChange(patch);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <section
      className="win"
      data-dragging={dragging ? "true" : undefined}
      data-minimized={block.minimized ? "true" : undefined}
      style={{
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.minimized ? HEAD_H : block.h,
        zIndex: block.z,
      }}
      onPointerDown={onFocus}
      onContextMenu={onMenu}
    >
      <header className="win-head" onPointerDown={startDrag} onDoubleClick={() => setEditingTitle(true)}>
        {accent ? <span className="dot" style={{ background: accent }} /> : null}
        {editingTitle ? (
          <input
            ref={titleRef}
            className="win-title"
            defaultValue={block.title}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && value !== block.title) onChange({ title: value });
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <span className="win-title" title={block.title}>
            {block.title}
          </span>
        )}

        {tag ? <span className="tag">{tag}</span> : null}

        <button
          className="win-btn"
          title={block.minimized ? "Expand" : "Minimize"}
          onClick={() => onChange({ minimized: !block.minimized })}
        >
          {block.minimized ? "+" : "–"}
        </button>
        <button className="win-btn" title="Menu" onClick={(e) => onMenu(e)}>
          ⋯
        </button>
      </header>

      {!block.minimized ? (
        <>
          {children}
          <div className="win-resize-e" onPointerDown={(e) => startResize(e, "x")} />
          <div className="win-resize-s" onPointerDown={(e) => startResize(e, "y")} />
          <div className="win-resize" onPointerDown={(e) => startResize(e, "both")} />
        </>
      ) : null}
    </section>
  );
}
