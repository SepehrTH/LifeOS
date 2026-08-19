import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { addItem } from "@/lib/blocks";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const text = String(body.text ?? "").trim().slice(0, 500);
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const item = addItem(userId, id, text, {
    recurring: body.recurring === true,
    milestone: body.milestone === true,
    dueAt: typeof body.dueAt === "string" ? body.dueAt.slice(0, 10) : "",
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}
