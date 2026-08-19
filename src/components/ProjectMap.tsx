"use client";

import { useState } from "react";
import Board, { type Point } from "@/components/Board";
import ContextMenu, { type MenuState } from "@/components/ContextMenu";
import TextBlock from "@/components/TextBlock";
import TodoWindow from "@/components/TodoWindow";
import Window from "@/components/Window";
import { mapTabFor } from "@/lib/projectTab";
import { useBoard, type Block, type Item, type ItemPatch } from "@/lib/useBoard";

/**
 * A project's own board. Groups here hold linked copies of the project's todos, so
 * anything added on the board shows up in the left rail and ticks off in both places.
 */
export default function ProjectMap({
  projectId,
  reloadKey,
  onItemsChanged,
}: {
  projectId: string;
  /** Bumped by the rail when it changes something, so the board refetches. */
  reloadKey: number;
  onItemsChanged: () => void;
}) {
  const board = useBoard(mapTabFor(projectId));
  const [menu, setMenu] = useState<MenuState>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [renameTokens, setRenameTokens] = useState<Record<string, number>>({});
  const [freshText, setFreshText] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState(reloadKey);

  if (seenKey !== reloadKey) {
    setSeenKey(reloadKey);
    board.reload();
  }

  function nextSpot(): Point {
    const n = board.blocks.length;
    return { x: 40 + (n % 3) * 300, y: 40 + Math.floor(n / 3) * 260 };
  }

  async function newGroup(at?: Point) {
    const spot = at ?? nextSpot();
    const block = await board.addBlock({
      kind: "general",
      title: "New group",
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

  /**
   * Every write here can touch the rail too, so refresh it — after the write lands, not
   * while it is still in flight.
   */
  async function changed<T>(result: Promise<T> | T): Promise<T> {
    const value = await result;
    onItemsChanged();
    return value;
  }

  function groupMenu(e: React.MouseEvent, block: Block) {
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
        {
          type: "item",
          label: "Rename group",
          onSelect: () =>
            setRenameTokens((prev) => ({ ...prev, [block.id]: (prev[block.id] ?? 0) + 1 })),
        },
        {
          type: "item",
          label: block.minimized ? "Expand" : "Minimize",
          onSelect: () => board.patchBlock(block.id, { minimized: !block.minimized }),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Delete group",
          danger: true,
          onSelect: () => {
            if (
              confirm(
                `Delete “${block.title}”? Its todos stay in the project — only the grouping goes.`
              )
            ) {
              board.removeBlock(block.id);
              onItemsChanged();
            }
          },
        },
      ],
    });
  }

  function itemMenu(e: React.MouseEvent, item: Item) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      entries: [
        {
          type: "item",
          label: "Take off the board",
          onSelect: () => changed(board.removeItem(item.id)),
        },
        { type: "sep" },
        {
          type: "item",
          label: "Delete from the project",
          danger: true,
          onSelect: () => {
            // The board row is a copy; deleting the original removes it everywhere.
            if (confirm(`Delete “${item.text}” from the project entirely?`)) {
              fetch(`/api/items/${item.linkId || item.id}`, { method: "DELETE" }).then(() => {
                board.reload();
                onItemsChanged();
              });
            }
          },
        },
      ],
    });
  }

  return (
    <div className="map">
      <div className="map-bar">
        <span className="rail-section">Map</span>
        <div className="bar-actions">
          <button className="btn btn-ghost" onClick={() => newText()}>
            Add text
          </button>
          <button className="btn" onClick={() => newGroup()}>
            Add group
          </button>
        </div>
      </div>

      <Board
        blocks={board.blocks}
        empty={board.loading ? "" : "Add a group to start arranging this project's todos."}
        onBackgroundMenu={(e, point) =>
          setMenu({
            x: e.clientX,
            y: e.clientY,
            entries: [
              { type: "item", label: "Add group here", onSelect: () => newGroup(point) },
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
              onMenu={(e) => {
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
              }}
            />
          ) : (
            <Window
              key={block.id}
              block={block}
              renameToken={renameTokens[block.id] ?? 0}
              onChange={(patch) => board.patchBlock(block.id, patch)}
              onFocus={() => board.bringToFront(block.id)}
              onMenu={(e) => groupMenu(e, block)}
            >
              <TodoWindow
                block={block}
                adding={addingIn === block.id}
                showOrigin={false}
                onStartAdd={() => setAddingIn(block.id)}
                onStopAdd={() => setAddingIn((cur) => (cur === block.id ? null : cur))}
                onAddItem={(text) => changed(board.addItem(block.id, text))}
                onPatchItem={(itemId: string, patch: ItemPatch) =>
                  changed(board.patchItem(itemId, patch))
                }
                onRemoveItem={(itemId) => changed(board.removeItem(itemId))}
                onItemMenu={itemMenu}
              />
            </Window>
          )
        )}
      </Board>

      <ContextMenu state={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
