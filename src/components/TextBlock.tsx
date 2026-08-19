"use client";

import { useEffect, useRef } from "react";
import type { Block } from "@/lib/useBoard";

const MIN_W = 120;

/** Loose text written straight onto a board — no window chrome around it. */
export default function TextBlock({
  block,
  autoFocus,
  onChange,
  onFocus,
  onMenu,
}: {
  block: Block;
  autoFocus?: boolean;
  onChange: (patch: Partial<Block>) => void;
  onFocus: () => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const autosize = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(autosize, [block.content, block.w]);

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus();
  }, [autoFocus]);

  function startDrag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = block.x;
    const originY = block.y;

    const move = (ev: PointerEvent) =>
      onChange({
        x: Math.max(0, originX + (ev.clientX - startX)),
        y: Math.max(0, originY + (ev.clientY - startY)),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const originW = block.w;

    const move = (ev: PointerEvent) =>
      onChange({ w: Math.max(MIN_W, originW + (ev.clientX - startX)) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className="text-block"
      style={{ left: block.x, top: block.y, width: block.w, zIndex: block.z }}
      onPointerDown={onFocus}
      onContextMenu={onMenu}
    >
      <div className="text-grip" onPointerDown={startDrag} title="Drag" />
      <textarea
        ref={areaRef}
        className="text-input"
        rows={1}
        placeholder="Type…"
        value={block.content}
        onChange={(e) => {
          onChange({ content: e.target.value });
          autosize();
        }}
      />
      <div className="text-resize" onPointerDown={startResize} />
    </div>
  );
}
