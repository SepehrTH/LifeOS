"use client";

import { useEffect, useRef } from "react";
import type { Block } from "@/lib/useBoard";

export default function ProjectWindow({
  block,
  editingDesc,
  onStopEditDesc,
  onChange,
  onOpen,
}: {
  block: Block;
  editingDesc: boolean;
  onStopEditDesc: () => void;
  onChange: (patch: Partial<Block>) => void;
  onOpen: () => void;
}) {
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingDesc) descRef.current?.focus();
  }, [editingDesc]);

  return (
    <div
      className="proj-body"
      onClick={(e) => {
        if (editingDesc) return;
        if ((e.target as HTMLElement).closest("textarea")) return;
        onOpen();
      }}
      title="Open project"
    >
      {editingDesc ? (
        <textarea
          ref={descRef}
          className="proj-desc"
          defaultValue={block.description}
          placeholder="Short description…"
          onKeyDown={(e) => {
            if (e.key === "Escape") onStopEditDesc();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== block.description) onChange({ description: next });
            onStopEditDesc();
          }}
        />
      ) : (
        <div className="proj-desc" onDoubleClick={onOpen}>
          {block.description || "No description yet."}
        </div>
      )}

      <div>
        <div className="proj-meta">
          <span>{block.progressMode === "milestones" ? "Milestones" : "Progress"}</span>
          <span>{block.progress}%</span>
        </div>
        <div className="bar-track" style={{ marginTop: 6 }}>
          <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, block.progress))}%` }} />
        </div>
      </div>
    </div>
  );
}
