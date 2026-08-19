import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { deleteMetric, updateMetric } from "@/lib/metrics";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  return NextResponse.json({ ok: updateMetric(userId, id, await req.json()) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = deleteMetric(userId, id);
  if (!ok) {
    return NextResponse.json({ error: "built-in metrics cannot be deleted" }, { status: 400 });
  }
  return NextResponse.json({ ok });
}
