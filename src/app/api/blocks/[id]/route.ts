import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { deleteBlock, getBlock, updateBlock } from "@/lib/blocks";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const block = getBlock(userId, id);
  if (!block) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ block });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = updateBlock(userId, id, await req.json());
  return NextResponse.json({ ok });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ ok: deleteBlock(userId, id) });
}
