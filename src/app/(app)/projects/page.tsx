"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Board, { type Point } from "@/components/Board";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import ProjectWindow from "@/components/ProjectWindow";
import TextBlock from "@/components/TextBlock";
import Window from "@/components/Window";
import { useBoard, type Block } from "@/lib/useBoard";

export default function ProjectsPage() {
  const board = useBoard("projects");
  const router = useRouter();
  const [menu, setMenu] = useState<MenuState>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [renameTokens, setRenameTokens] = useState<Record<string, number>>({});
  const [freshText, setFreshText] = useState<string | null>(null);

  const projects = board.blocks.filter((b) => b.kind === "project");

  function nextSpot(): Point {
    const n = board.blocks.length;
    return { x: 60 + (n % 4) * 340, y: 60 + Math.floor(n / 4) * 210 };
  }

  async function newProject(at?: Point) {
    const spot = at ?? nextSpot();
    const block = await board.addBlock({
      kind: "project",
      title: "New project",
      x: spot.x,
      y: spot.y,
    });
    if (block) setRenameTokens((prev) => ({ ...prev, [block.id]: (prev[block.id] ?? 0) + 1 }));
  }

  async function newText(at?: Point) {
    const spot = at ?? nextSpot();
    const block = await board.addBlock({ kind: "text", title: "Text", x: spot.x, y: spot.y });
    if (block) setFreshText(block.id);
  }

  function blockMenu(e: React.MouseEvent, block: Block) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: [
        { type: "item", label: "Open project", onSelect: () => router.push(`/projects/${block.id}`) },
        {
          type: "item",
          label: "Rename project",
          onSelect: () =>
            setRenameTokens((prev) => ({ ...prev, [block.id]: (prev[block.id] ?? 0) + 1 })),
        },
        { type: "item", label: "Edit description", onSelect: () => setEditingDesc(block.id) },
        {
          type: "item",
          label: block.minimized ? "Expand" : "Minimize",
          onSelect: () => board.patchBlock(block.id, { minimized: !block.minimized }),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Delete project",
          danger: true,
          onSelect: () => {
            if (confirm(`Delete “${block.title}”?`)) board.removeBlock(block.id);
          },
        },
      ],
    });
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

  return (
    <main className="page">
      <div className="bar">
        <h1>Projects</h1>
        <span className="bar-sub">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
        <div className="bar-actions">
          <button className="btn btn-ghost" onClick={() => newText()}>
            Add text
          </button>
          <button className="btn" onClick={() => newProject()}>
            Add project
          </button>
        </div>
      </div>

      <Board
        blocks={board.blocks}
        empty={board.loading ? "" : "Add a project, or right-click the board."}
        onBackgroundMenu={(e, point) =>
          setMenu({
            x: e.clientX,
            y: e.clientY,
            entries: [
              { type: "item", label: "Add project here", onSelect: () => newProject(point) },
              { type: "item", label: "Add text here", onSelect: () => newText(point) },
            ],
          })
        }
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
          ) : (
            <Window
              key={block.id}
              block={block}
              accent={block.color || undefined}
              renameToken={renameTokens[block.id] ?? 0}
              onChange={(patch) => board.patchBlock(block.id, patch)}
              onFocus={() => board.bringToFront(block.id)}
              onMenu={(e) => blockMenu(e, block)}
            >
              <ProjectWindow
                block={block}
                editingDesc={editingDesc === block.id}
                onStopEditDesc={() => setEditingDesc((cur) => (cur === block.id ? null : cur))}
                onChange={(patch) => board.patchBlock(block.id, patch)}
                onOpen={() => router.push(`/projects/${block.id}`)}
              />
            </Window>
          )
        )}
      </Board>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
    </main>
  );
}
