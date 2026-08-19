import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { deleteItem, updateItem } from "@/lib/blocks";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const patch: {
    text?: string;
    done?: boolean;
    recurring?: boolean;
    milestone?: boolean;
    dueAt?: string;
  } = {};
  if (typeof body.text === "string") patch.text = body.text.trim().slice(0, 500);
  if (typeof body.done === "boolean") patch.done = body.done;
  if (typeof body.recurring === "boolean") patch.recurring = body.recurring;
  if (typeof body.milestone === "boolean") patch.milestone = body.milestone;
  if (typeof body.dueAt === "string") patch.dueAt = body.dueAt.slice(0, 10);

  return NextResponse.json({ ok: updateItem(userId, id, patch) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ ok: deleteItem(userId, id) });
}
