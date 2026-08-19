import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { sendItemToBlock } from "@/lib/blocks";

type Ctx = { params: Promise<{ id: string }> };

/** Copies a project todo into a Todo-tab box, linked to the original. */
export async function POST(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { blockId } = await req.json();
  if (typeof blockId !== "string") {
    return NextResponse.json({ error: "blockId required" }, { status: 400 });
  }

  const item = sendItemToBlock(userId, id, blockId);
  if (!item) return NextResponse.json({ error: "already there, or not found" }, { status: 409 });
  return NextResponse.json({ item });
}
