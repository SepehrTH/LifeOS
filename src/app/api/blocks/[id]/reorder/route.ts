import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { reorderItems } from "@/lib/blocks";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { ids: string[] } — the block's todos in their new order. */
export async function POST(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  return NextResponse.json({ ok: reorderItems(userId, id, ids) });
}
