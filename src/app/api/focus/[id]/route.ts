import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { deleteSession } from "@/lib/focus";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ ok: deleteSession(userId, id) });
}
