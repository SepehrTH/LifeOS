import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { createBlock, listBlocks, type BlockKind } from "@/lib/blocks";
import { projectIdOfTab } from "@/lib/projectTab";

/** 'todo', 'projects', or a single project's own board. */
function resolveTab(raw: unknown): string {
  const tab = String(raw ?? "todo");
  const project = projectIdOfTab(tab);
  if (project && /^[0-9a-f-]{36}$/i.test(project)) return tab;
  return tab === "projects" ? "projects" : "todo";
}

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const tab = resolveTab(url.searchParams.get("tab"));
  const today = url.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  return NextResponse.json({ blocks: listBlocks(userId, tab, today) });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const tab = resolveTab(body.tab);
  const onProjectBoard = !!projectIdOfTab(tab);

  const kind: BlockKind = onProjectBoard
    ? body.kind === "text"
      ? "text"
      : "general"
    : body.kind === "deadlines"
      ? "deadlines"
      : body.kind === "text"
        ? "text"
        : tab === "projects"
          ? "project"
          : body.kind === "daily"
            ? "daily"
            : "general";

  const block = createBlock(userId, {
    tab,
    kind,
    title: String(
      body.title ?? (tab === "projects" && !onProjectBoard ? "New project" : "New list")
    ).slice(0, 120),
    description: String(body.description ?? "").slice(0, 500),
    content: String(body.content ?? ""),
    x: Number.isFinite(body.x) ? Number(body.x) : 60,
    y: Number.isFinite(body.y) ? Number(body.y) : 60,
    today: body.today,
  });

  return NextResponse.json({ block });
}
